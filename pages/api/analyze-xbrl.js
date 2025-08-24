// /pages/api/analyze-xbrl.js
// VERSIONE 17.1 (Solida, SSR-safe)
// - Import XLSX corretto (no default export).
// - Rimosso lo swap "solo debiti": flip euristico a monte sulle colonne anno.
// - detectScale legge T0000 + T0002 + T0006.
// - Formattazioni sicure (no crash su null).
// - Narrative condizionale se dati incompleti.
// - Chiamata OpenAI con try/catch e fallback.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as xlsx from 'xlsx';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Utils ----------
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u00A0-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const isEmptyResult = (r) => !r || (r.currentYear === null && r.previousYear === null);

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
    if (cleanVal.replace(/[^0-9]/g, '').length > 18) return null; // guard-rail
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
    return {
      currentYearCol: candidates[0].col,
      previousYearCol: candidates[1].col,
      currentYear: candidates[0].year,
      previousYear: candidates[1].year,
      usedFallback: false,
    };
  }
  // fallback: colonne più dense di numeri
  const score = new Map();
  for (const row of sheetData) {
    for (let c = 0; c < (row?.length || 0); c++) {
      if (typeof parseValue(row[c]) === 'number') score.set(c, (score.get(c) || 0) + 1);
    }
  }
  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)
    .slice(0, 4)
    .sort((a, b) => a - b);
  const rightMost = ranked.slice(-2);
  if (rightMost.length === 2) {
    if (rightMost[0] === rightMost[1] && ranked.length > 2) {
      rightMost[0] = ranked[ranked.length - 3];
      rightMost.sort((a, b) => a - b);
    }
    return {
      currentYearCol: rightMost[1],
      previousYearCol: rightMost[0],
      currentYear: null,
      previousYear: null,
      usedFallback: true,
    };
  }
  return null; // meglio segnalare dopo
};

function maybeFlipYearCols(sheetData, yearCols) {
  if (!yearCols) return null;
  let votes = 0, checks = 0;
  for (let i = 0; i < Math.min(30, sheetData.length); i++) {
    const row = sheetData[i] || [];
    const a = parseValue(row[yearCols.currentYearCol]);
    const b = parseValue(row[yearCols.previousYearCol]);
    if (a != null && b != null) { checks++; if (a < b) votes++; }
  }
  if (checks >= 5 && votes / checks > 0.7) {
    const tmpCol = yearCols.currentYearCol;
    yearCols.currentYearCol = yearCols.previousYearCol;
    yearCols.previousYearCol = tmpCol;
    const tmpYear = yearCols.currentYear;
    yearCols.currentYear = yearCols.previousYear;
    yearCols.previousYear = tmpYear;
  }
  return yearCols;
}

const extractTwoYearsFromRow = (row, yearCols) => {
  if (!yearCols) return { currentYear: null, previousYear: null };
  const a = parseValue(row[yearCols.currentYearCol]);
  const b = parseValue(row[yearCols.previousYearCol]);
  if (a !== null || b !== null) return { currentYear: a, previousYear: b };
  const nums = row.map((cell) => parseValue(cell)).filter((v) => v !== null);
  if (nums.length >= 2) {
    const twoRightMost = nums.slice(-2);
    return { currentYear: twoRightMost[1], previousYear: twoRightMost[0] };
  }
  return { currentYear: null, previousYear: null };
};

const findValueInSheet = (sheetData, searchConfigs, yearCols, metricName) => {
  if (!yearCols) return { currentYear: null, previousYear: null };
  let bestMatch = null;

  const scoreRow = (desc, primary) => {
    let score = 0;
    const allContain = primary.every((t) => desc.includes(t));
    if (allContain) score += 2;
    const firstCell = desc.split(' ')[0] ?? '';
    if (primary.some((t) => firstCell.includes(t))) score += 1;
    return score;
  };

  for (const config of searchConfigs) {
    const primary = (config.primary || []).map(norm);
    const exclusion = (config.exclusion || []).map(norm);

    for (const row of sheetData) {
      const desc = norm((row.slice(0, 6) || []).join(' '));
      const okPrimary =
        primary.every((t) => desc.includes(t)) ||
        primary.every((t) => desc.includes(`totale ${t}`));
      const bad = exclusion.some((t) => desc.includes(t));
      if (okPrimary && !bad) {
        const candidate = extractTwoYearsFromRow(row, yearCols);
        if (!isEmptyResult(candidate)) {
          const s = scoreRow(desc, primary);
          if (!bestMatch || s > bestMatch.score) {
            bestMatch = { ...candidate, score: s };
          }
        }
      }
    }
    if (bestMatch) break;
  }
  return bestMatch
    ? { currentYear: bestMatch.currentYear, previousYear: bestMatch.previousYear }
    : { currentYear: null, previousYear: null };
};

const findSimpleValue = (sheetData, searchTexts) => {
  const targets = searchTexts.map(norm);
  for (const row of sheetData) {
    for (let c = 0; c < Math.min(6, row.length); c++) {
      const cell = norm(row[c]);
      if (targets.some((t) => cell.includes(t))) {
        for (let k = c + 1; k < row.length; k++) {
          const v = String(row[k] ?? '').trim();
          if (v) return v;
        }
      }
    }
  }
  return null;
};

const detectScale = (sheets, coreMetrics) => {
  for (const sheetData of sheets) {
    const rx = /unit[aà]\s*di\s*misura.*(migliaia|euro)/i;
    for (const row of sheetData) {
      for (const cell of row) {
        const m = String(cell || '').match(rx);
        if (m) return m[1].toLowerCase() === 'migliaia' ? 1000 : 1;
      }
    }
  }
  const { fatturato, totaleAttivo } = coreMetrics || {};
  if (
    fatturato?.currentYear != null &&
    totaleAttivo?.currentYear != null &&
    fatturato.currentYear < 20000 &&
    totaleAttivo.currentYear < 20000
  ) return 1000;
  return 1;
};

// ---------- Config ----------
const metricsConfigs = {
  fatturato: [
    { primary: ['ricavi delle vendite e delle prestazioni'] },
    { primary: ['ricavi delle vendite'] },
    { primary: ['valore della produzione'], exclusion: ['costi', 'differenza'] },
  ],
  utilePerdita: [
    { primary: ["utile (perdita) dell'esercizio"] },
    { primary: ['risultato dellesercizio'] },
  ],
  debitiTotali: [{ primary: ['d) debiti'] }, { primary: ['debiti'] }],
  totaleAttivo: [{ primary: ['totale attivo'] }],
  patrimonioNetto: [{ primary: ['a) patrimonio netto'] }, { primary: ['totale patrimonio netto'] }],
};

// ---------- Handler ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'SessionId è richiesto' });

  console.log(`[${sessionId}] Avvio analisi XBRL (v17.1).`);

  try {
    const { data: session, error: sessionErr } = await supabase
      .from('checkup_sessions')
      .select('*, companies(*)')
      .eq('id', sessionId)
      .single();

    if (sessionErr) throw new Error(sessionErr.message || 'Errore lettura sessione.');
    if (!session) throw new Error('Sessione non trovata.');

    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from('checkup-documents')
      .download(session.file_path);
    if (dlErr) throw new Error('Impossibile scaricare il file di bilancio.');

    const workbook = xlsx.read(Buffer.from(await fileBlob.arrayBuffer()), { type: 'buffer' });
    const { T0000, T0002, T0006 } = workbook.Sheets || {};
    if (!T0000 || !T0002 || !T0006)
      throw new Error('Fogli standard (T0000, T0002, T0006) non trovati. Forse non è il formato atteso.');

    const companyInfoData = xlsx.utils.sheet_to_json(T0000, { header: 1, defval: '' });
    const balanceSheetData = xlsx.utils.sheet_to_json(T0002, { header: 1, defval: '' });
    const incomeStatementData = xlsx.utils.sheet_to_json(T0006, { header: 1, defval: '' });

    let yearColsBS = maybeFlipYearCols(balanceSheetData, findYearColumns(balanceSheetData));
    let yearColsIS = maybeFlipYearCols(incomeStatementData, findYearColumns(incomeStatementData));

    const companyName =
      findSimpleValue(companyInfoData, ['denominazione', 'ragione sociale', 'impresa', 'societa', 'azienda']) ||
      session.companies?.company_name ||
      'Azienda Analizzata';

    const context = {
      ateco: findSimpleValue(companyInfoData, ['attivita prevalente', 'settore di attivita prevalente']),
      region: (findSimpleValue(companyInfoData, ['sede'])?.match(/\(([^)]+)\)/) || [])[1] || null,
      companyName,
    };

    const utileCE = findValueInSheet(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile/Perdita');
    const utileSP = findValueInSheet(balanceSheetData, metricsConfigs.utilePerdita, yearColsBS, 'Utile/Perdita');

    const metrics = {
      fatturato: findValueInSheet(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
      utilePerdita: !isEmptyResult(utileCE) ? utileCE : utileSP,
      debitiTotali: findValueInSheet(balanceSheetData, metricsConfigs.debitiTotali, yearColsBS, 'Debiti Totali'),
      totaleAttivo: findValueInSheet(balanceSheetData, metricsConfigs.totaleAttivo, yearColsBS, 'Totale Attivo'),
      patrimonioNetto: findValueInSheet(balanceSheetData, metricsConfigs.patrimonioNetto, yearColsBS, 'Patrimonio Netto'),
    };

    const scale = detectScale(
      [companyInfoData, balanceSheetData, incomeStatementData],
      { fatturato: metrics.fatturato, totaleAttivo: metrics.totaleAttivo }
    );
    Object.values(metrics).forEach((m) => {
      if (!m) return;
      if (m.currentYear != null) m.currentYear *= scale;
      if (m.previousYear != null) m.previousYear *= scale;
    });

    const { fatturato, utilePerdita, debitiTotali } = metrics;
    const missing = Object.values(metrics).some(
      (m) => !m || m.currentYear === null || m.previousYear === null
    );
    let healthScore = null;
    if (!missing) {
      healthScore = 0;
      if (fatturato.currentYear > fatturato.previousYear) healthScore += 40;
      if (utilePerdita.currentYear > utilePerdita.previousYear) healthScore += 35;
      if (debitiTotali.currentYear < debitiTotali.previousYear) healthScore += 25;
    }

    let marketOutlook = 'Prospettive di mercato: dati generali non specificati.';
    try {
      const marketPrompt = `Fornisci un'analisi di mercato di 2-3 frasi per un'azienda italiana nel settore "${context.ateco || 'non specificato'}" situata in "${context.region || 'Italia'}". Sii generico e prudente.`;
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: marketPrompt }],
        temperature: 0.2,
      });
      marketOutlook = resp?.choices?.[0]?.message?.content || marketOutlook;
    } catch (e) {
      console.warn(`[${sessionId}] marketOutlook fallback:`, e?.message);
    }

    const fmt = (n) =>
      typeof n === 'number' && isFinite(n) ? n.toLocaleString('it-IT') + ' €' : 'n.d.';
    const pct = (n) =>
      typeof n === 'number' && isFinite(n) ? `${n.toFixed(1)}%` : 'n.d.';

    const revenueChange =
      fatturato?.previousYear != null &&
      fatturato?.currentYear != null &&
      fatturato.previousYear !== 0
        ? ((fatturato.currentYear - fatturato.previousYear) / Math.abs(fatturato.previousYear)) * 100
        : null;

    let summary;
    if (missing) {
      summary =
        'Dati incompleti: analisi limitata. Alcune voci chiave non sono state trovate con sufficiente affidabilità.';
    } else {
      const upRev = fatturato.currentYear > fatturato.previousYear;
      const upProfit = utilePerdita.currentYear > utilePerdita.previousYear;
      const downDebt = debitiTotali.currentYear < debitiTotali.previousYear;
      const parts = [];
      parts.push(upRev ? 'Crescita dei ricavi' : 'Ricavi in calo/stabili');
      parts.push(upProfit ? 'miglioramento dell’utile' : 'pressione sulla redditività');
      parts.push(downDebt ? 'riduzione dell’indebitamento' : 'indebitamento in aumento/stabile');
      summary = parts.join(', ') + '.';
    }

    const analysisResult = {
      summary,
      revenueAnalysis:
        revenueChange != null
          ? `Il fatturato è variato del ${pct(revenueChange)}, da ${fmt(fatturato.previousYear)} a ${fmt(
              fatturato.currentYear
            )}.`
          : `Variazione fatturato: n.d.`,
      profitAnalysis: `Utile da ${fmt(utilePerdita?.previousYear)} a ${fmt(utilePerdita?.currentYear)}.`,
      debtAnalysis: `Debiti totali da ${fmt(debitiTotali?.previousYear)} a ${fmt(debitiTotali?.currentYear)}.`,
      marketOutlook,
    };

    const resultToSave = {
      session_id: sessionId,
      health_score: healthScore,
      summary: analysisResult.summary,
      raw_ai_response: analysisResult,
      charts_data: {
        revenue_trend: {
          current_year: fatturato?.currentYear ?? null,
          previous_year: fatturato?.previousYear ?? null,
        },
        profit_trend: {
          current_year: utilePerdita?.currentYear ?? null,
          previous_year: utilePerdita?.previousYear ?? null,
        },
      },
      raw_parsed_data: { metrics, context, scale, companyName },
      data_quality: missing ? 'partial' : 'complete',
    };

    const { error: saveError } = await supabase.from('analysis_results').insert(resultToSave);
    if (saveError) throw new Error(`Salvataggio fallito: ${saveError.message}`);

    await supabase
      .from('checkup_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    console.log(`[${sessionId}] ✅ Analisi completata.`);
    return res.status(200).json({ success: true, sessionId });
  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] analyze-xbrl:`, error.message);
    if (sessionId) {
      await supabase
        .from('checkup_sessions')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message });
  }
}
