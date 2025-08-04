// /pages/api/start-checkup-hd.js
// Usa la nuova tabella 'checkup_sessions_hd'.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

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
    const userId = 'user-fittizio-supabase-id';
    console.log(`[HD] Procedo con utente fittizio: ${userId}`);

    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    const [fields, files] = await form.parse(req);
    const companyName = fields.companyName?.[0];
    const pdfFile = files.pdfFile?.[0];
    
    if (!companyName || !pdfFile) {
      return res.status(400).json({ error: 'Nome azienda o file PDF mancante.' });
    }

    const { data: company } = await supabase
      .from('companies')
      .upsert({ user_id: userId, company_name: companyName }, { onConflict: 'user_id, company_name' })
      .select().single();
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('checkup_sessions_hd')
      .insert({ 
        user_id: userId, 
        company_id: company.id, 
        status: 'indexing',
        session_name: `Check-UP HD ${companyName} - ${new Date().toLocaleDateString('it-IT')}`
      })
      .select().single();

    if (sessionError) throw new Error(`Errore creazione sessione: ${sessionError.message}`);
    session = sessionData;
    console.log(`[HD/${session.id}] Sessione creata, avvio indicizzazione...`);

    const loader = new PDFLoader(pdfFile.filepath);
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const splitDocs = await splitter.splitDocuments(docs);
    
    const docsWithMetadata = splitDocs.map(doc => ({
      ...doc,
      metadata: { ...doc.metadata, session_id: session.id, user_id: userId, file_name: pdfFile.originalFilename },
    }));

    await SupabaseVectorStore.fromDocuments(docsWithMetadata, embeddings, {
      client: supabase,
      tableName: 'documents',
      queryName: 'match_documents',
    });
    console.log(`[HD/${session.id}] ✅ Indicizzazione completata.`);

    await supabase.from('checkup_sessions_hd').update({ status: 'processing' }).eq('id', session.id);
    console.log(`[HD/${session.id}] Stato aggiornato a 'processing'. Avvio analisi in background...`);

    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
    const analyzeApiUrl = `${protocol}://${host}/api/analyze-hd`;

    fetch(analyzeApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id }),
    }).catch(fetchError => {
      console.error(`[HD/${session.id}] Errore avvio chiamata analisi (fire-and-forget):`, fetchError.message);
    });
    
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore fatale in start-checkup-hd:', error);
    if (session?.id) {
      await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: `Errore: ${error.message}` }).eq('id', session.id);
    }
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
