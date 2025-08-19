// /api/analyze-hd.js
// VERSIONE FINALE E SEMPLIFICATA: Legge i dati precisi pre-estratti da Supabase
// e li usa per l'analisi, eliminando tutta la logica di estrazione manuale.

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { formatDocumentsAsString } from "langchain/util/document";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------- LOGICA DI ESTRAZIONE MANUALE COMPLETAMENTE RIMOSSA ----------
// Le funzioni complesse come extractValueSmartly, extractRevenueCurrent, etc.
// non sono più necessarie. L'estrazione è già stata fatta da Document AI.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'SessionId mancante' });

  try {
    console.log(`[Analyze-HD/${sessionId}] Avvio analisi finale...`);

    // 1. NUOVO STEP: Recupera i dati numerici precisi dalla nuova tabella
    console.log(`[Analyze-HD/${sessionId}] Recupero dati numerici da Supabase...`);
    const { data: extractedData, error: extractedDataError } = await supabase
      .from('risultati_estratti_hd')
      .select('*')
      .eq('session_id', sessionId)
      .single(); // Ci aspettiamo un solo risultato per sessione

    if (extractedDataError) {
      throw new Error(`Dati numerici non trovati per la sessione: ${extractedDataError.message}`);
    }
    if (!extractedData) {
      throw new Error(`Nessun dato numerico trovato per la sessione ${sessionId}.`);
    }

    console.log(`[Analyze-HD/${sessionId}] ✅ Dati numerici recuperati:`, extractedData);

    // 2. Recupera il contesto dal database vettoriale (logica invariata)
    // Questo serve per le analisi qualitative e per trovare spiegazioni nel testo.
    const vectorStore = new SupabaseVectorStore(
      new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
      { client: supabase, tableName: 'documents', queryName: 'match_documents' }
    );
    const retriever = vectorStore.asRetriever({
      k: 60,
      searchKwargs: { filter: { session_id: sessionId } },
    });

    // La query può essere semplificata, ma la lasciamo per coerenza
    const query = "Conto economico, Stato Patrimoniale, Nota Integrativa";
    const docs = await retriever.getRelevantDocuments(query);
    const context = formatDocumentsAsString(docs);
    
    console.log(`[Analyze-HD/${sessionId}] Contesto testuale recuperato (${context.length} caratteri).`);

    // 3. ESEGUI L'ANALISI FINALE (Qui userai i dati per generare il report)
    // Ora hai a disposizione:
    // - `extractedData`: Un oggetto con i numeri precisi (es. extractedData.fatturato_anno_corrente)
    // - `context`: Il testo completo del documento per analisi qualitative.
    
    // Esempio di come potresti usare questi dati per generare un report con un'altra chiamata a OpenAI:
    const finalReport = {
        summary: `Analisi per la sessione ${sessionId} completata con successo.`,
        // Qui potresti inserire il risultato di una chiamata a un modello LLM
        // che usa sia i dati numerici che il contesto per creare un'analisi approfondita.
        raw_parsed_data: extractedData 
    };

    // 4. Salva il risultato finale e completa la sessione (logica invariata)
    await supabase.from('analysis_results_hd').insert({
      session_id: sessionId,
      raw_parsed_data: finalReport.raw_parsed_data,
      summary: finalReport.summary
    });

    await supabase.from('checkup_sessions_hd')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    console.log(`[Analyze-HD/${sessionId}] ✅ Analisi completata e salvata.`);
    return res.status(200).json({ success: true, sessionId, data: finalReport });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    await supabase.from('checkup_sessions_hd')
      .update({ status: 'failed', error_message: error.message })
      .eq('id', sessionId);
    return res.status(500).json({ error: error.message });
  }
}
