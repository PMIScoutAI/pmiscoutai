// /pages/api/analyze-xbrl.js
// VERSIONE 11.0 (Logica ATECO Avanzata e Prompt Dinamico)
// - INTEGRAZIONE: Implementata la nuova logica ATECO avanzata proposta dall'utente.
// - NUOVO: Funzione `getSectorInfo` per interrogare la tabella `ateco_macro_map` e recuperare dati di settore dettagliati (macro_sector_2, notes).
// - MIGLIORAMENTO: Il prompt per l'AI ora è costruito dinamicamente con un contesto settoriale ricco, utilizzando le note e le specifiche del database.
// - Le configurazioni delle metriche e l'estrazione ATECO di base rimangono invariate dalla v10.0.

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

// Funzioni di utility per il parsing (invariate)
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
        const descriptionCell = [row[0], row[1], row[2], row[3], row[4], row[5]].map(c => String(c || '').toLowerCase().trim()).join(' ');
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

// Configurazioni metriche (invariate)
const metricsConfigs = {
    fatturato: [{ primary: ["a) ricavi delle vendite e delle prestazioni"] }, { primary: ["ricavi delle vendite"] }, { primary: ["valore della produzione"], exclusion: ["costi", "differenza"] }],
    utilePerdita: [{ primary: ["utile (perdita) dell'esercizio"] }, { primary: ["risultato dell'esercizio"] }, { primary: ["risultato prima delle imposte"] }],
    totaleAttivo: [{ primary: ["totale attivo"] }],
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
    debitiLungoTermine: [{ primary: ["esigibili oltre l'esercizio successivo"] }, { primary: ["debiti esigibili oltre l'esercizio successivo"] }]
};

// 🎯 FUNZIONE MIGLIORATA per estrarre codice ATECO (invariata)
const extractAtecoCode = (atecoString) => {
    if (!atecoString) return null;
    console.log(`Estrazione ATECO da: "${atecoString}"`);
    const patterns = [
        /\((\d{2})\.(\d{2})\.(\d{2})\)/, /\/(\d{2})\.(\d{2})\.(\d{2})/,
        /(\d{2})\.(\d{2})/, /(\d{2})/
    ];
    for (const pattern of patterns) {
        const match = atecoString.match(pattern);
        if (match) {
            const division = match[1];
            console.log(`✅ Divisione ATECO estratta: ${division}`);
            return { full: match[0].replace(/[()]/g, ''), division: division };
        }
    }
    return null;
};

// 🎯 FUNZIONE per ottenere info settoriali dal TUO database
const getSectorInfo = async (divisionCode) => {
    if (!divisionCode) return null;
    try {
        const { data, error } = await supabase
            .from('ateco_macro_map')
            .select('macro_sector, macro_sector_2, notes')
            .eq('ateco_code', divisionCode)
            .single();
        if (error || !data) {
            console.log(`[ATECO] ⚠️ Divisione ${divisionCode} non trovata nel mapping`);
            return null;
        }
        console.log(`[ATECO] ✅ Trovato: ${data.macro_sector}${data.macro_sector_2 ? ` - ${data.macro_sector_2}` : ''}`);
        return data;
    } catch (err) {
        console.error(`[ATECO] Errore query per divisione ${divisionCode}:`, err);
        return null;
    }
};

export default async function handler(req, res) {
  const { sessionId } = req.query;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  if (!sessionId) return res.status(400).json({ error: 'SessionId è richiesto' });
  
  console.log(`[${sessionId}] Avvio analisi XBRL (versione 11.0).`);

  try {
    const { data: session, error: sessionError } = await supabase.from('checkup_sessions').select('*, companies(*)').eq('id', sessionId).single();
    if (sessionError || !session) throw new Error('Sessione non trovata.');

    const { data: fileBlob, error: downloadError } = await supabase.storage.from('checkup-documents').download(session.file_path);
    if (downloadError) throw new Error('Impossibile scaricare il file di bilancio.');
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const { T0000, T0002, T0006 } = workbook.Sheets;
    if (!T0000 || !T0002 || !T0006) throw new Error("Fogli di lavoro standard (T0000, T0002, T0006) non trovati.");

    const companyInfoData = xlsx.utils.sheet_to_json(T0000, { header: 1 });
    const balanceSheetData = xlsx.utils.sheet_to_json(T0002, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(T0006, { header: 1 });

    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    // 🎯 SEZIONE PRINCIPALE nel tuo handler analyze-xbrl.js
    const companyName = findSimpleValue(companyInfoData, ['denominazione', 'ragione sociale']) || session.companies.company_name || 'Azienda';
    const sedeRow = findSimpleValue(companyInfoData, ["sede"]);
    const regionMatch = sedeRow ? sedeRow.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    const rawAtecoString = findSimpleValue(companyInfoData, ["settore di attività prevalente", "codice ateco", "attività prevalente"]);
    console.log(`[${sessionId}] ATECO grezzo trovato: "${rawAtecoString}"`);
    
    const atecoData = extractAtecoCode(rawAtecoString);
    const sectorInfo = await getSectorInfo(atecoData?.division);

    const context = {
        ateco_code: atecoData?.full || rawAtecoString,
        ateco_division: atecoData?.division,
        region: region,
        macro_sector: sectorInfo?.macro_sector,
        macro_sector_2: sectorInfo?.macro_sector_2,
        sector_notes: sectorInfo?.notes
    };
    console.log(`[${sessionId}] Contesto finale:`, context);

    const metrics = {
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
        disponibilitaLiquide: findValueInSheetImproved(balanceSheetData, metricsConfigs.disponibilitaLiquide, yearColsBS, 'Disponibilità Liquide')
    };

    // 🎯 PROMPT ARRICCHITO con le tue informazioni settoriali
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
- Utile/(Perdita): ${metrics.utilePerdita.currentYear} / ${metrics.utilePerdita.previousYear}
- Totale Attivo: ${metrics.totaleAttivo.currentYear} / ${metrics.totaleAttivo.previousYear}
- Patrimonio Netto: ${metrics.patrimonioNetto.currentYear} / ${metrics.patrimonioNetto.previousYear}
- Debiti Totali: ${metrics.debitiTotali.currentYear} / ${metrics.debitiTotali.previousYear}
- Debiti a Breve Termine: ${metrics.debitiBreveTermine.currentYear} / ${metrics.debitiBreveTermine.previousYear}
- Crediti: ${metrics.creditiClienti.currentYear} / ${metrics.creditiClienti.previousYear}
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
      raw_parsed_data: { metrics, context, companyName }
    };
    
    await supabase.from('analysis_results').insert(resultToSave);
    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi XBRL completata con successo!`);
    return res.status(200).json({ success: true, sessionId: sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore fatale in analyze-xbrl:`, error);
    if (sessionId) {
      await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message });
  }
}
