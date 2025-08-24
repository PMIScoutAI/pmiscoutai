// /pages/api/analyze-xbrl.js
// VERSIONE 10.0 (Qualità e Validazione dei Dati)
// - Nuovo parser numerico robusto per formati EU/US.
// - Rilevamento automatico della scala (Euro vs. Migliaia).
// - Sanity check pre-analisi per bloccare dati "sporchi".
// - Estrazione del nome azienda e degli anni di riferimento migliorata.

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

// --- UTILITY DI PARSING E NORMALIZZAZIONE ---

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuovi accenti
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')      // rimuovi punteggiatura
    .replace(/\s+/g, ' ')
    .trim();

const isEmptyResult = (r) =>
  !r || (r.currentYear === null && r.previousYear === null);

/**
 * ✅ SOSTITUITO: Parser numerico robusto per EU/US e valori "sporchi".
 */
const parseValue = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;

  let s = String(val).trim();
  if (!s) return null;

  // Gestisce negativi in parentesi, es. (1.234,56)
  if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);

  // Pulisce da caratteri comuni
  s = s.replace(/\u00A0/g, '').replace(/['\s]/g, ''); // NBSP, spazi, apostrofi
  s = s.replace(/\u2212/g, '-'); // minus unicode

  // Logica per determinare il separatore decimale
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot > lastComma) { // Formato US: 1,234.56
    s = s.replace(/,/g, ''); 
  } else if (lastComma > lastDot) { // Formato EU: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.');
  }
  
  // Rimuove qualsiasi carattere non numerico rimasto, eccetto il punto decimale e il segno
  s = s.replace(/[^\d.-]/g, '');

  // Protezione contro numeri troppo grandi (probabilmente codici scambiati per numeri)
  if (s.replace(/[^0-9]/g, '').length > 12) {
      console.warn(`Valore scartato perché troppo lungo (potenziale codice): ${val}`);
      return null;
  }

  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

// --- FUNZIONI DI ESTRAZIONE DATI ---

/**
 * ✅ AGGIORNATO: Trova le colonne e gli anni di riferimento.
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
    const res = {
        currentYearCol: candidates[0].col,
        previousYearCol: candidates[1].col,
        currentYear: candidates[0].year,
        previousYear: candidates[1].year,
    };
    console.log('Colonne anni trovate da header:', res);
    return res;
  }
  
  // Fallback numerico
  const score = new Map();
  for (const row of sheetData) {
    for (let c = 0; c < (row?.length || 0); c++) {
      if (typeof parseValue(row[c]) === 'number') score.set(c, (score.get(c) || 0) + 1);
    }
  }
  const ranked = [...score.entries()].sort((a,b)=>b[1]-a[1]).map(([c])=>c).slice(0,4).sort((a,b)=>a-b);
  const rightMost = ranked.slice(-2);
  if (rightMost.length === 2) {
    const res = { currentYearCol: rightMost[1], previousYearCol: rightMost[0], currentYear: null, previousYear: null };
    console.warn('Colonne anni trovate con fallback numerico:', res);
    return res;
  }

  console.warn('Fallback finale per colonne anni: 3,4');
  return { currentYearCol: 3, previousYearCol: 4, currentYear: null, previousYear: null };
};

const extractTwoYearsFromRow = (row, yearCols) => {
  const a = parseValue(row[yearCols.currentYearCol]);
  const b = parseValue(row[yearCols.previousYearCol]);
  if (a !== null || b !== null) return { currentYear: a, previousYear: b };

  const nums = row.map(cell => parseValue(cell)).filter(v => v !== null);
  if (nums.length >= 2) {
    const twoRightMost = nums.slice(-2);
    return { currentYear: twoRightMost[1], previousYear: twoRightMost[0] };
  }
  return { currentYear: null, previousYear: null };
};

const findValueInSheet = (sheetData, searchConfigs, yearCols, metricName) => {
  console.log(`--- Inizio ricerca per: [${metricName}] ---`);
  for (const config of searchConfigs) {
    const primary = (config.primary || []).map(norm);
    const exclusion = (config.exclusion || []).map(norm);

    for (const row of sheetData) {
      const desc = norm((row.slice(0,6) || []).join(' '));
      const okPrimary = primary.every(t => desc.includes(t));
      const bad = exclusion.some(t => desc.includes(t));
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
 * ✅ AGGIORNATO: Trova valori testuali con normalizzazione e fallback.
 */
const findSimpleValue = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(norm);
    for (const row of sheetData) {
        const normalizedRow = (row.slice(0, 6) || []).map(c => norm(c)).join(' ');
        
        if (normalizedSearchTexts.some(searchText => normalizedRow.includes(searchText))) {
            // Cerca la prima cella non vuota e che non sia la label stessa
            for (let j = 0; j < row.length; j++) {
                const cellValue = String(row[j] || '').trim();
                if (cellValue && !normalizedSearchTexts.some(st => norm(cellValue).includes(st))) {
                    return cellValue;
                }
            }
        }
    }
    return null;
};

/**
 * ✅ NUOVO: Rileva la scala dei valori (Euro vs. Migliaia).
 */
const detectScale = (sheetData) => {
    const scaleRegex = /unit[aà]\s*di\s*misura.*(migliaia|euro)/i;
    for (const row of sheetData) {
        for (const cell of row) {
            const match = String(cell || '').match(scaleRegex);
            if (match) {
                if (match[1].toLowerCase() === 'migliaia') {
                    console.log('✅ Rilevata scala: Migliaia di Euro. Applico fattore 1000.');
                    return 1000;
                }
                console.log('✅ Rilevata scala: Euro.');
                return 1;
            }
        }
    }
    console.warn('⚠️ Nessuna indicazione sulla scala trovata. Assumo Euro (fattore 1).');
    return 1;
};

// --- CONFIGURAZIONI E HANDLER PRINCIPALE ---

const metricsConfigs = { /* ... invariato ... */ };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'SessionId è richiesto' });
  
  console.log(`[${sessionId}] Avvio analisi XBRL (v10.0 - Validazione Dati).`);

  try {
    const { data: session, error: sessionError } = await supabase.from('checkup_sessions').select('*, companies(*)').eq('id', sessionId).single();
    if (sessionError || !session) throw new Error('Sessione non trovata.');
    if (!session.file_path) throw new Error('Percorso del file non trovato.');

    const { data: fileBlob, error: downloadError } = await supabase.storage.from('checkup-documents').download(session.file_path);
    if (downloadError) throw new Error('Impossibile scaricare il file di bilancio.');
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true, raw: false });
    
    const companyInfoSheet = workbook.Sheets['T0000'];
    const balanceSheet = workbook.Sheets['T0002'];
    const incomeStatement = workbook.Sheets['T0006'];
    if (!companyInfoSheet || !balanceSheet || !incomeStatement) throw new Error("Fogli di lavoro standard (T0000, T0002, T0006) non trovati.");

    const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1, defval: '', raw: false });
    const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1, defval: '', raw: false });
    const companyInfoData = xlsx.utils.sheet_to_json(companyInfoSheet, { header: 1, defval: '', raw: false });

    // 1. Estrazione e uniformazione scala
    const scale = detectScale(companyInfoData) || detectScale(balanceSheetData);
    
    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    const companyName = findSimpleValue(companyInfoData, ["denominazione", "ragione sociale", "denominazione impresa", "societa"]) || 'Azienda Analizzata';
    const context = {
        ateco: findSimpleValue(companyInfoData, ["codice ateco", "attivita prevalente"]),
        region: (findSimpleValue(companyInfoData, ["sede"])?.match(/\(([^)]+)\)/) || [])[1] || null
    };

    const utileCE = findValueInSheet(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile/Perdita CE');
    const utileSP = findValueInSheet(balanceSheetData, metricsConfigs.utilePerdita, yearColsBS, 'Utile/Perdita SP');
    
    let metrics = {
      fatturato: findValueInSheet(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
      utilePerdita: !isEmptyResult(utileCE) ? utileCE : utileSP,
      // ... altre metriche
    };

    // Applica la scala a tutte le metriche
    Object.keys(metrics).forEach(key => {
        metrics[key].currentYear = metrics[key].currentYear !== null ? metrics[key].currentYear * scale : null;
        metrics[key].previousYear = metrics[key].previousYear !== null ? metrics[key].previousYear * scale : null;
    });

    // 2. Sanity Check sui dati estratti
    console.log("Eseguo sanity check sui dati estratti...");
    const coreValues = [
      metrics.fatturato?.currentYear,
      metrics.totaleAttivo?.currentYear,
      metrics.patrimonioNetto?.currentYear,
      metrics.utilePerdita?.currentYear
    ];
    const presentCoreValues = coreValues.filter(v => typeof v === 'number' && isFinite(v));
    if (presentCoreValues.length < 2) {
      throw new Error("Dati estratti insufficienti per un'analisi affidabile (fatturato, attivo, patrimonio, utile).");
    }
    const hasOutliers = Object.values(metrics).some(m =>
      [m?.currentYear, m?.previousYear].some(v => typeof v === 'number' && Math.abs(v) > 1e12)
    );
    if (hasOutliers) {
      throw new Error("Valori anomali o irrealistici rilevati. L'analisi è stata interrotta per garantire l'affidabilità.");
    }
    console.log("✅ Sanity check superato.");

    // 3. Preparazione del prompt con dati validati
    const yearLabelIS = yearColsIS.currentYear && yearColsIS.previousYear ? `(${yearColsIS.currentYear} / ${yearColsIS.previousYear})` : '(N / N-1)';
    const yearLabelBS = yearColsBS.currentYear && yearColsBS.previousYear ? `(${yearColsBS.currentYear} / ${yearColsBS.previousYear})` : '(N / N-1)';
    
    const dataForPrompt = `
Dati Aziendali per ${companyName} (Valori in Euro):

Contesto Aziendale:
- Regione: ${context.region || 'N/D'}
- Codice ATECO (Settore): ${context.ateco || 'N/D'}

Principali Voci di Conto Economico ${yearLabelIS}:
- Fatturato: ${metrics.fatturato.currentYear} / ${metrics.fatturato.previousYear}
- Costi della Produzione: ${metrics.costiProduzione.currentYear} / ${metrics.costiProduzione.previousYear}
- Ammortamenti e Svalutazioni: ${metrics.ammortamenti.currentYear} / ${metrics.ammortamenti.previousYear}
- Oneri Finanziari: ${metrics.oneriFinanziari.currentYear} / ${metrics.oneriFinanziari.previousYear}
- Utile/(Perdita) d'esercizio: ${metrics.utilePerdita.currentYear} / ${metrics.utilePerdita.previousYear}

Principali Voci di Stato Patrimoniale ${yearLabelBS}:
- Totale Attivo: ${metrics.totaleAttivo.currentYear} / ${metrics.totaleAttivo.previousYear}
- Patrimonio Netto: ${metrics.patrimonioNetto.currentYear} / ${metrics.patrimonioNetto.previousYear}
- Debiti Totali: ${metrics.debitiTotali.currentYear} / ${metrics.debitiTotali.previousYear}
- Attivo Circolante: ${metrics.attivoCircolante.currentYear} / ${metrics.attivoCircolante.previousYear}
- Debiti a Breve Termine: ${metrics.debitiBreveTermine.currentYear} / ${metrics.debitiBreveTermine.previousYear}
- Crediti verso Clienti: ${metrics.creditiClienti.currentYear} / ${metrics.creditiClienti.previousYear}
- Rimanenze: ${metrics.rimanenze.currentYear} / ${metrics.rimanenze.previousYear}
- Disponibilità Liquide: ${metrics.disponibilitaLiquide.currentYear} / ${metrics.disponibilitaLiquide.previousYear}
`;
    
    console.log(`[${sessionId}] Dati validati pronti per l'invio a OpenAI.`);
    console.log(dataForPrompt);

    // 4. Chiamata AI e salvataggio (invariato)
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
      raw_parsed_data: { metrics, context, scale }
    };
    
    const { error: saveError } = await supabase.from('analysis_results').insert(resultToSave);
    if (saveError) throw new Error(`Salvataggio fallito: ${saveError.message}`);

    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi XBRL completata con successo!`);
    return res.status(200).json({ success: true, sessionId: sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore fatale in analyze-xbrl:`, error.message);
    if (sessionId) {
      await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message });
  }
}
