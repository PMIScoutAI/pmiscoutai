// /api/analyze-hd.js
// VERSIONE ULTRA-SEMPLIFICATA: Estrae solo 2 dati chiave per massima affidabilità.

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
const llm = new ChatOpenAI({ 
    openAIApiKey: process.env.OPENAI_API_KEY, 
    modelName: "gpt-4o",
    temperature: 0,
});

// Funzione di pulizia robusta per i formati numerici italiani
const parseItalianNumber = (text) => {
    if (typeof text !== 'string') return 0;
    const cleanedText = text.trim().replace(/€/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanedText) || 0;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'SessionId mancante' });

  let contextForDebug = "";

  try {
    console.log(`[Analyze-HD/${sessionId}] Inizio estrazione semplificata (2 voci).`);

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({ k: 15, searchKwargs: { filter: { session_id: sessionId } } });

    // ✅ OBIETTIVO SEMPLICE: Estraiamo solo 2 dati chiave.
    const domandeBilancio = [
      {
        key: "revenue_current",
        domanda: `Dal Conto Economico, qual è il valore esatto della voce "A) Valore della produzione" per l'anno più recente?`
      },
      {
        key: "net_income_current",
        domanda: `Dal Conto Economico, qual è il valore finale di "Utile (perdita) dell'esercizio" per l'anno più recente?`
      }
    ];

    const domandaPrompt = PromptTemplate.fromTemplate(
      `Analizza il Contesto da un bilancio italiano e rispondi alla Domanda. Rispondi con **solo il numero** in formato standard (es. 1234567.89), senza simboli o commenti.\n\nDomanda: {domanda}\n\nContesto:\n{context}`
    );

    const extractedData = {};
    for (const { key, domanda } of domandeBilancio) {
        const relevantDocs = await retriever.getRelevantDocuments(domanda);
        const context = formatDocumentsAsString(relevantDocs);
        contextForDebug = context;

        const chain = domandaPrompt.pipe(llm).pipe(new StringOutputParser());
        const answer = await chain.invoke({ domanda, context });
        
        extractedData[key] = parseItalianNumber(answer);
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti:`, extractedData);

    // Salviamo solo i 2 dati estratti per la verifica.
    await supabase.from('analysis_results_hd').insert({
        session_id: sessionId,
        raw_parsed_data: extractedData,
        summary: `Estrazione semplificata completata.`
    });

    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`[Analyze-HD/${sessionId}] 🎉 Estrazione semplificata completata con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    if (contextForDebug) {
        console.error(`[Analyze-HD/${sessionId}] Contesto usato (primi 3000 caratteri):\n`, contextForDebug.slice(0, 3000));
    }
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
