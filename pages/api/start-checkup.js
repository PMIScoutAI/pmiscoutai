// /pages/api/start-checkup.js
// Versione definitiva che usa la nuova architettura con tabella 'users' autonoma.

import { createClient } from '@supabase/supabase-js';

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

    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { 'Authorization': `Bearer ${outsetaToken}` }
    });

    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Invalid Outseta token' });
    }
    const outsetaUser = await outsetaResponse.json();
    const { Uid: outsetaUid, Email, FirstName, LastName } = outsetaUser;

    // 2. Sincronizza il profilo chiamando la nostra nuova e semplice funzione RPC
    const { data: userId, error: rpcError } = await supabaseAdmin.rpc('get_or_create_user', {
      user_email: Email,
      user_first_name: FirstName || '',
      user_last_name: LastName || '',
      user_outseta_id: outsetaUid,
    });
    if (rpcError) throw rpcError;

    // 3. Procedi con la logica di creazione della sessione e della Signed URL
    const { companyData, fileName, prompt_name } = req.body;

    // La colonna 'user_id' in 'companies' e 'checkup_sessions' ora si riferisce a 'public.users.id'
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .upsert({ user_id: userId, ...companyData }, { onConflict: 'user_id' })
      .select('id').single();
    if (companyError) throw companyError;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkup_sessions')
      .insert({ 
        company_id: company.id, 
        user_id: userId, 
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
