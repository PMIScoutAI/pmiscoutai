// /api/analyze-hd.js
// VERSIONE CON ESTRAZIONE DI PRECISIONE CHIRURGICA: Addestrata sullo schema di bilancio italiano.

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
const llmJson = new ChatOpenAI({ 
    openAIApiKey: process.env.OPENAI_API_KEY, 
    modelName: "gpt-4o",
    temperature: 0,
    modelKwargs: { response_format: { type: "json_object" } },
});


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'SessionId mancante' });

  try {
    console.log(`[Analyze-HD/${sessionId}] Inizio analisi RAG con schema italiano di precisione.`);

    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts').select('prompt_template').eq('name', 'ANALISI_FINALE_HD_V1').single();
    if (promptError) throw new Error("Impossibile recuperare il prompt 'ANALISI_FINALE_HD_V1'.");
    const finalAnalysisPromptTemplate = promptData.prompt_template;

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({ k: 10, searchKwargs: { filter: { session_id: sessionId } } });

    // ✅ NUOVA STRATEGIA: Domande mirate e iper-specifiche per ogni dato chiave.
    const questions = {
        revenue_current: "Dal Conto Economico, qual è il valore di 'A) Valore della produzione' per l'anno corrente?",
        revenue_previous: "Dal Conto Economico, qual è il valore di 'A) Valore della produzione' per l'anno precedente?",
        ebitda_current: "Dal Conto Economico, qual è il valore della 'Differenza tra valore e costi della produzione (A-B)' per l'anno corrente?",
        ebitda_previous: "Dal Conto Economico, qual è la 'Differenza tra valore e costi della produzione (A-B)' per l'anno precedente?",
        net_income_current: "Dal Conto Economico, qual è il valore finale di '21) Utile (perdita) dell'esercizio' per l'anno corrente?",
        net_income_previous: "Dal Conto Economico, qual è il valore finale di '21) Utile (perdita) dell'esercizio' per l'anno precedente?",
        net_equity_current: "Dallo Stato Patrimoniale Passivo, qual è il 'Totale patrimonio netto' (voce A del Passivo) per l'anno corrente?",
        total_assets_current: "Dallo Stato Patrimoniale Attivo, qual è il 'Totale attivo' finale, che si trova dopo 'D) Ratei e risconti', per l'anno corrente?",
        cash_and_equivalents_current: "Dallo Stato Patrimoniale Attivo, qual è il 'Totale disponibilità liquide' (voce C.IV) per l'anno corrente?",
        total_debt_current: "Dallo Stato Patrimoniale Passivo, qual è il 'Totale debiti' (voce D) per l'anno corrente?",
    };

    const extractedData = {};
    for (const [key, question] of Object.entries(questions)) {
        const relevantDocs = await retriever.getRelevantDocuments(question);
        const context = formatDocumentsAsString(relevantDocs);
        
        const extractionPrompt = PromptTemplate.fromTemplate(
            `Sei un esperto contabile. Analizza il seguente contesto da un bilancio italiano. Il bilancio ha due colonne di valori: anno corrente e anno precedente. Trova il valore numerico esatto che risponde alla domanda, assicurandoti di prenderlo dalla colonna corretta. Ignora altri numeri non pertinenti.\n\nContesto:\n{context}\n\nDomanda: {question}\n\nIstruzioni: I numeri sono in formato italiano (es. "1.234.567,89"). Pulisci il numero e restituiscilo in formato standard (es. "1234567.89"). Rispondi SOLO con il numero. Se il valore non è presente, rispondi "0".`
        );

        const chain = extractionPrompt.pipe(llm).pipe(new StringOutputParser());
        const answer = await chain.invoke({ question, context });
        
        const cleanedAnswer = answer.replace(/\./g, '').replace(',', '.');
        extractedData[key] = parseFloat(cleanedAnswer) || 0;
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con RAG:`, extractedData);

    // CALCOLI POTENZIATI
    const { 
        revenue_current, revenue_previous, net_equity_current, net_income_current,
        ebitda_current, total_assets_current, cash_and_equivalents_current,
        total_debt_current
    } = extractedData;
    
    const net_financial_position = total_debt_current - cash_and_equivalents_current;
    const crescita_fatturato_perc = (revenue_previous !== 0) ? ((revenue_current - revenue_previous) / Math.abs(revenue_previous)) * 100 : null;
    const roe = (net_equity_current !== 0) ? (net_income_current / net_equity_current) * 100 : null;
    const roi = (total_assets_current !== 0) ? (ebitda_current / total_assets_current) * 100 : null;

    const dataForFinalPrompt = {
      ...extractedData,
      key_metrics: {
        crescita_fatturato_perc: { value: crescita_fatturato_perc, label: "Crescita Fatturato (%)" },
        roe: { value: roe, label: "ROE (%)" },
        roi: { value: roi, label: "ROI (%)" },
        net_financial_position: { value: net_financial_position, label: "Posizione Finanziaria Netta (€)" }
      },
      charts_data: {
        revenue_trend: { current_year: revenue_current, previous_year: revenue_previous }
      }
    };
    
    const finalAnalysisPrompt = PromptTemplate.fromTemplate(finalAnalysisPromptTemplate);
    // Usiamo il modello JSON per la generazione finale
    const finalChain = finalAnalysisPrompt.pipe(llmJson).pipe(new JsonOutputParser());
    const analysisResult = await finalChain.invoke({ data: JSON.stringify(dataForFinalPrompt, null, 2) });
    
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
