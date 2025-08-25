// /pages/api/analyze-xbrl.js
// VERSIONE 9.1 (Prompt ATECO Migliorato)
// - AGGIUNTO: Istruzione esplicita nel prompt per l'AI per generare analisi SWOT più specifiche
//   utilizzando il codice ATECO e il macro settore, evitando risposte generiche.
// - La logica di estrazione dati rimane invariata.

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
 * Trova le colonne degli anni in modo tollerante.
 */
const findYearColumns = (sheetData) => {
    const yearRegex = /(19|20)\d{2}/;
    let years = [];
    for (let i = 0; i < Math.min(sheetData.length, 40); i++) {
        const row = sheetData[i];
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] ?? '').trim();
            const match = cell.match(yearRegex);
            if (match) {
                years.push({ year: parseInt(match[0], 10), col: j });
            }
        }
        if (years.length >= 2) break;
    }
    if (years.length < 2) {
        console.warn("Non è stato possibile trovare le colonne degli anni in modo dinamico. Utilizzo fallback 3 e 4.");
        return { currentYearCol: 3, previousYearCol: 4 }; // Fallback
    }
    
    years.sort((a, b) => b.year - a.year);
    console.log(`Colonne anni trovate: Anno Corrente -> ${years[0].col}, Anno Precedente -> ${years[1].col}`);
    return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

/**
 * Funzione di ricerca flessibile basata su configurazioni.
 */
const findValueInSheet = (sheetData, searchConfigs, yearCols, metricName) => {
    console.log(`--- Inizio ricerca per metrica: [${metricName}] ---`);
    for (const config of searchConfigs) {
        const primaryTerms = config.primary.map(t => t.toLowerCase().trim());
        const exclusionTerms = (config.exclusion || []).map(t => t.toLowerCase().trim());

        for (const row of sheetData) {
            let description = '';
            for (let i = 0; i < 6; i++) {
                description += String(row[i] || '').toLowerCase().trim() + ' ';
            }
            description = description.replace(/\s+/g, ' ').trim();

            const allPrimaryTermsFound = primaryTerms.every(term => description.includes(term));
            const anyExclusionTermsFound = exclusionTerms.some(term => description.includes(term));

            if (allPrimaryTermsFound && !anyExclusionTermsFound) {
                const rawCurrent = row[yearCols.currentYearCol];
                const rawPrevious = row[yearCols.previousYearCol];
                const result = {
                    currentYear: parseValue(rawCurrent),
                    previousYear: parseValue(rawPrevious)
                };

                if (result.currentYear !== null || result.previousYear !== null) {
                    console.log(`[${metricName}] ✅ MATCH TROVATO con config: [${primaryTerms.join(', ')}]. Valori: {N: ${result.currentYear}, N-1: ${result.previousYear}}`);
                    return result;
                }
            }
        }
    }

    console.log(`[${metricName}] ⚠️ NESSUN MATCH TROVATO per nessuna configurazione.`);
    return { currentYear: null, previousYear: null };
};

/**
 * Trova un valore testuale semplice.
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

// Dizionario centralizzato per le configurazioni di ricerca.
const metricsConfigs = {
    fatturato: [ { primary: ["a) ricavi delle vendite e delle prestazioni"] }, { primary: ["ricavi delle vendite"] }, { primary: ["valore della produzione"], exclusion: ["costi", "differenza"] } ],
    utilePerdita: [ { primary: ["utile (perdita) dell'esercizio"] }, { primary: ["risultato dell'esercizio"] }, { primary: ["risultato prima delle imposte"] } ],
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
    disponibilitaLiquide: [ { primary: ["disponibilità liquide"] } ],
};


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId è richiesto' });
  }
  
  console.log(`[${sessionId}] Avvio analisi XBRL (versione 9.1).`);

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

    const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1 });
    const companyInfoData = xlsx.utils.sheet_to_json(companyInfoSheet, { header: 1 });

    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    const companyName = findSimpleValue(companyInfoData, ['denominazione', 'ragione sociale', 'impresa', 'società']) || session.companies.company_name || 'Azienda Analizzata';
    const sedeRow = findSimpleValue(companyInfoData, ["sede"]);
    const regionMatch = sedeRow ? sedeRow.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    // Logica per il controllo del macro settore tramite codice ATECO
    const parsedAteco = findSimpleValue(companyInfoData, ["codice ateco", "attività prevalente"]);
    let macroSector = null;
    if (parsedAteco) {
        const divisionCode = parsedAteco.split('.')[0];
        const { data, error } = await supabase
            .from('ateco_macro_map')
            .select('macro_sector')
            .eq('ateco_code', divisionCode)
            .single();

        if (!error && data?.macro_sector) {
            macroSector = data.macro_sector;
            console.log(`[${sessionId}] ✅ Macro Settore trovato: ${macroSector}`);
        } else {
            console.log(`[${sessionId}] ⚠️ Macro Settore non trovato per ATECO: ${divisionCode}. L'AI lo dedurrà.`);
        }
    }

    const context = {
        ateco_code: parsedAteco,
        region: region,
        macro_sector: macroSector // Sarà null se non trovato
    };
    
    // Estrazione delle metriche
    const metrics = {
        fatturato: findValueInSheet(incomeStatementData, metricsConfigs.fatturato, yearColsIS, 'Fatturato'),
        utilePerdita: findValueInSheet(incomeStatementData, metricsConfigs.utilePerdita, yearColsIS, 'Utile/Perdita CE') || findValueInSheet(balanceSheetData, metricsConfigs.utilePerdita, yearColsBS, 'Utile/Perdita SP'),
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

    // ✅ PROMPT MIGLIORATO: Aggiunta istruzione specifica per l'AI
    const dataForPrompt = `
Dati Aziendali per ${companyName}:

Contesto Aziendale:
- Regione: ${context.region || 'N/D'}
- Codice ATECO (Settore): ${context.ateco_code || 'N/D'}${context.macro_sector ? `\n- Macro Settore: ${context.macro_sector}` : ''}
- Istruzione per l'AI: Nell'analisi SWOT, alla voce 'Opportunità', fornisci spunti specifici e concreti basati sul Macro Settore e sul Codice ATECO, considerando il contesto di mercato italiano. Evita frasi generiche come 'Basata su ATECO'.

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
      raw_parsed_data: { metrics, context, companyName } // Aggiunto companyName per coerenza
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
