// /pages/api/start-checkup.js
// Versione con il trigger per l'analisi AI correttamente implementato.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

// Configurazione
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OUTSETA_API_URL = 'https://pmiscout.outseta.com/api/v1';
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
    console.log('🚀 Start checkup API chiamata');

    // 1. Parsing della richiesta
    const { fields, files } = await parseForm(req);
    const formData = JSON.parse(fields.formData || '{}');
    const outsetaToken = fields.outsetaToken;
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    // ... (Validazione dei dati del form e del file come prima) ...
    if (!outsetaToken || !formData.company_name || !file) {
        return res.status(400).json({ error: 'Dati mancanti nella richiesta.' });
    }

    // 2. Verifica del token Outseta
    const outsetaUser = await verifyOutsetaToken(outsetaToken);
    if (!outsetaUser) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }
    console.log('✅ Utente Outseta verificato:', outsetaUser.Email);

    // 3. Sincronizzazione dell'utente
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName || null,
      p_last_name: outsetaUser.LastName || null,
      p_full_name: outsetaUser.FullName || null
    });
    if (userError) throw new Error('Errore sincronizzazione utente: ' + userError.message);
    console.log('✅ Utente sincronizzato, ID:', userId);

    // 4. Controllo del limite di utilizzo
    const { data: sessionCount, error: countError } = await supabase.rpc('count_user_sessions', { p_user_id: userId });
    if (countError) throw new Error('Errore verifica limite: ' + countError.message);

    if (sessionCount >= USER_CHECKUP_LIMIT) {
      return res.status(429).json({ error: 'LIMIT_REACHED', message: `Hai raggiunto il limite di ${USER_CHECKUP_LIMIT} analisi.` });
    }
    console.log(`✅ Controllo limite OK: ${sessionCount}/${USER_CHECKUP_LIMIT}`);

    // 5. Gestione dell'azienda (Upsert)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({ user_id: userId, ...formData }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (companyError) throw new Error('Errore gestione azienda: ' + companyError.message);
    console.log('✅ Azienda gestita:', company.id);

    // 6. Creazione della sessione di checkup
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({ user_id: userId, company_id: company.id, session_name: `Analisi per ${formData.company_name}` })
      .select('id')
      .single();
    if (sessionError) throw new Error('Errore creazione sessione: ' + sessionError.message);
    const sessionId = session.id;
    console.log('✅ Sessione creata:', sessionId);

    // 7. Upload del file su Supabase Storage
    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = `${sessionId}/${file.originalFilename || 'bilancio.pdf'}`;
    const { error: uploadError } = await supabase.storage
      .from('checkup-documents')
      .upload(fileName, fileBuffer, { contentType: 'application/pdf' });
    if (uploadError) {
      await supabase.from('checkup_sessions').delete().eq('id', sessionId); // Rollback
      throw new Error('Errore upload file: ' + uploadError.message);
    }
    console.log('✅ File caricato con successo');

    // 8. Aggiornamento dello stato della sessione
    await supabase
      .from('checkup_sessions')
      .update({ file_path: fileName, status: 'processing', started_at: new Date().toISOString() })
      .eq('id', sessionId);

    // --- ✅ SOLUZIONE: Trigger Reale dell'Analisi AI ---
    // Sostituiamo il placeholder con una vera chiamata "fire-and-forget"
    // alla nostra Edge Function di Supabase.
    triggerAIAnalysis(sessionId).catch(err => {
      // Logghiamo l'errore ma non blocchiamo la risposta all'utente
      console.error(`[BACKGROUND_ERROR] Errore avvio analisi per sessione ${sessionId}:`, err);
    });

    // 10. Risposta di successo al frontend
    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      message: 'Checkup avviato con successo',
    });

  } catch (error) {
    console.error('💥 Errore generale in start-checkup:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}

// --- Funzioni Helper ---

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
    const response = await fetch(`${OUTSETA_API_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Errore verifica Outseta:', error);
    return null;
  }
}

// --- ✅ FUNZIONE TRIGGER REALE ---
async function triggerAIAnalysis(sessionId) {
  console.log(`🤖 Avvio reale dell'analisi AI per la sessione: ${sessionId}`);
  // Usiamo il client Supabase per invocare la nostra Edge Function
  const { error } = await supabase.functions.invoke('ai-analysis', {
    body: { session_id: sessionId },
  });
  if (error) {
    // Se c'è un errore, lo logghiamo. La funzione chiamante lo gestirà.
    throw error;
  }
  console.log(`✅ Chiamata di avvio per l'analisi della sessione ${sessionId} inviata con successo.`);
}
