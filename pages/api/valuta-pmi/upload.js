// FILE: upload.js - VERSIONE SEMPLIFICATA CORRETTA
// Percorso: pages/api/valuta-pmi/upload.js
// ✅ RIMOZIONE parametri qualitativi da valuation_inputs

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import xlsx from 'xlsx';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

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

const extractAndValidateYears = (balanceSheetData, incomeStatementData, sessionId) => {
  console.log(`[${sessionId}] 📅 Inizio estrazione e validazione anni...`);
  
  const currentYear = new Date().getFullYear();
  
  const tryExtractYearsFromHeader = (sheetData) => {
    for (let row = 0; row < Math.min(3, sheetData.length); row++) {
      for (let col = 2; col <= 6; col++) {
        const cell = String(sheetData[row]?.[col] || '').trim();
        const match = cell.match(/20(\d{2})/);
        if (match) {
          const year = parseInt('20' + match[1], 10);
          if (year >= currentYear - 5 && year <= currentYear) {
            return { year, col, found: true };
          }
        }
      }
    }
    return { found: false };
  };
  
  const extractedBS = tryExtractYearsFromHeader(balanceSheetData);
  
  let yearN, yearN1, colN, colN1;
  let extractionMethod = 'unknown';
  
  if (extractedBS.found) {
    yearN = extractedBS.year;
    yearN1 = yearN - 1;
    colN = extractedBS.col;
    colN1 = extractedBS.col + 1;
    extractionMethod = 'header_extraction';
    console.log(`[${sessionId}]   ✅ Metodo: Estrazione da header`);
  } else {
    yearN = currentYear - 1;
    yearN1 = yearN - 1;
    colN = 3;
    colN1 = 4;
    extractionMethod = 'static_fallback';
    console.log(`[${sessionId}]   🔄 Metodo: Fallback statico`);
  }
  
  return {
    yearCols: {
      currentYearCol: colN,
      previousYearCol: colN1
    },
    years: [yearN1, yearN],
    extractionMethod: extractionMethod
  };
};

const findDebitiFinanziariCivilistico = (sheetData, yearCols, sessionId) => {
  console.log(`[${sessionId}] 🔍 Ricerca Debiti...`);

  let debitiML = { currentYear: 0, previousYear: 0 };
  let debitiBreve = { currentYear: 0, previousYear: 0 };
  let inSezioneDebiti = false;
  let foundAny = false;

  for (const row of sheetData) {
    let desc = '';
    for (let i = 0; i < Math.min(row.length, 6); i++) {
      desc += String(row[i] || '').toLowerCase().trim() + ' ';
    }
    desc = desc.replace(/\s+/g, ' ').trim();

    if (!inSezioneDebiti && (desc.includes('d) debiti') || desc.includes('d. debiti'))) {
      inSezioneDebiti = true;
      console.log(`[${sessionId}]   ✅ Sezione D) DEBITI trovata`);
      continue;
    }

    if (inSezioneDebiti && (desc.match(/^e[\)\.]/))) {
      break;
    }

    if (!inSezioneDebiti) continue;

    const isEntro = /esigibili\s+entro\s+l['']esercizio\s+successivo/i.test(desc);
    const isOltre = /esigibili\s+oltre\s+l['']esercizio\s+successivo/i.test(desc);

    if (isEntro || isOltre) {
      const cur = parseValue(row[yearCols.currentYearCol]);
      const prev = parseValue(row[yearCols.previousYearCol]);

      if (cur !== null || prev !== null) {
        foundAny = true;
        if (isOltre) {
          debitiML.currentYear += (cur || 0);
          debitiML.previousYear += (prev || 0);
        }
        if (isEntro) {
          debitiBreve.currentYear += (cur || 0);
          debitiBreve.previousYear += (prev || 0);
        }
      }
    }
  }

  if (!foundAny || (debitiML.currentYear === 0 && debitiBreve.currentYear === 0)) {
    return {
      breve_termine: { currentYear: null, previousYear: null },
      ml_termine: { currentYear: null, previousYear: null },
      requiresManualEntry: true
    };
  }

  return {
    breve_termine: debitiBreve,
    ml_termine: debitiML,
    requiresManualEntry: false
  };
};

const findValueInSheet = (sheetData, searchConfigs, yearCols, metricName) => {
  for (const config of searchConfigs) {
    const primaryTerms = config.primary.map(t => t.toLowerCase().trim());
    
    for (const row of sheetData) {
      let description = '';
      for (let i = 0; i < Math.min(row.length, 6); i++) {
        description += String(row[i] || '').toLowerCase().trim() + ' ';
      }
      description = description.replace(/\s+/g, ' ').trim();
      
      const allPrimaryFound = primaryTerms.every(term => description.includes(term));
      
      if (allPrimaryFound) {
        const result = {
          currentYear: parseValue(row[yearCols.currentYearCol]),
          previousYear: parseValue(row[yearCols.previousYearCol])
        };
        if (result.currentYear !== null || result.previousYear !== null) {
          return result;
        }
      }
    }
  }
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
  ebitda: [ 
    { primary: ["margine operativo lordo (ebitda)"] },
    { primary: ["ebitda"] }
  ],
  utilePerdita: [
    { primary: ["utile (perdita) dell'esercizio"] }, 
    { primary: ["risultato dell'esercizio"] }
  ],
  imposte: [
    { primary: ["imposte sul reddito dell'esercizio"] }
  ],
  oneriFinanziari: [
    { primary: ["interessi e altri oneri finanziari"] }
  ],
  ammortamenti: [
    { primary: ["ammortamenti e svalutazioni"] }
  ]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  
  let sessionId = null;
  
  try {
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });
    
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userRow } = await supabase
      .from('users')
      .upsert({ 
        outseta_user_id: outsetaUser.Uid, 
        email: outsetaUser.Email, 
        first_name: outsetaUser.FirstName || '', 
        last_name: outsetaUser.LastName || '' 
      }, { onConflict: 'outseta_user_id' })
      .select('id')
      .single();
    
    if (!userRow) throw new Error('Impossibile autenticare utente');

    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const fileInput = files.file?.[0];
    if (!fileInput) return res.status(400).json({ error: 'Nessun file XBRL caricato' });
    
    const fileBuffer = fs.readFileSync(fileInput.filepath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const balanceSheet = workbook.Sheets['T0002'] || workbook.Sheets['T0001'];
    const incomeStatement = workbook.Sheets['T0006'] || workbook.Sheets['T0005'];
    
    if (!balanceSheet || !incomeStatement) {
      throw new Error('Fogli XBRL mancanti');
    }

    const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1 });
    
    const companyName = String(fields.companyName?.[0] || '').trim() || 'Azienda non specificata';
    
    const { data: companyRow } = await supabase
      .from('companies')
      .upsert({ user_id: userRow.id, company_name: companyName }, { onConflict: 'user_id,company_name' })
      .select('id')
      .single();
    
    if (!companyRow) throw new Error('Impossibile creare azienda');
    
    sessionId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await supabase.from('valuations').insert({ 
      session_id: sessionId, 
      user_id: userRow.id, 
      company_name: companyName, 
      status: 'processing' 
    });
    
    console.log(`[${sessionId}] 🚀 Sessione creata`);

    const yearConfig = extractAndValidateYears(balanceSheetData, incomeStatementData, sessionId);
    const yearCols = yearConfig.yearCols;
    const yearsExtracted = yearConfig.years;
    const yearN1 = yearsExtracted[0];
    const yearN = yearsExtracted[1];

    const metrics = {};
    for (const key in metricsConfigs) {
      const isBalanceSheetMetric = ['patrimonioNetto', 'disponibilitaLiquide'].includes(key);
      const sheet = isBalanceSheetMetric ? balanceSheetData : incomeStatementData;
      metrics[key] = findValueInSheet(sheet, metricsConfigs[key], yearCols, key);
    }

    const calculateEbitdaSafely = (utile, imposte, oneri, ammortamenti) => {
      if (utile === null) return null;
      return utile + (imposte || 0) + (oneri || 0) + (ammortamenti || 0);
    };

    const calculatedEbitda = {
      currentYear: calculateEbitdaSafely(
        metrics.utilePerdita.currentYear,
        metrics.imposte.currentYear,
        metrics.oneriFinanziari.currentYear,
        metrics.ammortamenti.currentYear
      ),
      previousYear: calculateEbitdaSafely(
        metrics.utilePerdita.previousYear,
        metrics.imposte.previousYear,
        metrics.oneriFinanziari.previousYear,
        metrics.ammortamenti.previousYear
      )
    };

    const debitiFinanziari = findDebitiFinanziariCivilistico(balanceSheetData, yearCols, sessionId);

    const ebitdaN = metrics.ebitda.currentYear ?? calculatedEbitda.currentYear;
    const ebitdaN1 = metrics.ebitda.previousYear ?? calculatedEbitda.previousYear;

    const historicalData = {};
    historicalData[yearN1] = {
      ricavi: metrics.fatturato.previousYear,
      ebitda: ebitdaN1,
      patrimonio_netto: metrics.patrimonioNetto.previousYear,
      debiti_finanziari_ml: debitiFinanziari.ml_termine.previousYear,
      debiti_finanziari_breve: debitiFinanziari.breve_termine.previousYear,
      disponibilita_liquide: metrics.disponibilitaLiquide.previousYear,
      imposte: metrics.imposte.previousYear,
      oneriFinanziari: metrics.oneriFinanziari.previousYear,
      ammortamenti: metrics.ammortamenti.previousYear
    };

    historicalData[yearN] = {
      ricavi: metrics.fatturato.currentYear,
      ebitda: ebitdaN,
      patrimonio_netto: metrics.patrimonioNetto.currentYear,
      debiti_finanziari_ml: debitiFinanziari.ml_termine.currentYear,
      debiti_finanziari_breve: debitiFinanziari.breve_termine.currentYear,
      disponibilita_liquide: metrics.disponibilitaLiquide.currentYear,
      imposte: metrics.imposte.currentYear,
      oneriFinanziari: metrics.oneriFinanziari.currentYear,
      ammortamenti: metrics.ammortamenti.currentYear
    };

    // ✅ CORRETTO: Nessun parametro qualitativo iniziale
    // Il settore e la dimensione verranno impostati dall'utente nel form
    const valuationInputs = {};

    const { error: updateError } = await supabase
      .from('valuations')
      .update({
        years_analyzed: yearsExtracted,
        historical_data: historicalData,
        valuation_inputs: valuationInputs,
        status: debitiFinanziari.requiresManualEntry ? 'data_entry' : 'complete'
      })
      .eq('session_id', sessionId);
    
    if (updateError) throw updateError;
    
    console.log(`[${sessionId}] ✅ Dati salvati`);
    
    return res.status(200).json({ 
      success: true, 
      sessionId: sessionId,
      companyName: companyName,
      years: yearsExtracted
    });

  } catch (error) {
    console.error(`Error:`, error);
    if (sessionId) {
      await supabase
        .from('valuations')
        .update({ status: 'failed', error_message: error.message })
        .eq('session_id', sessionId);
    }
    return res.status(500).json({ error: error.message || "Errore durante l'upload" });
  }
}
