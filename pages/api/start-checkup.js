// /pages/api/start-checkup.js
// Questa funzione Vercel gestisce la logica rapida: autenticazione e preparazione dell'upload.

import { createClient } from '@supabase/supabase-js';

// Inizializza il client Supabase con la chiave di servizio per avere pieni poteri.
// Queste variabili d'ambiente sono lette dal server Vercel.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Verifica l'autenticazione dell'utente tramite Outseta
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    // Chiamata all'API di Outseta per validare il token e ottenere i dati dell'utente
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: {
        'Authorization': `Bearer ${outsetaToken}`
      }
    });

    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Invalid Outseta token' });
    }
    const outsetaUser = await outsetaResponse.json();
    const { Uid: outsetaUid, Email, FirstName, LastName } = outsetaUser;

    // 2. Sincronizzazione con il Database Supabase
    const { data: userId, error: rpcError } = await supabaseAdmin.rpc('get_or_create_user', {
      user_email: Email,
      user_first_name: FirstName || '',
      user_last_name: LastName || '',
      user_outseta_id: outsetaUid,
    });
    if (rpcError) throw rpcError;

    // 3. Creazione della sessione e generazione della Signed URL
    const { companyData } = req.body; // Dati dell'azienda inviati dal frontend

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .upsert({ user_id: userId, ...companyData }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (companyError) throw companyError;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkup_sessions')
      .insert({ company_id: company.id, user_id: userId, status: 'waiting_for_file' })
      .select('id')
      .single();
    if (sessionError) throw sessionError;

    // Genera un URL a tempo per permettere l'upload sicuro dal browser
    const filePath = `public/${session.id}/${req.body.fileName}`;
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('checkup-documents')
      .createSignedUploadUrl(filePath);
    if (signedUrlError) throw signedUrlError;

    // 4. Risposta Immediata al Frontend
    res.status(200).json({
      sessionId: session.id,
      signedUploadUrl: signedUrlData.signedUrl,
      // Passiamo anche il token per la seconda chiamata di upload
      token: signedUrlData.token,
      path: signedUrlData.path,
    });

  } catch (error) {
    console.error('Error in /api/start-checkup:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
