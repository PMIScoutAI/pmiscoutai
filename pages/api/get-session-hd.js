// /pages/api/get-session-hd.js
// API per recuperare lo stato di una sessione di analisi HD

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Autentica l'utente tramite il token Outseta
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autorizzazione mancante.' });
    }
    
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    
    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token Outseta non valido.' });
    }
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', { 
      p_outseta_id: outsetaUser.Uid, 
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName
    });

    if (userError) {
        throw new Error(`Errore DB utente: ${userError.message}`);
    }

    // 2. Recupera la sessione dal database
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId è richiesto' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('*, companies(company_name)') // Recupera anche il nome dell'azienda
      .eq('id', sessionId)
      .eq('user_id', userId) // Assicura che l'utente possa vedere solo le proprie sessioni
      .single();

    if (sessionError) {
      console.error('Errore recupero sessione HD:', sessionError);
      return res.status(404).json({ error: 'Sessione non trovata o accesso non autorizzato.' });
    }

    // 3. Restituisci i dati della sessione
    return res.status(200).json(session);

  } catch (error) {
    console.error('💥 Errore grave in get-session-hd:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
