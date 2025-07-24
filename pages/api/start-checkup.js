// /pages/api/start-checkup.js

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
    // 1. Verifica autenticazione tramite token Outseta
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` },
    });

    if (!outsetaResponse.ok) {
      console.error('Outseta token validation failed:', await outsetaResponse.text());
      return res.status(401).json({ error: 'Invalid Outseta token' });
    }

    const outsetaUser = await outsetaResponse.json();
    const { Uid: outsetaUid, Email, FirstName, LastName } = outsetaUser;

    // 2. Recupera utente esistente da auth.users
    const { data: existingUser, error: selectError } = await supabaseAdmin
      .from('auth.users')
      .select('id')
      .eq('email', Email)
      .maybeSingle();

    let authUserId;

    if (selectError) throw selectError;

    if (!existingUser) {
      // 3. Crea nuovo utente se non esiste
      const { data: { user: newUser }, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: Email,
        email_confirm: true,
        user_metadata: {
          first_name: FirstName,
          last_name: LastName,
        }
      });
      if (createError) throw createError;
      authUserId = newUser.id;
    } else {
      authUserId = existingUser.id;
    }

    // 4. Chiama RPC per sincronizzare profilo utente
    const { error: rpcError } = await supabaseAdmin.rpc('upsert_user_profile', {
      user_id: authUserId,
      user_email: Email,
      user_first_name: FirstName || '',
      user_last_name: LastName || '',
      user_outseta_id: outsetaUid,
    });
    if (rpcError) throw rpcError;

    // 5. Crea azienda e sessione
    const { companyData, fileName } = req.body;

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .upsert({ user_id: authUserId, ...companyData }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (companyError) throw companyError;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkup_sessions')
      .insert({ company_id: company.id, user_id: authUserId, status: 'waiting_for_file' })
      .select('id')
      .single();
    if (sessionError) throw sessionError;

    // 6. Genera URL firmato per upload
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
    console.error('Errore in /api/start-checkup:', error.message);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
