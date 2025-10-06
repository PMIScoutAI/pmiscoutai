// /pages/api/valuta-pmi/upload.js
// Valuta-PMI: Upload XBRL, Parse dati finanziari e crea sessione valutazione
// VERSIONE 2.1 - Salva i componenti della PFN e rimuove 'management_quality' di default.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import xlsx from 'xlsx';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

// ... [Funzioni Utility invariate: parseValue, findYearColumns, etc. ] ...
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
    return { currentYearCol: 3, previousYearCol: 4, years: [] };
  }
  years.sort((a, b) => b.year - a.year);
  return { currentYearCol: years[0].col, previousYearCol: years[1].col, years: [years[1].year, years[0].year] };
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
        debitiFinanziariML.currentYear = (debitiFinanziariML.currentYear || 0) + (cur || 0);
        debitiFinanziariML.previousYear = (debitiFinanziariML.previousYear || 0) + (prev || 0);
      } else if (isBreve) {
        debitiFinanziariBreve.currentYear = (debitiFinanziariBreve.currentYear || 0) + (cur || 0);
        debitiFinanziariBreve.previousYear = (debitiFinanziariBreve.previousYear || 0) + (prev || 0);
      } else {
        console.log(`[${sessionId}] ⚠️ Debiti verso banche trovati ma senza scadenza chiara, sommati a breve termine per prudenza.`);
        debitiFinanziariBreve.currentYear = (debitiFinanziariBreve.currentYear || 0) + (cur || 0);
        debitiFinanziariBreve.previousYear = (debitiFinanziariBreve.previousYear || 0) + (prev || 0);
      }
    }
    
    if (desc.startsWith('e) ') || desc.includes('totale passivo')) break;
  }

  console.log(`[${sessionId}] 💰 Debiti Finanziari M/L: N=${debitiFinanziariML.currentYear}, N-1=${debitiFinanziariML.previousYear}`);
  console.log(`[${sessionId}] 💰 Debiti Finanziari Breve: N=${debitiFinanziariBreve.currentYear}, N-1=${debitiFinanziariBreve.previousYear}`);
  
  return { ml_termine: debitiFinanziariML, breve_termine: debitiFinanziariBreve };
};

const metricsConfigs = {
  fatturato: [{ primary: ["a) ricavi delle vendite e delle prestazioni"] }, { primary: ["ricavi delle vendite"] }],
  patrimonioNetto: [{ primary: ["totale patrimonio netto"] }, { primary: ["a) patrimonio netto"] }],
  disponibilitaLiquide: [{ primary: ["disponibilità liquide"] }],
  utilePerdita: [{ primary: ["utile (perdita) dell'esercizio"] }, { primary: ["risultato dell'esercizio"] }],
  imposte: [{ primary: ["imposte sul reddito dell'esercizio"] }, { primary: ["imposte sul reddito"] }],
  oneriFinanziari: [{ primary: ["interessi e altri oneri finanziari"] }],
  ammortamenti: [{ primary: ["ammortamenti e svalutazioni"] }]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  let sessionId = null;
  try {
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', { headers: { Authorization: `Bearer ${outsetaToken}` } });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
    const outsetaUser = await outsetaResponse.json();
    const { data: userRow } = await supabase.from('users').upsert({ outseta_user_id: outsetaUser.Uid, email: outsetaUser.Email, first_name: outsetaUser.FirstName || '', last_name: outsetaUser.LastName || '' }, { onConflict: 'outseta_user_id' }).select('id').single();
    if (!userRow) throw new Error('Impossibile autenticare utente');

    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const fileInput = files.file?.[0];
    if (!fileInput) return res.status(400).json({ error: 'Nessun file XBRL caricato' });
    const companyName = String(fields.companyName?.[0] || '').trim() || 'Azienda non specificata';
    const { data: companyRow } = await supabase.from('companies').upsert({ user_id: userRow.id, company_name: companyName }, { onConflict: 'user_id,company_name' }).select('id').single();
    if (!companyRow) throw new Error('Impossibile creare azienda');
    
    sessionId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await supabase.from('valuations').insert({ session_id: sessionId, user_id: userRow.id, company_name: companyName, status: 'processing' });
    console.log(`[${sessionId}] Sessione valutazione creata`);

    const fileBuffer = fs.readFileSync(fileInput.filepath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const balanceSheet = workbook.Sheets['T0002'] || workbook.Sheets['T0001'];
    const incomeStatement = workbook.Sheets['T0006'] || workbook.Sheets['T0005'];
    const companyInfo = workbook.Sheets['T0000'];
    if (!balanceSheet || !incomeStatement) throw new Error('Fogli XBRL mancanti');

    const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1 });
    const companyInfoData = companyInfo ? xlsx.utils.sheet_to_json(companyInfo, { header: 1 }) : [];
    
    const { years, ...yearColsBS } = findYearColumns(balanceSheetData);
    const { years: isYears, ...yearColsIS } = findYearColumns(incomeStatementData);

    const atecoRaw = companyInfoData.length > 0 ? findSimpleValue(companyInfoData, ['settore di attività prevalente', 'codice ateco']) : null;
    const atecoCode = atecoRaw?.match(/(\d{2})/)?.[1] || null;

    const metrics = {};
    for (const key in metricsConfigs) {
        metrics[key] = findValueInSheet(
            ['patrimonioNetto', 'disponibilitaLiquide'].includes(key) ? balanceSheetData : incomeStatementData,
            metricsConfigs[key],
            ['patrimonioNetto', 'disponibilitaLiquide'].includes(key) ? yearColsBS : yearColsIS,
            key
        );
    }
    
    const debitiFinanziari = findDebitiFinanziari(balanceSheetData, yearColsBS, sessionId);
    
    const ebitda = {
        currentYear: (metrics.utilePerdita.currentYear || 0) + (metrics.imposte.currentYear || 0) + (metrics.oneriFinanziari.currentYear || 0) + (metrics.ammortamenti.currentYear || 0),
        previousYear: (metrics.utilePerdita.previousYear || 0) + (metrics.imposte.previousYear || 0) + (metrics.oneriFinanziari.previousYear || 0) + (metrics.ammortamenti.previousYear || 0)
    };
    
    const pfn = {
      currentYear: (debitiFinanziari.ml_termine.currentYear || 0) + (debitiFinanziari.breve_termine.currentYear || 0) - (metrics.disponibilitaLiquide.currentYear || 0),
      previousYear: (debitiFinanziari.ml_termine.previousYear || 0) + (debitiFinanziari.breve_termine.previousYear || 0) - (metrics.disponibilitaLiquide.previousYear || 0)
    };

    const [yearN_1, yearN] = years.length === 2 ? years : [new Date().getFullYear() - 1, new Date().getFullYear()];

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
    
    // Rimuove 'management_quality' dai valori di default
    const valuationInputs = {
        market_position: 'follower',
        customer_concentration: 'medium',
        technology_risk: 'medium'
    };
    
    await supabase.from('valuations').update({
        years_analyzed: years,
        historical_data: historicalData,
        valuation_inputs: valuationInputs,
        sector_ateco: atecoCode,
        status: 'data_entry'
    }).eq('session_id', sessionId);
    
    console.log(`[${sessionId}] ✅ Dati iniziali salvati. Pronto per step 2.`);
    return res.status(200).json({ success: true, sessionId: sessionId });
  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore upload XBRL:`, error);
    if (sessionId) {
      await supabase.from('valuations').update({ status: 'failed', error_message: error.message }).eq('session_id', sessionId);
    }
    return res.status(500).json({ error: error.message || 'Errore durante l'upload del file' });
  }
}

