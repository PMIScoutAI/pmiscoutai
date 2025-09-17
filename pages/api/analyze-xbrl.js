// /pages/api/analyze-xbrl.js
// VERSIONE 13.3 (Fix Current Ratio Definitivo)
// - Mantiene la nuova struttura di auto-detection dei fogli.
// - Corregge il flusso logico riposizionando i blocchi di codice errati.
// - Mantiene il fix per la ricerca del "Totale Attivo".
// - Mantiene il pre-calcolo affidabile di EBITDA, EBIT e altri indicatori.
// - AGGIUNGE il calcolo corretto del Current Ratio

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import xlsx from 'xlsx';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// === SEZIONE: AUTO-DETECTION FOGLI ===

/**
 * Mappatura dei fogli XBRL per diverse tipologie societarie
 */
const SHEET_MAPPINGS = {
  // Standard per SRL, SPA, etc.
  standard: {
    companyInfo: ['T0000'],
    balanceSheet: ['T0002'],
    incomeStatement: ['T0006']
  },
  
  // Fallback per altre tipologie
  alternative: {
    companyInfo: ['T0000'],
    balanceSheet: ['T0001', 'T0002'], // T0001 come fallback
    incomeStatement: ['T0005', 'T0006'] // T0005 come fallback
  }
};

/**
 * Auto-detection del tipo di file XBRL basato sui fogli presenti
 */
const detectXbrlType = (workbook, sessionId) => {
  const availableSheets = Object.keys(workbook.Sheets);
  console.log(`[${sessionId}] 📋 Fogli disponibili:`, availableSheets.slice(0, 10)); // Log primi 10
  
  // Verifica presenza fogli standard
  const hasStandardSheets = ['T0000', 'T0002', 'T0006'].every(sheet => 
    availableSheets.includes(sheet)
  );
  
  if (hasStandardSheets) {
    console.log(`[${sessionId}] ✅ Rilevato formato XBRL STANDARD (SRL/SPA)`);
    return 'standard';
  } else {
    console.log(`[${sessionId}] 📄 Rilevato formato XBRL ALTERNATIVO - usando fallback`);
    return 'alternative';
  }
};

/**
 * Ottiene i fogli corretti basandosi sul tipo rilevato
 */
const getCorrectSheets = (workbook, xbrlType, sessionId) => {
  const mapping = SHEET_MAPPINGS[xbrlType];
  const availableSheets = Object.keys(workbook.Sheets);
  
  const result = {
    companyInfo: null,
    balanceSheet: null,
    incomeStatement: null
  };
  
  // Trova il foglio delle informazioni aziendali
  for (const sheetName of mapping.companyInfo) {
    if (availableSheets.includes(sheetName)) {
      result.companyInfo = workbook.Sheets[sheetName];
      console.log(`[${sessionId}] � Info aziendali: ${sheetName}`);
      break;
    }
  }
  
  // Trova il foglio dello stato patrimoniale
  for (const sheetName of mapping.balanceSheet) {
    if (availableSheets.includes(sheetName)) {
      result.balanceSheet = workbook.Sheets[sheetName];
      console.log(`[${sessionId}] 📊 Stato Patrimoniale: ${sheetName}`);
      break;
    }
  }
  
  // Trova il foglio del conto economico
  for (const sheetName of mapping.incomeStatement) {
    if (availableSheets.includes(sheetName)) {
      result.incomeStatement = workbook.Sheets[sheetName];
      console.log(`[${sessionId}] 💰 Conto Economico: ${sheetName}`);
      break;
    }
  }
  
  return result;
};

/**
 * Validazione della presenza di fogli critici
 */
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
  
  console.log(`[${sessionId}] ✅ Tutti i fogli necessari sono stati trovati`);
  return true;
};

// === FUNZIONI UTILITY ===

const parseValue = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let cleanVal = val.trim();
        const isNegative = cleanVal.startsWith('(') && cleanVal.endsWith(')');
        if (isNegative) cleanVal = '-' + cleanVal.substring(1, cleanVal.length - 1);
        cleanVal = cleanVal.replace(/\u00A0/g, '').replace(/['\s]/g, '').replace(/\u2212/g, '-').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
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
    console.log(`Colonne anni trovate: N -> ${years[0].col}, N-1 -> ${years[1].col}`);
    return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

const findSimpleValue = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    
    for (const row of sheetData) {
        for (let j = 0; j < row.length; j++) {
            const cellContent = String(row[j] || '').toLowerCase().trim();
            
            if (normalizedSearchTexts.some(searchText => cellContent.includes(searchText))) {
                console.log(`🔍 Trovato termine di ricerca in colonna ${j}: "${cellContent}"`);
                
                for (let k = j + 1; k < row.length; k++) {
                    const valueCell = String(row[k] || '').trim();
                    if (valueCell && valueCell !== '' && !normalizedSearchTexts.some(st => valueCell.toLowerCase().includes(st))) {
                        console.log(`✅ Valore trovato in colonna ${k}: "${valueCell}"`);
                        return valueCell;
                    }
                }
            }
        }
    }
    console.log(`⚠️ Valore non trovato per i termini: ${searchTexts.join(', ')}`);
    return null;
};

const findValueInSheetImproved = (sheetData, searchConfigs, yearCols, metricName) => {
    console.log(`--- Inizio ricerca per: [${metricName}] ---`);
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
                    console.log(`[${metricName}] 🎯 MATCH: "${description.substring(0, 50)}..." | Valori: N=${result.currentYear}, N-1=${result.previousYear}`);
                    return result;
                }
            }
        }
    }
    console.log(`[${metricName}] ⚠️ NESSUN MATCH trovato`);
    return { currentYear: null, previousYear: null };
};

// === CONFIGURAZIONI METRICHE - CON FIX TOTALE ATTIVO E PASSIVITÀ CORRENTI ===
const metricsConfigs = {
    fatturato: [{ primary: ["a) ricavi delle vendite e delle prestazioni"] }, { primary: ["ricavi delle vendite"] }, { primary: ["valore della produzione"], exclusion: ["costi", "differenza"] }],
    utilePerdita: [{ primary: ["utile (perdita) dell'esercizio"] }, { primary: ["risultato dell'esercizio"] }, { primary: ["risultato prima delle imposte"] }],
    
    // FIX 1: TOTALE ATTIVO - Reso più specifico per evitare conflitti
    totaleAttivo: [
        { primary: ["totale attivo", "a+b+c"] }, // Prima cerca con riferimento alle macro-classi
        { primary: ["totale attivo"], exclusion: ["circolante", "corrente", "c)"] }, // Poi fallback escludendo circolante
        { primary: ["totale attivo"] } // Ultima risorsa
    ],
    
    patrimonioNetto: [{ primary: ["totale patrimonio netto"] }, { primary: ["a) patrimonio netto"] }],
    debitiTotali: [{ primary: ["totale debiti"] }, { primary: ["d) debiti"] }],
    debitiBreveTermine: [{ primary: ["esigibili entro l'esercizio successivo"] }, { primary: ["debiti esigibili entro l'esercizio successivo"] }, { primary: ["entro l'esercizio successivo"] }],
    creditiClienti: [{ primary: ["crediti verso clienti"] }, { primary: ["totale crediti"] }, { primary: ["ii - crediti"], exclusion: ["soci"] }],
    debitiLungoTermine: [{ primary: ["esigibili oltre l'esercizio successivo"] }, { primary: ["debiti esigibili oltre l'esercizio successivo"] }],
    costiProduzione: [{ primary: ["b) costi della produzione"] }, { primary: ["costi della produzione"], exclusion: ["valore"] }],
    ammortamenti: [{ primary: ["ammortamenti e svalutazioni"] }],
    oneriFinanziari: [{ primary: ["interessi e altri oneri finanziari"] }],
    attivoCircolante: [{ primary: ["c) attivo circolante"], exclusion: ["immobilizzazioni"] }, { primary: ["totale attivo circolante"] }],
    rimanenze: [{ primary: ["rimanenze"] }],
    disponibilitaLiquide: [{ primary: ["disponibilità liquide"] }],
    imposte: [
        { primary: ["imposte sul reddito dell'esercizio"] },
        { primary: ["imposte sul reddito"] },
        { primary: ["totale imposte"] }
    ],
    
    // 🆕 NUOVA CONFIGURAZIONE PER PASSIVITÀ CORRENTI (FIX CURRENT RATIO)
    passivitaCorrente: [
        { primary: ["c) passività correnti"] },
        { primary: ["passività correnti"], exclusion: ["immobilizzazioni"] },
        { primary: ["totale passività correnti"] },
        { primary: ["passivo corrente"] },
        { primary: ["debiti esigibili entro l'esercizio successivo"] } // fallback con debiti a breve
    ]
};

// === FUNZIONI ATECO ===
const findAtecoValue = (sheetData, sessionId) => {
    console.log(`[${sessionId}] 🔍 Inizio ricerca specifica per codice ATECO`);
    const searchTerms = [
        "settore di attività prevalente (ateco)",
        "settore di attività prevalente",
        "codice ateco",
        "attività prevalente"
    ];
    for (const searchTerm of searchTerms) {
        console.log(`[${sessionId}] 🔎 Cercando: "${searchTerm}"`);
        for (let i = 0; i < sheetData.length; i++) {
            const row = sheetData[i];
            for (let j = 0; j < Math.min(row.length, 6); j++) {
                const cellValue = String(row[j] || '').toLowerCase().trim();
                if (cellValue.includes(searchTerm.toLowerCase())) {
                    console.log(`[${sessionId}] 🎯 Trovato termine "${searchTerm}" alla riga ${i}, colonna ${j}`);
                    for (let k = j + 1; k < row.length; k++) {
                        const valueCell = String(row[k] || '').trim();
                        // FIX: Aggiunta ricerca per codici a 6 cifre
                        if (valueCell && (valueCell.includes('(') || valueCell.match(/\d{2}\.\d{2}/) || valueCell.match(/^\d{6}$/))) {
                            console.log(`[${sessionId}] ✅ Valore ATECO trovato: "${valueCell}"`);
                            return valueCell;
                        }
                    }
                    for (let nextRow = i + 1; nextRow < Math.min(i + 3, sheetData.length); nextRow++) {
                        for (let col = 0; col < sheetData[nextRow].length; col++) {
                            const nextValue = String(sheetData[nextRow][col] || '').trim();
                            // FIX: Aggiunta ricerca per codici a 6 cifre anche nelle righe successive
                            if (nextValue && (nextValue.includes('(') || nextValue.match(/\d{2}\.\d{2}/) || nextValue.match(/^\d{6}$/))) {
                                console.log(`[${sessionId}] ✅ Valore ATECO trovato riga successiva: "${nextValue}"`);
                                return nextValue;
                            }
                        }
                    }
                }
            }
        }
    }
    console.log(`[${sessionId}] ❌ Nessun codice ATECO trovato con ricerca specifica`);
    return null;
};

const extractAtecoCode = (atecoString, sessionId) => {
    if (!atecoString) {
        console.log(`[${sessionId}] ❌ ATECO string vuota`);
        return null;
    }
    console.log(`[${sessionId}] 🔍 Estrazione ATECO da: "${atecoString}"`);
    const patterns = [
        // FIX: Aggiunto pattern per 6 cifre in PRIMA POSIZIONE
        { regex: /(\d{6})/, name: "Formato 6 cifre (139500)" },
        { regex: /\((\d{2})\.(\d{2})\.(\d{2})\)/, name: "Standard con parentesi (41.00.00)" },
        { regex: /(\d{2})\.(\d{2})\.(\d{2})/, name: "Standard senza parentesi 41.00.00" },
        { regex: /(\d{2})\.(\d{2})/, name: "Formato breve 41.00" },
        { regex: /(\d{2})-(\d{2})-(\d{2})/, name: "Con trattini 41-00-00" },
        { regex: /(\d{2})\s+(\d{2})\s+(\d{2})/, name: "Con spazi 41 00 00" },
        { regex: /(\d{2})/, name: "Solo divisione 41" }
    ];
    for (const { regex, name } of patterns) {
        const match = atecoString.match(regex);
        if (match) {
            let division, fullCode;
            
            // FIX: Gestione speciale per codici a 6 cifre
            if (name.includes("6 cifre")) {
                division = match[1].substring(0, 2); // Prime 2 cifre come divisione
                fullCode = match[1]; // Tutto il codice a 6 cifre
            } else {
                division = match[1];
                fullCode = match[0].replace(/[()]/g, '').replace(/[-\s]/g, '.');
            }
            
            console.log(`[${sessionId}] ✅ MATCH con pattern "${name}"`);
            console.log(`[${sessionId}] 📋 Divisione: ${division}, Codice completo: ${fullCode}`);
            return {
                full: fullCode,
                division: division,
                raw: atecoString,
                pattern_used: name
            };
        }
    }
    console.log(`[${sessionId}] 💥 NESSUN PATTERN ATECO RICONOSCIUTO in: "${atecoString}"`);
    return null;
};

const getSectorInfo = async (divisionCode, sessionId) => {
    if (!divisionCode) return null;
    try {
        const { data, error } = await supabase
            .from('ateco_macro_map')
            .select('macro_sector, macro_sector_2, notes')
            .eq('ateco_code', divisionCode)
            .single();
        if (error || !data) {
            console.log(`[${sessionId}] [ATECO] ⚠️ Divisione ${divisionCode} non trovata nel mapping`);
            return null;
        }
        console.log(`[${sessionId}] [ATECO] ✅ Trovato: ${data.macro_sector}${data.macro_sector_2 ? ` - ${data.macro_sector_2}` : ''}`);
        return data;
    } catch (err) {
        console.error(`[${sessionId}] [ATECO] Errore query per divisione ${divisionCode}:`, err);
        return null;
    }
};

// === FUNZIONE PRE-CALCOLO INDICATORI (CON FIX CURRENT RATIO) ===
const calculateFinancialIndicators = (metrics, sessionId) => {
    console.log(`[${sessionId}] 🧮 Inizio calcolo indicatori derivati...`);
    
    // Estrai valori dell'anno corrente, con fallback a 0
    const currentYearMetrics = {
        utile: metrics.utilePerdita.currentYear || 0,
        imposte: metrics.imposte.currentYear || 0,
        oneriFinanziari: metrics.oneriFinanziari.currentYear || 0,
        ammortamenti: metrics.ammortamenti.currentYear || 0,
    };
    
    // Estrai valori dell'anno precedente, con fallback a 0
    const previousYearMetrics = {
        utile: metrics.utilePerdita.previousYear || 0,
        imposte: metrics.imposte.previousYear || 0,
        oneriFinanziari: metrics.oneriFinanziari.previousYear || 0,
        ammortamenti: metrics.ammortamenti.previousYear || 0,
    };
    
    // CALCOLO EBITDA E EBIT
    const ebitda_current = currentYearMetrics.utile + currentYearMetrics.imposte + currentYearMetrics.oneriFinanziari + currentYearMetrics.ammortamenti;
    const ebit_current = ebitda_current - currentYearMetrics.ammortamenti;
    
    const ebitda_previous = previousYearMetrics.utile + previousYearMetrics.imposte + previousYearMetrics.oneriFinanziari + previousYearMetrics.ammortamenti;
    const ebit_previous = ebitda_previous - previousYearMetrics.ammortamenti;
    
    // Log per debugging
    console.log(`[${sessionId}] 📊 CALCOLI ANNO CORRENTE:`);
    console.log(`   Utile: ${currentYearMetrics.utile}`);
    console.log(`   Imposte: ${currentYearMetrics.imposte}`);
    console.log(`   Oneri Finanziari: ${currentYearMetrics.oneriFinanziari}`);
    console.log(`   Ammortamenti: ${currentYearMetrics.ammortamenti}`);
    console.log(`   ➡️ EBITDA: ${ebitda_current}`);
    console.log(`   ➡️ EBIT: ${ebit_current}`);
    
    // Aggiungi gli indicatori calcolati all'oggetto metrics
    metrics.ebitda = { 
        currentYear: ebitda_current, 
        previousYear: ebitda_previous 
    };
    
    metrics.ebit = { 
        currentYear: ebit_current, 
        previousYear: ebit_previous 
    };
    
    // Calcola altri ratio utili
    const fatturato_current = metrics.fatturato.currentYear || 0;
    const patrimonioNetto_current = metrics.patrimonioNetto.currentYear || 0;
    
    metrics.margineEbitda = {
        currentYear: fatturato_current !== 0 ? ((ebitda_current / fatturato_current) * 100) : null,
        previousYear: null // Estendere se necessario
    };
    
    metrics.roe = {
        currentYear: patrimonioNetto_current !== 0 ? ((currentYearMetrics.utile / patrimonioNetto_current) * 100) : null,
        previousYear: null
    };
    
    // 🆕 FIX CURRENT RATIO - CALCOLO CORRETTO
    const attivoCorrente_current = metrics.attivoCircolante.currentYear || 0;
    const passivitaCorrente_current = metrics.passivitaCorrente.currentYear || 0;
    const attivoCorrente_previous = metrics.attivoCircolante.previousYear || 0;
    const passivitaCorrente_previous = metrics.passivitaCorrente.previousYear || 0;
    
    metrics.currentRatio = {
        currentYear: passivitaCorrente_current !== 0 ? (attivoCorrente_current / passivitaCorrente_current) : null,
        previousYear: passivitaCorrente_previous !== 0 ? (attivoCorrente_previous / passivitaCorrente_previous) : null
    };
    
    console.log(`[${sessionId}] 📊 CURRENT RATIO CALCOLATO:`);
    console.log(`   Anno Corrente: ${attivoCorrente_current} / ${passivitaCorrente_current} = ${metrics.currentRatio.currentYear?.toFixed(2) || 'N/D'}`);
    console.log(`   Anno Precedente: ${attivoCorrente_previous} / ${passivitaCorrente_previous} = ${metrics.currentRatio.previousYear?.toFixed(2) || 'N/D'}`);
    
    console.log(`[${sessionId}] ✅ Indicatori calcolati con successo`);
    return metrics;
};

// === HANDLER PRINCIPALE ===

export default async function handler(req, res) {
  const { sessionId } = req.query;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  if (!sessionId) return res.status(400).json({ error: 'SessionId è richiesto' });
  
  console.log(`[${sessionId}] 🚀 Avvio analisi XBRL (versione 13.3 - Auto-Detection + Fix Current Ratio).`);

  try {
    const { data: session, error: sessionError } = await supabase.from('checkup_sessions').select('*, companies(*)').eq('id', sessionId).single();
    if (sessionError || !session) throw new Error('Sessione non trovata.');

    const { data: fileBlob, error: downloadError } = await supabase.storage.from('checkup-documents').download(session.file_path);
    if (downloadError) throw new Error('Impossibile scaricare il file di bilancio.');
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });

    // Auto-detection del tipo XBRL
    console.log(`[${sessionId}] 🔍 Avvio auto-detection tipo XBRL...`);
    const xbrlType = detectXbrlType(workbook, sessionId);
    const sheets = getCorrectSheets(workbook, xbrlType, sessionId);
    validateSheets(sheets, sessionId);

    // Conversione fogli a dati
    const companyInfoData = xlsx.utils.sheet_to_json(sheets.companyInfo, { header: 1 });
    const balanceSheetData = xlsx.utils.sheet_to_json(sheets.balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(sheets.incomeStatement, { header: 1 });

    console.log(`[${sessionId}] 📊 Dati estratti: Info=${companyInfoData.length} righe, SP=${balanceSheetData.length} righe, CE=${incomeStatementData.length} righe`);

    // Trova colonne anni
    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    // Estrai info azienda
    const companyName = findSimpleValue(companyInfoData, [
        'denominazione', 
        'ragione sociale',
        'denominazione sociale',
        'nome azienda'
    ]) || session.companies?.company_name || session.company_name || 'Azienda Sconosciuta';
    
    console.log(`[${sessionId}] 🏢 Nome azienda estratto: "${companyName}"`);

    const sedeRow = findSimpleValue(companyInfoData, ["sede"]);
    const regionMatch = sedeRow ? sedeRow.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    // Gestione ATECO
    console.log(`[${sessionId}] 🚀 Avvio ricerca ATECO migliorata`);
    let rawAtecoString = findAtecoValue(companyInfoData, sessionId);
    if (!rawAtecoString) {
        console.log(`[${sessionId}] ⚠️ Ricerca specifica fallita, uso fallback`);
        rawAtecoString = findSimpleValue(companyInfoData, ["settore di attività prevalente", "codice ateco", "attività prevalente"]);
    }
    console.log(`[${sessionId}] 📋 ATECO grezzo estratto: "${rawAtecoString}"`);
    
    const atecoData = extractAtecoCode(rawAtecoString, sessionId);
    if (!atecoData) console.log(`[${sessionId}] ❌ ATECO non estratto - continuando senza info settoriale`);

    const sectorInfo = await getSectorInfo(atecoData?.division, sessionId);

    console.log(`[${sessionId}] 🎯 RISULTATO FINALE ATECO:`);
    console.log(`   - Testo originale: "${rawAtecoString}"`);
    console.log(`   - Divisione estratta: ${atecoData?.division || 'NONE'}`);
    console.log(`   - Settore trovato: ${sectorInfo?.macro_sector || 'NONE'}`);

    const context = {
        xbrl_type: xbrlType,
        ateco_code: atecoData?.full || rawAtecoString,
        ateco_division: atecoData?.division,
        region: region,
        macro_sector: sectorInfo?.macro_sector,
        macro_sector_2: sectorInfo?.macro_sector_2,
        sector_notes: sectorInfo?.notes,
        ateco_extraction_method: rawAtecoString === findAtecoValue(companyInfoData, sessionId) ? 'specific' : 'fallback',
        ateco_pattern_used: atecoData?.pattern_used
    };

    // Estrai metriche base (CON PASSIVITÀ CORRENTI)
    let metrics = {
        fatturato: findValueInSheetImproved(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
        utilePerdita: findValueInSheetImproved(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile/Perdita CE') || findValueInSheetImproved(balanceSheetData, metricsConfigs.utilePerdita, yearColsBS, 'Utile/Perdita SP'),
        totaleAttivo: findValueInSheetImproved(balanceSheetData, metricsConfigs.totaleAttivo, yearColsBS, 'Totale Attivo'),
        patrimonioNetto: findValueInSheetImproved(balanceSheetData, metricsConfigs.patrimonioNetto, yearColsBS, 'Patrimonio Netto'),
        debitiTotali: findValueInSheetImproved(balanceSheetData, metricsConfigs.debitiTotali, yearColsBS, 'Debiti Totali'),
        debitiBreveTermine: findValueInSheetImproved(balanceSheetData, metricsConfigs.debitiBreveTermine, yearColsBS, 'Debiti Breve Termine'),
        creditiClienti: findValueInSheetImproved(balanceSheetData, metricsConfigs.creditiClienti, yearColsBS, 'Crediti'),
        debitiLungoTermine: findValueInSheetImproved(balanceSheetData, metricsConfigs.debitiLungoTermine, yearColsBS, 'Debiti Lungo Termine'),
        costiProduzione: findValueInSheetImproved(incomeStatementData, metricsConfigs.costiProduzione, yearColsIS, 'Costi Produzione'),
        ammortamenti: findValueInSheetImproved(incomeStatementData, metricsConfigs.ammortamenti, yearColsIS, 'Ammortamenti'),
        oneriFinanziari: findValueInSheetImproved(incomeStatementData, metricsConfigs.oneriFinanziari, yearColsIS, 'Oneri Finanziari'),
        attivoCircolante: findValueInSheetImproved(balanceSheetData, metricsConfigs.attivoCircolante, yearColsBS, 'Attivo Circolante'),
        rimanenze: findValueInSheetImproved(balanceSheetData, metricsConfigs.rimanenze, yearColsBS, 'Rimanenze'),
        disponibilitaLiquide: findValueInSheetImproved(balanceSheetData, metricsConfigs.disponibilitaLiquide, yearColsBS, 'Disponibilità Liquide'),
        imposte: findValueInSheetImproved(incomeStatementData, metricsConfigs.imposte, yearColsIS, 'Imposte'),
        
        // 🆕 ESTRAZIONE PASSIVITÀ CORRENTI PER CURRENT RATIO
        passivitaCorrente: findValueInSheetImproved(balanceSheetData, metricsConfigs.passivitaCorrente, yearColsBS, 'Passività Correnti')
