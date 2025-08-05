// /api/analyze-hd.js
// VERSIONE CON ESTRAZIONE DI PRECISIONE CHIRURGICA: Ritorna a un'estrazione mirata e robusta.

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
    temperature: 0 
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'SessionId mancante' });

  try {
    console.log(`[Analyze-HD/${sessionId}] Inizio estrazione dati con metodo mirato e robusto.`);

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({ k: 10, searchKwargs: { filter: { session_id: sessionId } } });

    // ✅ STRATEGIA ROBUSTA: Domande mirate e iper-specifiche per ogni dato chiave.
    const questions = {
        revenue_current: "Dal Conto Economico, qual è il valore di 'A) Valore della produzione' per l'anno corrente?",
        revenue_previous: "Dal Conto Economico, qual è il valore di 'A) Valore della produzione' per l'anno precedente?",
        ebitda_current: "Dal Conto Economico, qual è il valore della 'Differenza tra valore e costi della produzione (A-B)' per l'anno corrente?",
        net_income_current: "Dal Conto Economico, qual è il valore finale di '21) Utile (perdita) dell'esercizio' per l'anno corrente?",
        net_equity_current: "Dallo Stato Patrimoniale Passivo, qual è il 'Totale patrimonio netto' (voce A del Passivo) per l'anno corrente?",
        total_assets_current: "Dallo Stato Patrimoniale Attivo, qual è il 'Totale attivo' finale per l'anno corrente?",
        cash_and_equivalents_current: "Dallo Stato Patrimoniale Attivo, qual è il 'Totale disponibilità liquide' (voce C.IV) per l'anno corrente?",
        total_debt_current: "Dallo Stato Patrimoniale Passivo, qual è il 'Totale debiti' (voce D) per l'anno corrente?",
    };

    const extractedData = {};
    for (const [key, question] of Object.entries(questions)) {
        const relevantDocs = await retriever.getRelevantDocuments(question);
        const context = formatDocumentsAsString(relevantDocs);
        
        const extractionPrompt = PromptTemplate.fromTemplate(
            `Sei un esperto contabile. Analizza il seguente contesto da un bilancio italiano. Trova il valore numerico esatto che risponde alla domanda. Ignora altri numeri non pertinenti.\n\nContesto:\n{context}\n\nDomanda: {question}\n\nIstruzioni: I numeri sono in formato italiano (es. "1.234.567,89"). Pulisci il numero e restituiscilo in formato standard (es. "1234567.89"). Rispondi SOLO con il numero. Se il valore non è presente, rispondi "0".`
        );

        const chain = extractionPrompt.pipe(llm).pipe(new StringOutputParser());
        const answer = await chain.invoke({ question, context });
        
        const cleanedAnswer = answer.replace(/\./g, '').replace(',', '.');
        extractedData[key] = parseFloat(cleanedAnswer) || 0;
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con RAG:`, extractedData);

    // SEMPLIFICAZIONE: Salviamo solo i dati estratti, senza fare analisi complesse.
    await supabase.from('analysis_results_hd').insert({
        session_id: sessionId,
        raw_parsed_data: extractedData, // Salviamo i dati puliti per la visualizzazione
        summary: `Estrazione dati completata per ${Object.keys(extractedData).length} voci di bilancio.`
    });

    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`[Analyze-HD/${sessionId}] 🎉 Estrazione completata con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    // Aggiungiamo il logging del contesto in caso di errore per il debug
    if (error.message.includes('Estrai solo')) {
        const retriever = new SupabaseVectorStore(embeddings, { client: supabase, tableName: 'documents', queryName: 'match_documents' }).asRetriever({ k: 15, searchKwargs: { filter: { session_id: sessionId } } });
        const contextDocs = await retriever.getRelevantDocuments("Stato Patrimoniale e Conto Economico completo");
        const context = formatDocumentsAsString(contextDocs);
        console.error(`[Analyze-HD/${sessionId}] Contesto usato per l'estrazione fallita:\n`, context.slice(0, 4000));
    }
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
