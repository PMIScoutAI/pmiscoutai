// /pages/api/analyze-xbrl.js
// VERSIONE 7.1 (STABILE): Ripristino a una logica di estrazione più semplice e affidabile.
// - Ritorna all'uso di nomi di foglio fissi (T0000, T0002, T0006) per massima compatibilità.
// - Mantiene la funzione di ricerca con sinonimi per robustezza.

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
 * Funzione di parsing per gestire vari formati numerici.
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
        cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        cleanVal = cleanVal.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleanVal);
        return isNaN(num) ? null : num;
    }
    return null;
};

/**
 * Funzione di ricerca che assume che i dati siano nelle colonne 3 (anno N) e 4 (anno N-1).
 * @param {Array<Array<any>>} sheetData - I dati del foglio.
 * @param {string[]} searchTexts - Array di possibili diciture.
 * @returns {{ currentYear: number|null, previousYear: number|null }}
 */
const findValueInSheet = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    
    for (const row of sheetData) {
        const description = String(row[2] || row[1] || '').toLowerCase().trim();
        if (normalizedSearchTexts.some(searchText => description.includes(searchText))) {
            const rawCurrent = row[3];
            const rawPrevious = row[4];
            return { currentYear: parseValue(rawCurrent), previousYear: parseValue(rawPrevious) };
        }
    }
    return { currentYear: null, previousYear: null };
};

/**
 * Funzione di ricerca per valori testuali.
 * @param {Array<Array<any>>} sheetData - I dati del foglio.
 * @param {string[]} searchTexts - Array di possibili diciture.
 * @returns {string|null}
 */
const findSimpleValue = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    for (const row of sheetData) {
        const description = String(row[2] || row[1] || '').toLowerCase().trim();
        if (normalizedSearchTexts.some(searchText => description.includes(searchText))) {
            return row[3] || null;
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
  
  console.log(`[${sessionId}] Avvio analisi XBRL (versione stabile).`);

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
    
    // ✅ RIPRISTINO: Usiamo nomi di foglio fissi per maggiore affidabilità
    const companyInfoSheet = workbook.Sheets['T0000'];
    const balanceSheetData = xlsx.utils.sheet_to_json(workbook.Sheets['T0002'], { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(workbook.Sheets['T0006'], { header: 1 });
    const companyInfoData = xlsx.utils.sheet_to_json(companyInfoSheet, { header: 1 });

    if (!companyInfoSheet || !balanceSheetData || !incomeStatementData) {
        throw new Error("Uno o più fogli di lavoro standard (T0000, T0002, T0006) non sono stati trovati.");
    }

    const companyNameRow = companyInfoData.find(row => String(row[2] || '').toLowerCase().trim().includes('denominazione'));
    const companyName = companyNameRow ? companyNameRow[3] : 'Azienda Analizzata';

    const sedeRow = findSimpleValue(companyInfoData, ["sede"]);
    const regionMatch = sedeRow ? sedeRow.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    const context = {
        ateco: findSimpleValue(companyInfoData, ["codice ateco", "attività prevalente"]),
        region: region
    };

    const metrics = {
        fatturato: findValueInSheet(incomeStatementData, ["ricavi delle vendite", "valore della produzione"]),
        utilePerdita: findValueInSheet(balanceSheetData, ["utile (perdita) dell'esercizio", "risultato dell'esercizio"]),
        totaleAttivo: findValueInSheet(balanceSheetData, ["totale attivo"]),
        patrimonioNetto: findValueInSheet(balanceSheetData, ["patrimonio netto"]),
        debitiTotali: findValueInSheet(balanceSheetData, ["debiti"]),
        costiProduzione: findValueInSheet(incomeStatementData, ["costi della produzione"]),
        ammortamenti: findValueInSheet(incomeStatementData, ["ammortamenti e svalutazioni"]),
        oneriFinanziari: findValueInSheet(incomeStatementData, ["interessi e altri oneri finanziari"]),
        attivoCircolante: findValueInSheet(balanceSheetData, ["attivo circolante"]),
        debitiBreveTermine: findValueInSheet(balanceSheetData, ["debiti esigibili entro l'esercizio successivo"]),
        creditiClienti: findValueInSheet(balanceSheetData, ["crediti verso clienti"]),
        rimanenze: findValueInSheet(balanceSheetData, ["rimanenze"]),
        disponibilitaLiquide: findValueInSheet(balanceSheetData, ["disponibilità liquide"]),
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
