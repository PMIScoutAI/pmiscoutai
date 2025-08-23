// /pages/api/analyze-xbrl.js
// VERSIONE 5.0 (GENERICA): Rimuove la dipendenza da nomi di foglio fissi.
// - Il codice ora scansiona tutti i fogli per identificare Stato Patrimoniale e Conto Economico in base al loro contenuto.
// - Rende l'analisi compatibile con diversi formati di file XBRL.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import xlsx from 'xlsx';

// Inizializzazione client Supabase e OpenAI
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Funzione di utilità per cercare un valore finanziario (anno corrente e precedente).
 * @param {Array<Array<any>>} sheetData - I dati del foglio.
 * @param {string[]} searchTexts - Un array di possibili diciture da cercare.
 * @returns {{ currentYear: number|null, previousYear: number|null }}
 */
const findValueInSheet = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    
    for (const row of sheetData) {
        const description = String(row[2] || row[1] || '').toLowerCase().trim();
        if (normalizedSearchTexts.some(searchText => description.includes(searchText))) {
            const rawCurrent = row[3];
            const rawPrevious = row[4];
            const parseValue = (val) => {
                if (val === null || val === undefined) return null;
                if (typeof val === 'number') return val;
                if (typeof val === 'string') {
                    return parseFloat(val.replace(/\./g, '').replace(',', '.')) || null;
                }
                return null;
            };
            return { currentYear: parseValue(rawCurrent), previousYear: parseValue(rawPrevious) };
        }
    }
    return { currentYear: null, previousYear: null };
};

/**
 * Funzione di utilità per cercare un singolo valore testuale (es. Codice ATECO).
 * @param {Array<Array<any>>} sheetData - I dati del foglio.
 * @param {string[]} searchTexts - Un array di possibili diciture da cercare.
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

/**
 * ✅ NUOVA FUNZIONE: Trova un foglio di calcolo per nome o contenuto.
 * @param {object} workbook - L'oggetto workbook di SheetJS.
 * @param {string[]} keywords - Parole chiave da cercare nel nome del foglio o nel suo contenuto.
 * @returns {Array<Array<any>>|null} I dati del foglio trovato o null.
 */
const findSheetByKeywords = (workbook, keywords) => {
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    for (const sheetName of workbook.SheetNames) {
        // Cerca prima per nome del foglio
        if (normalizedKeywords.some(keyword => sheetName.toLowerCase().includes(keyword))) {
            const sheet = workbook.Sheets[sheetName];
            return xlsx.utils.sheet_to_json(sheet, { header: 1 });
        }
        // Se non trovato, cerca nel contenuto delle prime 10 righe
        const sheet = workbook.Sheets[sheetName];
        const sheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const contentToCheck = JSON.stringify(sheetData.slice(0, 10)).toLowerCase();
        if (normalizedKeywords.some(keyword => contentToCheck.includes(keyword))) {
            return sheetData;
        }
    }
    return null; // Se nessun foglio corrisponde
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
    // 1. Recupera la sessione e il percorso del file
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('*, companies(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error(`[${sessionId}] Errore recupero sessione:`, sessionError);
      throw new Error('Sessione non trovata.');
    }
    
    const filePath = session.file_path;
    if (!filePath) {
        throw new Error('Percorso del file non trovato nella sessione.');
    }

    // 2. Scarica il file da Supabase Storage
    console.log(`[${sessionId}] Download del file: ${filePath}`);
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('checkup-documents')
      .download(filePath);

    if (downloadError) {
      console.error(`[${sessionId}] Errore download file:`, downloadError);
      throw new Error('Impossibile scaricare il file di bilancio.');
    }
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

    // 3. ✅ NUOVA LOGICA: Parsa il file e trova i fogli dinamicamente
    console.log(`[${sessionId}] Parsing del file Excel e ricerca dinamica dei fogli...`);
    const workbook = xlsx.read(fileBuffer);
    
    const companyInfoSheet = findSheetByKeywords(workbook, ["t0000", "informazioni generali"]);
    const balanceSheet = findSheetByKeywords(workbook, ["t0002", "stato patrimoniale"]);
    const incomeStatement = findSheetByKeywords(workbook, ["t0006", "conto economico"]);

    if (!companyInfoSheet) throw new Error("Impossibile trovare il foglio con le informazioni aziendali.");
    if (!balanceSheet) throw new Error("Impossibile trovare il foglio dello Stato Patrimoniale.");
    if (!incomeStatement) throw new Error("Impossibile trovare il foglio del Conto Economico.");

    // 4. Estrai i dati finanziari e di contesto
    console.log(`[${sessionId}] Mappatura dei dati finanziari e di contesto.`);
    
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
        fatturato: findValueInSheet(incomeStatement, ["ricavi delle vendite e delle prestazioni"]),
        utilePerdita: findValueInSheet(balanceSheet, ["utile (perdita) dell'esercizio"]),
        totaleAttivo: findValueInSheet(balanceSheet, ["totale attivo"]),
        patrimonioNetto: findValueInSheet(balanceSheet, ["totale patrimonio netto (a)", "patrimonio netto"]),
        debitiTotali: findValueInSheet(balanceSheet, ["d) debiti", "totale debiti"]),
        costiProduzione: findValueInSheet(incomeStatement, ["costi della produzione"]),
        ammortamenti: findValueInSheet(incomeStatement, ["ammortamenti e svalutazioni"]),
        oneriFinanziari: findValueInSheet(incomeStatement, ["interessi e altri oneri finanziari"]),
        attivoCircolante: findValueInSheet(balanceSheet, ["c) attivo circolante", "totale attivo circolante"]),
        debitiBreveTermine: findValueInSheet(balanceSheet, ["debiti esigibili entro l'esercizio successivo"]),
        creditiClienti: findValueInSheet(balanceSheet, ["crediti verso clienti"]),
        rimanenze: findValueInSheet(balanceSheet, ["rimanenze"]),
        disponibilitaLiquide: findValueInSheet(balanceSheet, ["disponibilità liquide"]),
    };

    // 5. Prepara un testo più ricco per il prompt dell'AI
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

    // 6. Recupera il template del prompt V2
    console.log(`[${sessionId}] Recupero prompt template 'FINANCIAL_ANALYSIS_V2'`);
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2')
      .single();

    if (promptError || !promptData) {
      console.error(`[${sessionId}] Errore recupero prompt:`, promptError);
      throw new Error("Impossibile trovare il template del prompt 'FINANCIAL_ANALYSIS_V2'.");
    }

    const finalPrompt = `${promptData.prompt_template}\n\nUsa i seguenti dati strutturati per eseguire la tua analisi. Ignora lo STEP 1 (estrazione) e procedi direttamente con calcoli, analisi e generazione JSON.\n\n${dataForPrompt}`;

    // 7. Chiama OpenAI (invariato)
    console.log(`[${sessionId}] Invio richiesta a OpenAI...`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: finalPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const analysisResult = JSON.parse(response.choices[0].message.content);
    console.log(`[${sessionId}] Risposta JSON ricevuta da OpenAI.`);

    // 8. Salva i risultati nel database
    const resultToSave = {
      session_id: sessionId,
      health_score: analysisResult.health_score || null,
      key_metrics: analysisResult.key_metrics || null,
      swot: analysisResult.detailed_swot || null,
      recommendations: analysisResult.recommendations || null,
      charts_data: analysisResult.charts_data || null,
      summary: analysisResult.summary || null,
      raw_ai_response: analysisResult,
      detailed_swot: analysisResult.detailed_swot || null,
      risk_analysis: analysisResult.risk_analysis || null,
      pro_features_teaser: analysisResult.pro_features_teaser || null,
      raw_parsed_data: { metrics, context } // Salviamo anche il contesto
    };
    
    const { data: savedData, error: saveError } = await supabase
      .from('analysis_results')
      .insert(resultToSave)
      .select();

    if (saveError) {
      console.error(`[${sessionId}] Errore salvataggio risultati:`, saveError);
      throw new Error(`Errore durante il salvataggio dell'analisi: ${saveError.message}`);
    }

    console.log(`[${sessionId}] Risultati salvati correttamente (ID: ${savedData[0].id})`);

    // 9. Aggiorna lo stato della sessione a 'completed' (invariato)
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
