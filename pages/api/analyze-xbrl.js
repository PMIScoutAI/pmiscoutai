// /pages/api/analyze-xbrl.js
// VERSIONE 16.0 (Health Score Personalizzato e Analisi di Mercato)
// - NUOVO: Calcolo di un Health Score basato su 3 fattori: crescita fatturato, crescita utile, riduzione debiti.
// - NUOVO: Prompt AI specifico per generare un'analisi di mercato basata su ATECO e regione.
// - OBIETTIVO: Fornire un output qualitativo e un punteggio di salute immediatamente comprensibile.

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

// --- UTILITY E FUNZIONI DI ESTRAZIONE (INVARIATE DALLA v15) ---

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u00A0-\u036f]/g, '').replace(/[^\p{Letter}\p{Number}\s]/gu, '').replace(/\s+/g, ' ').trim();
const isEmptyResult = (r) => !r || (r.currentYear === null && r.previousYear === null);
const parseValue = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let cleanVal = val.trim();
        const isNegative = cleanVal.startsWith('(') && cleanVal.endsWith(')');
        if (isNegative) cleanVal = '-' + cleanVal.substring(1, cleanVal.length - 1);
        cleanVal = cleanVal.replace(/\u00A0/g, '').replace(/['\s]/g, '').replace(/\u2212/g, '-').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        if (cleanVal.replace(/[^0-9]/g, '').length > 12) return null;
        const num = parseFloat(cleanVal);
        return isNaN(num) ? null : num;
    }
    return null;
};
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
    return { currentYearCol: candidates[0].col, previousYearCol: candidates[1].col, currentYear: candidates[0].year, previousYear: candidates[1].year, usedFallback: false };
  }
  const score = new Map();
  for (const row of sheetData) {
    for (let c = 0; c < (row?.length || 0); c++) {
      if (typeof parseValue(row[c]) === 'number') score.set(c, (score.get(c) || 0) + 1);
    }
  }
  const ranked = [...score.entries()].sort((a,b)=>b[1]-a[1]).map(([c])=>c).slice(0,4).sort((a,b)=>a-b);
  const rightMost = ranked.slice(-2);
  if (rightMost.length === 2) {
    if (rightMost[0] === rightMost[1] && ranked.length > 2) {
        rightMost[0] = ranked[ranked.length - 3];
        rightMost.sort((a,b) => a-b);
    }
    return { currentYearCol: rightMost[1], previousYearCol: rightMost[0], currentYear: null, previousYear: null, usedFallback: true };
  }
  return { currentYearCol: 3, previousYearCol: 4, currentYear: null, previousYear: null, usedFallback: true };
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
        if (!isEmptyResult(result)) return result;
      }
    }
  }
  return { currentYear: null, previousYear: null };
};
const findSimpleValue = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(norm);
    for (const row of sheetData) {
        const normalizedRow = (row.slice(0, 6) || []).map(c => norm(c)).join(' ');
        if (normalizedSearchTexts.some(searchText => normalizedRow.includes(searchText))) {
            for (let j = 0; j < row.length; j++) {
                const cellValue = String(row[j] || '').trim();
                if (cellValue && !normalizedSearchTexts.some(st => norm(cellValue).includes(st))) return cellValue;
            }
        }
    }
    return null;
};
const detectScale = (sheets, coreMetrics) => {
    for (const sheetData of sheets) {
        const rx = /unit[aà]\s*di\s*misura.*(migliaia|euro)/i;
        for (const row of sheetData) for (const cell of row) {
            const m = String(cell||'').match(rx);
            if (m) return m[1].toLowerCase() === 'migliaia' ? 1000 : 1;
        }
    }
    const { fatturato, totaleAttivo } = coreMetrics;
    if (fatturato?.currentYear && totaleAttivo?.currentYear && fatturato.currentYear < 20000 && totaleAttivo.currentYear < 20000) return 1000;
    return 1;
};

// --- CONFIGURAZIONI E HANDLER ---
const metricsConfigs = {
  fatturato: [ { primary: ["ricavi delle vendite e delle prestazioni"] }, { primary: ["ricavi delle vendite"] }, { primary: ["valore della produzione"], exclusion: ["costi","differenza"] } ],
  utilePerdita: [ { primary: ["utile (perdita) dell'esercizio"] }, { primary: ["risultato dellesercizio"] } ],
  debitiTotali: [ { primary: ["d) debiti"] }, { primary: ["debiti"] } ],
  totaleAttivo: [ { primary: ["totale attivo"] } ],
  patrimonioNetto: [ { primary: ["a) patrimonio netto"] }, { primary: ["totale patrimonio netto"] } ],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'SessionId è richiesto' });
  
  console.log(`[${sessionId}] Avvio analisi XBRL (v16.0 - Health Score Personalizzato).`);

  try {
    const { data: session } = await supabase.from('checkup_sessions').select('*, companies(*)').eq('id', sessionId).single();
    if (!session) throw new Error('Sessione non trovata.');

    const { data: fileBlob } = await supabase.storage.from('checkup-documents').download(session.file_path);
    if (!fileBlob) throw new Error('Impossibile scaricare il file di bilancio.');
    
    const workbook = xlsx.read(Buffer.from(await fileBlob.arrayBuffer()), { type: 'buffer' });
    const { T0000, T0002, T0006 } = workbook.Sheets;
    if (!T0000 || !T0002 || !T0006) throw new Error("Fogli di lavoro standard (T0000, T0002, T0006) non trovati.");

    const companyInfoData = xlsx.utils.sheet_to_json(T0000, { header: 1, defval: '' });
    const balanceSheetData = xlsx.utils.sheet_to_json(T0002, { header: 1, defval: '' });
    const incomeStatementData = xlsx.utils.sheet_to_json(T0006, { header: 1, defval: '' });

    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    const companyName = findSimpleValue(companyInfoData, ["denominazione", "ragione sociale", "impresa", "societa", "azienda"]) || session.companies?.company_name || 'Azienda Analizzata';
    const context = {
        ateco: findSimpleValue(companyInfoData, ["codice ateco", "attivita prevalente"]),
        region: (findSimpleValue(companyInfoData, ["sede"])?.match(/\(([^)]+)\)/) || [])[1] || null
    };

    const utileCE = findValueInSheet(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile/Perdita');
    const utileSP = findValueInSheet(balanceSheetData, metricsConfigs.utilePerdita, yearColsBS, 'Utile/Perdita');
    
    let metrics = {
      fatturato: findValueInSheet(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
      utilePerdita: !isEmptyResult(utileCE) ? utileCE : utileSP,
      debitiTotali: findValueInSheet(balanceSheetData, metricsConfigs.debitiTotali, yearColsBS, 'Debiti Totali'),
      totaleAttivo: findValueInSheet(balanceSheetData, metricsConfigs.totaleAttivo, yearColsBS, 'Totale Attivo'),
      patrimonioNetto: findValueInSheet(balanceSheetData, metricsConfigs.patrimonioNetto, yearColsBS, 'Patrimonio Netto'),
    };

    const scale = detectScale([companyInfoData, balanceSheetData], { fatturato: metrics.fatturato, totaleAttivo: metrics.totaleAttivo });
    Object.values(metrics).forEach(m => {
      if (m.currentYear != null) m.currentYear *= scale;
      if (m.previousYear != null) m.previousYear *= scale;
    });

    // ✅ NUOVO: Calcolo Health Score Personalizzato
    let healthScore = 0;
    const { fatturato, utilePerdita, debitiTotali } = metrics;
    if (fatturato.currentYear > fatturato.previousYear) healthScore += 40;
    if (utilePerdita.currentYear > utilePerdita.previousYear) healthScore += 35;
    if (debitiTotali.currentYear < debitiTotali.previousYear) healthScore += 25;
    if (Object.values(metrics).some(m => m.currentYear === null || m.previousYear === null)) healthScore = null;

    // ✅ NUOVO: Prompt per analisi di mercato
    const marketPrompt = `Fornisci un'analisi di mercato di 2-3 frasi per un'azienda italiana con codice ATECO "${context.ateco}" situata in "${context.region || 'Italia'}". Sii generico e prudente.`;
    const marketResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: marketPrompt }],
        temperature: 0.2,
    });
    const marketOutlook = marketResponse.choices[0].message.content;

    // Costruzione del risultato finale
    const revenueChange = fatturato.previousYear !== 0 ? (((fatturato.currentYear - fatturato.previousYear) / Math.abs(fatturato.previousYear)) * 100) : 0;
    
    const analysisResult = {
        summary: `L'azienda ha registrato un fatturato di ${fatturato.currentYear.toLocaleString('it-IT')} € e un utile di ${utilePerdita.currentYear.toLocaleString('it-IT')} €.`,
        revenueAnalysis: `Il fatturato ha registrato una variazione del ${revenueChange.toFixed(1)}%.`,
        profitAnalysis: `L'utile è passato da ${utilePerdita.previousYear.toLocaleString('it-IT')} € a ${utilePerdita.currentYear.toLocaleString('it-IT')} €.`,
        debtAnalysis: `I debiti totali sono variati da ${debitiTotali.previousYear.toLocaleString('it-IT')} € a ${debitiTotali.currentYear.toLocaleString('it-IT')} €.`,
        marketOutlook: marketOutlook
    };

    const resultToSave = {
      session_id: sessionId,
      health_score: healthScore,
      summary: analysisResult.summary,
      raw_ai_response: analysisResult,
      charts_data: {
          revenue_trend: { current_year: fatturato.currentYear, previous_year: fatturato.previousYear },
          profit_trend: { current_year: utilePerdita.currentYear, previous_year: utilePerdita.previousYear }
      },
      raw_parsed_data: { metrics, context, scale, companyName }
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
