// /api/analyze-hd.js
// VERSIONE CON DOMANDE E PROMPT SUGGERITI DALL'UTENTE: Massima precisione e pulizia del codice.

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
    // Rimuove spazi, simboli €, poi i punti delle migliaia, e infine sostituisce la virgola
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
    console.log(`[Analyze-HD/${sessionId}] Inizio estrazione con domande e prompt migliorati.`);

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    const retriever = vectorStore.asRetriever({ k: 15, searchKwargs: { filter: { session_id: sessionId } } });

    // ✅ IMPLEMENTAZIONE: Utilizziamo l'array di domande fornito dall'utente.
    const domandeBilancio = [
      {
        key: "revenue_current",
        domanda: `Qual è il valore esatto della voce "Valore della produzione" riferita all'anno più recente disponibile nel bilancio?`
      },
      {
        key: "revenue_previous",
        domanda: `Qual è il valore esatto della voce "Valore della produzione" riferita all'anno precedente a quello più recente disponibile nel bilancio?`
      },
      {
        key: "ebitda_current",
        domanda: `Qual è il valore esatto della voce "Differenza tra valore e costi della produzione (A - B)" per l'anno più recente?`
      },
      {
        key: "net_income_current",
        domanda: `Qual è il valore dell’utile o perdita d’esercizio (voce 21 del Conto Economico) per l’anno più recente?`
      },
      {
        key: "net_equity_current",
        domanda: `Qual è il totale del patrimonio netto (voce A del Passivo) alla data di chiusura dell’ultimo esercizio disponibile?`
      },
      {
        key: "total_assets_current",
        domanda: `Qual è il valore del totale dell'attivo alla data di chiusura dell’ultimo esercizio?`
      },
      {
        key: "cash_and_equivalents_current",
        domanda: `Qual è il valore totale delle disponibilità liquide (voce C.IV dell’Attivo) alla chiusura dell’ultimo esercizio?`
      },
      {
        key: "total_debt_current",
        domanda: `Qual è il valore del totale dei debiti (voce D del Passivo) alla chiusura dell’ultimo esercizio?`
      }
    ];

    // ✅ IMPLEMENTAZIONE: Utilizziamo il nuovo template di prompt fornito dall'utente.
    const domandaPrompt = PromptTemplate.fromTemplate(
      `Hai ricevuto un bilancio italiano in formato testuale, contenente Stato Patrimoniale e Conto Economico.\n\nDomanda: {domanda}\n\nContesto:\n{context}\n\n⚠️ Rispondi con **solo un numero** (formato standard: 1234567.89). Nessun simbolo €, nessun commento.`
    );

    const extractedData = {};
    for (const { key, domanda } of domandeBilancio) {
        const relevantDocs = await retriever.getRelevantDocuments(domanda);
        const context = formatDocumentsAsString(relevantDocs);
        contextForDebug = context;

        const chain = domandaPrompt.pipe(llm).pipe(new StringOutputParser());
        const answer = await chain.invoke({ domanda, context });
        
        // Usiamo la nostra funzione di parsing robusta, anche se l'AI dovrebbe già restituire un numero pulito.
        extractedData[key] = parseItalianNumber(answer);
    }
    console.log(`[Analyze-HD/${sessionId}] Dati estratti con metodo chirurgico:`, extractedData);

    // Salviamo solo i dati estratti per la verifica.
    await supabase.from('analysis_results_hd').insert({
        session_id: sessionId,
        raw_parsed_data: extractedData,
        summary: `Estrazione dati completata per ${Object.keys(extractedData).length} voci di bilancio.`
    });

    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    console.log(`[Analyze-HD/${sessionId}] 🎉 Estrazione completata con successo!`);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    if (contextForDebug) {
        console.error(`[Analyze-HD/${sessionId}] Contesto usato per l'estrazione fallita (primi 3000 caratteri):\n`, contextForDebug.slice(0, 3000));
    }
    await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    res.status(500).json({ error: error.message });
  }
}
