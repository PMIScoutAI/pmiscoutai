// /pages/api/start-checkup.js
// VERSIONE 14.0 (DEFINITIVA): Implementata la logica con UPSERT per bypassare le RPC.
// - Risolve definitivamente gli errori PGRST202.
// - Utilizza `upsert` per una gestione dei dati robusta e idempotente.
// - Richiede che gli indici UNIQUE siano impostati correttamente nel database.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  let session;

  try {
    // 1) Auth Outseta
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante.' });

    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido.' });

    const outsetaUser = await outsetaResponse.json();

    // ✅ SOLUZIONE B (1): Sostituisci la RPC con UPSERT per l'utente
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .upsert(
        { 
          outseta_user_id: outsetaUser.Uid, 
          email: outsetaUser.Email, 
          first_name: outsetaUser.FirstName || '', 
          last_name: outsetaUser.LastName || '' 
        },
        { onConflict: 'outseta_user_id' } // Assicura che esista un indice UNIQUE su 'outseta_user_id'
      )
      .select('id')
      .single();

    if (userErr || !userRow?.id) {
        console.error("[start-checkup] Errore UPSERT utente:", userErr);
        throw new Error("Impossibile creare o trovare l'utente.");
    }
    const userId = userRow.id; // Questo è l'UUID corretto dal DB

    // 2) Parse form robusto
    const form = formidable();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve([flds, fls])));
    });

    const fileInput = Array.isArray(files?.file) ? files.file[0] : files?.file;
    if (!fileInput) return res.status(400).json({ error: 'Nessun file caricato.' });

    const companyNameRaw =
      (Array.isArray(fields?.companyName) ? fields.companyName[0] : fields?.companyName) || '';
    const companyName = String(companyNameRaw).trim() || 'Azienda non specificata';

    // 3) ✅ SOLUZIONE B (2): Sostituisci la RPC con UPSERT per l'azienda
    const { data: companyRow, error: coErr } = await supabase
      .from('companies')
      .upsert(
        { user_id: userId, company_name: companyName },
        { onConflict: 'user_id,company_name' } // Assicura che esista un indice UNIQUE su (user_id, company_name)
      )
      .select('id')
      .single();

    if (coErr || !companyRow?.id) {
        console.error("[start-checkup] Errore UPSERT azienda:", coErr);
        throw new Error("Impossibile creare o trovare l'azienda.");
    }
    const companyId = companyRow.id;

    // 4) Crea sessione
    const originalName = fileInput.originalFilename || 'file';
    const { data: createdSession, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({
        user_id: userId,
        company_id: companyId,
        status: 'processing',
        file_name: originalName
      })
      .select()
      .single();
    if (sessionError) throw sessionError;
    session = createdSession;

    // 5) Upload su Storage
    const filePath = `${userId}/${session.id}/${originalName}`;
    const fileBuffer = fs.readFileSync(fileInput.filepath);
    const contentType = fileInput.mimetype || 'application/octet-stream';

    const { error: uploadError } = await supabase.storage
      .from('checkup-files')
      .upload(filePath, fileBuffer, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    await supabase.from('checkup_sessions').update({ file_path: filePath }).eq('id', session.id);

    // 6) Trigger analisi asincrona
    console.log(`[${session.id}] Sessione creata. Avvio analisi XBRL...`);
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
    const analyzeApiUrl = `${protocol}://${host}/api/analyze-xbrl?sessionId=${session.id}`;

    fetch(analyzeApiUrl, { method: 'POST' }).catch((e) =>
      console.error(`[${session.id}] Errore avvio analisi:`, e?.message || e)
    );

    // 7) Risposta immediata
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
