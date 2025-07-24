// /pages/api/trigger-analysis.js
// Questa funzione Vercel fa solo da "ponte" per avviare l'analisi AI su Supabase.

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
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Potresti aggiungere un'ulteriore verifica qui per assicurarti
    // che l'utente che fa la richiesta sia il proprietario della sessione,
    // ma per ora la teniamo semplice.

    // Aggiorna lo stato della sessione per indicare che il file è stato caricato
    await supabaseAdmin
      .from('checkup_sessions')
      .update({ status: 'file_uploaded' })
      .eq('id', sessionId);

    // Avvia la Edge Function di Supabase per l'analisi pesante (fire-and-forget)
    // Assicurati che il nome della funzione 'ai-analysis' corrisponda a quella che creerai in Supabase.
    supabaseAdmin.functions.invoke('ai-analysis', {
      body: { session_id: sessionId },
    });

    // Rispondi subito al frontend senza aspettare la fine dell'analisi
    res.status(202).json({ success: true, message: 'Analysis triggered' });

  } catch (error) {
    console.error('Error in /api/trigger-analysis:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
