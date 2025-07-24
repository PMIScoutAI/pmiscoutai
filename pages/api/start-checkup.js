// /pages/api/start-checkup.js
// Versione definitiva con logica di upload semplificata e più robusta.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

// Configurazione
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_CHECKUP_LIMIT = 15;

// Disabilita il body parser di Next.js per gestire FormData
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Parsing della richiesta con Formidable
    const { fields, files } = await parseForm(req);
    
    const formData = JSON.parse(fields.formData || '{}');
    const outsetaToken = fields.outsetaToken;
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    // 2. Validazione dell'input
    if (!outsetaToken || !formData.company_name || !file) {
      return res.status(400).json({ error: 'Dati mancanti: token, nome azienda e file sono richiesti.' });
    }

    // 3. Verifica del token Outseta
    const outsetaUser = await verifyOutsetaToken(outsetaToken);
    if (!outsetaUser) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }

    // 4. Sincronizzazione dell'utente
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName,
      p_full_name: outsetaUser.FullName
    });
    if (userError) throw new Error(`Errore DB (get_or_create_user): ${userError.message}`);

    // 5. Controllo del limite di utilizzo
    const { data: sessionCount, error: countError } = await supabase.rpc('count_user_sessions', { p_user_id: userId });
    if (countError) throw new Error(`Errore DB (count_user_sessions): ${countError.message}`);

    if (sessionCount >= USER_CHECKUP_LIMIT) {
      return res.status(429).json({ error: 'LIMIT_REACHED', message: `Hai raggiunto il limite di ${USER_CHECKUP_LIMIT} analisi.` });
    }

    // 6. Gestione dell'azienda (Upsert)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({ user_id: userId, ...formData }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (companyError) throw new Error(`Errore DB (companies upsert): ${companyError.message}`);

    // 7. Creazione della sessione di checkup
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({ user_id: userId, company_id: company.id, session_name: `Analisi per ${formData.company_name}` })
      .select('id')
      .single();
    if (sessionError) throw new Error(`Errore DB (checkup_sessions insert): ${sessionError.message}`);
    const sessionId = session.id;

    // --- LOGICA DI UPLOAD SEMPLIFICATA ---
    // 8. Upload diretto del file su Supabase Storage
    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = `${sessionId}/${file.originalFilename || 'bilancio.pdf'}`;
    
    const { error: uploadError } = await supabase.storage
      .from('checkup-documents')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true // Sovrascrive se esiste già, per sicurezza
      });

    if (uploadError) {
      // Rollback: se l'upload fallisce, cancelliamo la sessione appena creata.
      await supabase.from('checkup_sessions').delete().eq('id', sessionId);
      throw new Error(`Errore Storage: ${uploadError.message}`);
    }

    // 9. Aggiornamento finale della sessione e avvio dell'analisi
    await supabase
      .from('checkup_sessions')
      .update({ file_path: fileName, status: 'processing', started_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Avvia l'analisi in background (fire-and-forget)
    supabase.functions.invoke('ai-analysis', { body: { session_id: sessionId } });

    // 10. Risposta di successo al frontend
    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      message: 'Checkup avviato con successo',
    });

  } catch (error) {
    console.error('💥 Errore generale in /api/start-checkup:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}

// --- Funzioni Helper (invariate) ---

async function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function verifyOutsetaToken(token) {
  try {
    const response = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Errore verifica Outseta:', error);
    return null;
  }
}
