// /pages/api/start-checkup.js
// VERSIONE 12.0 (DEBUG): Bypassa l'autenticazione Outseta per testare il flusso.
// - Utilizza un utente fittizio per non richiedere un login reale.
// - Ideale per lo sviluppo e il debug.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,              // <-- non usare NEXT_PUBLIC_* lato server
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  let session;

  try {
    // 1) ✅ MODIFICA: Autenticazione Outseta bypassata con un utente fittizio.
    console.log("[start-checkup] ATTENZIONE: Autenticazione Outseta bypassata per debug.");
    
    const outsetaUser = {
        Uid: 'fittizio-test-user-001',
        Email: 'test@example.com',
        FirstName: 'Test',
        LastName: 'User'
    };

    // La chiamata a Supabase ora usa sempre l'utente fittizio
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName || '',
      p_last_name: outsetaUser.LastName || '',
      p_outseta_id: outsetaUser.Uid
    });
    if (userError || !userId) {
      console.error(`[start-checkup] Errore RPC 'get_or_create_user':`, userError);
      throw new Error("Impossibile creare o trovare l'utente nel database.");
    }

    // 2) Parse form robusto (invariato)
    const form = formidable();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve([flds, fls])));
    });

    const fileInput = Array.isArray(files?.file) ? files.file[0] : files?.file;
    if (!fileInput) return res.status(400).json({ error: 'Nessun file caricato.' });

    const companyNameRaw =
      (Array.isArray(fields?.companyName) ? fields.companyName[0] : fields?.companyName) || '';
    const companyName = String(companyNameRaw).trim() || 'Azienda non specificata';

    // 3) Rimuoviamo la chiamata a 'get_or_create_company' e creiamo la sessione direttamente.
    const originalName = fileInput.originalFilename || 'file';
    const { data: createdSession, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({
        user_id: userId,
        company_name: companyName, // Salviamo il nome direttamente qui
        status: 'processing',
        file_name: originalName
      })
      .select()
      .single();
      
    if (sessionError) {
        console.error(`[start-checkup] Errore creazione sessione:`, sessionError);
        throw sessionError;
    }
    session = createdSession;

    // 4) Upload su Storage (invariato)
    const filePathSafeUser = String(userId);
    const filePath = `${filePathSafeUser}/${session.id}/${originalName}`;
    const fileBuffer = fs.readFileSync(fileInput.filepath);
    const contentType = fileInput.mimetype || 'application/octet-stream';

    const { error: uploadError } = await supabase.storage
      .from('checkup-files')
      .upload(filePath, fileBuffer, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    await supabase.from('checkup_sessions').update({ file_path: filePath }).eq('id', session.id);

    // 5) Trigger analisi asincrona (invariato)
    console.log(`[${session.id}] Sessione creata. Avvio analisi XBRL...`);
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
    const analyzeApiUrl = `${protocol}://${host}/api/analyze-xbrl?sessionId=${session.id}`;

    fetch(analyzeApiUrl, { method: 'POST' }).catch((e) =>
      console.error(`[${session.id}] Errore avvio analisi:`, e?.message || e)
    );

    // 6) Risposta immediata (invariato)
    console.log(`✅ [${session.id}] Setup completato, restituisco sessionId`);
    return res.status(200).json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error('💥 Errore fatale in start-checkup:', error?.message || error);
    if (session?.id) {
      await supabase
        .from('checkup_sessions')
        .update({ status: 'failed', error_message: error.message || 'Errore' })
        .eq('id', session.id);
    }
    return res.status(500).json({ error: error.message || 'Errore interno del server.' });
  }
}
