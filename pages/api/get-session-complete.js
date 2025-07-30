// /pages/api/get-session-complete.js
// API unica che restituisce sessione + analisi + company in una sola chiamata

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
    // Verifica token Outseta
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token mancante.' });
    }

    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });

    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token non valido.' });
    }

    const outsetaUser = await outsetaResponse.json();
    
    // Ottieni l'ID utente interno
    const { data: userId } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName
    });

    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId è richiesto' });
    }

    // Query COMPLETA: sessione + company + risultati analisi in una sola chiamata
    const { data: sessionData, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select(`
        *,
        companies(*),
        analysis_results(*)
      `)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError) {
      console.error('Errore query Supabase:', sessionError);
      
      if (sessionError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Sessione non trovata o accesso negato.' });
      }
      
      throw new Error(sessionError.message);
    }

    if (!sessionData) {
      return res.status(404).json({ error: 'Sessione non trovata o accesso negato.' });
    }

    // Struttura la risposta per essere compatibile con il frontend esistente
    const response = {
      // Dati della sessione
      ...sessionData,
      // Se esiste un risultato di analisi, lo mettiamo direttamente
      analysisData: sessionData.analysis_results?.[0] || null
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Errore get-session-complete:', error);
    res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
