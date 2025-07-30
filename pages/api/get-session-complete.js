// /pages/api/get-session-complete.js
// VERSIONE ROBUSTA CON DUE QUERY SEPARATE

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

    console.log(`🔍 Recupero sessione ${sessionId} per utente ${userId}`);

    // 1️⃣ PRIMA QUERY: Recupera la sessione e l'azienda collegata
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('*, companies(*)') // Join con companies funziona
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      console.error('❌ Errore query sessione o sessione non trovata:', sessionError);
      return res.status(404).json({ error: 'Sessione non trovata o accesso negato.' });
    }

    // 2️⃣ SECONDA QUERY: Recupera i risultati dell'analisi separatamente
    console.log(`🔍 Recupero risultati analisi per sessione ${sessionId}`);
    const { data: results, error: analysisError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('session_id', sessionId);

    if (analysisError) {
      // Logghiamo l'errore ma non blocchiamo la richiesta
      // Potremmo voler restituire la sessione anche senza i risultati
      console.error('⚠️ Errore query risultati analisi:', analysisError);
    }
    
    // Prendi solo il primo risultato (di solito ce n'è uno solo)
    const analysisData = results && results.length > 0 ? results[0] : null;

    if (!analysisData) {
        console.warn(`🟡 Nessun risultato di analisi trovato per la sessione ${sessionId}`);
    }

    // 3️⃣ Unisci i risultati e restituisci la risposta
    const response = {
      ...session,
      analysisData, // Aggiungi il campo che il frontend si aspetta
    };
    
    console.log('✅ Dati finali restituiti correttamente.');
    res.status(200).json(response);

  } catch (error) {
    console.error('💥 Errore grave in get-session-complete:', error);
    res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
