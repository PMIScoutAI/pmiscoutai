// /pages/api/analyze-xbrl.js
// VERSIONE 7.2 (ROBUSTA):
// - Bucket parametrico (DOCS_BUCKET) e allineato con upload.
// - Colonne degli anni calcolate per foglio (CE/SP).
// - Parsing numeri potenziato (NBSP, minus unicode, parentesi negative, etc.).
// - Ricerca descrizioni su più colonne.
// - Prompt più vincolante (system message + istruzioni chiare).

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

const DOCS_BUCKET = process.env.DOCS_BUCKET || 'checkup-files';

/** -------------------- Utilities -------------------- **/

/**
 * Parsing numerico robusto (migliaia/decimali EU, NBSP, minus unicode, parentesi negative).
 */
const parseValue = (val) => {
  if (val == null || String(val).trim() === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'string') {
    let s = val.trim();
    // parentesi => negativo
    if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
    s = s
      .replace(/\u00A0/g, '') // NBSP
      .replace(/['\s]/g, '')  // spazi/apostrofi
      .replace(/\u2212/g, '-')// minus unicode
      .replace(/\./g, '')     // migliaia
      .replace(',', '.');     // decimale EU
    s = s.replace(/[^\d.-]/g, ''); // togli simboli residui (% etc.)
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Trova le colonne degli anni (N e N-1) nel foglio (cerca "YYYY" anche dentro celle tipo "al 31/12/2024").
 */
const findYearColumns = (sheetData) => {
  const yearRegex = /(19|20)\d{2}/; // prendi la prima occorrenza di anno nella cella
  const years = [];
  for (let r = 0; r < Math.min(sheetData.length, 40); r++) {
    const row = sheetData[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '').trim();
      const m = cell.match(yearRegex);
      if (m) {
        const y = parseInt(m[0], 10);
        if (Number.isFinite(y)) years.push({ year: y, col: c });
      }
    }
    if (years.length >= 2) break;
  }
  if (years.length < 2) return { currentYearCol: 3, previousYearCol: 4 }; // fallback
  years.sort((a, b) => b.year - a.year);
  return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

/**
 * Cerca una label (sinonimi) nelle prime N colonne e restituisce valori N / N-1 dalle colonne anno.
 */
const findValueInSheet = (sheetData, searchTexts, yearCols, maxLabelCols = 6) => {
  const normalized = searchTexts.map(t => t.toLowerCase().trim());
  for (const row of sheetData) {
    for (let i = 0; i < Math.min(maxLabelCols, row.length); i++) {
      const description = String(row[i] ?? '').toLowerCase().trim();
      if (!description) continue;
      if (normalized.some(s => description.includes(s))) {
        const rawCurrent = row[yearCols.currentYearCol];
        const rawPrevious = row[yearCols.previousYearCol];
        return { currentYear: parseValue(rawCurrent), previousYear: parseValue(rawPrevious) };
      }
    }
  }
  return { currentYear: null, previousYear: null };
};

/**
 * Trova un valore testuale a destra della label (sinonimi).
 */
const findSimpleValue = (sheetData, searchTexts, maxLabelCols = 6) => {
  const normalized = searchTexts.map(t => t.toLowerCase().trim());
  for (const row of sheetData) {
    for (let i = 0; i < Math.min(maxLabelCols, row.length); i++) {
      const description = String(row[i] ?? '').toLowerCase().trim();
      if (!description) continue;
      if (normalized.some(s => description.includes(s))) {
        for (let j = i + 1; j < row.length; j++) {
          if (row[j] != null && String(row[j]).trim() !== '') {
            return String(row[j]).trim();
          }
        }
      }
    }
  }
  return null;
};

/**
 * Trova un foglio per nome o contenuto (prime 50 righe) — usato qui come backup se servisse.
 */
const findSheetByKeywords = (workbook, keywords) => {
  const normalizedKeywords = keywords.map(k => k.toLowerCase());
  for (const sheetName of workbook.SheetNames) {
    if (normalizedKeywords.some(k => sheetName.toLowerCase().includes(k))) {
      return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    }
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    const contentToCheck = JSON.stringify(sheetData.slice(0, 50)).toLowerCase();
    if (normalizedKeywords.some(k => contentToCheck.includes(k))) {
      return sheetData;
    }
  }
  return null;
};

/** -------------------- API Handler -------------------- **/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId è richiesto' });
  }

  console.log(`[${sessionId}] Avvio analisi XBRL (v7.2).`);

  try {
    // 1) Recupera sessione
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('*, companies(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) throw new Error('Sessione non trovata.');
    if (!session.file_path) throw new Error('Percorso del file non trovato nella sessione.');

    // 2) Scarica file dal bucket parametrico
    console.log(`[${sessionId}] Download file da bucket '${DOCS_BUCKET}': ${session.file_path}`);
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(DOCS_BUCKET)
      .download(session.file_path);

    if (downloadError) {
      console.error(`[${sessionId}] Errore download file:`, downloadError);
      throw new Error('Impossibile scaricare il file di bilancio.');
    }

    // 3) Parsing Excel
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true, raw: false });

    // 4) Individua fogli (dinamico + fallback)
    let companyInfo = findSheetByKeywords(workbook, ['t0000', 'informazioni generali', 'anagrafica']);
    let balanceSheet = findSheetByKeywords(workbook, ['t0002', 'stato patrimoniale']);
    let incomeStatement = findSheetByKeywords(workbook, ['t0006', 'conto economico']);

    // Prova fallback diretto se non trovati
    if (!companyInfo && workbook.Sheets['T0000']) companyInfo = xlsx.utils.sheet_to_json(workbook.Sheets['T0000'], { header: 1 });
    if (!balanceSheet && workbook.Sheets['T0002']) balanceSheet = xlsx.utils.sheet_to_json(workbook.Sheets['T0002'], { header: 1 });
    if (!incomeStatement && workbook.Sheets['T0006']) incomeStatement = xlsx.utils.sheet_to_json(workbook.Sheets['T0006'], { header: 1 });

    if (!companyInfo) throw new Error('Foglio anagrafica non trovato.');
    if (!balanceSheet) throw new Error('Stato Patrimoniale non trovato.');
    if (!incomeStatement) throw new Error('Conto Economico non trovato.');

    // 5) Colonne anni per foglio
    const yearColsBS = findYearColumns(balanceSheet);
    const yearColsIS = findYearColumns(incomeStatement);
    console.log(`[${sessionId}] yearColsBS=${JSON.stringify(yearColsBS)}, yearColsIS=${JSON.stringify(yearColsIS)}`);

    // 6) Contesto
    const companyName =
      findSimpleValue(companyInfo, ['denominazione', 'ragione sociale', 'impresa', 'società']) ||
      'Azienda Analizzata';

    const sede = findSimpleValue(companyInfo, ['sede', 'sede legale', 'indirizzo']);
    const regionMatch = sede ? sede.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    const context = {
      ateco: findSimpleValue(companyInfo, ['codice ateco', 'attività prevalente', 'ateco']),
      region,
    };

    // 7) Metriche (N / N-1)
    const metrics = {
      fatturato: findValueInSheet(incomeStatement, ['ricavi delle vendite', 'valore della produzione'], yearColsIS),
      utilePerdita:
        findValueInSheet(incomeStatement, ["utile (perdita) dell'esercizio", 'risultato dell'esercizio'], yearColsIS) ||
        findValueInSheet(balanceSheet, ["utile (perdita) dell'esercizio", 'risultato dell'esercizio'], yearColsBS),
      totaleAttivo: findValueInSheet(balanceSheet, ['totale attivo'], yearColsBS),
      patrimonioNetto: findValueInSheet(balanceSheet, ['patrimonio netto', 'totale patrimonio netto'], yearColsBS),
      debitiTotali: findValueInSheet(balanceSheet, ['totale debiti', 'debiti'], yearColsBS),
      costiProduzione: findValueInSheet(incomeStatement, ['costi della produzione'], yearColsIS),
      ammortamenti: findValueInSheet(incomeStatement, ['ammortamenti e svalutazioni'], yearColsIS),
      oneriFinanziari: findValueInSheet(incomeStatement, ['interessi e altri oneri finanziari', 'oneri finanziari'], yearColsIS),
      attivoCircolante: findValueInSheet(balanceSheet, ['attivo circolante', 'totale attivo circolante'], yearColsBS),
      debitiBreveTermine: findValueInSheet(balanceSheet, ["debiti esigibili entro l'esercizio successivo", 'debiti a breve'], yearColsBS),
      creditiClienti: findValueInSheet(balanceSheet, ['crediti verso clienti'], yearColsBS),
      rimanenze: findValueInSheet(balanceSheet, ['rimanenze'], yearColsBS),
      disponibilitaLiquide: findValueInSheet(balanceSheet, ['disponibilità liquide', 'cassa e banche'], yearColsBS),
    };

    // 7.1) Heuristics: se >70% metriche sono null, log per debug
    const metricVals = Object.values(metrics);
    const nullCount = metricVals.filter(m => !m || (m.currentYear == null && m.previousYear == null)).length;
    if (nullCount / metricVals.length > 0.7) {
      console.warn(`[${sessionId}] Attenzione: molte metriche null (${nullCount}/${metricVals.length}). Verifica label/colonne/anni.`);
    }

    // 8) Prompt: schema leggero e istruzioni chiare
    const inputData = {
      company: { name: companyName, region: context.region || 'N/D', ateco: context.ateco || 'N/D' },
      currency: 'EUR',
      scale: 'unità', // se conosci "migliaia"/"milioni", impostalo qui
      years: { current: 'N', previous: 'N-1' },
      metrics
    };

    const schemaInstructions = `
Sei un analista. RESTITUISCI SOLTANTO un JSON valido con queste chiavi:
{
  "health_score": number|null,
  "key_metrics": {
    "growth": { "fatturato_yoy_pct": number|null, "utile_yoy_pct": number|null },
    "marginalita": { "ebitda_margine_pct": number|null, "ebit_margine_pct": number|null, "utile_margine_pct": number|null },
    "solidita": { "leverage": number|null, "equity_ratio_pct": number|null },
    "liquidita": { "current_ratio": number|null, "quick_ratio": number|null },
    "efficienza": { "dso_giorni": number|null, "dio_giorni": number|null, "dpo_giorni": number|null },
    "interest_coverage": number|null
  },
  "detailed_swot": { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] },
  "recommendations": string[],
  "charts_data": object|null,
  "summary": string|null,
  "risk_analysis": string[]|null,
  "pro_features_teaser": string[]|null,
  "warnings": string[],
  "raw_parsed_data": { "context": object, "metrics": object },
  "scale": "unità|migliaia|milioni",
  "currency": "EUR"
}
Regole:
- Non inventare dati: se un input è null, i KPI che lo richiedono ⇒ null.
- Arrotonda i numeri a 2 decimali; percentuali come 0.00-100.00.
- Inserisci "warnings" con i motivi per cui certi KPI non sono calcolabili.
- Usa esattamente i nomi campo sopra, nessun testo fuori dal JSON.
Dati in input (usa SOLO questi):
`;

    // 9) Recupera il template base e compone il prompt finale
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2')
      .single();

    if (promptError || !promptData) {
      throw new Error("Prompt 'FINANCIAL_ANALYSIS_V2' non trovato.");
    }

    const finalPrompt =
      `${promptData.prompt_template}\n\n` +
      schemaInstructions +
      `\n====DATI_INIZIO====\n` +
      JSON.stringify(inputData, null, 2) +
      `\n====DATI_FINE====`;

    // 10) OpenAI call (con system message)
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'Sei un analista finanziario. Rispondi SOLO con JSON valido conforme allo schema richiesto.' },
        { role: 'user', content: finalPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const analysisResult = JSON.parse(response.choices[0].message.content);

    // 11) Salvataggio risultati
    const resultToSave = {
      session_id: sessionId,
      health_score: analysisResult.health_score ?? null,
      key_metrics: analysisResult.key_metrics ?? null,
      swot: analysisResult.detailed_swot ?? null,
      recommendations: analysisResult.recommendations ?? null,
      charts_data: analysisResult.charts_data ?? null,
      summary: analysisResult.summary ?? null,
      raw_ai_response: analysisResult,
      detailed_swot: analysisResult.detailed_swot ?? null,
      risk_analysis: analysisResult.risk_analysis ?? null,
      pro_features_teaser: analysisResult.pro_features_teaser ?? null,
      raw_parsed_data: { metrics, context }
    };

    const { error: saveError } = await supabase.from('analysis_results').insert(resultToSave);
    if (saveError) throw new Error(`Salvataggio fallito: ${saveError.message}`);

    // 12) Chiudi la sessione
    await supabase
      .from('checkup_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi XBRL completata con successo!`);
    return res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore in analyze-xbrl:`, error?.message || error);
    if (sessionId) {
      await supabase
        .from('checkup_sessions')
        .update({ status: 'failed', error_message: error.message || 'Errore analisi' })
        .eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
