// /pages/api/analyze-xbrl.js
// VERSIONE 17.2 (Fix Definitivo e Completo)
// - FIX 1: Corretta la ricerca del "Totale Attivo" per essere più specifica.
// - FIX 2: Implementato il calcolo deterministico di EBITDA ed EBIT direttamente nello script.
// - L'AI ora riceve i dati di redditività già calcolati e corretti.
// - Questo script è completo e non omette alcuna funzione.

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


// === SEZIONE MAPPATURA FOGLI ===
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

const findSheet = (workbook, sheetNames) => {
    for (const name of sheetNames) {
        if (workbook.Sheets[name]) {
            console.log(`✅ Foglio trovato: ${name}`);
            return workbook.Sheets[name];
        }
    }
    return null;
};


// === FUNZIONI DI UTILITY PER IL PARSING ===

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

// --- FIX 1: Configurazioni di ricerca corrette e più specifiche ---
const metricsConfigs = {
    fatturato: [{ primary: ["a) ricavi delle vendite e delle prestazioni"] }, { primary: ["ricavi delle vendite"] }, { primary: ["valore della produzione"], exclusion: ["costi", "differenza"] }],
    utilePerdita: [{ primary: ["utile (perdita) dell'esercizio"] }, { primary: ["risultato dell'esercizio"] }, { primary: ["risultato prima delle imposte"] }],
    totaleAttivo: [
        { primary: ["totale attivo", "a+b+c"] }, // Criterio specifico per evitare il match con l'attivo circolante
        { primary: ["totale attivo"] } // Fallback
    ],
    patrimonioNetto: [{ primary: ["totale patrimonio netto"] }, { primary: ["a) patrimonio netto"] }],
    debitiTotali: [{ primary: ["totale debiti"] }, { primary: ["d) debiti"] }],
    debitiBreveTermine: [{ primary: ["esigibili entro l'esercizio successivo"] }, { primary: ["debiti esigibili entro l'esercizio successivo"] }, { primary: ["entro l'esercizio successivo"] }],
    creditiClienti: [{ primary: ["crediti verso clienti"] }, { primary: ["totale crediti"] }, { primary: ["ii - crediti"], exclusion: ["soci"] }],
    costiProduzione: [{ primary: ["b) costi della produzione"] }, { primary: ["costi della produzione"], exclusion: ["valore"] }],
    ammortamenti: [{ primary: ["ammortamenti e svalutazioni"] }],
    oneriFinanziari: [{ primary: ["interessi e altri oneri finanziari"] }],
    attivoCircolante: [{ primary: ["c) attivo circolante"], exclusion: ["immobilizzazioni"] }, { primary: ["totale attivo circolante"] }],
    rimanenze: [{ primary: ["rimanenze"] }],
    disponibilitaLiquide: [{ primary: ["disponibilità liquide"] }],
    debitiLungoTermine: [{ primary: ["esigibili oltre l'esercizio successivo"] }, { primary: ["debiti esigibili oltre l'esercizio successivo"] }],
    imposte: [
        { primary: ["imposte sul reddito dell'esercizio"] },
        { primary: ["imposte sul reddito"] },
        { primary: ["totale imposte"] }
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
        for (let i = 0; i < sheetData.length; i++) {
            const row = sheetData[i];
            for (let j = 0; j < Math.min(row.length, 6); j++) {
                const cellValue = String(row[j] || '').toLowerCase().trim();
                if (cellValue.includes(searchTerm.toLowerCase())) {
                    for (let k = j + 1; k < row.length; k++) {
                        const valueCell = String(row[k] || '').trim();
                        if (valueCell && (valueCell.includes('(') || valueCell.match(/\d{2}\.\d{2}/))) {
                            return valueCell;
                        }
                    }
                    for (let nextRow = i + 1; nextRow < Math.min(i + 3, sheetData.length); nextRow++) {
                        for (let col = 0; col < sheetData[nextRow].length; col++) {
                            const nextValue = String(sheetData[nextRow][col] || '').trim();
                            if (nextValue && (nextValue.includes('(') || nextValue.match(/\d{2}\.\d{2}/))) {
                                return nextValue;
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
};

const extractAtecoCode = (atecoString, sessionId) => {
    if (!atecoString) return null;
    const patterns = [
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
            const division = match[1];
            const fullCode = match[0].replace(/[()]/g, '').replace(/[-\s]/g, '.');
            return { full: fullCode, division: division, raw: atecoString, pattern_used: name };
        }
    }
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
        return data;
    } catch (err) {
        console.error(`[${sessionId}] [ATECO] Errore query per divisione ${divisionCode}:`, err);
        return null;
    }
};


// === FUNZIONE PRINCIPALE (HANDLER) ===
export default async function handler(req, res) {
  const { sessionId } = req.query;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  if (!sessionId) return res.status(400).json({ error: 'SessionId è richiesto' });
  
  console.log(`[${sessionId}] Avvio analisi XBRL (versione 17.2 - Fix Definitivo).`);

  try {
    const { data: session, error: sessionError } = await supabase.from('checkup_sessions').select('*, companies(*)').eq('id', sessionId).single();
    if (sessionError || !session) throw new Error('Sessione non trovata.');

    const { data: fileBlob, error: downloadError } = await supabase.storage.from('checkup-documents').download(session.file_path);
    if (downloadError) throw new Error('Impossibile scaricare il file di bilancio.');
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });

    const isStandard = workbook.SheetNames.includes('T0002') && workbook.SheetNames.includes('T0006');
    const xbrlType = isStandard ? 'standard' : 'alternative';
    console.log(`[${sessionId}] Tipo XBRL rilevato: ${xbrlType}`);
    const mapping = SHEET_MAPPINGS[xbrlType];
    
    const sheetCompanyInfo = findSheet(workbook, mapping.companyInfo);
    const sheetBalanceSheet = findSheet(workbook, mapping.balanceSheet);
    const sheetIncomeStatement = findSheet(workbook, mapping.incomeStatement);

    if (!sheetCompanyInfo || !sheetBalanceSheet || !sheetIncomeStatement) {
        throw new Error(`Impossibile trovare uno o più fogli necessari per il tipo ${xbrlType}.`);
    }

    const companyInfoData = xlsx.utils.sheet_to_json(sheetCompanyInfo, { header: 1 });
    const balanceSheetData = xlsx.utils.sheet_to_json(sheetBalanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(sheetIncomeStatement, { header: 1 });

    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    const companyName = findSimpleValue(companyInfoData, ['denominazione', 'ragione sociale']) || session.companies?.company_name || 'Azienda Sconosciuta';
    
    const rawAtecoString = findAtecoValue(companyInfoData, sessionId);
    const atecoData = extractAtecoCode(rawAtecoString, sessionId);
    const sectorInfo = await getSectorInfo(atecoData?.division, sessionId);
    
    const sedeRow = findSimpleValue(companyInfoData, ["sede"]);
    const regionMatch = sedeRow ? sedeRow.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    const context = {
        region: region,
        ateco_code: atecoData?.full || rawAtecoString,
        ateco_division: atecoData?.division,
        macro_sector: sectorInfo?.macro_sector,
        macro_sector_2: sectorInfo?.macro_sector_2,
        sector_notes: sectorInfo?.notes,
        ateco_pattern_used: atecoData?.pattern_used
    };

    const metrics = {
        fatturato: findValueInSheetImproved(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
        utilePerdita: findValueInSheetImproved(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile/Perdita'),
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
        imposte: findValueInSheetImproved(incomeStatementData, metricsConfigs.imposte, yearColsIS, 'Imposte')
    };
    
    // --- FIX 2: Calcolo deterministico di EBITDA ed EBIT ---
    console.log(`[${sessionId}] Inizio calcolo indicatori derivati.`);
    const cy = { // Dati Anno Corrente (Current Year)
        utile: metrics.utilePerdita.currentYear || 0,
        imposte: metrics.imposte.currentYear || 0,
        oneriFinanziari: metrics.oneriFinanziari.currentYear || 0,
        ammortamenti: metrics.ammortamenti.currentYear || 0,
    };

    const ebitdaCurrentYear = cy.utile + cy.imposte + cy.oneriFinanziari + cy.ammortamenti;
    const ebitCurrentYear = ebitdaCurrentYear - cy.ammortamenti;

    metrics.ebitda = { currentYear: ebitdaCurrentYear, previousYear: null };
    metrics.ebit = { currentYear: ebitCurrentYear, previousYear: null };

    console.log(`[${sessionId}] ✅ EBITDA Calcolato (N): ${ebitdaCurrentYear}`);
    console.log(`[${sessionId}] ✅ EBIT Calcolato (N): ${ebitCurrentYear}`);
    // --- FINE FIX 2 ---

    const sectorialContext = sectorInfo ? `
- SETTORE SPECIFICO: ${sectorInfo.macro_sector.toUpperCase()}${sectorInfo.macro_sector_2 ? ` (${sectorInfo.macro_sector_2})` : ''}
- NOTE SETTORIALI: ${sectorInfo.notes}
- ISTRUZIONE AI: Analizza i dati considerando i KPI e le dinamiche specifiche del settore ${sectorInfo.macro_sector}.` : '';

    const dataForPrompt = `
Dati Aziendali per ${companyName}:
Contesto Aziendale:
- Regione: ${context.region || 'N/D'}
- Codice ATECO: ${context.ateco_code || 'N/D'}${sectorialContext}

Principali Voci di Bilancio (Anno Corrente N / Anno Precedente N-1):
- Fatturato: ${metrics.fatturato.currentYear} / ${metrics.fatturato.previousYear}
- EBITDA: ${ebitdaCurrentYear} / N/D
- Utile/(Perdita): ${metrics.utilePerdita.currentYear} / ${metrics.utilePerdita.previousYear}
- Totale Attivo: ${metrics.totaleAttivo.currentYear} / ${metrics.totaleAttivo.previousYear}
- Patrimonio Netto: ${metrics.patrimonioNetto.currentYear} / ${metrics.patrimonioNetto.previousYear}
- Debiti Totali: ${metrics.debitiTotali.currentYear} / ${metrics.debitiTotali.previousYear}
- Attivo Circolante: ${metrics.attivoCircolante.currentYear} / ${metrics.attivoCircolante.previousYear}
- Debiti a Breve Termine: ${metrics.debitiBreveTermine.currentYear} / ${metrics.debitiBreveTermine.previousYear}
`;

    const { data: promptData, error: promptError } = await supabase.from('ai_prompts').select('prompt_template').eq('name', 'FINANCIAL_ANALYSIS_V2').single();
    if (promptError || !promptData) throw new Error("Prompt 'FINANCIAL_ANALYSIS_V2' non trovato.");

    const finalPrompt = `${promptData.prompt_template}\n\n### DATI ESTRATTI DAL BILANCIO ###\n${dataForPrompt}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: finalPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    const resultToSave = {
      session_id: sessionId,
      company_name: companyName,
      health_score: analysisResult.health_score,
      key_metrics: analysisResult.key_metrics,
      swot: analysisResult.detailed_swot,
      recommendations: analysisResult.recommendations,
      charts_data: analysisResult.charts_data,
      summary: analysisResult.summary,
      raw_ai_response: analysisResult,
      detailed_swot: analysisResult.detailed_swot,
      risk_analysis: analysisResult.risk_analysis,
      pro_features_teaser: analysisResult.pro_features_teaser,
      raw_parsed_data: { metrics, context, companyName, xbrl_type: xbrlType }
    };
    
    await supabase.from('analysis_results').insert(resultToSave);
    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi XBRL completata con successo! Tipo: ${xbrlType}`);
    return res.status(200).json({ success: true, sessionId: sessionId, xbrl_type: xbrlType });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore fatale in analyze-xbrl:`, error);
    if (sessionId) {
      await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message });
  }
}

