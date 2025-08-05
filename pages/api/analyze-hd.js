// /api/analyze-hd.js
// VERSIONE FINALE CON ESTRAZIONE STRUTTURATA: Implementa la strategia a 2 fasi con il prompt dell'utente.

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
    console.log(`[Analyze-HD/${sessionId}] Inizio estrazione con JSON strutturato.`);

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    // Recuperiamo un contesto ampio per l'estrazione
    const retriever = vectorStore.asRetriever({ k: 15, searchKwargs: { filter: { session_id: sessionId } } });
    const contextDocs = await retriever.getRelevantDocuments("Stato Patrimoniale e Conto Economico completo");
    const context = formatDocumentsAsString(contextDocs);

    // ✅ PROMPT DELL'UTENTE: Utilizziamo il prompt fornito, che è molto più robusto.
    const extractionPrompt = PromptTemplate.fromTemplate(
        `Sei un esperto analista contabile. Il tuo unico compito è estrarre dati numerici precisi dallo **Stato Patrimoniale** e dal **Conto Economico** riportati nel contesto seguente, e restituirli in un formato JSON standardizzato.

        Contesto:
        {context}
        
        ### ISTRUZIONI:
        1. Analizza attentamente ogni tabella del bilancio.
        2. Per ogni riga che contiene un’etichetta (label) e valori numerici per uno o entrambi gli anni:
           - Copia fedelmente l’etichetta
           - Estrai i valori **per l'anno corrente** e **per l'anno precedente**
           - Se manca un valore, inserisci 0
        3. I numeri sono nel formato italiano (es. "1.234.567,89") → converti in numero standard (es. 1234567.89)
        4. Se un’etichetta è presente due volte, includila una sola volta (la più completa)
        5. Ignora intestazioni, sottototali intermedi o voci testuali
        6. Inserisci solo i dati numerici, **non fare alcun commento o calcolo**
        7. Il risultato finale deve essere un oggetto JSON con questa struttura precisa:
        
        {{
         "items": [
           {{ "label": "Valore della produzione", "current_year": 32938542, "previous_year": 21088915 }},
           {{ "label": "Utile (perdita) dell'esercizio", "current_year": 4079843, "previous_year": 1480683 }},
           {{ "label": "Totale patrimonio netto", "current_year": 5187514, "previous_year": 3238355 }}
         ]
        }}`
    );

    const extractionChain = extractionPrompt.pipe(llmJson).pipe(new JsonOutputParser());
    console.log(`[Analyze-HD/${sessionId}] Avvio estrazione strutturata...`);
    const extractedResult = await extractionChain.invoke({ context });
    
    const extractedItems = extractedResult.items || [];

    if (extractedItems.length < 5) { // Controllo di sicurezza
        throw new Error(`Estrazione fallita: Estratti solo ${extractedItems.length} dati. Il documento potrebbe essere illeggibile o il prompt non ha funzionato.`);
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con JSON mode: ${extractedItems.length} voci.`);

    // Per ora, salviamo l'intera tabella estratta per la verifica.
    await supabase.from('analysis_results_hd').insert({
        session_id: sessionId,
        raw_parsed_data: extractedItems, // Salviamo l'array completo di voci di bilancio
        summary: `Estrazione completata. ${extractedItems.length} voci di bilancio estratte per la verifica.`
    });

    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`[Analyze-HD/${sessionId}] 🎉 Estrazione completata con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
