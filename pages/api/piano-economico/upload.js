// /pages/api/piano-economico/upload.js
// VERSIONE 5.0 - OPZIONE B ROBUSTO
// ✅ Auto-detection fogli XBRL (da analyze-xbrl.js)
// ✅ Fallback parsing (da valuta-pmi/upload.js)
// ✅ Pre-calcoli indicatori (da analyze-xbrl.js)
// ✅ Generazione piano economico anni 1-3 SUBITO
// ✅ Logging dettagliato per debug

import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// SEZIONE 1: MAPPATURA FOGLI XBRL
// ============================================

const SHEET_MAPPINGS = {
  standard: {
    companyInfo: ['T0000'],
    balanceSheet: ['T0002'],
    incomeStatement: ['T0006']
  },
  alternative: {
    companyInfo: ['T0000'],
    balanceSheet: ['T0001', 'T0002'],
    incomeStatement: ['T0005', 'T0006']
  }
};

// ============================================
// SEZIONE 2: AUTO-DETECTION FOGLI (da analyze-xbrl.js)
// ============================================

const detectXbrlType = (workbook, sessionId) => {
  const availableSheets = Object.keys(workbook.Sheets);
  console.log(`[${sessionId}] 📋 Fogli disponibili:`, availableSheets.slice(0, 10));
  
  const hasStandardSheets = ['T0000', 'T0002', 'T0006'].every(sheet => 
    availableSheets.includes(sheet)
  );
  
  if (hasStandardSheets) {
    console.log(`[${sessionId}] ✅ Formato XBRL STANDARD rilevato`);
    return 'standard';
  } else {
    console.log(`[${sessionId}] 📄 Formato XBRL ALTERNATIVO - usando fallback`);
    return 'alternative';
  }
};

const getCorrectSheets = (workbook, xbrlType, sessionId) => {
  const mapping = SHEET_MAPPINGS[xbrlType];
  const availableSheets = Object.keys(workbook.Sheets);
  
  const result = {
    companyInfo: null,
    balanceSheet: null,
    incomeStatement: null
  };
  
  for (const sheetName of mapping.companyInfo) {
    if (availableSheets.includes(sheetName)) {
      result.companyInfo = workbook.Sheets[sheetName];
      console.log(`[${sessionId}] 🏢 Info aziendali: ${sheetName}`);
      break;
    }
  }
  
  for (const sheetName of mapping.balanceSheet) {
    if (availableSheets.includes(sheetName)) {
      result.balanceSheet = workbook.Sheets[sheetName];
      console.log(`[${sessionId}] 📊 Stato Patrimoniale: ${sheetName}`);
      break;
    }
  }
  
  for (const sheetName of mapping.incomeStatement) {
    if (availableSheets.includes(sheetName)) {
      result.incomeStatement = workbook.Sheets[sheetName];
      console.log(`[${sessionId}] 💰 Conto Economico: ${sheetName}`);
      break;
    }
  }
  
  return result;
};

const validateSheets = (sheets, sessionId) => {
  const missing = [];
  
  if (!sheets.companyInfo) missing.push('Informazioni Aziendali (T0000)');
  if (!sheets.balanceSheet) missing.push('Stato Patrimoniale (T0002/T0001)');
  if (!sheets.incomeStatement) missing.push('Conto Economico (T0006/T0005)');
  
  if (missing.length > 0) {
    const error = `Fogli mancanti: ${missing.join(', ')}`;
    console.error(`[${sessionId}] ❌ ${error}`);
    throw new Error(error);
  }
  
  console.log(`[${sessionId}] ✅ Tutti i fogli necessari trovati`);
  return true;
};

// ============================================
// SEZIONE 3: UTILITY PARSING
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
    console.warn('Colonne anni non trovate, uso fallback 3 e 4.');
    return { currentYearCol: 3, previousYearCol: 4 };
  }
  years.sort((a, b) => b.year - a.year);
  return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

// ✅ PARSING SEMPLICE DA VALUTA-PMI (FUNZIONA)
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
          console.log(`[${metricName}] ✅ Trovato: "${description.substring(0, 60)}..." | N=${result.currentYear}, N-1=${result.previousYear}`);
          return result;
        }
      }
    }
  }
  console.log(`[${metricName}] ⚠️ Non trovato`);
  return { currentYear: null, previousYear: null };
};

// ============================================
// SEZIONE 4: METRICHE CONFIG (SEMPLIFICATO)
// ============================================

const metricsConfigs = {
  fatturato: [
    { primary: ['a) ricavi delle vendite e delle prestazioni'] },
    { primary: ['ricavi delle vendite'] },
    { primary: ['valore della produzione'] }
  ],
  costiPersonale: [
    { primary: ['costi per prestazioni di lavoro dipendente'] },
    { primary: ['costi per lavoro dipendente'] },
    { primary: ['personale'] }
  ],
  costiMateriePrime: [
    { primary: ['materie prime'] },
    { primary: ['costi materie prime'] }
  ],
  costiServizi: [
    { primary: ['costi per servizi'] },
    { primary: ['servizi'] }
  ],
  costiGodimento: [
    { primary: ['costi per godimento beni di terzi'] },
    { primary: ['godimento beni'] }
  ],
  oneriDiversi: [
    { primary: ['oneri diversi di gestione'] },
    { primary: ['oneri diversi'] }
  ],
  ammortamenti: [
    { primary: ['ammortamenti e svalutazioni'] },
    { primary: ['ammortamenti'] }
  ],
  oneriFinanziari: [
    { primary: ['interessi e altri oneri finanziari'] },
    { primary: ['oneri finanziari'] }
  ],
  utile: [
    { primary: ['utile (perdita) dell\'esercizio'] },
    { primary: ['risultato dell\'esercizio'] },
    { primary: ['risultato prima delle imposte'] }
  ],
  totaleAttivo: [
    { primary: ['totale attivo'] }
  ],
  patrimonioNetto: [
    { primary: ['totale patrimonio netto'] },
    { primary: ['a) patrimonio netto'] }
  ],
  debitiTotali: [
    { primary: ['totale debiti'] },
    { primary: ['d) debiti'] }
  ],
  imposte: [
    { primary: ['imposte sul reddito dell\'esercizio'] },
    { primary: ['imposte sul reddito'] }
  ]
};

// ============================================
// SEZIONE 5: PRE-CALCOLI INDICATORI (da analyze-xbrl.js)
// ============================================

const calculateFinancialIndicators = (metrics, sessionId) => {
  console.log(`[${sessionId}] 🧮 Inizio pre-calcoli indicatori...`);
  
  const currentYearMetrics = {
    utile: metrics.utile.currentYear || 0,
    imposte: metrics.imposte.currentYear || 0,
    oneriFinanziari: metrics.oneriFinanziari.currentYear || 0,
    ammortamenti: metrics.ammortamenti.currentYear || 0,
  };
  
  const previousYearMetrics = {
    utile: metrics.utile.previousYear || 0,
    imposte: metrics.imposte.previousYear || 0,
    oneriFinanziari: metrics.oneriFinanziari.previousYear || 0,
    ammortamenti: metrics.ammortamenti.previousYear || 0,
  };
  
  // ✅ CALCOLA EBITDA SE NON PRESENTE
  const ebitda_current = currentYearMetrics.utile + currentYearMetrics.imposte + 
                         currentYearMetrics.oneriFinanziari + currentYearMetrics.ammortamenti;
  const ebit_current = ebitda_current - currentYearMetrics.ammortamenti;
  
  const ebitda_previous = previousYearMetrics.utile + previousYearMetrics.imposte + 
                          previousYearMetrics.oneriFinanziari + previousYearMetrics.ammortamenti;
  const ebit_previous = ebitda_previous - previousYearMetrics.ammortamenti;
  
  metrics.ebitda = { currentYear: ebitda_current, previousYear: ebitda_previous };
  metrics.ebit = { currentYear: ebit_current, previousYear: ebit_previous };
  
  console.log(`[${sessionId}] ✅ EBITDA calcolato: N=${ebitda_current}, N-1=${ebitda_previous}`);
  console.log(`[${sessionId}] ✅ EBIT calcolato: N=${ebit_current}, N-1=${ebit_previous}`);
  
  return metrics;
};

// ============================================
// SEZIONE 6: GENERAZIONE PIANO ECONOMICO
// ============================================

const INFLATION_RATE = 0.02;
const MIN_GROWTH_RATE = 0.02;
const MAX_GROWTH_RATE = 0.10;
const TECH_GROWTH_RATE = 0.08;
const IRES_RATE = 0.24;
const IRAP_RATE = 0.039;

const getGrowthRate = (atecoCode, overrideRate) => {
  if (overrideRate) return Math.max(MIN_GROWTH_RATE, Math.min(overrideRate, MAX_GROWTH_RATE));
  
  const isTech = atecoCode && /^(62|63|72|73)/.test(atecoCode);
  if (isTech) return TECH_GROWTH_RATE;
  
  return 0.025;
};

const generateProspectiveYears = (anno0Data, growthRate, sessionId) => {
  console.log(`[${sessionId}] 📊 GENERAZIONE PIANO PROSPETTICO`);
  console.log(`   Tasso crescita ricavi: ${(growthRate * 100).toFixed(1)}%`);
  
  const years = {};
  let prevData = anno0Data;
  
  for (let year = 1; year <= 3; year++) {
    const currentData = {};
    
    currentData.ricavi = Math.round(prevData.ricavi * (1 + growthRate));
    currentData.costiPersonale = Math.round((prevData.costiPersonale || 0) * (1 + INFLATION_RATE));
    
    const mp_pct = prevData.ricavi > 0 ? (prevData.mp || 0) / prevData.ricavi : 0;
    currentData.materiePrime = Math.round(currentData.ricavi * mp_pct);
    
    const servizi_pct = prevData.ricavi > 0 ? (prevData.servizi || 0) / prevData.ricavi : 0;
    currentData.servizi = Math.round(currentData.ricavi * servizi_pct);
    
    const godimento_pct = prevData.ricavi > 0 ? (prevData.godimento || 0) / prevData.ricavi : 0;
    currentData.godimento = Math.round(currentData.ricavi * godimento_pct);
    
    const oneri_pct = prevData.ricavi > 0 ? (prevData.oneriDiversi || 0) / prevData.ricavi : 0;
    currentData.oneriDiversi = Math.round(currentData.ricavi * oneri_pct);
    
    currentData.ammortamenti = prevData.ammortamenti || 0;
    
    currentData.ebitda = Math.round(
      currentData.ricavi - currentData.costiPersonale - currentData.materiePrime - 
      currentData.servizi - currentData.godimento - currentData.oneriDiversi
    );
    
    currentData.ebit = Math.round(currentData.ebitda - currentData.ammortamenti);
    currentData.oneriFinanziari = prevData.oneriFinanziari || 0;
    currentData.ebt = Math.round(currentData.ebit - currentData.oneriFinanziari);
    
    const ires = Math.round(currentData.ebit * IRES_RATE);
    const irap = Math.round(currentData.ebit * IRAP_RATE);
    currentData.imposte = Math.round(ires + irap);
    
    currentData.utileNetto = Math.round(currentData.ebt - currentData.imposte);
    
    currentData.margineEbitda = currentData.ricavi > 0 ? (currentData.ebitda / currentData.ricavi) * 100 : 0;
    currentData.margineEbit = currentData.ricavi > 0 ? (currentData.ebit / currentData.ricavi) * 100 : 0;
    currentData.margineNetto = currentData.ricavi > 0 ? (currentData.utileNetto / currentData.ricavi) * 100 : 0;
    
    console.log(`   ✅ ANNO ${year}: Ricavi=${currentData.ricavi}, EBITDA=${currentData.ebitda}, Utile=${currentData.utileNetto}`);
    
    years[`anno${year}_data`] = currentData;
    prevData = currentData;
  }
  
  return years;
};

const calculateKpi = (anno0, anno3, patrimonioNetto, debitiTotali) => {
  const ricavi_y3 = anno3.ricavi || 0;
  const ricavi_y0 = anno0.ricavi || 1;
  const cagr = Math.pow(ricavi_y3 / ricavi_y0, 1/3) - 1;
  
  const roe = patrimonioNetto > 0 ? (anno3.utileNetto / patrimonioNetto) * 100 : 0;
  const roi = (anno0.ricavi || 1) > 0 ? (anno3.ebit / anno0.ricavi) * 100 : 0;
  const leverage = anno3.ebitda > 0 ? debitiTotali / anno3.ebitda : 0;
  const interestCoverage = anno3.oneriFinanziari > 0 ? anno3.ebit / anno3.oneriFinanziari : 999;
  
  const margineEbitda = [anno0, anno3].reduce((sum, year) => sum + (year.margineEbitda || 0), 0) / 2;
  
  return {
    cagr_ricavi: (cagr * 100).toFixed(2),
    roe_y3: roe.toFixed(2),
    roi_y3: roi.toFixed(2),
    leverage_y3: leverage.toFixed(2),
    interest_coverage_y3: Math.min(interestCoverage, 999).toFixed(2),
    margine_ebitda_medio: margineEbitda.toFixed(2),
    breakeven_assessment: anno3.ebitda > 0 ? 'SOSTENIBILE' : 'CRITICO'
  };
};

const calculateSensitivity = (anno3) => {
  const baseline = anno3.ricavi;
  const baseline_ebitda = anno3.ebitda;
  const baseline_margin = anno3.margineEbitda;
  const delta_ricavi = baseline * 0.1;
  
  return {
    ricavi_baseline: {
      ricavi: baseline,
      ebitda: baseline_ebitda,
      margine_ebitda: baseline_margin.toFixed(1)
    },
    ricavi_plus10: {
      ricavi: Math.round(baseline + delta_ricavi),
      ebitda: Math.round(baseline_ebitda + (delta_ricavi * (baseline_margin / 100))),
      margine_ebitda: baseline_margin.toFixed(1)
    },
    ricavi_minus10: {
      ricavi: Math.round(baseline - delta_ricavi),
      ebitda: Math.round(baseline_ebitda - (delta_ricavi * (baseline_margin / 100))),
      margine_ebitda: baseline_margin.toFixed(1)
    }
  };
};

const generateNarrative = (companyName, anno0, anno3, growthRate) => {
  const cagr = ((Math.pow(anno3.ricavi / anno0.ricavi, 1/3) - 1) * 100).toFixed(1);
  
  return `PIANO ECONOMICO TRIENNALE - ${companyName.toUpperCase()}

EXECUTIVE SUMMARY
Il presente piano economico triennale muove da un bilancio storico caratterizzato da ricavi di €${anno0.ricavi?.toLocaleString('it-IT') || '0'} e un EBITDA di €${anno0.ebitda?.toLocaleString('it-IT') || '0'} (margine ${anno0.margineEbitda?.toFixed(1) || 0}%).

Con un tasso di crescita annua del ${(growthRate * 100).toFixed(1)}%, il piano stima ricavi a €${anno3.ricavi?.toLocaleString('it-IT') || '0'} entro il 2027, con EBITDA atteso a €${anno3.ebitda?.toLocaleString('it-IT') || '0'} e utile netto di €${anno3.utileNetto?.toLocaleString('it-IT') || '0'}. La traiettoria è ${anno3.ebitda > 0 ? 'sostenibile' : 'critica'}.

DRIVER DI CRESCITA
La crescita è sostenuta da: (a) espansione organica, (b) stabilità dei margini operativi, (c) effetto leva finanziaria moderato.

METRICHE CHIAVE
- CAGR Ricavi 3 anni: ${cagr}%
- Margine EBITDA medio: ${((anno0.margineEbitda + anno3.margineEbitda) / 2).toFixed(1)}%
- EBIT Margine Year 3: ${anno3.margineEbit?.toFixed(1) || 0}%
- Utile Netto Year 3: €${anno3.utileNetto?.toLocaleString('it-IT') || '0'}

CONCLUSIONI
Il piano rappresenta uno scenario prudenziale basato su ipotesi conservative.`;
};

// ============================================
// SEZIONE 7: PARSE FORM
// ============================================

const parseForm = (req) => {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      uploadDir: process.env.UPLOAD_DIR || '/tmp',
      keepExtensions: true,
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      resolve({ fields, files });
    });
  });
};

// ============================================
// SEZIONE 8: HANDLER PRINCIPALE
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const sessionId = uuidv4();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${sessionId}] 🚀 UPLOAD + GENERATE PIANO ECONOMICO (v5.0 - OPZIONE B ROBUSTO)`);
  console.log(`${'='.repeat(80)}`);

  try {
    // STEP 1: AUTENTICAZIONE
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autenticazione mancante' });
    }

    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });

    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token non valido' });
    }

    const outsetaUser = await outsetaResponse.json();
    console.log(`[${sessionId}] ✅ Autenticazione OK: ${outsetaUser.Email}`);

    // STEP 2: USER SUPABASE
    const { data: userRow, error: userError } = await supabase
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

    if (userError || !userRow) {
      return res.status(500).json({ error: 'Errore autenticazione user' });
    }

    console.log(`[${sessionId}] ✅ User ID: ${userRow.id}`);

    // STEP 3: PARSE FORM
    const { fields, files } = await parseForm(req);

    if (!files.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const fileObj = Array.isArray(files.file) ? files.file[0] : files.file;
    const fileBuffer = fs.readFileSync(fileObj.filepath);
    console.log(`[${sessionId}] ✅ File: ${fileBuffer.length} bytes`);

    // STEP 4: PARSE EXCEL + AUTO-DETECT FOGLI
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const xbrlType = detectXbrlType(workbook, sessionId);
    const sheets = getCorrectSheets(workbook, xbrlType, sessionId);
    validateSheets(sheets, sessionId);

    const balanceSheetData = xlsx.utils.sheet_to_json(sheets.balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(sheets.incomeStatement, { header: 1 });

    console.log(`[${sessionId}] ✅ Excel: ${balanceSheetData.length} righe (SP), ${incomeStatementData.length} righe (CE)`);

    // STEP 5: ESTRAI YEAR COLUMNS
    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    // STEP 6: ESTRAI METRICHE
    console.log(`[${sessionId}] 📊 Inizio estrazione metriche...`);
    
    const metrics = {
      fatturato: findValueInSheet(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
      costiPersonale: findValueInSheet(incomeStatementData, metricsConfigs.costiPersonale, yearColsIS, 'Costi Personale'),
      costiMateriePrime: findValueInSheet(incomeStatementData, metricsConfigs.costiMateriePrime, yearColsIS, 'Materie Prime'),
      costiServizi: findValueInSheet(incomeStatementData, metricsConfigs.costiServizi, yearColsIS, 'Servizi'),
      costiGodimento: findValueInSheet(incomeStatementData, metricsConfigs.costiGodimento, yearColsIS, 'Godimento'),
      oneriDiversi: findValueInSheet(incomeStatementData, metricsConfigs.oneriDiversi, yearColsIS, 'Oneri Diversi'),
      ammortamenti: findValueInSheet(incomeStatementData, metricsConfigs.ammortamenti, yearColsIS, 'Ammortamenti'),
      oneriFinanziari: findValueInSheet(incomeStatementData, metricsConfigs.oneriFinanziari, yearColsIS, 'Oneri Finanziari'),
      utile: findValueInSheet(incomeStatementData, metricsConfigs.utile, yearColsIS, 'Utile'),
      totaleAttivo: findValueInSheet(balanceSheetData, metricsConfigs.totaleAttivo, yearColsBS, 'Totale Attivo'),
      patrimonioNetto: findValueInSheet(balanceSheetData, metricsConfigs.patrimonioNetto, yearColsBS, 'Patrimonio Netto'),
      debitiTotali: findValueInSheet(balanceSheetData, metricsConfigs.debitiTotali, yearColsBS, 'Debiti Totali'),
      imposte: findValueInSheet(incomeStatementData, metricsConfigs.imposte, yearColsIS, 'Imposte')
    };

    console.log(`[${sessionId}] ✅ Metriche estratte`);

    // STEP 7: PRE-CALCOLI
    const enrichedMetrics = calculateFinancialIndicators(metrics, sessionId);

    // STEP 8: CALCOLA PERCENTUALI
    const fatturatoCorrente = enrichedMetrics.fatturato.currentYear || 1;
    const incidenze = {
      mp_pct: fatturatoCorrente > 0 ? (enrichedMetrics.costiMateriePrime.currentYear || 0) / fatturatoCorrente * 100 : 0,
      servizi_pct: fatturatoCorrente > 0 ? (enrichedMetrics.costiServizi.currentYear || 0) / fatturatoCorrente * 100 : 0,
      godimento_pct: fatturatoCorrente > 0 ? (enrichedMetrics.costiGodimento.currentYear || 0) / fatturatoCorrente * 100 : 0,
      oneri_pct: fatturatoCorrente > 0 ? (enrichedMetrics.oneriDiversi.currentYear || 0) / fatturatoCorrente * 100 : 0
    };

    console.log(`[${sessionId}] ✅ Percentuali calcolate`);

    // STEP 9: CAMPI FORM
    const companyName = Array.isArray(fields.companyName) ? fields.companyName[0] : fields.companyName || 'Azienda';
    const scenario = Array.isArray(fields.scenario) ? fields.scenario[0] : fields.scenario || 'base';
    const atecoCode = Array.isArray(fields.atecoCode) ? fields.atecoCode[0] : fields.atecoCode || null;
    const growthRateOverride = Array.isArray(fields.growthRateOverride) ? parseFloat(fields.growthRateOverride[0]) : (fields.growthRateOverride ? parseFloat(fields.growthRateOverride) : null);

    console.log(`[${sessionId}] ✅ ${companyName}`);

    // STEP 10: DETERMINA TASSO CRESCITA
    const growthRate = getGrowthRate(atecoCode, growthRateOverride);
    console.log(`[${sessionId}] 📈 Tasso crescita: ${(growthRate * 100).toFixed(1)}%`);

    // STEP 11: PREPARA ANNO 0
    const anno0 = {
      ricavi: enrichedMetrics.fatturato.currentYear || 0,
      costiPersonale: enrichedMetrics.costiPersonale.currentYear || 0,
      mp: enrichedMetrics.costiMateriePrime.currentYear || 0,
      servizi: enrichedMetrics.costiServizi.currentYear || 0,
      godimento: enrichedMetrics.costiGodimento.currentYear || 0,
      oneriDiversi: enrichedMetrics.oneriDiversi.currentYear || 0,
      ammortamenti: enrichedMetrics.ammortamenti.currentYear || 0,
      oneriFinanziari: enrichedMetrics.oneriFinanziari.currentYear || 0,
      margineEbitda: 0,
      margineEbit: 0,
      margineNetto: 0,
      ebitda: enrichedMetrics.ebitda.currentYear || 0,
      ebit: enrichedMetrics.ebit.currentYear || 0
    };

    // STEP 12: GENERA ANNI 1-3
    const prospectiveYears = generateProspectiveYears(anno0, growthRate, sessionId);
    console.log(`[${sessionId}] ✅ Piano prospettico generato`);

    // STEP 13: CALCOLA KPI
    const anno3 = prospectiveYears.anno3_data;
    const kpis = calculateKpi(
      anno0,
      anno3,
      enrichedMetrics.patrimonioNetto.currentYear || 0,
      enrichedMetrics.debitiTotali.currentYear || 0
    );

    console.log(`[${sessionId}] ✅ KPI calcolati`);

    // STEP 14: SENSIBILITÀ
    const sensibilita = calculateSensitivity(anno3);

    // STEP 15: NARRATIVE
    const narrative = generateNarrative(companyName, anno0, anno3, growthRate);

    // STEP 16: PREPARA INSERT
    const insertData = {
      id: sessionId,
      user_id: userRow.id,
      company_name: companyName,
      
      anno0_ricavi: enrichedMetrics.fatturato.currentYear,
      anno0_costi_personale: enrichedMetrics.costiPersonale.currentYear,
      anno0_mp: enrichedMetrics.costiMateriePrime.currentYear,
      anno0_servizi: enrichedMetrics.costiServizi.currentYear,
      anno0_godimento: enrichedMetrics.costiGodimento.currentYear,
      anno0_oneri_diversi: enrichedMetrics.oneriDiversi.currentYear,
      anno0_ammortamenti: enrichedMetrics.ammortamenti.currentYear,
      anno0_oneri_finanziari: enrichedMetrics.oneriFinanziari.currentYear,
      anno0_utile: enrichedMetrics.utile.currentYear,
      
      mp_pct: incidenze.mp_pct,
      servizi_pct: incidenze.servizi_pct,
      godimento_pct: incidenze.godimento_pct,
      oneri_pct: incidenze.oneri_pct,
      
      ateco_code: atecoCode,
      scenario_type: scenario,
      growth_rate_override: growthRateOverride,
      growth_rate_applied: growthRate,
      
      totale_attivo: enrichedMetrics.totaleAttivo.currentYear,
      patrimonio_netto: enrichedMetrics.patrimonioNetto.currentYear,
      debiti_totali: enrichedMetrics.debitiTotali.currentYear,
      
      anno1_data: JSON.stringify(prospectiveYears.anno1_data),
      anno2_data: JSON.stringify(prospectiveYears.anno2_data),
      anno3_data: JSON.stringify(prospectiveYears.anno3_data),
      
      kpi_derivati: JSON.stringify(kpis),
      sensibilita: JSON.stringify(sensibilita),
      narrative: narrative,
      
      status: 'completed'
    };

    console.log(`[${sessionId}] 🔧 Dati preparati`);

    // STEP 17: INSERT SUPABASE
    const { data: insertedData, error: insertError } = await supabase
      .from('piano_economico_sessions')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error(`[${sessionId}] ❌ Errore insert:`, insertError.message);
      return res.status(500).json({ 
        error: 'Errore salvataggio sessione',
        errorDetails: insertError
      });
    }

    console.log(`[${sessionId}] ✅ Insert OK`);

    // STEP 18: CLEANUP
    try {
      fs.unlinkSync(fileObj.filepath);
    } catch (e) {
      console.warn(`[${sessionId}] ⚠️ Errore cleanup`);
    }

    console.log(`\n[${sessionId}] 🎉 COMPLETATO`);
    console.log(`${'='.repeat(80)}\n`);

    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      userId: userRow.id,
      userEmail: outsetaUser.Email,
      message: 'Piano economico generato con successo',
      status: 'completed',
      data: {
        company_name: companyName,
        anno0_ricavi: enrichedMetrics.fatturato.currentYear,
        anno3_ricavi: anno3.ricavi,
        anno3_ebitda: anno3.ebitda,
        anno3_utile: anno3.utileNetto,
        growth_rate: (growthRate * 100).toFixed(1),
        kpi: kpis
      }
    });

  } catch (error) {
    console.error(`[${sessionId}] 💥 ERRORE FATALE:`, error.message);
    
    return res.status(500).json({
      error: error.message || 'Errore durante l\'elaborazione del file',
      sessionId: sessionId
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
