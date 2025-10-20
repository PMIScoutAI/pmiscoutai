// /pages/api/valuta-pmi/[action].js
// API UNIFICATA per Valuta-PMI: upload, calculate, get-session
// VERSIONE UNIFIED 1.0 - Piano Gratuito Vercel

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import xlsx from 'xlsx';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// ROUTER PRINCIPALE
// ============================================
export default async function handler(req, res) {
  const { action } = req.query;

  try {
    switch (action) {
      case 'upload':
        return await handleUpload(req, res);
      case 'calculate':
        return await handleCalculate(req, res);
      case 'get-session':
        return await handleGetSession(req, res);
      default:
        return res.status(404).json({ error: 'Action non valida' });
    }
  } catch (error) {
    console.error(`[valuta-pmi/${action}] Errore:`, error);
    return res.status(500).json({ error: error.message || 'Errore interno' });
  }
}

// Disabilita bodyParser solo per upload
export const config = { 
  api: { 
    bodyParser: false 
  } 
};

// ============================================
// HANDLER 1: GET-SESSION
// ============================================
async function handleGetSession(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const outsetaToken = req.headers.authorization?.split(' ')[1];
  if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });

  const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', {
    headers: { Authorization: `Bearer ${outsetaToken}` }
  });
  if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
  
  const outsetaUser = await outsetaResponse.json();
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('outseta_user_id', outsetaUser.Uid)
    .single();
  
  if (userErr || !userRow) throw new Error('Utente non trovato');

  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId mancante' });

  const { data: valuationData, error: valuationError } = await supabase
    .from('valuations')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userRow.id)
    .single();

  if (valuationError || !valuationData) {
    return res.status(404).json({ error: 'Sessione non trovata' });
  }

  return res.status(200).json({ success: true, data: valuationData });
}

// ============================================
// HANDLER 2: CALCULATE
// ============================================
async function handleCalculate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId, updatedData, valuationInputs } = req.body;
  if (!sessionId || !updatedData || !valuationInputs) {
    return res.status(400).json({ error: 'Dati incompleti' });
  }

  const outsetaToken = req.headers.authorization?.split(' ')[1];
  if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });
  
  const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', { 
    headers: { Authorization: `Bearer ${outsetaToken}` } 
  });
  if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
  
  const outsetaUser = await outsetaResponse.json();
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('outseta_user_id', outsetaUser.Uid)
    .single();
  
  if (!userRow) throw new Error('Utente non autorizzato');

  const { data: session, error: sessionError } = await supabase
    .from('valuations')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userRow.id)
    .single();
  
  if (sessionError) throw new Error('Sessione non trovata');

  // LOGICA CALCOLO (estratta da calculate.js)
  const years = session.years_analyzed.sort((a,b) => b-a);
  const yearN = years[0];
  const yearN1 = years[1];
  const dataN = updatedData[yearN];
  const dataN1 = updatedData[yearN1];
  
  const settore = getSettoreMultiples(valuationInputs.settore);
  const multiploEbitda = settore.ev_ebitda;
  const evBase = dataN.ebitda * multiploEbitda;
  
  const scontoLiquidita = calculateLiquidityDiscount(valuationInputs.dimensione, settore.liquidita);
  const evPostSconto = evBase * (1 - scontoLiquidita);
  
  const { factors, totalAdjustment } = calculateEVAdjustments(valuationInputs, dataN, dataN1);
  const evAggiustato = evPostSconto * (1 + totalAdjustment);
  
  const equityValueLordo = evAggiustato - dataN.pfn;
  const concentrationAdj = calculateCustomerConcentrationAdjustment(valuationInputs.customer_concentration);
  const equityValueNetto = equityValueLordo * (1 + concentrationAdj);
  
  const results = {
    fair_market_value: Math.round(equityValueNetto),
    conservative_value: Math.round(equityValueNetto * 0.85),
    optimistic_value: Math.round(equityValueNetto * 1.15),
    calculation_details: {
      step1_ev_base: Math.round(evBase),
      step1_multiplo: multiploEbitda,
      step2_sconto_liquidita_pct: parseFloat((scontoLiquidita * 100).toFixed(1)),
      step2_ev_post_sconto: Math.round(evPostSconto),
      step3_fattori_ev: {
        crescita_ricavi: parseFloat((factors.growth * 100).toFixed(1)),
        margine_lordo: parseFloat((factors.margin * 100).toFixed(1)),
        posizione_mercato: parseFloat((factors.market_position * 100).toFixed(1)),
        indebitamento: parseFloat((factors.debt * 100).toFixed(1)),
        rischio_tecnologico: parseFloat((factors.tech_risk * 100).toFixed(1)),
        totale: parseFloat((totalAdjustment * 100).toFixed(1))
      },
      step3_ev_aggiustato: Math.round(evAggiustato),
      step4_pfn_sottratta: Math.round(dataN.pfn),
      step4_equity_lordo: Math.round(equityValueLordo),
      step5_concentrazione_clienti_pct: parseFloat((concentrationAdj * 100).toFixed(1)),
      step5_equity_netto: Math.round(equityValueNetto),
      settore: {
        nome: settore.nome,
        multiplo_ebitda: settore.ev_ebitda,
        liquidita: settore.liquidita
      },
      dimensione_azienda: valuationInputs.dimensione,
      inputs_used: {
        ...dataN,
        ...valuationInputs,
        ricavi_n1: dataN1?.ricavi,
        crescita_ricavi_pct: dataN1?.ricavi ? parseFloat((((dataN.ricavi - dataN1.ricavi) / dataN1.ricavi) * 100).toFixed(1)) : null,
        debt_ebitda_ratio: dataN.ebitda ? parseFloat(((dataN.debiti_finanziari_ml + dataN.debiti_finanziari_breve) / dataN.ebitda).toFixed(2)) : null
      }
    }
  };
  
  const { error: updateError } = await supabase
    .from('valuations')
    .update({
      historical_data: updatedData,
      valuation_inputs: valuationInputs,
      results_data: results,
      status: 'completed'
    })
    .eq('session_id', sessionId);
    
  if (updateError) throw updateError;
  
  return res.status(200).json({ success: true, results });
}

// ============================================
// HANDLER 3: UPLOAD (LOGICA COMPLETA)
// ============================================
async function handleUpload(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  
  let sessionId = null;
  
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
  const companyInfo = workbook.Sheets['T0000'];
  
  if (!balanceSheet || !incomeStatement) {
    throw new Error('Fogli XBRL mancanti');
  }

  const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1 });
  const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1 });
  const companyInfoData = companyInfo ? xlsx.utils.sheet_to_json(companyInfo, { header: 1 }) : [];
  
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
  
  // ESTRAZIONE ANNI E DATI (usa le funzioni helper sotto)
  const yearConfig = extractAndValidateYears(balanceSheetData, incomeStatementData, sessionId);
  const yearCols = yearConfig.yearCols;
  const yearsExtracted = yearConfig.years;

  const atecoRaw = companyInfoData.length > 0 ? findSimpleValue(companyInfoData, ['settore di attività prevalente', 'codice ateco']) : null;
  const atecoCode = atecoRaw?.match(/(\d{2})/)?.[1] || null;

  const metrics = {};
  for (const key in metricsConfigs) {
    const isBalanceSheetMetric = ['patrimonioNetto', 'disponibilitaLiquide'].includes(key);
    const sheet = isBalanceSheetMetric ? balanceSheetData : incomeStatementData;
    metrics[key] = findValueInSheet(sheet, metricsConfigs[key], yearCols, key);
  }

  const calculatedEbitda = {
    currentYear: calculateEbitdaSafely(
      metrics.utilePerdita.currentYear,
      metrics.imposte.currentYear,
      metrics.oneriFinanziari.currentYear,
      metrics.ammortamenti.currentYear,
      'N'
    ),
    previousYear: calculateEbitdaSafely(
      metrics.utilePerdita.previousYear,
      metrics.imposte.previousYear,
      metrics.oneriFinanziari.previousYear,
      metrics.ammortamenti.previousYear,
      'N-1'
    )
  };

  const debitiFinanziari = findDebitiFinanziariCivilistico(balanceSheetData, yearCols, sessionId);

  const historicalData = {};
  const yearN1 = yearsExtracted[0];
  const yearN = yearsExtracted[1];

  historicalData[yearN1] = {
      ricavi: metrics.fatturato.previousYear,
      ebitda: metrics.ebitda.previousYear ?? calculatedEbitda.previousYear,
      patrimonio_netto: metrics.patrimonioNetto.previousYear,
      debiti_finanziari_ml: debitiFinanziari.ml_termine.previousYear,
      debiti_finanziari_breve: debitiFinanziari.breve_termine.previousYear,
      disponibilita_liquide: metrics.disponibilitaLiquide.previousYear,
  };

  historicalData[yearN] = {
      ricavi: metrics.fatturato.currentYear,
      ebitda: metrics.ebitda.currentYear ?? calculatedEbitda.currentYear,
      patrimonio_netto: metrics.patrimonioNetto.currentYear,
      debiti_finanziari_ml: debitiFinanziari.ml_termine.currentYear,
      debiti_finanziari_breve: debitiFinanziari.breve_termine.currentYear,
      disponibilita_liquide: metrics.disponibilitaLiquide.currentYear,
  };

  const valuationInputs = {
    market_position: 'follower',
    customer_concentration: 'medium',
    technology_risk: 'medium'
  };

  const { error: updateError } = await supabase
    .from('valuations')
    .update({
      years_analyzed: yearsExtracted,
      historical_data: historicalData,
      valuation_inputs: valuationInputs,
      sector_ateco: atecoCode,
      status: debitiFinanziari.requiresManualEntry ? 'data_entry' : 'complete'
    })
    .eq('session_id', sessionId);
  
  if (updateError) throw updateError;
  
  return res.status(200).json({ 
    success: true, 
    sessionId: sessionId,
    companyName: companyName,
    years: yearsExtracted
  });
}

// ============================================
// FUNZIONI HELPER (da upload.js e calculate.js)
// ============================================

const SETTORI_ITALIANI = [
  { id: 'manifatturiero_generale', nome: 'Manifatturiero - Generale', ev_ebitda: 7.86, ev_ebit: 8.81, liquidita: 'medio' },
  { id: 'manifatturiero_metalli', nome: 'Manifatturiero - Metalli', ev_ebitda: 8.68, ev_ebit: 12.27, liquidita: 'medio' },
  { id: 'manifatturiero_plastica', nome: 'Manifatturiero - Plastica/Gomma', ev_ebitda: 13.31, ev_ebit: 22.13, liquidita: 'medio' },
  { id: 'manifatturiero_macchinari', nome: 'Manifatturiero - Macchinari', ev_ebitda: 15.35, ev_ebit: 20.02, liquidita: 'medio' },
  { id: 'manifatturiero_elettronica', nome: 'Manifatturiero - Elettronica', ev_ebitda: 17.28, ev_ebit: 28.93, liquidita: 'liquido' },
  { id: 'alimentare_produzione', nome: 'Alimentare - Produzione', ev_ebitda: 11.17, ev_ebit: 14.76, liquidita: 'medio' },
  { id: 'alimentare_distribuzione', nome: 'Alimentare - Distribuzione', ev_ebitda: 10.77, ev_ebit: 16.86, liquidita: 'medio' },
  { id: 'ristorazione', nome: 'Ristorazione', ev_ebitda: 18.67, ev_ebit: 32.11, liquidita: 'illiquido' },
  { id: 'retail_abbigliamento', nome: 'Retail - Abbigliamento', ev_ebitda: 9.22, ev_ebit: 14.64, liquidita: 'medio' },
  { id: 'retail_alimentare', nome: 'Retail - Alimentare', ev_ebitda: 7.74, ev_ebit: 16.89, liquidita: 'medio' },
  { id: 'retail_specializzato', nome: 'Retail - Specializzato', ev_ebitda: 9.90, ev_ebit: 19.99, liquidita: 'medio' },
  { id: 'retail_edilizia', nome: 'Retail - Edilizia', ev_ebitda: 15.75, ev_ebit: 20.75, liquidita: 'medio' },
  { id: 'edilizia_costruzioni', nome: 'Edilizia - Costruzioni', ev_ebitda: 15.65, ev_ebit: 24.03, liquidita: 'illiquido' },
  { id: 'edilizia_materiali', nome: 'Edilizia - Materiali', ev_ebitda: 13.14, ev_ebit: 17.28, liquidita: 'medio' },
  { id: 'trasporti_logistica', nome: 'Trasporti - Logistica', ev_ebitda: 11.33, ev_ebit: 25.31, liquidita: 'medio' },
  { id: 'servizi_professionali', nome: 'Servizi Professionali', ev_ebitda: 16.75, ev_ebit: 23.77, liquidita: 'medio' },
  { id: 'software_it', nome: 'Software/IT', ev_ebitda: 27.98, ev_ebit: 37.85, liquidita: 'liquido' },
  { id: 'ecommerce', nome: 'E-commerce', ev_ebitda: 28.08, ev_ebit: null, liquidita: 'liquido' },
  { id: 'sanita_prodotti', nome: 'Sanità - Prodotti', ev_ebitda: 21.20, ev_ebit: 33.63, liquidita: 'medio' },
  { id: 'sanita_servizi', nome: 'Sanità - Servizi', ev_ebitda: 11.32, ev_ebit: 15.15, liquidita: 'medio' },
  { id: 'turismo_hotel', nome: 'Turismo/Hotel', ev_ebitda: 15.42, ev_ebit: 28.23, liquidita: 'illiquido' },
  { id: 'energia_rinnovabili', nome: 'Energia - Rinnovabili', ev_ebitda: 11.30, ev_ebit: 31.91, liquidita: 'medio' },
  { id: 'commercio_auto', nome: 'Commercio Auto', ev_ebitda: 14.42, ev_ebit: 21.68, liquidita: 'medio' },
  { id: 'tessile', nome: 'Tessile', ev_ebitda: 9.22, ev_ebit: 14.64, liquidita: 'medio' },
  { id: 'packaging', nome: 'Packaging', ev_ebitda: 9.46, ev_ebit: 15.43, liquidita: 'medio' }
];

const SCONTO_LIQUIDITA_BAGNA = {
  grande: { liquido: 0.10, medio: 0.125, illiquido: 0.15 },
  media: { liquido: 0.20, medio: 0.225, illiquido: 0.25 },
  piccola: { liquido: 0.30, medio: 0.325, illiquido: 0.35 },
  micro: { liquido: 0.35, medio: 0.375, illiquido: 0.40 }
};

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
  
  let yearN, yearN1, colN, colN1, extractionMethod;
  
  if (extractedBS.found) {
    yearN = extractedBS.year;
    yearN1 = yearN - 1;
    colN = extractedBS.col;
    colN1 = extractedBS.col + 1;
    extractionMethod = 'header_extraction';
  } else {
    yearN = currentYear - 1;
    yearN1 = yearN - 1;
    colN = 3;
    colN1 = 4;
    extractionMethod = 'static_fallback';
  }
  
  return {
    yearCols: {
      currentYearCol: colN,
      previousYearCol: colN1
    },
    years: [yearN1, yearN],
    extractionMethod: extractionMethod,
    warnings: [],
    requiresUserConfirmation: false,
    validateExtractedValues: () => []
  };
};

const findDebitiFinanziariCivilistico = (sheetData, yearCols, sessionId) => {
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

    if (!inSezioneDebiti && (
        desc.includes('d) debiti') || 
        desc.includes('d. debiti') ||
        desc.includes('d)debiti') ||
        desc.includes('d debiti')
    )) {
      inSezioneDebiti = true;
      continue;
    }

    if (inSezioneDebiti && (
        desc.match(/^e[\)\.]/) || 
        desc.includes('totale passivo') ||
        desc.includes('totale passività')
    )) {
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

const calculateEbitdaSafely = (utile, imposte, oneri, ammortamenti, year) => {
  if (utile === null) return null;
  return utile + (imposte || 0) + (oneri || 0) + (ammortamenti || 0);
};

const getSettoreMultiples = (settoreId) => {
  const settore = SETTORI_ITALIANI.find(s => s.id === settoreId);
  return settore || SETTORI_ITALIANI.find(s => s.id === 'manifatturiero_generale');
};

const calculateLiquidityDiscount = (dimensione, liquiditaSettore) => {
  const dim = dimensione.toLowerCase();
  const liq = liquiditaSettore.toLowerCase();
  if (!SCONTO_LIQUIDITA_BAGNA[dim] || !SCONTO_LIQUIDITA_BAGNA[dim][liq]) {
    return 0.225;
  }
  return SCONTO_LIQUIDITA_BAGNA[dim][liq];
};

const calculateGrowthAdjustment = (ricaviN, ricaviN1) => {
  if (!ricaviN1 || ricaviN1 === 0) return 0;
  const growth = ((ricaviN - ricaviN1) / ricaviN1) * 100;
  if (growth > 20) return 0.12;
  if (growth >= 10) return 0.06;
  if (growth >= 3) return 0.02;
  if (growth >= 0) return 0;
  return -0.20;
};

const calculateMarginAdjustment = (margineLordo) => {
  if (margineLordo === null || margineLordo === undefined) return 0;
  if (margineLordo > 60) return 0.08;
  if (margineLordo >= 40) return 0.04;
  if (margineLordo >= 25) return 0;
  return -0.12;
};

const calculateMarketPositionAdjustment = (position) => {
  const adjustments = {
    leader: 0.08,
    challenger: 0.03,
    follower: -0.08,
    niche: 0.02
  };
  return adjustments[position] || 0;
};

const calculateDebtAdjustment = (debitiTotali, ebitda) => {
  if (!ebitda || ebitda === 0) return -0.15;
  const debtRatio = debitiTotali / ebitda;
  if (debtRatio < 2) return 0.03;
  if (debtRatio <= 4) return -0.05;
  return -0.15;
};

const calculateTechRiskAdjustment = (techRisk) => {
  const adjustments = {
    low: 0.05,
    medium: 0,
    high: -0.15
  };
  return adjustments[techRisk] || 0;
};

const calculateEVAdjustments = (inputs, dataN, dataN1) => {
  const factors = {
    growth: calculateGrowthAdjustment(dataN.ricavi, dataN1?.ricavi),
    margin: calculateMarginAdjustment(inputs.margine_lordo),
    market_position: calculateMarketPositionAdjustment(inputs.market_position),
    debt: calculateDebtAdjustment(dataN.debiti_finanziari_ml + dataN.debiti_finanziari_breve, dataN.ebitda),
    tech_risk: calculateTechRiskAdjustment(inputs.technology_risk)
  };
  const totalAdjustment = Object.values(factors).reduce((sum, val) => sum + val, 0);
  return { factors, totalAdjustment };
};

const calculateCustomerConcentrationAdjustment = (concentration) => {
  if (concentration === null || concentration === undefined) return 0;
  if (concentration > 50) return -0.20;
  if (concentration >= 30) return -0.10;
  if (concentration >= 15) return 0;
  return 0.05;
};
