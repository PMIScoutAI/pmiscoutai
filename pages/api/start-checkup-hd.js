// /pages/api/start-checkup-hd.js
// API per il nuovo flusso di analisi con LangChain (RAG)

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

// Inizializzazione dei client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Vercel richiede questa configurazione per gestire il parsing del corpo della richiesta
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  let session; // La definiamo qui per usarla nel blocco catch

  try {
    // --- 1. AUTENTICAZIONE UTENTE (tramite token Outseta) ---
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autorizzazione mancante.' });
    }
    
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    
    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token Outseta non valido.' });
    }
    
    const outsetaUser = await outsetaResponse.json();
    // Funzione RPC per ottenere/creare l'utente su Supabase
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', { 
      p_outseta_id: outsetaUser.Uid, 
      p_email: outsetaUser.Email, 
      p_first_name: outsetaUser.FirstName, 
      p_last_name: outsetaUser.LastName 
    });

    if (userError) throw new Error(`Errore DB utente: ${userError.message}`);
    console.log(`[HD] Utente autenticato: ${userId}`);

    // --- 2. PARSING DEL FILE PDF ---
    const form = formidable({ 
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });
    
    const [fields, files] = await form.parse(req);
    const companyName = fields.companyName?.[0];
    const pdfFile = files.pdfFile?.[0];
    
    if (!companyName || !pdfFile) {
      return res.status(400).json({ error: 'Nome azienda o file PDF mancante.' });
    }
    console.log(`[HD] File ricevuto: ${pdfFile.originalFilename}`);

    // --- 3. CREAZIONE SESSIONE E AZIENDA SU DB ---
    const { data: company } = await supabase
      .from('companies')
      .upsert({ user_id: userId, company_name: companyName }, { onConflict: 'user_id' })
      .select().single();
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({ 
        user_id: userId, 
        company_id: company.id, 
        status: 'indexing', // Nuovo stato iniziale per il flusso HD
        session_name: `Check-UP HD ${companyName} - ${new Date().toLocaleDateString('it-IT')}`,
        session_type: 'HD' // Campo per distinguere le sessioni
      })
      .select().single();

    if (sessionError) throw new Error(`Errore creazione sessione: ${sessionError.message}`);
    session = sessionData;
    console.log(`[HD] Sessione creata: ${session.id} con stato 'indexing'`);

    // --- 4. CARICAMENTO, SPLITTING E INDICIZZAZIONE (LOGICA LANGCHAIN) ---
    console.log(`[HD/${session.id}] Avvio indicizzazione con LangChain...`);

    // 4.1 Carica il PDF dal percorso temporaneo
    const loader = new PDFLoader(pdfFile.filepath);
    const docs = await loader.load();

    // 4.2 Suddivide il documento in "pezzi" (chunks)
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`[HD/${session.id}] Documento diviso in ${splitDocs.length} chunks.`);

    // 4.3 Crea e salva i vettori su Supabase
    await SupabaseVectorStore.fromDocuments(splitDocs, embeddings, {
      client: supabase,
      tableName: 'documents', // Assicurati che questa tabella esista e abbia pgvector abilitato
      queryName: 'match_documents', // Assicurati che questa funzione esista
      // Aggiungiamo un metadata per filtrare per sessione
      metadata: { session_id: session.id }
    });
    
    console.log(`[HD/${session.id}] ✅ Indicizzazione completata e vettori salvati.`);

    // --- 5. AGGIORNA STATO E AVVIA ANALISI IN BACKGROUND ---
    await supabase
      .from('checkup_sessions')
      .update({ status: 'processing' }) // Ora può iniziare l'analisi vera e propria
      .eq('id', session.id);
    
    console.log(`[HD/${session.id}] Stato aggiornato a 'processing'.`);

    // TODO: Avviare la funzione di analisi in background (es. /api/analyze-hd)
    // Per ora, lasciamo che il frontend inizi il polling.
    // In un'architettura più avanzata, potresti triggerare una Vercel Function o un webhook qui.

    // --- 6. RISPOSTA AL CLIENT ---
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore fatale in start-checkup-hd:', error);
    
    // Se abbiamo una sessione, la marchiamo come fallita
    if (session?.id) {
      await supabase
        .from('checkup_sessions')
        .update({ 
          status: 'failed', 
          error_message: `Errore durante l'indicizzazione: ${error.message}` 
        })
        .eq('id', session.id);
    }
    
    return res.status(500).json({ 
      error: error.message || 'Errore interno del server' 
    });
  }
}
