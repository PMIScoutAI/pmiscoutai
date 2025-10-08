// /pages/api/valuta-pmi/upload.js
// Valuta-PMI: Upload XBRL, Parse dati finanziari e crea sessione valutazione
// VERSIONE SEMPLIFICATA E CORRETTA

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
// FUNZIONI UTILITY
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

// ============================================
// ESTRAZIONE ANNI SEMPLIFICATA
// ============================================
const findYearColumns = (sheetData) => {
  console.log('🔍 Ricerca colonne degli anni (solo pattern anno civile)...');
  const yearPattern = /\b20\d{2}\b/; // Solo anni tipo 2023, 2024
  let foundYears = [];
  // Cerca SOLO nelle prime 15 righe (header)
  for (let i = 0; i < Math.min(sheetData.length, 15); i++) {
    const row = sheetData[i];
    for (let j = 2; j < row.length; j++) {
      const cell = String(row[j] ?? '').trim();
      const match = cell.match(yearPattern);
      if (match) {
        const year = parseInt(match[0], 10);
        const currentYear = new Date().getFullYear();
        // Verifica che l'anno sia sensato (tra 2015 e anno corrente + 1)
        if (year >= 2015 && year <= currentYear + 1) {
          // Evita duplicati
          if (!foundYears.find(y => y.year === year)) {
            foundYears.push({ year, col: j });
            console.log(`  ✅ Anno ${year} trovato in colonna ${j}`);
          }
        }
      }
    }
  }
  // Fallback se non trova almeno 2 anni
  if (foundYears.length < 2) {
    console.warn('⚠️ Anni non trovati, uso colonne di default');
    const currentYear = new Date().getFullYear();
    return {
      currentYearCol: 3,
      previousYearCol: 4,
      years: [
        { year: currentYear - 1, col: 4 },
        { year: currentYear, col: 3 }
      ]
    };
  }
  // Ordina per anno DECRESCENTE e prendi i 2 più recenti
  foundYears.sort((a, b) => b.year - a.year);
  const twoMostRecent = foundYears.slice(0, 2);
  // Riordina in modo che [0] sia il vecchio, [1] sia il nuovo
  twoMostRecent.sort((a, b) => a.year - b.year);
  console.log(`✅ Anni selezionati: ${twoMostRecent[0].year} (col ${twoMostRecent[0].col}), ${twoMostRecent[1].year} (col ${twoMostRecent[1].col})`);
  return {
    currentYearCol: twoMostRecent[1].col,    // Anno più recente
    previousYearCol: twoMostRecent[0].col,   // Anno precedente
    years: twoMostRecent
  };
};

// ============================================
// ESTRAZIONE NOME AZIENDA DA XBRL
// ============================================

const extractCompanyName = (companyInfoData) => {
  console.log('🏢 Ricerca nome azienda...');
  
  const searchTerms = [
    'denominazione',
    'ragione sociale',
    'nome della ditta',
    'nome impresa',
    'ditta',
    'società'
  ];
  
  for (const row of companyInfoData) {
    for (let i = 0; i < row.length; i++) {
      const cell = String(row[i] || '').toLowerCase().trim();
      
      // Controlla se la cella contiene uno dei termini di ricerca
      if (searchTerms.some(term => cell.includes(term))) {
        // Il nome dovrebbe essere nella cella successiva
        for (let j = i + 1; j < row.length; j++) {
          const valueCell = String(row[j] || '').trim();
          
          // Esclude celle vuote, numeri puri, date, codici fiscali
          if (valueCell && 
              valueCell.length > 3 && 
              valueCell.length < 100 &&
              !/^\d+$/.test(valueCell) && // Non solo numeri
              !/^\d{2}\/\d{2}\/\d{4}$/.test(valueCell)) { // Non date
            
            console.log(`  ✅ Nome azienda trovato: "${valueCell}"`);
            return valueCell;
          }
        }
      }
    }
  }
  
  console.log('  ⚠️ Nome azienda non trovato nel file XBRL');
  return null;
};

// ============================================
// PARSING DEBITI CIVILISTICO - VERSIONE CONFORME
// ============================================
const findDebitiFinanziariCivilistico = (sheetData, yearCols, sessionId) => {
  console.log(`[${sessionId}] 🔍 Ricerca Debiti secondo schema civilistico italiano...`);
  let debitiML = { currentYear: 0, previousYear: 0 };
  let debitiBreve = { currentYear: 0, previousYear: 0 };
  let inSezioneDebiti = false;
  let foundAny = false;
  for (const row of sheetData) {
    // Concatena le prime colonne per formare la descrizione
    let desc = '';
    for (let i = 0; i < Math.min(row.length, 6); i++) {
      desc += String(row[i] || '').toLowerCase().trim() + ' ';
    }
    desc = desc.replace(/\s+/g, ' ').trim();
    // STEP 1: Trova la sezione D) DEBITI
    if (!inSezioneDebiti && (
        desc.includes('d) debiti') ||
        desc.includes('d. debiti') ||
        desc.includes('d)debiti') ||
        desc.includes('d debiti')
    )) {
      inSezioneDebiti = true;
      console.log(`[${sessionId}]   ✅ Sezione D) DEBITI trovata`);
      continue;
    }
    // STEP 2: Esci se arrivi alla sezione successiva
    if (inSezioneDebiti && (
        desc.match(/^e[\)\.]/) ||
        desc.includes('totale passivo') ||
        desc.includes('totale passività')
    )) {
      console.log(`[${sessionId}]   ℹ️ Fine sezione debiti`);
      break;
    }
    if (!inSezioneDebiti) continue;
    // STEP 3: Usa REGEX UFFICIALI per "entro" e "oltre"
    const isEntro = /esigibili\s+entro\s+l['']esercizio\s+successivo/i.test(desc);
    const isOltre = /esigibili\s+oltre\s+l['']esercizio\s+successivo/i.test(desc);
    // STEP 4: Se la riga contiene "entro" o "oltre", estrai i valori
    if (isEntro || isOltre) {
      const cur = parseValue(row[yearCols.currentYearCol]);
      const prev = parseValue(row[yearCols.previousYearCol]);
      if (cur !== null || prev !== null) {
        foundAny = true;
        if (isOltre) {
          debitiML.currentYear += (cur || 0);
          debitiML.previousYear += (prev || 0);
          console.log(`[${sessionId}]   └─ M/L: N=${cur}, N-1=${prev} | "${desc.substring(0, 50)}..."`);
        }
        if (isEntro) {
          debitiBreve.currentYear += (cur || 0);
          debitiBreve.previousYear += (prev || 0);
          console.log(`[${sessionId}]   └─ Breve: N=${cur}, N-1=${prev} | "${desc.substring(0, 50)}..."`);
        }
      }
    }
  }
  // STEP 5: Se non trova NESSUN debito, ritorna null + flag
  if (!foundAny || (debitiML.currentYear === 0 && debitiBreve.currentYear === 0)) {
    console.log(`[${sessionId}]   ⚠️ Debiti non trovati → richiede input manuale`);
    return {
      breve_termine: { currentYear: null, previousYear: null },
      ml_termine: { currentYear: null, previousYear: null },
      requiresManualEntry: true
    };
  }
  console.log(`[${sessionId}]   ✅ Debiti M/L: N=${debitiML.currentYear}, N-1=${debitiML.previousYear}`);
  console.log(`[${sessionId}]   ✅ Debiti Breve: N=${debitiBreve.currentYear}, N-1=${debitiBreve.previousYear}`);
  return {
    breve_termine: debitiBreve,
    ml_termine: debitiML,
    requiresManualEntry: false
  };
};

// ============================================
// FUNZIONI DI RICERCA ALTRE METRICHE
// ============================================

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
          console.log(`[${metricName}] Trovato: "${description.substring(0, 50)}..." | N=${result.currentYear}, N-1=${result.previousYear}`);
          return result;
        }
      }
    }
  }
  console.log(`[${metricName}] Non trovato`);
  return { currentYear: null, previousYear: null };
};

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
// HANDLER PRINCIPALE
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  
  let sessionId = null;
  
  try {
    // 1. AUTENTICAZIONE
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });
    
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userRow } = await supabase
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
    
    if (!userRow) throw new Error('Impossibile autenticare utente');

    // 2. PARSE FORM
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const fileInput = files.file?.[0];
    if (!fileInput) return res.status(400).json({ error: 'Nessun file XBRL caricato' });
    
    // 3. LEGGI FILE XBRL
    const fileBuffer = fs.readFileSync(fileInput.filepath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const balanceSheet = workbook.Sheets['T0002'] || workbook.Sheets['T0001'];
    const incomeStatement = workbook.Sheets['T0006'] || workbook.Sheets['T0005'];
    const companyInfo = workbook.Sheets['T0000'];
    
    if (!balanceSheet || !incomeStatement) {
      throw new Error('Fogli XBRL mancanti (T0002/T0006 o T0001/T0005)');
    }

    const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1 });
    const companyInfoData = companyInfo ? xlsx.utils.sheet_to_json(companyInfo, { header: 1 }) : [];
    
    // 4. ESTRAI NOME AZIENDA
    let companyName = extractCompanyName(companyInfoData);
    
    // Fallback: usa il nome inserito manualmente dall'utente
    if (!companyName) {
      companyName = String(fields.companyName?.[0] || '').trim() || 'Azienda non specificata';
      console.log(`⚠️ Nome azienda da input manuale: "${companyName}"`);
    }
    
    // 5. CREA AZIENDA
    const { data: companyRow } = await supabase
      .from('companies')
      .upsert(
        { user_id: userRow.id, company_name: companyName }, 
        { onConflict: 'user_id,company_name' }
      )
      .select('id')
      .single();
    
    if (!companyRow) throw new Error('Impossibile creare azienda');
    
    // 6. CREA SESSIONE
    sessionId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await supabase
      .from('valuations')
      .insert({ 
        session_id: sessionId, 
        user_id: userRow.id, 
        company_name: companyName, 
        status: 'processing' 
      });
    
    console.log(`[${sessionId}] 🚀 Sessione valutazione creata per "${companyName}"`);

    // 7. TROVA ANNI (VERSIONE SEMPLIFICATA)
    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);
    const yearsExtracted = yearColsBS.years.map(y => y.year);
    console.log(`[${sessionId}] 📅 Anni estratti:`, yearsExtracted);
    console.log(`[${sessionId}] 📊 Colonne: N=${yearColsBS.currentYearCol}, N-1=${yearColsBS.previousYearCol}`);

    // 8. ESTRAI ATECO
    const atecoRaw = companyInfoData.length > 0 
      ? findSimpleValue(companyInfoData, ['settore di attività prevalente', 'codice ateco']) 
      : null;
    const atecoCode = atecoRaw?.match(/(\d{2})/)?.[1] || null;
    console.log(`[${sessionId}] 🏢 ATECO estratto: ${atecoCode}`);

    // 9. ESTRAI METRICHE
    const metrics = {};
    for (const key in metricsConfigs) {
      metrics[key] = findValueInSheet(
        ['patrimonioNetto', 'disponibilitaLiquide'].includes(key) ? balanceSheetData : incomeStatementData,
        metricsConfigs[key],
        ['patrimonioNetto', 'disponibilitaLiquide'].includes(key) ? yearColsBS : yearColsIS,
        key
      );
    }
    
    // 10. ESTRAI DEBITI FINANZIARI
    const debitiFinanziari = findDebitiFinanziariCivilistico(balanceSheetData, yearColsBS, sessionId);
    
    // 11. CALCOLA EBITDA
    const ebitda = {
      currentYear: (metrics.utilePerdita.currentYear || 0) + (metrics.imposte.currentYear || 0) + (metrics.oneriFinanziari.currentYear || 0) + (metrics.ammortamenti.currentYear || 0),
      previousYear: (metrics.utilePerdita.previousYear || 0) + (metrics.imposte.previousYear || 0) + (metrics.oneriFinanziari.previousYear || 0) + (metrics.ammortamenti.previousYear || 0)
    };
    
    console.log(`[${sessionId}] 💰 EBITDA calcolato: N=${ebitda.currentYear}, N-1=${ebitda.previousYear}`);
    
    // 12. CALCOLA PFN (usa null se debiti non trovati)
    const pfn = {
      currentYear: debitiFinanziari.ml_termine.currentYear !== null && debitiFinanziari.breve_termine.currentYear !== null
        ? (debitiFinanziari.ml_termine.currentYear || 0) + (debitiFinanziari.breve_termine.currentYear || 0) - (metrics.disponibilitaLiquide.currentYear || 0)
        : null,
      previousYear: debitiFinanziari.ml_termine.previousYear !== null && debitiFinanziari.breve_termine.previousYear !== null
        ? (debitiFinanziari.ml_termine.previousYear || 0) + (debitiFinanziari.breve_termine.previousYear || 0) - (metrics.disponibilitaLiquide.previousYear || 0)
        : null
    };
    
    console.log(`[${sessionId}] 📊 PFN calcolata: N=${pfn.currentYear}, N-1=${pfn.previousYear}`);

    // 13. PREPARA DATI STORICI
    const yearN_1 = yearsExtracted[0];
    const yearN = yearsExtracted[1];
    
    const historicalData = {
      [yearN]: {
        ricavi: metrics.fatturato.currentYear,
        ebitda: ebitda.currentYear,
        patrimonio_netto: metrics.patrimonioNetto.currentYear,
        debiti_finanziari_ml: debitiFinanziari.ml_termine.currentYear,
        debiti_finanziari_breve: debitiFinanziari.breve_termine.currentYear,
        disponibilita_liquide: metrics.disponibilitaLiquide.currentYear,
        pfn: pfn.currentYear
      },
      [yearN_1]: {
        ricavi: metrics.fatturato.previousYear,
        ebitda: ebitda.previousYear,
        patrimonio_netto: metrics.patrimonioNetto.previousYear,
        debiti_finanziari_ml: debitiFinanziari.ml_termine.previousYear,
        debiti_finanziari_breve: debitiFinanziari.breve_termine.previousYear,
        disponibilita_liquide: metrics.disponibilitaLiquide.previousYear,
        pfn: pfn.previousYear
      }
    };
    
    const valuationInputs = {
      market_position: 'follower',
      customer_concentration: 'medium',
      technology_risk: 'medium'
    };
    
    // 14. SALVA DATI (con status condizionale)
    const { error: updateError } = await supabase
      .from('valuations')
      .update({
        years_analyzed: yearsExtracted,
        historical_data: historicalData,
        valuation_inputs: valuationInputs,
        sector_ateco: atecoCode,
        status: debitiFinanziari.requiresManualEntry ? 'data_entry' : 'complete'  // ✅ MODIFICA QUESTA RIGA
      })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error(`[${sessionId}] ❌ Errore update:`, updateError);
      throw updateError;
    }
    
    console.log(`[${sessionId}] ✅ Dati salvati correttamente su Supabase`);
    
    return res.status(200).json({ 
      success: true, 
      sessionId: sessionId,
      companyName: companyName,
      years: yearsExtracted
    });

  } catch (error) {
    console.error(`[${sessionId || 'NO_SESSION'}] ❌ Errore upload XBRL:`, error);
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
      error: error.message || "Errore durante l'upload del file" 
    });
  }
}
