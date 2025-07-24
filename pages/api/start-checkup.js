// /pages/api/start-checkup.js
// Versione aggiornata che riceve e salva il prompt selezionato dall'utente.

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

    // 1. PARSING DELLA RICHIESTA
    const { fields, files } = await parseForm(req);
    
    // Estrai i dati dal form
    const formData = JSON.parse(fields.formData || '{}');
    const outsetaToken = fields.outsetaToken;
    // --- MODIFICA: Estrai anche il nome del prompt ---
    const promptName = fields.promptName;
    
    // ... (Validazione base come prima) ...
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!outsetaToken || !formData.company_name || !file || !promptName) {
        return res.status(400).json({ error: 'Dati mancanti nella richiesta.' });
    }
    
    console.log(`✅ Dati form validati. Prompt scelto: ${promptName}`);

    // 2. VERIFICA TOKEN OUTSETA
    const outsetaUser = await verifyOutsetaToken(outsetaToken);
    if (!outsetaUser) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }
    console.log('✅ Utente Outseta verificato:', outsetaUser.Email);

    // 3. SINCRONIZZA UTENTE NEL DATABASE
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName || null,
      p_last_name: outsetaUser.LastName || null,
      p_full_name: outsetaUser.FullName || null
    });
    if (userError) throw new Error('Errore sincronizzazione utente: ' + userError.message);
    console.log('✅ Utente sincronizzato, ID:', userId);

    // 4. CONTROLLA LIMITE UTILIZZO
    const { data: sessionCount, error: countError } = await supabase.rpc('count_user_sessions', { p_user_id: userId });
    if (countError) throw new Error('Errore verifica limite: ' + countError.message);

    if (sessionCount >= USER_CHECKUP_LIMIT) {
      return res.status(429).json({ error: 'LIMIT_REACHED', message: `Hai raggiunto il limite di ${USER_CHECKUP_LIMIT} analisi.` });
    }
    console.log(`✅ Controllo limite OK: ${sessionCount}/${USER_CHECKUP_LIMIT}`);

    // 5. GESTISCI AZIENDA (UPSERT)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({ user_id: userId, ...formData }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (companyError) throw new Error('Errore gestione azienda: ' + companyError.message);
    console.log('✅ Azienda gestita:', company.id);

    // 6. CREA SESSIONE DI CHECKUP
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({
        user_id: userId,
        company_id: company.id,
        session_name: `Analisi per ${formData.company_name}`,
        status: 'waiting_for_file',
        // --- MODIFICA: Salva il prompt scelto nel database ---
        prompt_name: promptName 
      })
      .select('id')
      .single();
    if (sessionError) throw new Error('Errore creazione sessione: ' + sessionError.message);
    const sessionId = session.id;
    console.log('✅ Sessione creata:', sessionId);

    // 7. UPLOAD DEL FILE
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

    // 8. AGGIORNA STATO SESSIONE E AVVIA ANALISI
    await supabase
      .from('checkup_sessions')
      .update({ file_path: fileName, status: 'processing', started_at: new Date().toISOString() })
      .eq('id', sessionId);

    triggerAIAnalysis(sessionId).catch(err => {
      console.error(`[BACKGROUND_ERROR] Errore avvio analisi per sessione ${sessionId}:`, err);
    });

    // 9. RISPOSTA DI SUCCESSO
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

async function triggerAIAnalysis(sessionId) {
  console.log(`🤖 Avvio reale dell'analisi AI per la sessione: ${sessionId}`);
  const { error } = await supabase.functions.invoke('ai-analysis', {
    body: { session_id: sessionId },
  });
  if (error) {
    throw error;
  }
  console.log(`✅ Chiamata di avvio per l'analisi della sessione ${sessionId} inviata con successo.`);
}
