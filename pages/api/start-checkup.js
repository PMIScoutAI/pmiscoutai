// /pages/api/start-checkup.js
// Versione definitiva che usa i metodi ufficiali e più robusti di Supabase.

import { createClient } from '@supabase/supabase-js';

// Inizializza il client di amministrazione di Supabase.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // --- 1. Verifica l'autenticazione dell'utente tramite Outseta ---
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { 'Authorization': `Bearer ${outsetaToken}` }
    });

    if (!outsetaResponse.ok) {
      console.error('Outseta token validation failed:', await outsetaResponse.text());
      return res.status(401).json({ error: 'Invalid Outseta token' });
    }
    const outsetaUser = await outsetaResponse.json();
    const { Uid: outsetaUid, Email, FirstName, LastName } = outsetaUser;

    // --- 2. Cerca o crea l'utente in Supabase Auth TRAMITE L'API UFFICIALE ---
    let authUserId;
    const adminAuth = supabaseAdmin.auth.admin;

    // Questo è il metodo corretto e supportato per cercare un utente.
    const { data: { user: existingUser }, error: findError } = await adminAuth.getUserByEmail(Email);

    if (findError && findError.name === 'UserNotFoundError') {
      // L'utente non esiste, lo creiamo usando l'Admin API.
      const { data: { user: newUser }, error: createError } = await adminAuth.createUser({
        email: Email,
        email_confirm: true, // Lo consideriamo già verificato da Outseta
        user_metadata: {
          first_name: FirstName,
          last_name: LastName,
        }
      });
      if (createError) throw createError;
      authUserId = newUser.id;
    } else if (findError) {
      // Altro tipo di errore durante la ricerca.
      throw findError;
    } else {
      // L'utente esiste già.
      authUserId = existingUser.id;
    }

    // --- 3. Sincronizza il profilo chiamando la nostra funzione RPC ---
    const { error: rpcError } = await supabaseAdmin.rpc('upsert_user_profile', {
      user_id: authUserId,
      user_email: Email,
      user_first_name: FirstName || '',
      user_last_name: LastName || '',
      user_outseta_id: outsetaUid,
    });
    if (rpcError) throw rpcError;

    // --- 4. Procedi con la logica di creazione della sessione e della Signed URL ---
    const { companyData, fileName, prompt_name } = req.body;

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .upsert({ user_id: authUserId, ...companyData }, { onConflict: 'user_id' })
      .select('id').single();
    if (companyError) throw companyError;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkup_sessions')
      .insert({ 
        company_id: company.id, 
        user_id: authUserId, 
        status: 'waiting_for_file',
        prompt_name: prompt_name
      })
      .select('id').single();
    if (sessionError) throw sessionError;

    const filePath = `public/${session.id}/${fileName}`;
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('checkup-documents')
      .createSignedUploadUrl(filePath);
    if (signedUrlError) throw signedUrlError;

    res.status(200).json({
      sessionId: session.id,
      signedUploadUrl: signedUrlData.signedUrl,
    });

  } catch (error) {
    console.error('Error in /api/start-checkup:', error.message);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
