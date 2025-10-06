// /pages/api/valuta-pmi/get-session.js
// API per recuperare i dati di una specifica sessione di valutazione.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Autenticazione utente
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });

    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userRow, error: userErr } = await supabase.from('users').select('id').eq('outseta_user_id', outsetaUser.Uid).single();
    if (userErr || !userRow) throw new Error('Utente non trovato o non autorizzato.');

    // 2. Recupero sessione
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'ID della sessione mancante.' });
    }

    const { data: valuationData, error: valuationError } = await supabase
      .from('valuations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userRow.id) // Sicurezza: l'utente può vedere solo le sue sessioni
      .single();

    if (valuationError || !valuationData) {
      return res.status(404).json({ error: 'Sessione di valutazione non trovata.' });
    }

    return res.status(200).json({ success: true, data: valuationData });

  } catch (error) {
    console.error(`💥 Errore in get-session:`, error);
    return res.status(500).json({ error: error.message || 'Errore interno del server.' });
  }
}
