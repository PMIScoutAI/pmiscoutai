// /pages/api/analyze-xbrl.js
// VERSIONE 13.8 (Ricerca Strict Debiti a Breve) - ROLLBACK FUNZIONANTE
// - Mantiene tutte le feature precedenti.
// - Sostituisce la ricerca generica dei debiti a breve con una funzione specializzata
//   'findDebitiBreveTermineStrict' che opera solo nella sezione PASSIVO per massima accuratezza.

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
      console.log(`[${sessionId}] 🏢 Info aziendali: ${sheetName}`);
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

const findAndSumCurrentLiabilities = (sheetData, yearCols, sessionId) => {
    console.log(`[${sessionId}] 🚀 Inizio calcolo specializzato per Passività Correnti...`);
    
    let totalCurrentLiabilities = { currentYear: 0, previousYear: 0 };
    const logDetails = [];
    let inPassiveSection = false;

    const searchPatterns = ["esigibili entro l'esercizio successivo", "debiti esigibili entro", "entro l'esercizio successivo", "passività correnti"];
    const exclusionPatterns = ["crediti", "attivo"];
    const passiveSectionStarters = ["d) debiti", "passivo", "passività"];
    
    for (const row of sheetData) {
        let description = '';
        for (let i = 0; i < Math.min(row.length, 6); i++) {
            description += String(row[i] || '').toLowerCase().trim() + ' ';
        }
        description = description.replace(/\s+/g, ' ').trim();

        if (!inPassiveSection && passiveSectionStarters.some(starter => description.includes(starter))) {
            console.log(`[${sessionId}] ✅ Sezione PASSIVO identificata dalla riga: "${description.substring(0,50)}..."`);
            inPassiveSection = true;
        }

        if (!inPassiveSection) {
            continue;
        }

        const containsSearchPattern = searchPatterns.some(pattern => description.includes(pattern));
        const containsExclusionPattern = exclusionPatterns.some(pattern => description.includes(pattern));

        if (containsSearchPattern && !containsExclusionPattern) {
            const currentYearValue = parseValue(row[yearCols.currentYearCol]);
            const previousYearValue = parseValue(row[yearCols.previousYearCol]);

            if (currentYearValue !== null && currentYearValue > 0) {
                totalCurrentLiabilities.currentYear += currentYearValue;
                const logEntry = `   - Voce: "${description.substring(0, 70)}..." = ${currentYearValue.toLocaleString('it-IT')}€`;
                logDetails.push(logEntry);
            }
             if (previousYearValue !== null && previousYearValue > 0) {
                totalCurrentLiabilities.previousYear += previousYearValue;
            }
        }
    }

    if (logDetails.length > 0) {
        console.log(`[${sessionId}] 🔍 VOCI TROVATE E SOMMATE PER PASSIVITÀ CORRENTI (Anno Corrente):`);
        logDetails.forEach(log => console.log(log));
        console.log(`   ➡️ TOTALE CALCOLATO: ${totalCurrentLiabilities.currentYear.toLocaleString('it-IT')}€`);
    } else {
        console.log(`[${sessionId}] ⚠️ Nessuna voce specifica trovata per la somma delle Passività Correnti. Si tenterà il fallback.`);
    }

    if (totalCurrentLiabilities.currentYear === 0 && totalCurrentLiabilities.previousYear === 0) {
        return { currentYear: null, previousYear: null };
    }
    
    return totalCurrentLiabilities;
};

const findDebitiBreveTermineStrict = (sheetData, yearCols, sessionId) => {
  console.log(`[${sessionId}] 🔎 Ricerca STRICT Debiti a breve in sezione PASSIVO...`);
  let inPassive = false;

  for (const row of sheetData) {
    let desc = '';
    for (let i = 0; i < Math.min(row.length, 6); i++) desc += String(row[i] || '').toLowerCase().trim() + ' ';
    desc = desc.replace(/\s+/g, ' ').trim();

    if (!inPassive && (desc.includes('d) debiti') || desc.includes('passivo') || desc.includes('passività'))) {
      inPassive = true;
      continue;
    }
    if (!inPassive) continue;

    const hasDebiti = desc.includes('debiti');
    const hasEntro = desc.includes("esigibili entro l'esercizio successivo") || desc.includes("entro l'esercizio successivo");
    const hasCredito = desc.includes('crediti') || desc.includes('attivo');

    if (hasDebiti && hasEntro && !hasCredito) {
      const cur = parseValue(row[yearCols.currentYearCol]);
      const prev = parseValue(row[yearCols.previousYearCol]);
      console.log(`[${sessionId}] ✅ Debiti breve (STRICT) trovati: N=${cur} N-1=${prev} | "${desc.substring(0,60)}..."`);
      return { currentYear: cur, previousYear: prev, _source: 'strict' };
    }

    if (desc.startsWith('e) ') || desc.includes('totale passivo')) break;
  }

  console.log(`[${sessionId}] ⚠️ Nessun match STRICT per Debiti a breve`);
  return { currentYear: null, previousYear: null, _source: 'none' };
};

// === CONFIGURAZIONI METRICHE ===
const metricsConfigs = {
    fatturato: [{ primary: ["a) ricavi delle vendite e delle prestazioni"] }, { primary: ["ricavi delle vendite"] }, { primary: ["valore della produzione"], exclusion: ["costi", "differenza"] }],
    utilePerdita: [{ primary: ["utile (perdita) dell'esercizio"] }, { primary: ["risultato dell'esercizio"] }, { primary: ["risultato prima delle imposte"] }],
    totaleAttivo: [ { primary: ["totale attivo", "a+b+c"] }, { primary: ["totale attivo"], exclusion: ["circolante", "corrente", "c)"] }, { primary: ["totale attivo"] } ],
    patrimonioNetto: [{ primary: ["totale patrimonio netto"] }, { primary: ["a) patrimonio netto"] }],
    debitiTotali: [{ primary: ["totale debiti"] }, { primary: ["d) debiti"] }],
    creditiClienti: [{ primary: ["crediti verso clienti"] }, { primary: ["totale crediti"] }, { primary: ["ii - crediti"], exclusion: ["soci"] }],
    debitiLungoTermine: [{ primary: ["esigibili oltre l'esercizio successivo"] }, { primary: ["debiti esigibili oltre l'esercizio successivo"] }],
    costiProduzione: [{ primary: ["b) costi della produzione"] }, { primary: ["costi della produzione"], exclusion: ["valore"] }],
    ammortamenti: [{ primary: ["ammortamenti e svalutazioni"] }],
    oneriFinanziari: [{ primary: ["interessi e altri oneri finanziari"] }],
    attivoCircolante: [{ primary: ["c) attivo circolante"], exclusion: ["immobilizzazioni"] }, { primary: ["totale attivo circolante"] }],
    rimanenze: [{ primary: ["rimanenze"] }],
    disponibilitaLiquide: [{ primary: ["disponibilità liquide"] }],
    imposte: [ { primary: ["imposte sul reddito dell'esercizio"] }, { primary: ["imposte sul reddito"] }, { primary: ["totale imposte"] } ],
};

// === FUNZIONI ATECO ===
const findAtecoValue = (sheetData, sessionId) => {
    console.log(`[${sessionId}] 🔍 Inizio ricerca specifica per codice ATECO`);
    const searchTerms = [ "settore di attività prevalente (ateco)", "settore di attività prevalente", "codice ateco", "attività prevalente" ];
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
                        if (valueCell && (valueCell.includes('(') || valueCell.match(/\d{2}\.\d{2}/) || valueCell.match(/^\d{6}$/))) {
                            console.log(`[${sessionId}] ✅ Valore ATECO trovato: "${valueCell}"`);
                            return valueCell;
                        }
                    }
                    for (let nextRow = i + 1; nextRow < Math.min(i + 3, sheetData.length); nextRow++) {
                        for (let col = 0; col < sheetData[nextRow].length; col++) {
                            const nextValue = String(sheetData[nextRow][col] || '').trim();
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
            if (name.includes("6 cifre")) {
                division = match[1].substring(0, 2);
                fullCode = match[1];
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

// === FUNZIONE PRE-CALCOLO INDICATORI ===
const calculateFinancialIndicators = (metrics, sessionId) => {
    console.log(`[${sessionId}] 🧮 Inizio calcolo indicatori derivati...`);
    
    const currentYearMetrics = {
        utile: metrics.utilePerdita.currentYear || 0,
        imposte: metrics.imposte.currentYear || 0,
        oneriFinanziari: metrics.oneriFinanziari.currentYear || 0,
        ammortamenti: metrics.ammortamenti.currentYear || 0,
    };
    
    const previousYearMetrics = {
        utile: metrics.utilePerdita.previousYear || 0,
        imposte: metrics.imposte.previousYear || 0,
        oneriFinanziari: metrics.oneriFinanziari.previousYear || 0,
        ammortamenti: metrics.ammortamenti.previousYear || 0,
    };
    
    const ebitda_current = currentYearMetrics.utile + currentYearMetrics.imposte + currentYearMetrics.oneriFinanziari + currentYearMetrics.ammortamenti;
    const ebit_current = ebitda_current - currentYearMetrics.ammortamenti;
    const ebitda_previous = previousYearMetrics.utile + previousYearMetrics.imposte + previousYearMetrics.oneriFinanziari + previousYearMetrics.ammortamenti;
    const ebit_previous = ebitda_previous - previousYearMetrics.ammortamenti;
    
    metrics.ebitda = { currentYear: ebitda_current, previousYear: ebitda_previous };
    metrics.ebit = { currentYear: ebit_current, previousYear: ebit_previous };
    
    const fatturato_current = metrics.fatturato.currentYear || 0;
    const patrimonioNetto_current = metrics.patrimonioNetto.currentYear || 0;
    
    metrics.margineEbitda = {
        currentYear: fatturato_current !== 0 ? ((ebitda_current / fatturato_current) * 100) : null,
        previousYear: null
    };
    
    metrics.roe = {
        currentYear: patrimonioNetto_current !== 0 ? ((currentYearMetrics.utile / patrimonioNetto_current) * 100) : null,
        previousYear: null
    };
    
    // ROI = EBIT / Totale Attivo * 100
    const totaleAttivo_current = metrics.totaleAttivo.currentYear || 0;
    const totaleAttivo_previous = metrics.totaleAttivo.previousYear || 0;
    metrics.roi = {
        currentYear: totaleAttivo_current !== 0 ? ((ebit_current / totaleAttivo_current) * 100) : null,
        previousYear: totaleAttivo_previous !== 0 ? ((ebit_previous / totaleAttivo_previous) * 100) : null
    };

    // Debt/Equity = Debiti Totali / Patrimonio Netto
    const debitiTotali_current = metrics.debitiTotali.currentYear || 0;
    const debitiTotali_previous = metrics.debitiTotali.previousYear || 0;
    const patrimonioNetto_previous = metrics.patrimonioNetto.previousYear || 0;
    metrics.debtEquity = {
        currentYear: patrimonioNetto_current !== 0 ? (debitiTotali_current / patrimonioNetto_current) : null,
        previousYear: patrimonioNetto_previous !== 0 ? (debitiTotali_previous / patrimonioNetto_previous) : null
    };
    
    console.log(`[${sessionId}] 📊 ROI CALCOLATO:`);
    console.log(`   Anno Corrente: ${ebit_current} / ${totaleAttivo_current} = ${metrics.roi.currentYear?.toFixed(2) || 'N/D'}%`);
    console.log(`   Anno Precedente: ${ebit_previous} / ${totaleAttivo_previous} = ${metrics.roi.previousYear?.toFixed(2) || 'N/D'}%`);
    console.log(`[${sessionId}] 📊 DEBT/EQUITY CALCOLATO:`);
    console.log(`   Anno Corrente: ${debitiTotali_current} / ${patrimonioNetto_current} = ${metrics.debtEquity.currentYear?.toFixed(2) || 'N/D'}`);
    console.log(`   Anno Precedente: ${debitiTotali_previous} / ${patrimonioNetto_previous} = ${metrics.debtEquity.previousYear?.toFixed(2) || 'N/D'}`);


    let passivitaCorrente_current = metrics.passivitaCorrente.currentYear;
    let passivitaCorrente_previous = metrics.passivitaCorrente.previousYear;

    if (passivitaCorrente_current === null && metrics.debitiBreveTermine.currentYear !== null) {
        passivitaCorrente_current = metrics.debitiBreveTermine.currentYear;
        console.log(`[${sessionId}] ⚠️ FALLBACK ANNO CORRENTE: Somma non riuscita. Usando Debiti Breve Termine (${passivitaCorrente_current}) per il Current Ratio.`);
    }
    if (passivitaCorrente_previous === null && metrics.debitiBreveTermine.previousYear !== null) {
        passivitaCorrente_previous = metrics.debitiBreveTermine.previousYear;
        console.log(`[${sessionId}] ⚠️ FALLBACK ANNO PRECEDENTE: Somma non riuscita. Usando Debiti Breve Termine (${passivitaCorrente_previous}) per il Current Ratio.`);
    }
    
    metrics.passivitaCorrente.currentYear = passivitaCorrente_current;
    metrics.passivitaCorrente.previousYear = passivitaCorrente_previous;

    const attivoCorrente_current = metrics.attivoCircolante.currentYear || 0;
    const attivoCorrente_previous = metrics.attivoCircolante.previousYear || 0;
    
    metrics.currentRatio = {
        currentYear: passivitaCorrente_current !== 0 && passivitaCorrente_current !== null ? (attivoCorrente_current / passivitaCorrente_current) : null,
        previousYear: passivitaCorrente_previous !== 0 && passivitaCorrente_previous !== null ? (attivoCorrente_previous / passivitaCorrente_previous) : null
    };
    
    console.log(`[${sessionId}] 📊 CURRENT RATIO FINALE CALCOLATO:`);
    console.log(`   Anno Corrente: ${attivoCorrente_current} / ${passivitaCorrente_current} = ${metrics.currentRatio.currentYear?.toFixed(2) || 'N/D'}`);
    console.log(`   Anno Precedente: ${attivoCorrente_previous} / ${passivitaCorrente_previous} = ${metrics.currentRatio.previousYear?.toFixed(2) || 'N/D'}`);
    
    console.log(`[${sessionId}] ✅ Indicatori calcolati con successo`);
    return metrics;
};


// === HANDLER PRINCIPALE ===

export default async function handler(req, res) {
  const { sessionId } = req.query;
  if (req.method !== '
