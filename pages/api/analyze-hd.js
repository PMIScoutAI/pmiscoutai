// /pages/api/analyze-hd.js
// Salva i risultati nelle nuove tabelle 'analysis_results_hd' e 'checkup_sessions_hd'.

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser, JsonOutputParser } from "@langchain/core/output_parsers";
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
  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId mancante' });
  }

  try {
    console.log(`[Analyze-HD/${sessionId}] Inizio analisi RAG.`);

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: 'documents',
      queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({
        searchKwargs: { filter: { session_id: sessionId } }
    });
    console.log(`[Analyze-HD/${sessionId}] Retriever inizializzato.`);

    const questions = {
        total_assets_current: "Qual è il totale attivo dell'anno corrente?",
        revenue_current: "Quali sono i ricavi delle vendite e delle prestazioni dell'anno corrente?",
        net_equity_current: "Qual è il patrimonio netto dell'anno corrente?",
        total_debt_current: "Qual è il totale dei debiti dell'anno corrente?",
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
        extractedData[key] = parseFloat(answer.replace(/[^\d.-]/g, '')) || 0;
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con RAG:`, extractedData);

    const finalAnalysisPrompt = PromptTemplate.fromTemplate(
      `Sei un analista finanziario esperto per PMI italiane. Basandoti ESCLUSIVAMENTE sui seguenti dati pre-estratti, fornisci un'analisi completa.
      
      Dati Pre-estratti:
      {data}

      Restituisci un JSON con questa struttura esatta:
      {{
        "health_score": <numero intero da 0 a 100 basato sulla salute generale>,
        "summary": "<riassunto dell'analisi in 2-3 frasi>",
        "key_metrics": {{
          "liquidita": <valore numerico o "N/A">,
          "solvibilita": <valore numerico o "N/A">,
          "redditivita": <valore numerico o "N/A">
        }},
        "recommendations": [
          "<raccomandazione strategica 1>",
          "<raccomandazione strategica 2>"
        ],
        "detailed_swot": {{
          "strengths": ["<punto di forza 1>", "<punto di forza 2>"],
          "weaknesses": ["<punto di debolezza 1>"],
          "opportunities": ["<opportunità 1>"],
          "threats": ["<minaccia 1>"]
        }}
      }}`
    );

    const finalChain = finalAnalysisPrompt.pipe(llm).pipe(new JsonOutputParser());
    const analysisResult = await finalChain.invoke({ data: JSON.stringify(extractedData) });
    console.log(`[Analyze-HD/${sessionId}] Analisi finale generata.`);

    const { error: saveError } = await supabase
      .from('analysis_results_hd')
      .insert({
        session_id: sessionId,
        health_score: analysisResult.health_score || 0,
        summary: analysisResult.summary || '',
        key_metrics: analysisResult.key_metrics || {},
        recommendations: analysisResult.recommendations || [],
        raw_ai_response: analysisResult,
        detailed_swot: analysisResult.detailed_swot || {},
        raw_parsed_data: extractedData,
      });

    if (saveError) throw new Error(`Errore salvataggio risultati: ${saveError.message}`);
    console.log(`[Analyze-HD/${sessionId}] Risultati salvati su DB.`);

    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`[Analyze-HD/${sessionId}] 🎉 Analisi HD completata con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
