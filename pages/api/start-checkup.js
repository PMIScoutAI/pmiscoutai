// /pages/api/start-checkup.js
// VERSIONE AGGIORNATA: Ora chiama la nuova API 'analyze-xbrl'
// - La logica di upload e gestione della sessione rimane invariata.
// - L'unica modifica è il puntamento all'endpoint corretto per l'analisi.

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
    // 1. Autenticazione utente con Outseta (invariata)
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante.' });
    
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido.' });
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userId } = await supabase.rpc('get_or_create_user', { 
      p_outseta_uid: outsetaUser.Uid, 
      p_email: outsetaUser.Email 
    });

    // 2. Gestione del file caricato con formidable (invariato)
    const form = formidable({});
    const [fields, files] = await form.parse(req);
    
    const file = files.file[0];
    if (!file) return res.status(400).json({ error: 'Nessun file caricato.' });

    const companyName = fields.companyName[0] || 'Azienda non specificata';

    // 3. Crea o trova l'azienda (invariato)
    const { data: company } = await supabase.rpc('get_or_create_company', {
      p_user_id: userId,
      p_company_name: companyName
    });

    // 4. Crea la sessione di checkup (invariato)
    const { data: createdSession, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({
        user_id: userId,
        company_id: company.id,
        status: 'processing',
        file_name: file.originalFilename,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;
    session = createdSession;

    // 5. Carica il file su Supabase Storage (invariato)
    const filePath = `${userId}/${session.id}/${file.originalFilename}`;
    const fileBuffer = fs.readFileSync(file.filepath);

    const { error: uploadError } = await supabase.storage
      .from('checkup-files')
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    await supabase
      .from('checkup_sessions')
      .update({ file_path: filePath })
      .eq('id', session.id);
    
    // 6. ✅ MODIFICA CHIAVE: Avvia l'analisi chiamando la nuova API 'analyze-xbrl'
    console.log(`[${session.id}] Sessione creata. Avvio dell'analisi XBRL in background...`);

    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
    
    // L'URL ora punta al nuovo endpoint
    const analyzeApiUrl = `${protocol}://${host}/api/analyze-xbrl?sessionId=${session.id}`;

    console.log(`[${session.id}] Chiamata a: ${analyzeApiUrl}`);

    // Avvia la chiamata senza attenderne la fine (fire-and-forget)
    fetch(analyzeApiUrl, {
      method: 'POST',
    }).catch(fetchError => {
      console.error(`[${session.id}] Errore avvio chiamata analisi (fire-and-forget):`, fetchError.message);
    });
    
    // 7. Restituisce subito la risposta all'utente (invariato)
    console.log(`✅ [${session.id}] Setup completato, restituisco sessionId`);
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore fatale in start-checkup:', error);
    
    if (session?.id) {
      await supabase
        .from('checkup_sessions')
        .update({ 
          status: 'failed', 
          error_message: error.message 
        })
        .eq('id', session.id);
    }

    return res.status(500).json({ error: 'Errore interno del server.' });
  }
}
