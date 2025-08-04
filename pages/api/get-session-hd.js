// /pages/api/get-session-hd.js
// API per recuperare lo stato di una sessione di analisi HD e i risultati finali.

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
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId è richiesto' });
    }

    // Per lo sviluppo del beta, non controlliamo l'utente.
    // In produzione, aggiungeremmo .eq('user_id', userId)
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select(`
        *,
        companies(company_name),
        analysis_results(*)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Errore recupero sessione HD:', sessionError);
      return res.status(404).json({ error: 'Sessione non trovata.' });
    }
    
    // La query di Supabase con il join (*) mette i risultati in un array.
    // Li spostiamo al primo livello per comodità.
    if (session.analysis_results && session.analysis_results.length > 0) {
        session.analysis_results = session.analysis_results[0];
    } else {
        session.analysis_results = null;
    }

    return res.status(200).json(session);

  } catch (error) {
    console.error('💥 Errore grave in get-session-hd:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
