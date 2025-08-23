// /pages/api/analyze-xbrl.js
// VERSIONE 7.0 (ROBUSTA): Implementa logiche di parsing e ricerca dati avanzate.
// - Identifica dinamicamente le colonne degli anni per un'estrazione affidabile.
// - Utilizza una funzione di parsing dei numeri potenziata.
// - Cerca le descrizioni delle metriche in un range di colonne più ampio.
// - Cerca l'utile prima nel Conto Economico.

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

/**
 * Funzione di parsing potenziata per gestire vari formati numerici.
 * @param {any} val - Il valore della cella.
 * @returns {number|null}
 */
const parseValue = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let cleanVal = val.trim();
        const isNegative = cleanVal.startsWith('(') && cleanVal.endsWith(')');
        if (isNegative) {
            cleanVal = '-' + cleanVal.substring(1, cleanVal.length - 1);
        }
        // Gestisce sia il punto come separatore delle migliaia che la virgola
        cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        // Rimuove caratteri non numerici, preservando il punto decimale e il segno meno
        cleanVal = cleanVal.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleanVal);
        return isNaN(num) ? null : num;
    }
    return null;
};

/**
 * Trova le colonne dell'anno corrente e precedente in un foglio di calcolo.
 * @param {Array<Array<any>>} sheetData - I dati del foglio.
 * @returns {{ currentYearCol: number, previousYearCol: number }}
 */
const findYearColumns = (sheetData) => {
    const yearRegex = /^(20\d{2})$/;
    let years = [];
    for (let i = 0; i < Math.min(sheetData.length, 15); i++) {
        const row = sheetData[i];
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j]).trim();
            if (yearRegex.test(cell)) {
                years.push({ year: parseInt(cell, 10), col: j });
            }
        }
        if (years.length >= 2) break;
    }
    if (years.length < 2) return { currentYearCol: 3, previousYearCol: 4 }; // Fallback
    
    years.sort((a, b) => b.year - a.year);
    return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

/**
 * Funzione di ricerca potenziata che usa le colonne degli anni trovate dinamicamente.
 * @param {Array<Array<any>>} sheetData - I dati del foglio.
 * @param {string[]} searchTexts - Array di possibili diciture.
 * @param {{ currentYearCol: number, previousYearCol: number }} yearCols - Gli indici delle colonne degli anni.
 * @returns {{ currentYear: number|null, previousYear: number|null }}
 */
const findValueInSheet = (sheetData, searchTexts, yearCols) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    
    for (const row of sheetData) {
        // Cerca la descrizione nelle prime 4 colonne per maggiore flessibilità
        for (let i = 0; i < 4; i++) {
            const description = String(row[i] || '').toLowerCase().trim();
            if (normalizedSearchTexts.some(searchText => description.includes(searchText))) {
                const rawCurrent = row[yearCols.currentYearCol];
                const rawPrevious = row[yearCols.previousYearCol];
                return { currentYear: parseValue(rawCurrent), previousYear: parseValue(rawPrevious) };
            }
        }
    }
    return { currentYear: null, previousYear: null };
};

/**
 * Funzione di ricerca per valori testuali potenziata.
 * @param {Array<Array<any>>} sheetData - I dati del foglio.
 * @param {string[]} searchTexts - Array di possibili diciture.
 * @returns {string|null}
 */
const findSimpleValue = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    for (const row of sheetData) {
        for (let i = 0; i < 4; i++) {
            const description = String(row[i] || '').toLowerCase().trim();
            if (normalizedSearchTexts.some(searchText => description.includes(searchText))) {
                // Ritorna il primo valore non vuoto nelle colonne successive
                for (let j = i + 1; j < row.length; j++) {
                    if (row[j]) return String(row[j]);
                }
            }
        }
    }
    return null;
};

/**
 * Trova un foglio di calcolo per nome o contenuto, cercando in più righe.
 * @param {object} workbook - L'oggetto workbook di SheetJS.
 * @param {string[]} keywords - Parole chiave da cercare.
 * @returns {Array<Array<any>>|null}
 */
const findSheetByKeywords = (workbook, keywords) => {
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    for (const sheetName of workbook.SheetNames) {
        if (normalizedKeywords.some(keyword => sheetName.toLowerCase().includes(keyword))) {
            return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        }
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        const contentToCheck = JSON.stringify(sheetData.slice(0, 20)).toLowerCase(); // Cerca nelle prime 20 righe
        if (normalizedKeywords.some(keyword => contentToCheck.includes(keyword))) {
            return sheetData;
        }
    }
    return null;
};


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId è richiesto' });
  }
  
  console.log(`[${sessionId}] Avvio analisi XBRL.`);

  try {
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('*, companies(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) throw new Error('Sessione non trovata.');
    if (!session.file_path) throw new Error('Percorso del file non trovato.');

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('checkup-documents')
      .download(session.file_path);

    if (downloadError) throw new Error('Impossibile scaricare il file di bilancio.');
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const workbook = xlsx.read(fileBuffer);
    
    const companyInfoSheet = findSheetByKeywords(workbook, ["t0000", "informazioni generali", "anagrafica"]);
    const balanceSheet = findSheetByKeywords(workbook, ["t0002", "stato patrimoniale"]);
    const incomeStatement = findSheetByKeywords(workbook, ["t0006", "conto economico"]);

    if (!companyInfoSheet) throw new Error("Foglio anagrafica non trovato.");
    if (!balanceSheet) throw new Error("Stato Patrimoniale non trovato.");
    if (!incomeStatement) throw new Error("Conto Economico non trovato.");

    // Identifica le colonne degli anni una sola volta
    const yearCols = findYearColumns(balanceSheet);

    const companyNameRow = companyInfoSheet.find(row => String(row[2] || '').toLowerCase().trim().includes('denominazione'));
    const companyName = companyNameRow ? companyNameRow[3] : 'Azienda Analizzata';

    const sedeRow = findSimpleValue(companyInfoSheet, ["sede"]);
    const regionMatch = sedeRow ? sedeRow.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    const context = {
        ateco: findSimpleValue(companyInfoSheet, ["codice ateco", "attività prevalente"]),
        region: region
    };

    const metrics = {
        fatturato: findValueInSheet(incomeStatement, ["ricavi delle vendite", "valore della produzione"], yearCols),
        // Cerca l'utile prima nel CE, poi nello SP come fallback
        utilePerdita: findValueInSheet(incomeStatement, ["utile (perdita) dell'esercizio", "risultato dell'esercizio"], yearCols) || findValueInSheet(balanceSheet, ["utile (perdita) dell'esercizio"], yearCols),
        totaleAttivo: findValueInSheet(balanceSheet, ["totale attivo"], yearCols),
        patrimonioNetto: findValueInSheet(balanceSheet, ["patrimonio netto"], yearCols),
        debitiTotali: findValueInSheet(balanceSheet, ["debiti"], yearCols),
        costiProduzione: findValueInSheet(incomeStatement, ["costi della produzione"], yearCols),
        ammortamenti: findValueInSheet(incomeStatement, ["ammortamenti e svalutazioni"], yearCols),
        oneriFinanziari: findValueInSheet(incomeStatement, ["interessi e altri oneri finanziari"], yearCols),
        attivoCircolante: findValueInSheet(balanceSheet, ["attivo circolante"], yearCols),
        debitiBreveTermine: findValueInSheet(balanceSheet, ["debiti esigibili entro l'esercizio successivo"], yearCols),
        creditiClienti: findValueInSheet(balanceSheet, ["crediti verso clienti"], yearCols),
        rimanenze: findValueInSheet(balanceSheet, ["rimanenze"], yearCols),
        disponibilitaLiquide: findValueInSheet(balanceSheet, ["disponibilità liquide"], yearCols),
    };

    const dataForPrompt = `
Dati Aziendali per ${companyName}:

Contesto Aziendale:
- Regione: ${context.region || 'N/D'}
- Codice ATECO (Settore): ${context.ateco || 'N/D'}

Principali Voci di Conto Economico (Anno Corrente N / Anno Precedente N-1):
- Fatturato: ${metrics.fatturato.currentYear} / ${metrics.fatturato.previousYear}
- Costi della Produzione: ${metrics.costiProduzione.currentYear} / ${metrics.costiProduzione.previousYear}
- Ammortamenti e Svalutazioni: ${metrics.ammortamenti.currentYear} / ${metrics.ammortamenti.previousYear}
- Oneri Finanziari: ${metrics.oneriFinanziari.currentYear} / ${metrics.oneriFinanziari.previousYear}
- Utile/(Perdita) d'esercizio: ${metrics.utilePerdita.currentYear} / ${metrics.utilePerdita.previousYear}

Principali Voci di Stato Patrimoniale (Anno Corrente N / Anno Precedente N-1):
- Totale Attivo: ${metrics.totaleAttivo.currentYear} / ${metrics.totaleAttivo.previousYear}
- Patrimonio Netto: ${metrics.patrimonioNetto.currentYear} / ${metrics.patrimonioNetto.previousYear}
- Debiti Totali: ${metrics.debitiTotali.currentYear} / ${metrics.debitiTotali.previousYear}
- Attivo Circolante: ${metrics.attivoCircolante.currentYear} / ${metrics.attivoCircolante.previousYear}
- Debiti a Breve Termine: ${metrics.debitiBreveTermine.currentYear} / ${metrics.debitiBreveTermine.previousYear}
- Crediti verso Clienti: ${metrics.creditiClienti.currentYear} / ${metrics.creditiClienti.previousYear}
- Rimanenze: ${metrics.rimanenze.currentYear} / ${metrics.rimanenze.previousYear}
- Disponibilità Liquide: ${metrics.disponibilitaLiquide.currentYear} / ${metrics.disponibilitaLiquide.previousYear}
`;

    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2')
      .single();

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
      raw_parsed_data: { metrics, context }
    };
    
    const { error: saveError } = await supabase.from('analysis_results').insert(resultToSave);
    if (saveError) throw new Error(`Salvataggio fallito: ${saveError.message}`);

    await supabase
      .from('checkup_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi XBRL completata con successo!`);
    return res.status(200).json({ success: true, sessionId: sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore fatale in analyze-xbrl:`, error.message);
    if (sessionId) {
      await supabase
        .from('checkup_sessions')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message });
  }
}
