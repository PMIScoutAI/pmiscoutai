// /api/start-checkup-hd.js
// VERSIONE IBRIDA: Salva i dati strutturati pre-estratti da Document AI
// e poi procede con l'indicizzazione vettoriale del documento completo.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";

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
    // La logica dell'utente fittizio per la beta rimane invariata
    const userId = '11111111-1111-1111-1111-111111111111';
    const { error: userError } = await supabase
      .from('users')
      .upsert({ 
        id: userId, 
        email: 'beta@pmiscout.eu',
        outseta_user_id: 'dummy-outseta-id-for-beta'
      }, { onConflict: 'id' });
      
    if (userError) throw new Error(`Errore DB users: ${userError.message}`);
    console.log(`[HD] Utente fittizio ${userId} verificato/creato.`);

    // 1. Estrai i dati dal form: PDF, nome azienda e i NUOVI dati estratti
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    const [fields, files] = await form.parse(req);
    
    const companyName = fields.companyName?.[0];
    const pdfFile = files.pdfFile?.[0];
    const extractedDataJson = fields.extractedDataJson?.[0]; // NUOVO CAMPO

    if (!companyName || !pdfFile || !extractedDataJson) {
      return res.status(400).json({ error: 'Dati mancanti: nome azienda, file PDF o dati estratti sono richiesti.' });
    }

    const extractedData = JSON.parse(extractedDataJson);
    console.log('[HD] Dati numerici pre-estratti ricevuti:', extractedData);

    // La creazione dell'azienda rimane invariata
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({ user_id: userId, company_name: companyName }, { onConflict: 'user_id, company_name' })
      .select().single();
      
    if (companyError) throw new Error(`Errore DB companies: ${companyError.message}`);
    
    // La creazione della sessione rimane invariata
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
    console.log(`[HD/${session.id}] Sessione creata.`);

    // 2. NUOVO STEP: Salva i dati numerici estratti nella nuova tabella
    console.log(`[HD/${session.id}] Salvataggio dati numerici estratti...`);
    const { error: extractedDataError } = await supabase
      .from('risultati_estratti_hd') // Nome della nuova tabella
      .insert({
        session_id: session.id,
        fatturato_anno_corrente: extractedData.fatturato_anno_corrente,
        fatturato_anno_precedente: extractedData.fatturato_anno_precedente,
        utile_esercizio_anno_corrente: extractedData.utile_esercizio_anno_corrente,
        utile_esercizio_anno_precedente: extractedData.utile_esercizio_anno_precedente,
        patrimonio_netto_anno_corrente: extractedData.patrimonio_netto_anno_corrente,
        patrimonio_netto_anno_precedente: extractedData.patrimonio_netto_anno_precedente,
      });

    if (extractedDataError) {
      throw new Error(`Errore salvataggio dati estratti: ${extractedDataError.message}`);
    }
    console.log(`[HD/${session.id}] ✅ Dati numerici salvati correttamente.`);

    // 3. L'indicizzazione vettoriale del documento completo procede come prima
    console.log(`[HD/${session.id}] Avvio indicizzazione vettoriale...`);
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
    console.log(`[HD/${session.id}] ✅ Indicizzazione vettoriale completata.`);

    // Il resto del flusso (aggiornamento stato e avvio analisi) rimane invariato
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
