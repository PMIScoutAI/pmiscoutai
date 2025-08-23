// /pages/api/analyze-xbrl.js
// VERSIONE 1.1 (FIX BUCKET): Aggiornato il nome del bucket di Supabase Storage.
// - Risolve l'errore 'StorageUnknownError: Bucket not found' durante il download.
// - Utilizza il nome corretto 'checkup-documents'.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import jszip from 'jszip';
import Papa from 'papaparse';

// Inizializzazione client Supabase e OpenAI
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Funzione di utilità per cercare un valore in un file CSV parsato.
 * Cerca un testo specifico nella prima colonna (ignorando maiuscole/minuscole e spazi).
 * @param {Array<Array<string>>} csvData - I dati del CSV come array di array.
 * @param {string} searchText - Il testo da cercare nella prima colonna descrittiva.
 * @returns {{ currentYear: number|null, previousYear: number|null }} Un oggetto con i valori per l'anno corrente e precedente.
 */
const findValueInCsv = (csvData, searchText) => {
    const normalizedSearchText = searchText.toLowerCase().trim();
    
    for (const row of csvData) {
        // La descrizione è tipicamente nella seconda o terza colonna (indice 1 o 2)
        const description = (row[2] || row[1] || '').toLowerCase().trim();

        if (description.includes(normalizedSearchText)) {
            // I valori numerici sono tipicamente nella terza e quarta colonna (indice 3 e 4)
            const currentYearValue = parseFloat(row[3]?.replace(/\./g, '').replace(',', '.')) || null;
            const previousYearValue = parseFloat(row[4]?.replace(/\./g, '').replace(',', '.')) || null;
            return { currentYear: currentYearValue, previousYear: previousYearValue };
        }
    }
    return { currentYear: null, previousYear: null };
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
    // ✅ FIX: Aggiornato il nome del bucket a 'checkup-documents'
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('checkup-documents')
      .download(filePath);

    if (downloadError) {
      console.error(`[${sessionId}] Errore download file:`, downloadError);
      throw new Error('Impossibile scaricare il file di bilancio.');
    }
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

    // 3. Estrai i file CSV dal contenitore .zip/.xls
    console.log(`[${sessionId}] Estrazione dei dati dal file...`);
    const zip = await jszip.loadAsync(fileBuffer);
    
    // Nomi dei file CSV che ci interessano
    const requiredFiles = {
        companyInfo: 'T0000.csv',
        balanceSheet: 'T0002.csv',
        incomeStatement: 'T0006.csv'
    };
    
    let csvContents = {};

    for (const key in requiredFiles) {
        const fileName = Object.values(zip.files).find(file => file.name.endsWith(requiredFiles[key]));
        if (!fileName) throw new Error(`File CSV richiesto non trovato nell'archivio: ${requiredFiles[key]}`);
        
        const content = await fileName.async('string');
        csvContents[key] = Papa.parse(content).data;
    }

    // 4. Estrai i dati finanziari chiave dai CSV
    console.log(`[${sessionId}] Mappatura dei dati finanziari.`);
    
    const companyNameRow = csvContents.companyInfo.find(row => (row[2] || '').toLowerCase().trim().includes('denominazione'));
    const companyName = companyNameRow ? companyNameRow[3] : 'Azienda Analizzata';

    const metrics = {
        fatturato: findValueInCsv(csvContents.incomeStatement, "ricavi delle vendite e delle prestazioni"),
        utilePerdita: findValueInCsv(csvContents.balanceSheet, "utile (perdita) dell'esercizio"),
        totaleAttivo: findValueInCsv(csvContents.balanceSheet, "totale attivo"),
        patrimonioNetto: findValueInCsv(csvContents.balanceSheet, "totale patrimonio netto (a)"),
        debitiTotali: findValueInCsv(csvContents.balanceSheet, "d) debiti"),
        attivoCircolante: findValueInCsv(csvContents.balanceSheet, "c) attivo circolante"),
        debitiBreveTermine: findValueInCsv(csvContents.balanceSheet, "debiti esigibili entro l'esercizio successivo"),
    };

    // 5. Prepara il testo strutturato per il prompt dell'AI
    const dataForPrompt = `
Dati Aziendali per ${companyName}:
- Anno Corrente (N): ${metrics.fatturato.currentYear !== null ? metrics.fatturato.currentYear.toLocaleString('it-IT') : 'N/D'} €
- Anno Precedente (N-1): ${metrics.fatturato.previousYear !== null ? metrics.fatturato.previousYear.toLocaleString('it-IT') : 'N/D'} €

Metriche Chiave (Anno Corrente N / Anno Precedente N-1):
- Fatturato: ${metrics.fatturato.currentYear} / ${metrics.fatturato.previousYear}
- Utile/(Perdita) d'esercizio: ${metrics.utilePerdita.currentYear} / ${metrics.utilePerdita.previousYear}
- Totale Attivo: ${metrics.totaleAttivo.currentYear} / ${metrics.totaleAttivo.previousYear}
- Patrimonio Netto: ${metrics.patrimonioNetto.currentYear} / ${metrics.patrimonioNetto.previousYear}
- Debiti Totali: ${metrics.debitiTotali.currentYear} / ${metrics.debitiTotali.previousYear}
- Attivo Circolante: ${metrics.attivoCircolante.currentYear} / ${metrics.attivoCircolante.previousYear}
- Debiti a Breve Termine: ${metrics.debitiBreveTermine.currentYear} / ${metrics.debitiBreveTermine.previousYear}
`;

    // 6. Recupera il template del prompt da Supabase
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

    // 7. Chiama OpenAI
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
      user_id: session.user_id,
      company_id: session.company_id,
      raw_result: analysisResult,
      prompt_version: 'FINANCIAL_ANALYSIS_V2',
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

    // 9. Aggiorna lo stato della sessione a 'completed'
    await supabase
      .from('checkup_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi XBRL completata con successo!`);
    return res.status(200).json({ success: true, sessionId: sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore fatale in analyze-xbrl:`, error.message);
    
    // Aggiorna lo stato della sessione a 'failed' in caso di errore
    if (sessionId) {
      await supabase
        .from('checkup_sessions')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', sessionId);
    }
    
    return res.status(500).json({ error: error.message });
  }
}
