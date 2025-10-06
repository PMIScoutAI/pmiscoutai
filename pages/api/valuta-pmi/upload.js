// /pages/api/valuta-pmi/upload.js
// Valuta-PMI: Upload XBRL, Parse dati finanziari e crea sessione valutazione
// VERSIONE 1.1 - FIX: Corretto lo stato della sessione per rispettare i vincoli del DB.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import xlsx from 'xlsx';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

// ============================================
// UTILITY FUNCTIONS (riusate da analyze-xbrl.js)
// ============================================

const parseValue = (val) => {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    let cleanVal = val.trim();
    const isNegative = cleanVal.startsWith('(') && cleanVal.endsWith(')');
    if (isNegative) cleanVal = '-' + cleanVal.substring(1, cleanVal.length - 1);
    cleanVal = cleanVal
      .replace(/\u00A0/g, '')
      .replace(/['\s]/g, '')
      .replace(/\u2212/g, '-')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const num = parseFloat(cleanVal);
    return isNaN(num) ? null : num;
  }
  return null;
};

const findYearColumns = (sheetData) => {
  const yearRegex = /(19|20)\d{2}/;
  let years = [];
  for (let i = 0; i < Math.min(sheetData.length, 40); i++) {
    const row = sheetData[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').trim();
      const match = cell.match(yearRegex);
      if (match) years.push({ year: parseInt(match[0], 10), col: j });
    }
    if (years.length >= 2) break;
  }
  if (years.length < 2) {
    console.warn("Colonne anni non trovate, uso fallback 3 e 4.");
    return { currentYearCol: 3, previousYearCol: 4 };
  }
  years.sort((a, b) => b.year - a.year);
  return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

const findValueInSheet = (sheetData, searchConfigs, yearCols, metricName) => {
  for (const config of searchConfigs) {
    const primaryTerms = config.primary.map(t => t.toLowerCase().trim());
    const exclusionTerms = (config.exclusion || []).map(t => t.toLowerCase().trim());
    
    for (const row of sheetData) {
      let description = '';
      for (let i = 0; i < Math.min(row.length, 6); i++) {
        description += String(row[i] || '').toLowerCase().trim() + ' ';
      }
      description = description.replace(/\s+/g, ' ').trim();
      
      const allPrimaryFound = primaryTerms.every(term => description.includes(term));
      const anyExclusionFound = exclusionTerms.some(term => description.includes(term));
      
      if (allPrimaryFound && !anyExclusionFound) {
        const result = {
          currentYear: parseValue(row[yearCols.currentYearCol]),
          previousYear: parseValue(row[yearCols.previousYearCol])
        };
        if (result.currentYear !== null || result.previousYear !== null) {
          console.log(`[${metricName}] ✅ Trovato: "${description.substring(0, 50)}..." | N=${result.currentYear}, N-1=${result.previousYear}`);
          return result;
        }
      }
    }
  }
  console.log(`[${metricName}] ⚠️ Non trovato`);
  return { currentYear: null, previousYear: null };
};

const findSimpleValue = (sheetData, searchTexts) => {
  const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
  for (const row of sheetData) {
    for (let j = 0; j < row.length; j++) {
      const cellContent = String(row[j] || '').toLowerCase().trim();
      if (normalizedSearchTexts.some(searchText => cellContent.includes(searchText))) {
        for (let k = j + 1; k < row.length; k++) {
          const valueCell = String(row[k] || '').trim();
          if (valueCell && valueCell !== '' && !normalizedSearchTexts.some(st => valueCell.toLowerCase().includes(st))) {
            return valueCell;
          }
        }
      }
    }
  }
  return null;
};

// ============================================
// FUNZIONE: Estrazione Debiti Finanziari
// ============================================
const findDebitiFinanziari = (sheetData, yearCols, sessionId) => {
  console.log(`[${sessionId}] 🔍 Ricerca Debiti Finanziari (Banche)...`);
  
  let debitiFinanziariML = { currentYear: null, previousYear: null };
  let debitiFinanziariBreve = { currentYear: null, previousYear: null };
  
  let inPassiveSection = false;
  
  for (const row of sheetData) {
    let desc = '';
    for (let i = 0; i < Math.min(row.length, 6); i++) {
      desc += String(row[i] || '').toLowerCase().trim() + ' ';
    }
    desc = desc.replace(/\s+/g, ' ').trim();
    
    if (!inPassiveSection && (desc.includes('d) debiti') || desc.includes('passivo'))) {
      inPassiveSection = true;
      console.log(`[${sessionId}] ✅ Sezione PASSIVO trovata`);
      continue;
    }
    
    if (!inPassiveSection) continue;
    
    const hasBanche = desc.includes('debiti verso banche') || desc.includes('verso banche');
    const hasFinanziatori = desc.includes('altri finanziatori') || desc.includes('finanziamenti');
    
    if (hasBanche || hasFinanziatori) {
      const cur = parseValue(row[yearCols.currentYearCol]);
      const prev = parseValue(row[yearCols.previousYearCol]);
      
      const isMLTermine = desc.includes("esigibili oltre l'esercizio") || desc.includes("oltre l'esercizio successivo");
      const isBreve = desc.includes("esigibili entro l'esercizio") || desc.includes("entro l'esercizio successivo") || desc.includes("quota corrente");
      
      if (isMLTermine) {
        debitiFinanziariML.currentYear = cur;
        debitiFinanziariML.previousYear = prev;
        console.log(`[${sessionId}] 💰 Debiti Finanziari M/L: N=${cur}, N-1=${prev}`);
      } else if (isBreve) {
        debitiFinanziariBreve.currentYear = cur;
        debitiFinanziariBreve.previousYear = prev;
        console.log(`[${sessionId}] 💰 Debiti Finanziari Breve: N=${cur}, N-1=${prev}`);
      } else {
        console.log(`[${sessionId}] ⚠️ Debiti verso banche trovati ma senza scadenza chiara`);
      }
    }
    
    if (desc.startsWith('e) ') || desc.includes('totale passivo')) break;
  }
  
  return {
    ml_termine: debitiFinanziariML,
    breve_termine: debitiFinanziariBreve
  };
};

// ============================================
// CONFIGURAZIONI METRICHE (da analyze-xbrl.js)
// ============================================

const metricsConfigs = {
  fatturato: [
    { primary: ["a) ricavi delle vendite e delle prestazioni"] },
    { primary: ["ricavi delle vendite"] }
  ],
  patrimonioNetto: [
    { primary: ["totale patrimonio netto"] },
    { primary: ["a) patrimonio netto"] }
  ],
  disponibilitaLiquide: [
    { primary: ["disponibilità liquide"] }
  ],
  debitiTotali: [
    { primary: ["totale debiti"] },
    { primary: ["d) debiti"] }
  ],
  utilePerdita: [
    { primary: ["utile (perdita) dell'esercizio"] },
    { primary: ["risultato dell'esercizio"] }
  ],
  imposte: [
    { primary: ["imposte sul reddito dell'esercizio"] },
    { primary: ["imposte sul reddito"] }
  ],
  oneriFinanziari: [
    { primary: ["interessi e altri oneri finanziari"] }
  ],
  ammortamenti: [
    { primary: ["ammortamenti e svalutazioni"] }
  ]
};

// ============================================
// HANDLER PRINCIPALE
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  let sessionId = null;

  try {
    // 1️⃣ AUTENTICAZIONE (Outseta)
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });

    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token non valido' });
    }

    const outsetaUser = await outsetaResponse.json();

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .upsert(
        {
          outseta_user_id: outsetaUser.Uid,
          email: outsetaUser.Email,
          first_name: outsetaUser.FirstName || '',
          last_name: outsetaUser.LastName || ''
        },
        { onConflict: 'outseta_user_id' }
      )
      .select('id')
      .single();

    if (userErr || !userRow?.id) {
      throw new Error('Impossibile autenticare utente');
    }

    const userId = userRow.id;
    console.log(`[Valuta-PMI] Utente autenticato: ${userId}`);

    // 2️⃣ PARSE FORM
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const fileInput = Array.isArray(files?.file) ? files.file[0] : files?.file;
    if (!fileInput) {
      return res.status(400).json({ error: 'Nessun file XBRL caricato' });
    }

    const companyNameRaw = Array.isArray(fields?.companyName) 
      ? fields.companyName[0] 
      : fields?.companyName;
    const companyName = String(companyNameRaw || '').trim() || 'Azienda non specificata';

    console.log(`[Valuta-PMI] File ricevuto: ${fileInput.originalFilename}, Azienda: ${companyName}`);

    // 3️⃣ CREA/TROVA AZIENDA
    const { data: companyRow, error: coErr } = await supabase
      .from('companies')
      .upsert(
        { user_id: userId, company_name: companyName },
        { onConflict: 'user_id,company_name' }
      )
      .select('id')
      .single();

    if (coErr || !companyRow?.id) {
      throw new Error('Impossibile creare azienda');
    }

    // 4️⃣ CREA SESSIONE VALUTAZIONE
    sessionId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { error: sessionError } = await supabase
      .from('valuations')
      .insert({
        session_id: sessionId,
        user_id: userId,
        company_name: companyName,
        status: 'processing' // Stato iniziale valido
      });

    if (sessionError) throw sessionError;

    console.log(`[${sessionId}] Sessione valutazione creata`);

    // 5️⃣ PARSE XBRL
    const fileBuffer = fs.readFileSync(fileInput.filepath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    
    const availableSheets = Object.keys(workbook.Sheets);
    console.log(`[${sessionId}] Fogli disponibili:`, availableSheets.slice(0, 10));

    const balanceSheet = workbook.Sheets['T0002'] || workbook.Sheets['T0001'];
    const incomeStatement = workbook.Sheets['T0006'] || workbook.Sheets['T0005'];
    const companyInfo = workbook.Sheets['T0000'];

    if (!balanceSheet || !incomeStatement) {
      throw new Error('Fogli XBRL mancanti (T0002/T0006 o T0001/T0005)');
    }

    const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1 });
    const companyInfoData = companyInfo ? xlsx.utils.sheet_to_json(companyInfo, { header: 1 }) : [];

    console.log(`[${sessionId}] Dati estratti: SP=${balanceSheetData.length} righe, CE=${incomeStatementData.length} righe`);

    // 6️⃣ ESTRAZIONE DATI
    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    let atecoCode = null;
    if (companyInfoData.length > 0) {
      const atecoRaw = findSimpleValue(companyInfoData, ['settore di attività prevalente', 'codice ateco']);
      if (atecoRaw) {
        const match = atecoRaw.match(/(\d{2})/);
        atecoCode = match ? match[1] : null;
      }
    }
    console.log(`[${sessionId}] ATECO estratto: ${atecoCode || 'N/D'}`);

    const metrics = {
      fatturato: findValueInSheet(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
      patrimonioNetto: findValueInSheet(balanceSheetData, metricsConfigs.patrimonioNetto, yearColsBS, 'PN'),
      disponibilitaLiquide: findValueInSheet(balanceSheetData, metricsConfigs.disponibilitaLiquide, yearColsBS, 'Disponibilità'),
      debitiTotali: findValueInSheet(balanceSheetData, metricsConfigs.debitiTotali, yearColsBS, 'Debiti Totali'),
      utilePerdita: findValueInSheet(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile'),
      imposte: findValueInSheet(incomeStatementData, metricsConfigs.imposte, yearColsIS, 'Imposte'),
      oneriFinanziari: findValueInSheet(incomeStatementData, metricsConfigs.oneriFinanziari, yearColsIS, 'Oneri Finanziari'),
      ammortamenti: findValueInSheet(incomeStatementData, metricsConfigs.ammortamenti, yearColsIS, 'Ammortamenti')
    };
    
    const debitiFinanziari = findDebitiFinanziari(balanceSheetData, yearColsBS, sessionId);
    metrics.debitiFinanziariML = debitiFinanziari.ml_termine;
    metrics.debitiFinanziariBreve = debitiFinanziari.breve_termine;

    const currentYear = {
      utile: metrics.utilePerdita.currentYear || 0,
      imposte: metrics.imposte.currentYear || 0,
      oneriFinanziari: metrics.oneriFinanziari.currentYear || 0,
      ammortamenti: metrics.ammortamenti.currentYear || 0
    };
    const previousYear = {
      utile: metrics.utilePerdita.previousYear || 0,
      imposte: metrics.imposte.previousYear || 0,
      oneriFinanziari: metrics.oneriFinanziari.previousYear || 0,
      ammortamenti: metrics.ammortamenti.previousYear || 0
    };
    metrics.ebitda = {
      currentYear: currentYear.utile + currentYear.imposte + currentYear.oneriFinanziari + currentYear.ammortamenti,
      previousYear: previousYear.utile + previousYear.imposte + previousYear.oneriFinanziari + previousYear.ammortamenti
    };
    console.log(`[${sessionId}] EBITDA calcolato: N=${metrics.ebitda.currentYear}, N-1=${metrics.ebitda.previousYear}`);

    let pfn = { currentYear: null, previousYear: null };
    if (metrics.debitiFinanziariML.currentYear !== null && metrics.debitiFinanziariBreve.currentYear !== null && metrics.disponibilitaLiquide.currentYear !== null) {
      pfn.currentYear = metrics.debitiFinanziariML.currentYear + metrics.debitiFinanziariBreve.currentYear - metrics.disponibilitaLiquide.currentYear;
      console.log(`[${sessionId}] 💰 PFN calcolata automaticamente: ${pfn.currentYear}`);
    }

    // 7️⃣ SALVA DATI E AGGIORNA STATO
    const historicalData = {
      '2024': {
        ricavi: metrics.fatturato.currentYear,
        ebitda: metrics.ebitda.currentYear,
        patrimonio_netto: metrics.patrimonioNetto.currentYear,
        pfn: pfn.currentYear
      },
      '2023': {
        ricavi: metrics.fatturato.previousYear,
        ebitda: metrics.ebitda.previousYear,
        patrimonio_netto: metrics.patrimonioNetto.previousYear,
        pfn: pfn.previousYear
      }
    };

    const { error: updateError } = await supabase
      .from('valuations')
      .update({
        years_analyzed: [2023, 2024],
        historical_data: historicalData,
        sector_ateco: atecoCode,
        // ✅ FIX: Lo stato rimane 'processing' in attesa del prossimo step
        // Questo risolve il "check constraint" violation.
        status: 'processing' 
      })
      .eq('session_id', sessionId);

    if (updateError) throw updateError;

    console.log(`[${sessionId}] ✅ Upload completato con successo`);

    // 8️⃣ RISPOSTA
    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      data: {
        company_name: companyName,
        ateco_code: atecoCode,
        years: [2023, 2024],
        metrics: {
          ricavi_2024: metrics.fatturato.currentYear,
          ebitda_2024: metrics.ebitda.currentYear,
          patrimonio_netto_2024: metrics.patrimonioNetto.currentYear,
          pfn_2024: pfn.currentYear,
          debiti_finanziari_auto_detected: {
            ml_termine: metrics.debitiFinanziariML.currentYear !== null,
            breve_termine: metrics.debitiFinanziariBreve.currentYear !== null
          }
        }
      },
      // Cambiamo il next_step per riflettere il nuovo flusso
      next_step: 'data_review' 
    });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore upload XBRL:`, error);

    if (sessionId) {
      await supabase
        .from('valuations')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('session_id', sessionId);
    }

    return res.status(500).json({
      error: error.message || 'Errore durante l\'upload del file'
    });
  }
}
