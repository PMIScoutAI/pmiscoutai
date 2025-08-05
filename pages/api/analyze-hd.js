// /api/analyze-hd.js
// VERSIONE FINALE CON ESTRAZIONE JSON STRUTTURATA: Massima precisione e affidabilità.

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
// Abilitiamo la modalità JSON per un output strutturato e affidabile
const llm = new ChatOpenAI({ 
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
    console.log(`[Analyze-HD/${sessionId}] Inizio analisi con estrazione JSON strutturata.`);

    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts').select('prompt_template').eq('name', 'ANALISI_FINALE_HD_V1').single();
    if (promptError) throw new Error("Impossibile recuperare il prompt 'ANALISI_FINALE_HD_V1'.");
    const finalAnalysisPromptTemplate = promptData.prompt_template;

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    // Recuperiamo un contesto ampio per l'estrazione
    const retriever = vectorStore.asRetriever({ k: 10, searchKwargs: { filter: { session_id: sessionId } } });
    const contextDocs = await retriever.getRelevantDocuments("Stato Patrimoniale e Conto Economico");
    const context = formatDocumentsAsString(contextDocs);

    // ✅ NUOVA LOGICA: Un unico prompt per estrarre tutti i dati in formato JSON.
    const extractionPrompt = PromptTemplate.fromTemplate(
        `Sei un esperto contabile specializzato in bilanci italiani. Analizza il contesto fornito, che contiene lo Stato Patrimoniale e il Conto Economico. Estrai i seguenti valori sia per l'anno corrente che per l'anno precedente.
        
        Contesto del bilancio:
        {context}

        Istruzioni:
        1.  Identifica le colonne per l'anno corrente e l'anno precedente.
        2.  Estrai i valori numerici per ogni voce richiesta.
        3.  I numeri sono in formato italiano (es. "1.234.567,89"). Convertili in formato numerico standard (es. 1234567.89).
        4.  Se un valore non è presente, usa 0.
        5.  Restituisci ESCLUSIVAMENTE un oggetto JSON con la seguente struttura:

        {{
            "revenue_current": <numero>,
            "revenue_previous": <numero>,
            "ebitda_current": <numero>,
            "ebitda_previous": <numero>,
            "net_income_current": <numero>,
            "net_income_previous": <numero>,
            "net_equity_current": <numero>,
            "total_assets_current": <numero>,
            "cash_and_equivalents_current": <numero>,
            "total_debt_current": <numero>
        }}`
    );

    const extractionChain = extractionPrompt.pipe(llm).pipe(new JsonOutputParser());
    console.log(`[Analyze-HD/${sessionId}] Avvio estrazione strutturata...`);
    const extractedData = await extractionChain.invoke({ context });
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con JSON mode:`, extractedData);

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
    const finalChain = finalAnalysisPrompt.pipe(llm).pipe(new JsonOutputParser());
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
