// /pages/api/get-session-hd.js
// Recupera i dati dalle nuove tabelle 'checkup_sessions_hd' e 'analysis_results_hd'.

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

    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions_hd')
      .select(`
        *,
        companies(company_name),
        analysis_results_hd(*)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Errore recupero sessione HD:', sessionError);
      return res.status(404).json({ error: 'Sessione non trovata.' });
    }
    
    if (session.analysis_results_hd && session.analysis_results_hd.length > 0) {
        session.analysis_results = session.analysis_results_hd[0];
        delete session.analysis_results_hd;
    } else {
        session.analysis_results = null;
    }

    return res.status(200).json(session);

  } catch (error) {
    console.error('💥 Errore grave in get-session-hd:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
