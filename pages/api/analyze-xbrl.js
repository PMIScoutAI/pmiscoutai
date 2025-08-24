// /pages/api/analyze-xbrl.js
// VERSIONE 14.0 (Analisi Strategica per Imprenditori)
// - NUOVO: Prompt AI completamente riscritto per un output narrativo e di business.
// - NUOVO: L'output JSON è ora semplice e contiene analisi testuali su fatturato, utili, debiti e mercato.
// - OBIETTIVO: Fornire un'analisi chiara e immediatamente comprensibile, non un report tecnico.

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

// --- UTILITY DI PARSING E NORMALIZZAZIONE (INVARIATE) ---

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u00A0-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const isEmptyResult = (r) =>
  !r || (r.currentYear === null && r.previousYear === null);

const parseValue = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let cleanVal = val.trim();
        const isNegative = cleanVal.startsWith('(') && cleanVal.endsWith(')');
        if (isNegative) {
            cleanVal = '-' + cleanVal.substring(1, cleanVal.length - 1);
        }
        cleanVal = cleanVal.replace(/\u00A0/g, '');
        cleanVal = cleanVal.replace(/['\s]/g, '');
        cleanVal = cleanVal.replace(/\u2212/g, '-');
        cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        cleanVal = cleanVal.replace(/[^\d.-]/g, '');
        
        if (cleanVal.replace(/[^0-9]/g, '').length > 12) {
            console.warn(`Valore scartato perché troppo lungo (potenziale codice): ${val}`);
            return null;
        }
        const num = parseFloat(cleanVal);
        return isNaN(num) ? null : num;
    }
    return null;
};


// --- FUNZIONI DI ESTRAZIONE DATI (INVARIATE) ---

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
        usedFallback: false,
    };
    console.log('Colonne anni trovate da header:', res);
    return res;
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
    const res = { currentYearCol: rightMost[1], previousYearCol: rightMost[0], currentYear: null, previousYear: null, usedFallback: true };
    console.warn('Colonne anni trovate con fallback numerico:', res);
    return res;
  }

  console.warn('Fallback finale per colonne anni: 3,4');
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
        if (!isEmptyResult(result)) {
          console.log(`[${metricName}] ✅ Match:`, { desc, result });
          return result;
        }
      }
    }
  }
  console.log(`[${metricName}] ⚠️ Nessun match per ${metricName}`);
  return { currentYear: null, previousYear: null };
};

const findSimpleValue = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(norm);
    for (const row of sheetData) {
        const normalizedRow = (row.slice(0, 6) || []).map(c => norm(c)).join(' ');
        if (normalizedSearchTexts.some(searchText => normalizedRow.includes(searchText))) {
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

const detectScale = (sheets, coreMetrics) => {
    for (const sheetData of sheets) {
        const rx = /unit[aà]\s*di\s*misura.*(migliaia|euro)/i;
        for (const row of sheetData) for (const cell of row) {
            const m = String(cell||'').match(rx);
            if (m) {
                const scale = m[1].toLowerCase() === 'migliaia' ? 1000 : 1;
                console.log(`✅ Scala rilevata da testo: ${scale === 1000 ? 'Migliaia di Euro' : 'Euro'}`);
                return scale;
            }
        }
    }
    const { fatturato, totaleAttivo } = coreMetrics;
    if (fatturato?.currentYear && totaleAttivo?.currentYear) {
        if (fatturato.currentYear < 20000 && totaleAttivo.currentYear < 20000) {
            console.warn('⚠️ Scala non trovata, ma valori core < 20.000. Assumo "Migliaia di Euro" (fattore 1000).');
            return 1000;
        }
    }
    console.warn('⚠️ Nessuna scala rilevata: assumo Euro (fattore 1)');
    return 1;
};

// --- CONFIGURAZIONI E HANDLER PRINCIPALE ---

const metricsConfigs = {
  fatturato: [ { primary: ["ricavi delle vendite e delle prestazioni"] }, { primary: ["ricavi delle vendite"] }, { primary: ["valore della produzione"], exclusion: ["costi","differenza"] }, ],
  utilePerdita: [ { primary: ["utile (perdita) dell'esercizio"] }, { primary: ["risultato dellesercizio"] }, { primary: ["risultato prima delle imposte"] }, ],
  totaleAttivo: [ { primary: ["totale attivo"] } ],
  patrimonioNetto: [ { primary: ["a) patrimonio netto"] }, { primary: ["totale patrimonio netto"] } ],
  debitiTotali: [ { primary: ["d) debiti"] }, { primary: ["debiti"] } ],
  costiProduzione: [ { primary: ["b) costi della produzione"] }, { primary: ["costi della produzione"], exclusion: ["valore"] } ],
  ammortamenti: [ { primary: ["ammortamenti e svalutazioni"] } ],
  oneriFinanziari: [ { primary: ["interessi e altri oneri finanziari"] } ],
  attivoCircolante: [ { primary: ["c) attivo circolante"], exclusion: ["immobilizzazioni"] }, { primary: ["totale attivo circolante"] } ],
  debitiBreveTermine: [ { primary: ["debiti esigibili entro l'esercizio successivo"] } ],
  creditiClienti: [ { primary: ["crediti verso clienti"] } ],
  rimanenze: [ { primary: ["rimanenze"] } ],
  disponibilitaLiquide: [ { primary: ["disponibilita liquide"] }, { primary: ["cassa e banche"], exclusion: ["passivo", "debiti"] } ],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'SessionId è richiesto' });
  
  console.log(`[${sessionId}] Avvio analisi XBRL (v14.0 - Analisi Strategica).`);

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

    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    const companyName = findSimpleValue(companyInfoData, ["denominazione", "ragione sociale", "impresa", "societa", "azienda"]) || 'Azienda Analizzata';
    const context = {
        ateco: findSimpleValue(companyInfoData, ["codice ateco", "attivita prevalente"]),
        region: (findSimpleValue(companyInfoData, ["sede"])?.match(/\(([^)]+)\)/) || [])[1] || null
    };

    const utileCE = findValueInSheet(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile/Perdita CE');
    const utileSP = findValueInSheet(balanceSheetData, metricsConfigs.utilePerdita, yearColsBS, 'Utile/Perdita SP');
    
    let metrics = {
      fatturato:        findValueInSheet(incomeStatementData, metricsConfigs.fatturato,        yearColsIS, 'Fatturato'),
      utilePerdita:     !isEmptyResult(utileCE) ? utileCE : utileSP,
      debitiTotali:     findValueInSheet(balanceSheetData, metricsConfigs.debitiTotali,       yearColsBS, 'Debiti Totali'),
      totaleAttivo:     findValueInSheet(balanceSheetData, metricsConfigs.totaleAttivo,       yearColsBS, 'Totale Attivo'),
      patrimonioNetto:  findValueInSheet(balanceSheetData, metricsConfigs.patrimonioNetto,    yearColsBS, 'Patrimonio Netto'),
    };

    const scale = detectScale([companyInfoData, balanceSheetData], { fatturato: metrics.fatturato, totaleAttivo: metrics.totaleAttivo });

    Object.values(metrics).forEach(m => {
      if (!m) return;
      if (m.currentYear != null)  m.currentYear  = m.currentYear  * scale;
      if (m.previousYear != null) m.previousYear = m.previousYear * scale;
    });

    // Sanity Check
    console.log("Eseguo sanity check sui dati estratti...");
    const coreMetricsCheck = [ metrics.fatturato, metrics.totaleAttivo, metrics.patrimonioNetto, metrics.utilePerdita ];
    const validCoreMetricsCount = coreMetricsCheck.filter(m => m && m.currentYear != null && m.previousYear != null).length;
    if (validCoreMetricsCount < 2) {
      throw new Error(`Dati estratti insufficienti per un'analisi affidabile. Trovate solo ${validCoreMetricsCount}/4 metriche core con dati per entrambi gli anni.`);
    }
    
    // ✅ NUOVO: Calcolo % fatturato per il prompt
    const revCurrent = metrics.fatturato.currentYear;
    const revPrevious = metrics.fatturato.previousYear;
    let revenueChangePercentage = "N/D";
    if (revCurrent != null && revPrevious != null && revPrevious !== 0) {
        revenueChangePercentage = (((revCurrent - revPrevious) / Math.abs(revPrevious)) * 100).toFixed(1) + '%';
    }

    // ✅ NUOVO: Prompt strategico e semplice
    const dataForPrompt = `
- Nome Azienda: ${companyName}
- Anno Corrente: ${yearColsIS.currentYear || 'N'}
- Anno Precedente: ${yearColsIS.previousYear || 'N-1'}
- Regione: ${context.region || 'N/D'}
- Codice ATECO: ${context.ateco || 'N/D'}
- Fatturato Anno Corrente: ${revCurrent} Euro
- Fatturato Anno Precedente: ${revPrevious} Euro
- Variazione % Fatturato: ${revenueChangePercentage}
- Utile/Perdita Anno Corrente: ${metrics.utilePerdita.currentYear} Euro
- Utile/Perdita Anno Precedente: ${metrics.utilePerdita.previousYear} Euro
- Debiti Totali Anno Corrente: ${metrics.debitiTotali.currentYear} Euro
- Debiti Totali Anno Precedente: ${metrics.debitiTotali.previousYear} Euro
`;
    
    const finalPrompt = `
Sei un analista finanziario esperto che si rivolge a un imprenditore italiano in modo chiaro, semplice e diretto.
Basandoti sui dati forniti, genera un'analisi concisa. Evita il gergo tecnico.

Dati:
${dataForPrompt}

Fornisci la tua analisi ESCLUSIVAMENTE come oggetto JSON con la seguente struttura:
{
  "revenueAnalysis": "Un commento di 1-2 frasi sulla crescita del fatturato. Inizia menzionando la percentuale di variazione.",
  "profitAnalysis": "Un commento di 1-2 frasi sull'andamento dell'utile/perdita.",
  "debtAnalysis": "Un commento di 1-2 frasi sull'andamento dei debiti totali, indicando se la situazione è migliorata o peggiorata.",
  "marketOutlook": "Un commento di 2-3 frasi sull'andamento generale del mercato per il settore (basato su ATECO) e la regione indicati. Sii prudente e basati su conoscenze generali se non hai dati specifici.",
  "summary": "Un riassunto esecutivo di 2 frasi che lega insieme i punti principali."
}
`;
    
    console.log(`[${sessionId}] Dati validati pronti per l'invio a OpenAI.`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: finalPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    let analysisResult;
    try {
        analysisResult = JSON.parse(response.choices[0].message.content);
    } catch (e) {
        console.error("Errore nel parsing della risposta JSON da OpenAI:", e);
        throw new Error("La risposta dell'AI non è in un formato JSON valido.");
    }
    
    // ✅ NUOVO: Salvataggio della nuova struttura di output
    const resultToSave = {
      session_id: sessionId,
      summary: analysisResult.summary,
      // Salva la nuova analisi in un campo dedicato. Il frontend andrà adattato.
      strategic_analysis: analysisResult, 
      raw_ai_response: analysisResult,
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
