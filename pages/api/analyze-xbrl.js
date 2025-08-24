// /pages/api/analyze-xbrl.js
// VERSIONE 9.0 (Estrazione Hyper-Robusta)
// - Normalizzazione del testo per la ricerca (ignora accenti, punteggiatura).
// - Rilevamento colonne anni con fallback basato su densità numerica.
// - Fallback a livello di riga per estrarre i 2 valori numerici più a destra.
// - Corretta gestione del fallback tra Conto Economico e Stato Patrimoniale.
// - Dizionario di ricerca ulteriormente ampliato.

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

// ✅ NUOVO: Utility per normalizzare le stringhe di ricerca
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuovi accenti
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')      // rimuovi punteggiatura
    .replace(/\s+/g, ' ')
    .trim();

// ✅ NUOVO: Utility per verificare se un risultato di ricerca è vuoto
const isEmptyResult = (r) =>
  !r || (r.currentYear === null && r.previousYear === null);

/**
 * Funzione di parsing potenziata per gestire vari formati numerici.
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
        cleanVal = cleanVal.replace(/\u00A0/g, '');   // NBSP
        cleanVal = cleanVal.replace(/['\s]/g, '');    // spazi/apostrofi
        cleanVal = cleanVal.replace(/\u2212/g, '-');  // minus unicode
        cleanVal = cleanVal.replace(/\./g, '').replace(',', '.'); // migliaia/decimali EU
        cleanVal = cleanVal.replace(/[^\d.-]/g, '');  // togli simboli (es. %)
        const num = parseFloat(cleanVal);
        return isNaN(num) ? null : num;
    }
    return null;
};

/**
 * ✅ SOSTITUITO: Trova le colonne degli anni con fallback numerico.
 */
const findYearColumns = (sheetData) => {
  const yearRe = /^(19|20)\d{2}$/;
  const candidates = [];
  for (let r = 0; r < Math.min(25, sheetData.length); r++) {
    const row = sheetData[r] || [];
    for (let c = 0; c < Math.min(20, row.length); c++) {
      const cell = String(row[c] ?? '').trim();
      if (yearRe.test(cell)) candidates.push({ year: parseInt(cell, 10), col: c });
    }
  }
  if (candidates.length >= 2) {
    candidates.sort((a, b) => b.year - a.year);
    const res = { currentYearCol: candidates[0].col, previousYearCol: candidates[1].col };
    console.log('Year columns from headers:', res);
    return res;
  }
  // Fallback: prendi le due colonne con più valori numerici (a destra)
  const score = new Map();
  for (const row of sheetData) {
    for (let c = 0; c < (row?.length || 0); c++) {
      const v = parseValue(row[c]);
      if (v !== null) score.set(c, (score.get(c) || 0) + 1);
    }
  }
  const ranked = [...score.entries()].sort((a,b)=>b[1]-a[1]).map(([c])=>c).slice(0,4).sort((a,b)=>a-b);
  const rightMost = ranked.slice(-2);
  if (rightMost.length === 2) {
    const res = { currentYearCol: rightMost[1], previousYearCol: rightMost[0] };
    console.warn('Year columns by numeric fallback:', res);
    return res;
  }
  console.warn('Year columns fallback to 3,4');
  return { currentYearCol: 3, previousYearCol: 4 };
};

/**
 * ✅ NUOVO: Helper per estrarre i valori, con fallback sui 2 numeri più a destra della riga.
 */
const extractTwoYearsFromRow = (row, yearCols) => {
  const a = parseValue(row[yearCols.currentYearCol]);
  const b = parseValue(row[yearCols.previousYearCol]);
  if (a !== null || b !== null) return { currentYear: a, previousYear: b };

  // fallback: due numeri più a destra
  const nums = [];
  for (let i = 0; i < row.length; i++) {
    const v = parseValue(row[i]);
    if (v !== null) nums.push({ i, v });
  }
  if (nums.length >= 2) {
    const twoRightMost = nums.slice(-2);
    return { currentYear: twoRightMost[1].v, previousYear: twoRightMost[0].v };
  }
  return { currentYear: null, previousYear: null };
};

/**
 * ✅ SOSTITUITO: Funzione di ricerca con normalizzazione e fallback.
 */
const findValueInSheet = (sheetData, searchConfigs, yearCols, metricName) => {
  console.log(`--- Inizio ricerca per: [${metricName}] ---`);
  for (const config of searchConfigs) {
    const primary = (config.primary || []).map(norm);
    const exclusion = (config.exclusion || []).map(norm);

    for (const row of sheetData) {
      const desc = norm((row.slice(0,6) || []).join(' '));
      // prova esatta
      const okPrimary = primary.every(t => desc.includes(t));
      const bad = exclusion.some(t => desc.includes(t));

      // prova “totale …” (e.g., totale patrimonio netto)
      const primaryOrTotale = okPrimary || primary.every(t => desc.includes(`totale ${t}`));

      if (primaryOrTotale && !bad) {
        const result = extractTwoYearsFromRow(row, yearCols);
        if (!isEmptyResult(result)) {
          console.log(`[${metricName}] match:`, { desc, result });
          return result;
        }
      }
    }
  }
  console.log(`[${metricName}] nessun match`);
  return { currentYear: null, previousYear: null };
};

/**
 * Trova un valore testuale semplice (es. Ragione Sociale, ATECO).
 */
const findSimpleValue = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    for (const row of sheetData) {
        const descriptionCell = [row[0], row[1], row[2], row[3], row[4], row[5]]
            .map(c => String(c || '').toLowerCase().trim())
            .join(' ');

        if (normalizedSearchTexts.some(searchText => descriptionCell.includes(searchText))) {
            for (let j = 0; j < row.length; j++) {
                if (typeof row[j] === 'string' && row[j].trim() && !normalizedSearchTexts.some(st => row[j].toLowerCase().includes(st))) {
                    return row[j].trim();
                }
            }
        }
    }
    return null;
};

// ✅ AGGIORNATO: Dizionario di ricerca con più alias e normalizzato.
const metricsConfigs = {
  fatturato: [
    { primary: ["ricavi delle vendite e delle prestazioni"] },
    { primary: ["ricavi delle vendite"] },
    { primary: ["valore della produzione"], exclusion: ["costi","differenza"] },
  ],
  utilePerdita: [
    { primary: ["utile perdita dellesercizio"] },
    { primary: ["risultato dellesercizio"] },
    { primary: ["risultato prima delle imposte"] },
  ],
  totaleAttivo: [
    { primary: ["totale attivo"] },
    { primary: ["attivo totale"] },
  ],
  patrimonioNetto: [
    { primary: ["patrimonio netto"] },
    { primary: ["totale patrimonio netto"] },
  ],
  debitiTotali: [
    { primary: ["totale debiti"] },
    { primary: ["debiti"] },
  ],
  costiProduzione: [
    { primary: ["costi della produzione"] },
    { primary: ["totale costi della produzione"] },
  ],
  ammortamenti: [
    { primary: ["ammortamenti e svalutazioni"] },
    { primary: ["ammortamenti"] },
  ],
  oneriFinanziari: [
    { primary: ["interessi e altri oneri finanziari"] },
    { primary: ["oneri finanziari"] },
  ],
  attivoCircolante: [
    { primary: ["attivo circolante"] },
    { primary: ["totale attivo circolante"] },
  ],
  debitiBreveTermine: [
    { primary: ["debiti esigibili entro lesercizio successivo"] },
    { primary: ["debiti entro lesercizio successivo"] },
    { primary: ["debiti a breve"] },
  ],
  creditiClienti: [
    { primary: ["crediti verso clienti"] },
  ],
  rimanenze: [
    { primary: ["rimanenze"] },
    { primary: ["magazzino"] },
  ],
  disponibilitaLiquide: [
    { primary: ["disponibilita liquide"] },
    { primary: ["cassa e banche"] },
    { primary: ["liquidita immediate"] },
  ],
};


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId è richiesto' });
  }
  
  console.log(`[${sessionId}] Avvio analisi XBRL (versione hyper-robusta 9.0).`);

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
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true, raw: false });
    
    const companyInfoSheet = workbook.Sheets['T0000'];
    const balanceSheet = workbook.Sheets['T0002'];
    const incomeStatement = workbook.Sheets['T0006'];

    if (!companyInfoSheet || !balanceSheet || !incomeStatement) {
        throw new Error("Uno o più fogli di lavoro standard (T0000, T0002, T0006) non sono stati trovati.");
    }

    // ✅ AGGIORNATO: sheet_to_json più solido
    const balanceSheetData   = xlsx.utils.sheet_to_json(balanceSheet,   { header: 1, defval: '', raw: false });
    const incomeStatementData= xlsx.utils.sheet_to_json(incomeStatement,{ header: 1, defval: '', raw: false });
    const companyInfoData    = xlsx.utils.sheet_to_json(companyInfoSheet,{ header: 1, defval: '', raw: false });

    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    const companyName = findSimpleValue(companyInfoData, ['denominazione', 'ragione sociale', 'impresa', 'società']) || 'Azienda Analizzata';

    const sedeRow = findSimpleValue(companyInfoData, ["sede"]);
    const regionMatch = sedeRow ? sedeRow.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    const context = {
        ateco: findSimpleValue(companyInfoData, ["codice ateco", "attività prevalente"]),
        region: region
    };

    // ✅ AGGIORNATO: Logica di estrazione con fallback corretto per utile/perdita
    const utileCE = findValueInSheet(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile/Perdita CE');
    const utileSP = findValueInSheet(balanceSheetData,  metricsConfigs.utilePerdita, yearColsBS, 'Utile/Perdita SP');
    const utilePerdita = !isEmptyResult(utileCE) ? utileCE : utileSP;

    const metrics = {
      fatturato: findValueInSheet(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
      utilePerdita,
      totaleAttivo: findValueInSheet(balanceSheetData, metricsConfigs.totaleAttivo, yearColsBS, 'Totale Attivo'),
      patrimonioNetto: findValueInSheet(balanceSheetData, metricsConfigs.patrimonioNetto, yearColsBS, 'Patrimonio Netto'),
      debitiTotali: findValueInSheet(balanceSheetData, metricsConfigs.debitiTotali, yearColsBS, 'Debiti Totali'),
      costiProduzione: findValueInSheet(incomeStatementData, metricsConfigs.costiProduzione, yearColsIS, 'Costi Produzione'),
      ammortamenti: findValueInSheet(incomeStatementData, metricsConfigs.ammortamenti, yearColsIS, 'Ammortamenti'),
      oneriFinanziari: findValueInSheet(incomeStatementData, metricsConfigs.oneriFinanziari, yearColsIS, 'Oneri Finanziari'),
      attivoCircolante: findValueInSheet(balanceSheetData, metricsConfigs.attivoCircolante, yearColsBS, 'Attivo Circolante'),
      debitiBreveTermine: findValueInSheet(balanceSheetData, metricsConfigs.debitiBreveTermine, yearColsBS, 'Debiti Breve Termine'),
      creditiClienti: findValueInSheet(balanceSheetData, metricsConfigs.creditiClienti, yearColsBS, 'Crediti Clienti'),
      rimanenze: findValueInSheet(balanceSheetData, metricsConfigs.rimanenze, yearColsBS, 'Rimanenze'),
      disponibilitaLiquide: findValueInSheet(balanceSheetData, metricsConfigs.disponibilitaLiquide, yearColsBS, 'Disponibilità Liquide'),
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
    
    console.log(`[${sessionId}] Dati estratti pronti per l'invio a OpenAI.`);
    console.log(dataForPrompt); // Log per verificare i dati estratti

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
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore fatale in analyze-xbrl:`, error);
    if (sessionId) {
      await supabase
        .from('checkup_sessions')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message });
  }
}
