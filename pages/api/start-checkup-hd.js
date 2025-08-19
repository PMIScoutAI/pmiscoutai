// /api/start-checkup-hd.js
// VERSIONE UNIFICATA E ROBUSTA: Esegue estrazione, indicizzazione e analisi
// in un unico processo per evitare timeout e problemi di comunicazione.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { formatDocumentsAsString } from "langchain/util/document";

// Inizializzazione dei client (invariata)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  let session;

  try {
    // --- FASE 1: RICEZIONE E CREAZIONE SESSIONE (come prima) ---
    const userId = '11111111-1111-1111-1111-111111111111';
    // ... (la logica dell'utente fittizio rimane la stessa)

    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    const [fields, files] = await form.parse(req);
    
    const companyName = fields.companyName?.[0];
    const pdfFile = files.pdfFile?.[0];
    const extractedDataJson = fields.extractedDataJson?.[0];

    if (!companyName || !pdfFile || !extractedDataJson) {
      return res.status(400).json({ error: 'Dati mancanti.' });
    }
    const extractedData = JSON.parse(extractedDataJson);

    // ... (creazione azienda e sessione come prima)
     const { data: company } = await supabase
      .from('companies')
      .upsert({ user_id: userId, company_name: companyName }, { onConflict: 'user_id, company_name' })
      .select().single();
      
    const { data: sessionData } = await supabase
      .from('checkup_sessions_hd')
      .insert({ 
        user_id: userId, 
        company_id: company.id,
        status: 'processing', // Partiamo subito con 'processing'
        session_name: `Check-UP HD ${companyName} - ${new Date().toLocaleDateString('it-IT')}`
      })
      .select().single();
    session = sessionData;
    console.log(`[HD/${session.id}] Sessione creata, avvio processo completo...`);

    // --- FASE 2: SALVATAGGIO DATI E INDICIZZAZIONE (come prima) ---
    await supabase.from('risultati_estratti_hd').insert({
        session_id: session.id,
        ...extractedData
      });
    console.log(`[HD/${session.id}] Dati numerici salvati.`);

    const loader = new PDFLoader(pdfFile.filepath);
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const splitDocs = await splitter.splitDocuments(docs);
    const docsWithMetadata = splitDocs.map(doc => ({
      ...doc,
      metadata: { ...doc.metadata, session_id: session.id, user_id: userId },
    }));
    await SupabaseVectorStore.fromDocuments(docsWithMetadata, embeddings, {
      client: supabase, tableName: 'documents', queryName: 'match_documents',
    });
    console.log(`[HD/${session.id}] Indicizzazione vettoriale completata.`);

    // --- FASE 3: ANALISI FINALE (logica di analyze-hd.js integrata qui) ---
    console.log(`[HD/${session.id}] Avvio analisi finale...`);
    
    // Non serve recuperare i dati numerici, li abbiamo già in `extractedData`
    console.log(`[HD/${session.id}] Dati numerici per l'analisi:`, extractedData);

    // Recuperiamo il contesto dal database vettoriale (come faceva analyze-hd)
    const vectorStore = new SupabaseVectorStore(embeddings, { client: supabase, tableName: 'documents', queryName: 'match_documents' });
    const retriever = vectorStore.asRetriever({
      k: 60,
      searchKwargs: { filter: { session_id: session.id } },
    });
    const contextDocs = await retriever.getRelevantDocuments("Conto economico, Stato Patrimoniale, Nota Integrativa");
    const context = formatDocumentsAsString(contextDocs);
    console.log(`[HD/${session.id}] Contesto testuale recuperato.`);

    // Qui generi il tuo report finale usando `extractedData` e `context`
    const finalReport = {
        summary: `Analisi per la sessione ${session.id} completata con successo.`,
        raw_parsed_data: extractedData 
    };

    // Salviamo il risultato finale
    await supabase.from('analysis_results_hd').insert({
      session_id: session.id,
      raw_parsed_data: finalReport.raw_parsed_data,
      summary: finalReport.summary
    });
    console.log(`[HD/${session.id}] Risultati finali salvati.`);

    // --- FASE 4: COMPLETAMENTO ---
    await supabase.from('checkup_sessions_hd')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', session.id);
    console.log(`[HD/${session.id}] ✅ Processo completo terminato.`);
    
    // Restituisci il sessionId al frontend, che ora reindirizzerà a una pagina già pronta
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore fatale in start-checkup-hd (unificato):', error);
    if (session?.id) {
      await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: `Errore: ${error.message}` }).eq('id', session.id);
    }
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
