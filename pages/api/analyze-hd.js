// /api/analyze-hd.js
// VERSIONE FINALE CON LOGICA A 2 FASI: 1) Estrazione Pura, 2) Analisi su Dati Puliti.

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
const llmJson = new ChatOpenAI({ 
    openAIApiKey: process.env.OPENAI_API_KEY, 
    modelName: "gpt-4o",
    temperature: 0,
    modelKwargs: { response_format: { type: "json_object" } },
});

// Funzione helper per trovare un valore nel JSON estratto
const findValue = (items, labelPart) => {
    const item = items.find(d => d.label.toLowerCase().includes(labelPart.toLowerCase()));
    return item || { current_year: 0, previous_year: 0 };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'SessionId mancante' });

  try {
    console.log(`[Analyze-HD/${sessionId}] Avvio analisi a 2 fasi.`);

    // --- FASE 1: ESTRAZIONE PURA DEI DATI IN UN JSON STRUTTURATO ---

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({ k: 15, searchKwargs: { filter: { session_id: sessionId } } });
    const contextDocs = await retriever.getRelevantDocuments("Stato Patrimoniale e Conto Economico completo");
    const context = formatDocumentsAsString(contextDocs);

    const extractionPrompt = PromptTemplate.fromTemplate(
        `Sei un ragioniere esperto. Il tuo unico compito è trascrivere i dati dallo Stato Patrimoniale e dal Conto Economico forniti nel contesto in un formato JSON strutturato.
        
        Contesto del bilancio:
        {context}

        Istruzioni Dettagliate:
        1.  Scorri il Conto Economico e lo Stato Patrimoniale.
        2.  Per ogni riga che contiene un valore numerico, estrai la descrizione (label) e i valori per l'anno corrente e l'anno precedente.
        3.  Converti i numeri dal formato italiano (es. "1.234.567,89") a un formato numerico standard (es. 1234567.89).
        4.  Se per una riga manca un valore, usa 0.
        5.  Restituisci ESCLUSIVAMENTE un oggetto JSON con una singola chiave "items", che contiene un array di oggetti. Ogni oggetto deve avere questa struttura: {{"label": "Descrizione Voce", "current_year": <numero>, "previous_year": <numero>}}

        Esempio di output:
        {{
            "items": [
                {{"label": "A) Valore della produzione", "current_year": 32938542, "previous_year": 21088915}},
                {{"label": "1) ricavi delle vendite e delle prestazioni", "current_year": 32234507, "previous_year": 20970465}},
                {{"label": "Utile (perdita) dell'esercizio", "current_year": 4079843, "previous_year": 1480683}},
                {{"label": "Totale patrimonio netto", "current_year": 5187514, "previous_year": 3238355}}
            ]
        }}`
    );

    const extractionChain = extractionPrompt.pipe(llmJson).pipe(new JsonOutputParser());
    console.log(`[Analyze-HD/${sessionId}] Fase 1: Avvio estrazione pura...`);
    const rawExtractionResult = await extractionChain.invoke({ context });
    const extractedItems = rawExtractionResult.items || [];
    
    if (extractedItems.length === 0) {
        throw new Error("Fase 1 fallita: Nessun dato estratto dal documento.");
    }
    console.log(`[Analyze-HD/${sessionId}] Fase 1 completata: Estratte ${extractedItems.length} voci di bilancio.`);

    // --- FASE 2: ANALISI SUI DATI PULITI ESTRATTI ---

    // Ora cerchiamo i valori specifici nel nostro JSON pulito
    const revenue = findValue(extractedItems, 'Valore della produzione');
    const ebitda = findValue(extractedItems, 'Differenza tra valore e costi della produzione');
    const netIncome = findValue(extractedItems, 'Utile (perdita) dell\'esercizio');
    const netEquity = findValue(extractedItems, 'Totale patrimonio netto');
    const totalAssets = findValue(extractedItems, 'Totale attivo');
    const cash = findValue(extractedItems, 'disponibilità liquide');
    const totalDebt = findValue(extractedItems, 'Totale debiti');

    const extractedData = {
        revenue_current: revenue.current_year,
        revenue_previous: revenue.previous_year,
        ebitda_current: ebitda.current_year,
        ebitda_previous: ebitda.previous_year,
        net_income_current: netIncome.current_year,
        net_income_previous: netIncome.previous_year,
        net_equity_current: netEquity.current_year,
        total_assets_current: totalAssets.current_year,
        cash_and_equivalents_current: cash.current_year,
        total_debt_current: totalDebt.current_year,
    };
    console.log(`[Analyze-HD/${sessionId}] Dati chiave puliti pronti per l'analisi:`, extractedData);

    // Calcoli matematici
    const { revenue_current, revenue_previous, net_equity_current, net_income_current, ebitda_current, total_assets_current, cash_and_equivalents_current, total_debt_current } = extractedData;
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
    
    // Invochiamo il prompt di analisi finale che hai scritto tu
    const { data: promptData } = await supabase.from('ai_prompts').select('prompt_template').eq('name', 'ANALISI_FINALE_HD_V1').single();
    const finalAnalysisPrompt = PromptTemplate.fromTemplate(promptData.prompt_template);
    const finalChain = finalAnalysisPrompt.pipe(llmJson).pipe(new JsonOutputParser());
    
    console.log(`[Analyze-HD/${sessionId}] Fase 2: Avvio analisi finale...`);
    const analysisResult = await finalChain.invoke({ data: JSON.stringify(dataForFinalPrompt, null, 2) });
    
    if (analysisResult.error) throw new Error(analysisResult.error);
    console.log(`[Analyze-HD/${sessionId}] Fase 2 completata: Analisi generata.`);

    // Salvataggio
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
    console.log(`[Analyze-HD/${sessionId}] 🎉 Flusso a 2 fasi completato con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
