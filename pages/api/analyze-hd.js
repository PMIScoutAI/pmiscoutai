// /api/analyze-hd.js
// VERSIONE POTENZIATA: Esegue i calcoli in locale per la massima precisione.

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
  if (!sessionId) return res.status(400).json({ error: 'SessionId mancante' });

  try {
    console.log(`[Analyze-HD/${sessionId}] Inizio analisi RAG potenziata.`);

    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts').select('prompt_template').eq('name', 'ANALISI_FINALE_HD_V1').single();
    if (promptError) throw new Error("Impossibile recuperare il prompt 'ANALISI_FINALE_HD_V1'.");
    const finalAnalysisPromptTemplate = promptData.prompt_template;

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({ searchKwargs: { filter: { session_id: sessionId } } });

    const questions = {
        revenue_current: "Quali sono i ricavi delle vendite e delle prestazioni dell'anno corrente?",
        revenue_previous: "Quali sono i ricavi delle vendite e delle prestazioni dell'anno precedente?",
        net_equity_current: "Qual è il patrimonio netto dell'anno corrente?",
        net_income_current: "Qual è l'utile (o la perdita) dell'esercizio corrente?",
    };

    const extractedData = {};
    for (const [key, question] of Object.entries(questions)) {
        const relevantDocs = await retriever.getRelevantDocuments(question);
        const context = formatDocumentsAsString(relevantDocs);
        const prompt = PromptTemplate.fromTemplate(
            `Contesto: {context}\n\nDomanda: {question}\n\nBasandoti ESCLUSIVAMENTE sul contesto fornito, estrai il valore numerico richiesto. Pulisci il numero da qualsiasi simbolo (es. €) o testo. Rispondi SOLO con il numero. Se il valore non è presente, rispondi con "0".`
        );
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        const answer = await chain.invoke({ question, context });
        const cleanedAnswer = answer.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
        extractedData[key] = parseFloat(cleanedAnswer) || 0;
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con RAG:`, extractedData);

    // ✅ ESEGUIAMO I CALCOLI QUI, NEL CODICE, PER LA MASSIMA PRECISIONE
    const { revenue_current, revenue_previous, net_equity_current, net_income_current } = extractedData;
    
    const crescita_fatturato_perc = (revenue_previous && revenue_current) 
      ? ((revenue_current - revenue_previous) / revenue_previous) * 100 
      : null;
      
    const roe = (net_equity_current && net_income_current)
      ? (net_income_current / net_equity_current) * 100
      : null;

    const dataForFinalPrompt = {
      ...extractedData,
      key_metrics: {
        crescita_fatturato_perc: { value: crescita_fatturato_perc, label: "Crescita Fatturato (%)" },
        roe: { value: roe, label: "ROE (%)" }
      },
      charts_data: {
        revenue_trend: { current_year: revenue_current, previous_year: revenue_previous }
      }
    };
    
    const finalAnalysisPrompt = PromptTemplate.fromTemplate(finalAnalysisPromptTemplate);
    const finalChain = finalAnalysisPrompt.pipe(llm).pipe(new JsonOutputParser());
    const analysisResult = await finalChain.invoke({ data: JSON.stringify(dataForFinalPrompt, null, 2) });
    
    // Controlla se l'AI ha restituito un errore controllato
    if (analysisResult.error) {
        throw new Error(analysisResult.error);
    }
    console.log(`[Analyze-HD/${sessionId}] Analisi finale generata.`);

    await supabase.from('analysis_results_hd').insert({
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

    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`[Analyze-HD/${sessionId}] 🎉 Analisi HD completata con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
