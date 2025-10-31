// /pages/api/piano-economico/upload-and-generate.js
// VERSIONE 4.0 - COMPLETO
// ✅ Estrae dati anno0 da Excel
// ✅ Applica assunzioni del prompt
// ✅ Genera anni 1-3 PRE-CALCOLATI
// ✅ Salva tutto pronto per visualizzazione

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
// UTILITY FUNCTIONS
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
    return { currentYearCol: 3, previousYearCol: 4 };
  }
  years.sort((a, b) => b.year - a.year);
  return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

const findValueInSheetImproved = (sheetData, searchConfigs, yearCols, metricName) => {
  for (const config of searchConfigs) {
    const primaryTerms = config.primary.map(t => t.toLowerCase().trim());
    const exclusionTerms = (config.exclusion || []).map(t => t.toLowerCase().trim());
    for (const row of sheetData) {
      let description = '';
      for (let i = 0; i < Math.min(row.length, 6); i++) {
        description += String(row[i] || '').toLowerCase().trim() + ' ';
      }
      description = description.replace(/\s+/g, ' ').trim();
      const allPrimaryTermsFound = primaryTerms.every(term => description.includes(term));
      const anyExclusionTermsFound = exclusionTerms.some(term => description.includes(term));
      if (allPrimaryTermsFound && !anyExclusionTermsFound) {
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

// ============================================
// METRIC CONFIGS (Identico ad analyze-xbrl.js)
// ============================================

const metricsConfigs = {
  fatturato: [
    { primary: ['a) ricavi delle vendite e delle prestazioni'] },
    { primary: ['ricavi delle vendite'] },
    { primary: ['valore della produzione'], exclusion: ['costi', 'differenza'] }
  ],
  costiProduzione: [
    { primary: ['b) costi della produzione'] },
    { primary: ['costi della produzione'], exclusion: ['valore'] }
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
    { primary: ['totale attivo', 'a+b+c'] },
    { primary: ['totale attivo'], exclusion: ['circolante', 'corrente'] }
  ],
  patrimonioNetto: [
    { primary: ['totale patrimonio netto'] },
    { primary: ['a) patrimonio netto'] }
  ],
  debitiTotali: [
    { primary: ['totale debiti'] },
    { primary: ['d) debiti'] }
  ]
};

// ============================================
// ASSUNZIONI BUSINESS PLAN (Dal Prompt)
// ============================================

const INFLATION_RATE = 0.02; // 2% inflazione
const MIN_GROWTH_RATE = 0.02; // 2% minimo
const MAX_GROWTH_RATE = 0.10; // 10% massimo
const TECH_GROWTH_RATE = 0.08; // 8% per tech
const IRES_RATE = 0.24; // 24%
const IRAP_RATE = 0.039; // 3.9%

/**
 * Determina il tasso di crescita ricavi in base al settore
 */
const getGrowthRate = (atecoCode, overrideRate) => {
  if (overrideRate) return Math.max(MIN_GROWTH_RATE, Math.min(overrideRate, MAX_GROWTH_RATE));
  
  // Se tech/AI/digitale → 8%
  const isTech = atecoCode && /^(62|63|72|73)/.test(atecoCode);
  if (isTech) return TECH_GROWTH_RATE;
  
  // Default: 2.5% (tra inflazione e tech)
  return 0.025;
};

/**
 * Genera i dati prospettici per gli anni 1-3
 */
const generateProspectiveYears = (anno0Data, growthRate, sessionId) => {
  console.log(`[${sessionId}] 📊 GENERAZIONE PIANO PROSPETTICO`);
  console.log(`   Tasso crescita ricavi: ${(growthRate * 100).toFixed(1)}%`);
  
  const years = {};
  let prevData = anno0Data;
  
  for (let year = 1; year <= 3; year++) {
    console.log(`\n   === ANNO ${year} ===`);
    
    const currentData = {};
    
    // 1. RICAVI con crescita
    currentData.ricavi = Math.round(prevData.ricavi * (1 + growthRate));
    console.log(`   Ricavi: ${prevData.ricavi} × (1 + ${growthRate}) = ${currentData.ricavi}`);
    
    // 2. COSTI PERSONALE con inflazione
    currentData.costiPersonale = Math.round((prevData.costiPersonale || 0) * (1 + INFLATION_RATE));
    
    // 3. MATERIE PRIME: % fissa su ricavi
    const mp_pct = prevData.ricavi > 0 ? (prevData.mp || 0) / prevData.ricavi : 0;
    currentData.materiePrime = Math.round(currentData.ricavi * mp_pct);
    
    // 4. SERVIZI: % fissa su ricavi
    const servizi_pct = prevData.ricavi > 0 ? (prevData.servizi || 0) / prevData.ricavi : 0;
    currentData.servizi = Math.round(currentData.ricavi * servizi_pct);
    
    // 5. GODIMENTO: % fissa su ricavi
    const godimento_pct = prevData.ricavi > 0 ? (prevData.godimento || 0) / prevData.ricavi : 0;
    currentData.godimento = Math.round(currentData.ricavi * godimento_pct);
    
    // 6. ONERI DIVERSI: % fissa su ricavi
    const oneri_pct = prevData.ricavi > 0 ? (prevData.oneriDiversi || 0) / prevData.ricavi : 0;
    currentData.oneriDiversi = Math.round(currentData.ricavi * oneri_pct);
    
    // 7. AMMORTAMENTI: flat (nessun nuovo investimento)
    currentData.ammortamenti = prevData.ammortamenti || 0;
    
    // 8. EBITDA = Ricavi - Tutti i costi operativi
    currentData.ebitda = Math.round(
      currentData.ricavi 
      - currentData.costiPersonale 
      - currentData.materiePrime 
      - currentData.servizi 
      - currentData.godimento 
      - currentData.oneriDiversi
    );
    
    // 9. EBIT = EBITDA - Ammortamenti
    currentData.ebit = Math.round(currentData.ebitda - currentData.ammortamenti);
    
    // 10. ONERI FINANZIARI: flat (no nuovi debiti)
    currentData.oneriFinanziari = prevData.oneriFinanziari || 0;
    
    // 11. EBT = EBIT - Oneri finanziari
    currentData.ebt = Math.round(currentData.ebit - currentData.oneriFinanziari);
    
    // 12. IMPOSTE = IRES (24% EBIT) + IRAP (3.9% EBIT)
    const ires = Math.round(currentData.ebit * IRES_RATE);
    const irap = Math.round(currentData.ebit * IRAP_RATE);
    currentData.imposte = Math.round(ires + irap);
    
    // 13. UTILE NETTO = EBT - Imposte
    currentData.utileNetto = Math.round(currentData.ebt - currentData.imposte);
    
    // 14. MARGINI
    currentData.margineEbitda = currentData.ricavi > 0 
      ? (currentData.ebitda / currentData.ricavi) * 100 
      : 0;
    currentData.margineEbit = currentData.ricavi > 0 
      ? (currentData.ebit / currentData.ricavi) * 100 
      : 0;
    currentData.margineNetto = currentData.ricavi > 0 
      ? (currentData.utileNetto / currentData.ricavi) * 100 
      : 0;
    
    console.log(`   EBITDA: ${currentData.ebitda} (margine: ${currentData.margineEbitda.toFixed(1)}%)`);
    console.log(`   EBIT: ${currentData.ebit} (margine: ${currentData.margineEbit.toFixed(1)}%)`);
    console.log(`   Utile Netto: ${currentData.utileNetto} (margine: ${currentData.margineNetto.toFixed(1)}%)`);
    
    years[`anno${year}_data`] = currentData;
    prevData = currentData;
  }
  
  return years;
};

/**
 * Calcola KPI derivati
 */
const calculateKpi = (anno0, anno3, patrimonioNetto, debitiTotali) => {
  const ricavi_y3 = anno3.ricavi || 0;
  const ricavi_y0 = anno0.ricavi || 1;
  const cagr = Math.pow(ricavi_y3 / ricavi_y0, 1/3) - 1;
  
  const roe = patrimonioNetto > 0 ? (anno3.utileNetto / patrimonioNetto) * 100 : 0;
  const roi = (anno0.ricavi || 1) > 0 ? (anno3.ebit / anno0.ricavi) * 100 : 0;
  const leverage = anno3.ebitda > 0 ? debitiTotali / anno3.ebitda : 0;
  const interestCoverage = anno3.oneriFinanziari > 0 
    ? anno3.ebit / anno3.oneriFinanziari 
    : 999;
  
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

/**
 * Calcola sensibilità (+/- 10% ricavi)
 */
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

/**
 * Genera narrative strategica
 */
const generateNarrative = (companyName, anno0, anno3, growthRate, sectorInfo) => {
  const cagr = ((Math.pow(anno3.ricavi / anno0.ricavi, 1/3) - 1) * 100).toFixed(1);
  const sectorText = sectorInfo ? `settore ${sectorInfo}` : 'settore di operatività';
  
  return `PIANO ECONOMICO TRIENNALE - ${companyName.toUpperCase()}

EXECUTIVE SUMMARY
Il presente piano economico triennale muove da un bilancio storico caratterizzato da ricavi di €${anno0.ricavi?.toLocaleString('it-IT') || '0'} e un EBITDA di €${anno0.ebitda?.toLocaleString('it-IT') || '0'} (margine ${anno0.margineEbitda?.toFixed(1) || 0}%).

Con un tasso di crescita annua del ${(growthRate * 100).toFixed(1)}% (in linea con i benchmark settoriali), il piano stima ricavi a €${anno3.ricavi?.toLocaleString('it-IT') || '0'} entro il 2027, con EBITDA atteso a €${anno3.ebitda?.toLocaleString('it-IT') || '0'} (margine ${anno3.margineEbitda?.toFixed(1) || 0}%) e utile netto di €${anno3.utileNetto?.toLocaleString('it-IT') || '0'}. La traiettoria è ${anno3.ebitda > 0 ? 'sostenibile' : 'critica'}.

DRIVER DI CRESCITA
La crescita è sostenuta da: (a) espansione organica in linea con il ${sectorText}, (b) stabilità dei margini operativi attraverso controllo dei costi, (c) effetto leva finanziaria moderato con riduzione progressiva del leverage.

METRICHE CHIAVE
- CAGR Ricavi 3 anni: ${cagr}%
- Margine EBITDA medio: ${((anno0.margineEbitda + anno3.margineEbitda) / 2).toFixed(1)}%
- EBIT Margine Year 3: ${anno3.margineEbit?.toFixed(1) || 0}%
- Utile Netto Year 3: €${anno3.utileNetto?.toLocaleString('it-IT') || '0'}
- Assessment complessivo: ${anno3.ebitda > 0 ? 'SOSTENIBILE' : 'CRITICO'}

FATTORI DI RISCHIO
Il piano presuppone: (i) continuità operativa e stabilità della domanda, (ii) assenza di significativi incrementi nei prezzi delle materie prime, (iii) mantenimento dell'efficienza costi corrente, (iv) nessun nuovo indebitamento.

CONCLUSIONI
Il piano rappresenta uno scenario prudenziale basato su ipotesi conservative. È consigliabile un monitoraggio trimestrale dei KPI principali e una revisione annuale del piano in base ai risultati consuntivi.`;
};

// ============================================
// PARSE FORM
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
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const sessionId = uuidv4();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${sessionId}] 🚀 UPLOAD + GENERATE PIANO ECONOMICO (v4.0)`);
  console.log(`${'='.repeat(80)}`);

  try {
    // ============================================
    // STEP 1: AUTENTICAZIONE
    // ============================================

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

    // ============================================
    // STEP 2: USER SUPABASE
    // ============================================

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

    // ============================================
    // STEP 3: PARSE FORM
    // ============================================

    const { fields, files } = await parseForm(req);

    if (!files.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const fileObj = Array.isArray(files.file) ? files.file[0] : files.file;
    const fileBuffer = fs.readFileSync(fileObj.filepath);
    console.log(`[${sessionId}] ✅ File: ${fileBuffer.length} bytes`);

    // ============================================
    // STEP 4: PARSE EXCEL
    // ============================================

    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheets = workbook.SheetNames;

    if (sheets.length === 0) {
      return res.status(400).json({ error: 'File Excel vuoto' });
    }

    const firstSheet = workbook.Sheets[sheets[0]];
    const sheetData = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

    console.log(`[${sessionId}] ✅ Excel: ${sheetData.length} righe`);

    // ============================================
    // STEP 5: ESTRAI YEAR COLUMNS
    // ============================================

    const yearCols = findYearColumns(sheetData);

    // ============================================
    // STEP 6: ESTRAI METRICHE ANNO 0
    // ============================================

    const metrics = {
      fatturato: findValueInSheetImproved(sheetData, metricsConfigs.fatturato, yearCols, 'Fatturato'),
      costiPersonale: findValueInSheetImproved(sheetData, metricsConfigs.costiPersonale, yearCols, 'Costi Personale'),
      costiMateriePrime: findValueInSheetImproved(sheetData, metricsConfigs.costiMateriePrime, yearCols, 'Materie Prime'),
      costiServizi: findValueInSheetImproved(sheetData, metricsConfigs.costiServizi, yearCols, 'Servizi'),
      costiGodimento: findValueInSheetImproved(sheetData, metricsConfigs.costiGodimento, yearCols, 'Godimento'),
      oneriDiversi: findValueInSheetImproved(sheetData, metricsConfigs.oneriDiversi, yearCols, 'Oneri Diversi'),
      ammortamenti: findValueInSheetImproved(sheetData, metricsConfigs.ammortamenti, yearCols, 'Ammortamenti'),
      oneriFinanziari: findValueInSheetImproved(sheetData, metricsConfigs.oneriFinanziari, yearCols, 'Oneri Finanziari'),
      utile: findValueInSheetImproved(sheetData, metricsConfigs.utile, yearCols, 'Utile'),
      totaleAttivo: findValueInSheetImproved(sheetData, metricsConfigs.totaleAttivo, yearCols, 'Totale Attivo'),
      patrimonioNetto: findValueInSheetImproved(sheetData, metricsConfigs.patrimonioNetto, yearCols, 'Patrimonio Netto'),
      debitiTotali: findValueInSheetImproved(sheetData, metricsConfigs.debitiTotali, yearCols, 'Debiti Totali')
    };

    console.log(`[${sessionId}] ✅ Metriche estratte`);

    // ============================================
    // STEP 7: CALCOLA PERCENTUALI
    // ============================================

    const fatturatoCorrente = metrics.fatturato.currentYear || 1;

    const incidenze = {
      mp_pct: fatturatoCorrente > 0 ? (metrics.costiMateriePrime.currentYear || 0) / fatturatoCorrente * 100 : 0,
      servizi_pct: fatturatoCorrente > 0 ? (metrics.costiServizi.currentYear || 0) / fatturatoCorrente * 100 : 0,
      godimento_pct: fatturatoCorrente > 0 ? (metrics.costiGodimento.currentYear || 0) / fatturatoCorrente * 100 : 0,
      oneri_pct: fatturatoCorrente > 0 ? (metrics.oneriDiversi.currentYear || 0) / fatturatoCorrente * 100 : 0
    };

    console.log(`[${sessionId}] ✅ Percentuali calcolate`);

    // ============================================
    // STEP 8: CAMPI FORM
    // ============================================

    const companyName = Array.isArray(fields.companyName) 
      ? fields.companyName[0] 
      : fields.companyName || 'Azienda';
    
    const scenario = Array.isArray(fields.scenario)
      ? fields.scenario[0]
      : fields.scenario || 'base';
    
    const atecoCode = Array.isArray(fields.atecoCode)
      ? fields.atecoCode[0]
      : fields.atecoCode || null;

    const growthRateOverride = Array.isArray(fields.growthRateOverride)
      ? parseFloat(fields.growthRateOverride[0])
      : (fields.growthRateOverride ? parseFloat(fields.growthRateOverride) : null);

    console.log(`[${sessionId}] ✅ ${companyName}`);

    // ============================================
    // STEP 9: DETERMINA TASSO CRESCITA
    // ============================================

    const growthRate = getGrowthRate(atecoCode, growthRateOverride);
    console.log(`[${sessionId}] 📈 Tasso crescita: ${(growthRate * 100).toFixed(1)}%`);

    // ============================================
    // STEP 10: PREPARA ANNO 0
    // ============================================

    const anno0 = {
      ricavi: metrics.fatturato.currentYear || 0,
      costiPersonale: metrics.costiPersonale.currentYear || 0,
      mp: metrics.costiMateriePrime.currentYear || 0,
      servizi: metrics.costiServizi.currentYear || 0,
      godimento: metrics.costiGodimento.currentYear || 0,
      oneriDiversi: metrics.oneriDiversi.currentYear || 0,
      ammortamenti: metrics.ammortamenti.currentYear || 0,
      oneriFinanziari: metrics.oneriFinanziari.currentYear || 0,
      utileNetto: metrics.utile.currentYear || 0,
      margineEbitda: 0,
      margineEbit: 0,
      margineNetto: 0,
      ebitda: 0,
      ebit: 0
    };

    // ============================================
    // STEP 11: GENERA ANNI 1-3
    // ============================================

    const prospectiveYears = generateProspectiveYears(anno0, growthRate, sessionId);
    console.log(`[${sessionId}] ✅ Piano prospettico generato`);

    // ============================================
    // STEP 12: CALCOLA KPI
    // ============================================

    const anno3 = prospectiveYears.anno3_data;
    const kpis = calculateKpi(
      anno0,
      anno3,
      metrics.patrimonioNetto.currentYear || 0,
      metrics.debitiTotali.currentYear || 0
    );

    console.log(`[${sessionId}] ✅ KPI calcolati`);

    // ============================================
    // STEP 13: CALCOLA SENSIBILITÀ
    // ============================================

    const sensibilita = calculateSensitivity(anno3);

    // ============================================
    // STEP 14: GENERA NARRATIVE
    // ============================================

    const narrative = generateNarrative(companyName, anno0, anno3, growthRate, null);

    // ============================================
    // STEP 15: PREPARA DATI PER INSERT
    // ============================================

    const insertData = {
      id: sessionId,
      user_id: userRow.id,
      company_name: companyName,
      
      // Anno 0
      anno0_ricavi: metrics.fatturato.currentYear,
      anno0_costi_personale: metrics.costiPersonale.currentYear,
      anno0_mp: metrics.costiMateriePrime.currentYear,
      anno0_servizi: metrics.costiServizi.currentYear,
      anno0_godimento: metrics.costiGodimento.currentYear,
      anno0_oneri_diversi: metrics.oneriDiversi.currentYear,
      anno0_ammortamenti: metrics.ammortamenti.currentYear,
      anno0_oneri_finanziari: metrics.oneriFinanziari.currentYear,
      anno0_utile: metrics.utile.currentYear,
      
      // Percentuali
      mp_pct: incidenze.mp_pct,
      servizi_pct: incidenze.servizi_pct,
      godimento_pct: incidenze.godimento_pct,
      oneri_pct: incidenze.oneri_pct,
      
      // Metadati
      ateco_code: atecoCode,
      scenario_type: scenario,
      growth_rate_override: growthRateOverride,
      growth_rate_applied: growthRate,
      
      // Stato Patrimoniale
      totale_attivo: metrics.totaleAttivo.currentYear,
      patrimonio_netto: metrics.patrimonioNetto.currentYear,
      debiti_totali: metrics.debitiTotali.currentYear,
      
      // ✅ DATI PROSPETTICI PRE-CALCOLATI
      anno1_data: JSON.stringify(prospectiveYears.anno1_data),
      anno2_data: JSON.stringify(prospectiveYears.anno2_data),
      anno3_data: JSON.stringify(prospectiveYears.anno3_data),
      
      // KPI
      kpi_derivati: JSON.stringify(kpis),
      
      // Sensibilità
      sensibilita: JSON.stringify(sensibilita),
      
      // Narrative
      narrative: narrative,
      
      status: 'completed'
    };

    console.log(`[${sessionId}] 🔧 Dati preparati`);

    // ============================================
    // STEP 16: INSERT SUPABASE
    // ============================================

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

    // ============================================
    // STEP 17: CLEANUP
    // ============================================

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
        anno0_ricavi: metrics.fatturato.currentYear,
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
