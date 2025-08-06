// /api/analyze-hd.js
// VERSIONE FINALE CON ESTRAZIONE JSON MIRATA: Implementa la strategia suggerita dall'utente.

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
// Abilitiamo la modalità JSON per forzare un output strutturato e affidabile
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

  let context = ""; // Definito qui per essere accessibile nel catch

  try {
    console.log(`[Analyze-HD/${sessionId}] Inizio estrazione JSON mirata.`);

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({ k: 20, searchKwargs: { filter: { session_id: sessionId } } });
    const contextDocs = await retriever.getRelevantDocuments("L'intero Stato Patrimoniale e Conto Economico della società principale, ignorando i dati di bilancio di altre società menzionate nella nota integrativa.");
    context = formatDocumentsAsString(contextDocs);

    // ✅ PROMPT POTENZIATO: Chiede all'AI di compilare un "modulo" JSON con le 8 voci principali.
    const extractionPrompt = PromptTemplate.fromTemplate(
        `Sei un esperto contabile specializzato in bilanci italiani. Il tuo unico compito è analizzare il Contesto fornito e compilare un modulo JSON con i dati delle 8 voci principali richieste.
        
        Contesto del bilancio:
        {context}
        
        ### ISTRUZIONI DETTAGLIATE:
        1.  Focalizzati ESCLUSIVAMENTE sulle tabelle dello **Stato Patrimoniale** e del **Conto Economico** della società principale. Ignora i dati di bilancio di altre società (es. capogruppo) che potrebbero trovarsi nella Nota Integrativa.
        2.  Identifica le colonne per l'anno corrente (solitamente la prima colonna di numeri) e l'anno precedente (la seconda).
        3.  Estrai i valori numerici per ogni voce richiesta nel JSON di output.
        4.  Converti i numeri dal formato italiano (es. "1.234.567,89") a un numero standard (es. 1234567.89).
        5.  Se un valore non è presente, usa 0.
        6.  Restituisci ESCLUSIVAMENTE un oggetto JSON con la seguente struttura:

        {{
            "revenue_current": <Valore della voce "A) Valore della produzione", anno corrente>,
            "revenue_previous": <Valore della voce "A) Valore della produzione", anno precedente>,
            "ebitda_current": <Valore della voce "Differenza tra valore e costi della produzione (A - B)", anno corrente>,
            "net_income_current": <Valore della voce "21) Utile (perdita) dell'esercizio", anno corrente>,
            "net_equity_current": <Valore della voce "Totale patrimonio netto" (Passivo, Voce A), anno corrente>,
            "total_assets_current": <Valore della voce "Totale attivo", anno corrente>,
            "cash_and_equivalents_current": <Valore della voce "Totale disponibilità liquide" (Attivo, Voce C.IV), anno corrente>,
            "total_debt_current": <Valore della voce "Totale debiti" (Passivo, Voce D), anno corrente>
        }}`
    );

    const extractionChain = extractionPrompt.pipe(llmJson).pipe(new JsonOutputParser());
    console.log(`[Analyze-HD/${sessionId}] Avvio estrazione strutturata mirata...`);
    const extractedData = await extractionChain.invoke({ context });
    
    if (!extractedData || Object.keys(extractedData).length < 8) {
        throw new Error(`Estrazione fallita: l'AI non ha restituito tutte le 8 voci richieste.`);
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con JSON mode:`, extractedData);

    // Per ora, salviamo solo i dati estratti per la verifica.
    await supabase.from('analysis_results_hd').insert({
        session_id: sessionId,
        raw_parsed_data: extractedData,
        summary: `Estrazione completata. Dati principali estratti per la verifica.`
    });

    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`[Analyze-HD/${sessionId}] 🎉 Estrazione completata con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    if (context) {
        console.error(`[Analyze-HD/${sessionId}] Contesto usato per l'estrazione fallita (primi 3000 caratteri):\n`, context.slice(0, 3000));
    }
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
