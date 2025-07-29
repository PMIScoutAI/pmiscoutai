// pages/api/save-valuation.js

import { createClient } from '@supabase/supabase-js';

// Usiamo il client "Admin" con la chiave di servizio segreta
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { user, inputs, outputs } = req.body;

    if (!user || !user.Uid) {
      return res.status(400).json({ error: 'ID utente mancante nella richiesta.' });
    }

    const payload = {
      user_id: user.Uid,
      inputs: inputs,
      outputs: outputs,
    };

    // Inseriamo i dati nella nuova tabella 'valutazioni_aziendali'
    const { error } = await supabase.from('valutazioni_aziendali').insert(payload);

    if (error) {
      console.error('Errore Supabase:', error);
      throw error;
    }

    res.status(200).json({ message: 'Valutazione salvata con successo!' });

  } catch (error) {
    res.status(500).json({ error: `Errore durante il salvataggio della valutazione: ${error.message}` });
  }
}
