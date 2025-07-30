// /pages/api/get-session-complete.js
// Versione semplificata che usa l'userId direttamente

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
    const { sessionId, userId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId è richiesto' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'UserId è richiesto' });
    }

    console.log(`🔍 Recupero dati per sessione ${sessionId} e utente ${userId}`);

    // Query COMPLETA: sessione + company + risultati analisi
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

    console.log(`✅ Dati recuperati per sessione ${sessionId}`);
    res.status(200).json(response);

  } catch (error) {
    console.error('Errore get-session-complete:', error);
    res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
