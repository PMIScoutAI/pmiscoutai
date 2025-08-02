// /pages/api/start-checkup.js
// VERSIONE STABILE E FUNZIONANTE:
// 1. Riceve il file e i dati.
// 2. Crea la sessione e salva il file.
// 3. AVVIA L'ANALISI IN BACKGROUND in modo sicuro dal backend.
// 4. Restituisce il session_id.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  let session;

  try {
    // 1. Autenticazione utente
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante.' });
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, { headers: { Authorization: `Bearer ${outsetaToken}` } });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido.' });
    const outsetaUser = await outsetaResponse.json();
    const { data: userId } = await supabase.rpc('get_or_create_user', { p_outseta_id: outsetaUser.Uid, p_email: outsetaUser.Email, p_first_name: outsetaUser.FirstName, p_last_name: outsetaUser.LastName });

    // 2. Gestione del file
    const form = formidable({ maxFileSize: 5 * 1024 * 1024, filter: ({ mimetype }) => mimetype && mimetype.includes('pdf') });
    const [fields, files] = await form.parse(req);
    const companyName = fields.companyName?.[0];
    const pdfFile = files.pdfFile?.[0];
    if (!companyName || !pdfFile) throw new Error('Nome azienda o file PDF mancante.');

    // 3. Creazione sessione
    const { data: company } = await supabase.from('companies').upsert({ user_id: userId, company_name: companyName }, { onConflict: 'user_id' }).select().single();
    
    const { data: sessionData, error: sessionError } = await supabase.from('checkup_sessions').insert({ 
        user_id: userId, 
        company_id: company.id, 
        status: 'processing', // Lo stato parte subito come "in elaborazione"
        session_name: `Check-UP ${companyName} - ${new Date().toLocaleDateString('it-IT')}`
    }).select().single();

    if(sessionError) throw new Error(`Errore creazione sessione: ${sessionError.message}`);
    session = sessionData;

    // 4. Upload del file
    const fileName = `${pdfFile.originalFilename}`;
    const fileBuffer = fs.readFileSync(pdfFile.filepath);
    const { error: uploadError } = await supabase.storage
      .from('checkup-documents')
      .upload(`public/${session.id}/${fileName}`, fileBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw new Error(`Errore upload file: ${uploadError.message}`);
    
    // 5. AVVIO DELL'ANALISI DAL BACKEND (La soluzione sicura)
    console.log(`[${session.id}] Sessione creata. Avvio dell'analisi in background...`);
    
    // Costruisci l'URL completo per la chiamata API interna. Vercel fornisce questa variabile.
    const analyzeApiUrl = `https://${process.env.VERCEL_URL}/api/analyze-pdf`;

    // Chiamata "lancia e dimentica" per non far attendere l'utente
    fetch(analyzeApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INTERNAL_SECRET}` 
        },
        body: JSON.stringify({ session_id: session.id })
    }).catch(err => {
        // Logga l'errore ma non bloccare la risposta all'utente, l'errore verrà salvato
        // nella sessione dall'API analyze-pdf stessa.
        console.error(`[${session.id}] Errore nell'avvio in background di analyze-pdf:`, err.message);
    });

    console.log(`✅ [${session.id}] Chiamata di avvio analisi inviata.`);
    
    // 6. Restituisce il session_id al frontend per il redirect
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore in start-checkup:', error);
    if (session?.id) {
        await supabase.from('checkup_sessions').update({ status: 'failed', error_message: `Errore nella fase di setup: ${error.message}` }).eq('id', session.id);
    }
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
