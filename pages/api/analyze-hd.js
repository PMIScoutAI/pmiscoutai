// /api/analyze-hd.js
// VERSIONE POTENZIATA: Legge il prompt dal DB, estrae più dati e genera un report più ricco.

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser, JsonOutputParser } from "@langchain/core/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";

// --- Inizializzazione dei Client ---
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

// --- Funzione Principale dell'Handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId mancante' });
  }

  try {
    console.log(`[Analyze-HD/${sessionId}] Inizio analisi RAG potenziata.`);

    // 1. ✅ NUOVO: Recupera il prompt dal database
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'ANALISI_FINALE_HD_V1')
      .single();
    
    if (promptError || !promptData) {
      throw new Error("Impossibile recuperare il prompt 'ANALISI_FINALE_HD_V1' dal database.");
    }
    const finalAnalysisPromptTemplate = promptData.prompt_template;
    console.log(`[Analyze-HD/${sessionId}] Prompt 'ANALISI_FINALE_HD_V1' caricato.`);

    // 2. Inizializza il Retriever
    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: 'documents',
      queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({
        searchKwargs: { filter: { session_id: sessionId } }
    });
    console.log(`[Analyze-HD/${sessionId}] Retriever inizializzato.`);

    // 3. ✅ POTENZIATO: Estrazione di più dati, inclusi quelli dell'anno precedente
    const questions = {
        revenue_current: "Quali sono i ricavi delle vendite e delle prestazioni dell'anno corrente?",
        revenue_previous: "Quali sono i ricavi delle vendite e delle prestazioni dell'anno precedente?",
        net_equity_current: "Qual è il patrimonio netto dell'anno corrente?",
        net_income_current: "Qual è l'utile (o la perdita) dell'esercizio corrente?",
    };

    const extractedData = {};
    for (const [key, question] of Object.entries(questions)) {
        console.log(`[Analyze-HD/${sessionId}] Estraggo: ${key}`);
        const relevantDocs = await retriever.getRelevantDocuments(question);
        const context = formatDocumentsAsString(relevantDocs);
        
        const prompt = PromptTemplate.fromTemplate(
            `Basandoti solo sul seguente contesto, rispondi alla domanda. Rispondi solo con il valore numerico, senza testo aggiuntivo. Se non trovi la risposta, rispondi "0".\n\nContesto:\n{context}\n\nDomanda: {question}`
        );
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        const answer = await chain.invoke({ question, context });
        // Pulizia del numero da eventuali simboli di valuta o testo residuo
        const cleanedAnswer = answer.replace(/[^0-9.,-]+/g, '').replace(/\./g, '').replace(',', '.');
        extractedData[key] = parseFloat(cleanedAnswer) || 0;
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con RAG:`, extractedData);

    // 4. Generazione dell'Analisi Finale usando il prompt dal DB
    const finalAnalysisPrompt = PromptTemplate.fromTemplate(finalAnalysisPromptTemplate);
    const finalChain = finalAnalysisPrompt.pipe(llm).pipe(new JsonOutputParser());
    const analysisResult = await finalChain.invoke({ data: JSON.stringify(extractedData) });
    console.log(`[Analyze-HD/${sessionId}] Analisi finale generata.`);

    // 5. Salvataggio dei risultati nel database
    const { error: saveError } = await supabase
      .from('analysis_results_hd')
      .insert({
        session_id: sessionId,
        health_score: analysisResult.health_score,
        summary: analysisResult.summary,
        key_metrics: analysisResult.key_metrics,
        recommendations: analysisResult.recommendations,
        raw_ai_response: analysisResult,
        charts_data: analysisResult.charts_data,
        detailed_swot: analysisResult.detailed_swot,
        raw_parsed_data: extractedData,
      });

    if (saveError) throw new Error(`Errore salvataggio risultati: ${saveError.message}`);
    console.log(`[Analyze-HD/${sessionId}] Risultati salvati su DB.`);

    // 6. Aggiornamento dello stato finale della sessione
    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`[Analyze-HD/${sessionId}] 🎉 Analisi HD completata con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
