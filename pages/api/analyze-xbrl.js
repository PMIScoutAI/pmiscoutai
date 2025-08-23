// /pages/api/analyze-xbrl.js
// VERSIONE 3.0: Arricchimento dei dati estratti per un'analisi più profonda.
// - Aggiunta l'estrazione di nuove metriche da Conto Economico e Stato Patrimoniale.
// - Aggiornato il payload di dati inviato all'AI.

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
 * Funzione di utilità per cercare un valore in dati estratti da un foglio di calcolo.
 * @param {Array<Array<any>>} sheetData - I dati del foglio come array di array.
 * @param {string} searchText - Il testo da cercare.
 * @returns {{ currentYear: number|null, previousYear: number|null }} Un oggetto con i valori.
 */
const findValueInSheet = (sheetData, searchText) => {
    const normalizedSearchText = searchText.toLowerCase().trim();
    
    for (const row of sheetData) {
        const description = String(row[2] || row[1] || '').toLowerCase().trim();

        if (description.includes(normalizedSearchText)) {
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
            
            const currentYearValue = parseValue(rawCurrent);
            const previousYearValue = parseValue(rawPrevious);
            
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
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('checkup-documents')
      .download(filePath);

    if (downloadError) {
      console.error(`[${sessionId}] Errore download file:`, downloadError);
      throw new Error('Impossibile scaricare il file di bilancio.');
    }
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

    // 3. Parsa il file Excel e estrai i fogli necessari
    console.log(`[${sessionId}] Parsing del file Excel...`);
    const workbook = xlsx.read(fileBuffer);
    
    const requiredSheets = {
        companyInfo: 'T0000',
        balanceSheet: 'T0002',
        incomeStatement: 'T0006'
    };
    
    let sheetContents = {};

    for (const key in requiredSheets) {
        const sheetName = requiredSheets[key];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error(`Foglio di calcolo richiesto non trovato nel file: ${sheetName}`);
        
        sheetContents[key] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    }

    // 4. ✅ MIGLIORAMENTO: Estrai un set di dati più ricco
    console.log(`[${sessionId}] Mappatura dei dati finanziari estesi.`);
    
    const companyNameRow = sheetContents.companyInfo.find(row => String(row[2] || '').toLowerCase().trim().includes('denominazione'));
    const companyName = companyNameRow ? companyNameRow[3] : 'Azienda Analizzata';

    const metrics = {
        // Metriche di base
        fatturato: findValueInSheet(sheetContents.incomeStatement, "ricavi delle vendite e delle prestazioni"),
        utilePerdita: findValueInSheet(sheetContents.balanceSheet, "utile (perdita) dell'esercizio"),
        totaleAttivo: findValueInSheet(sheetContents.balanceSheet, "totale attivo"),
        patrimonioNetto: findValueInSheet(sheetContents.balanceSheet, "totale patrimonio netto (a)"),
        debitiTotali: findValueInSheet(sheetContents.balanceSheet, "d) debiti"),
        
        // Nuove metriche per analisi di marginalità
        costiProduzione: findValueInSheet(sheetContents.incomeStatement, "costi della produzione"),
        ammortamenti: findValueInSheet(sheetContents.incomeStatement, "ammortamenti e svalutazioni"),
        oneriFinanziari: findValueInSheet(sheetContents.incomeStatement, "interessi e altri oneri finanziari"),

        // Nuove metriche per analisi di liquidità e ciclo del circolante
        attivoCircolante: findValueInSheet(sheetContents.balanceSheet, "c) attivo circolante"),
        debitiBreveTermine: findValueInSheet(sheetContents.balanceSheet, "debiti esigibili entro l'esercizio successivo"),
        creditiClienti: findValueInSheet(sheetContents.balanceSheet, "crediti verso clienti"),
        rimanenze: findValueInSheet(sheetContents.balanceSheet, "rimanenze"),
        disponibilitaLiquide: findValueInSheet(sheetContents.balanceSheet, "disponibilità liquide"),
    };

    // 5. ✅ MIGLIORAMENTO: Prepara un testo più ricco per il prompt dell'AI
    const dataForPrompt = `
Dati Aziendali per ${companyName}:

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

    // 6. Recupera il template del prompt da Supabase (invariato)
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
      raw_ai_response: analysisResult, // Nome colonna corretto
      detailed_swot: analysisResult.detailed_swot || null,
      risk_analysis: analysisResult.risk_analysis || null,
      pro_features_teaser: analysisResult.pro_features_teaser || null,
      raw_parsed_data: metrics
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
