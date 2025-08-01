// pages/api/save-simulation.js

import { createClient } from '@supabase/supabase-js';

// Usiamo il client "Admin" con la chiave di servizio segreta, come nel tuo esempio.
// Questo client ha i massimi privilegi e può bypassare le policy RLS se necessario.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Prendiamo i dati inviati dal calcolatore.
    const { user, inputs, outputs } = req.body;

    // Eseguiamo una validazione semplice: ci assicuriamo che l'ID utente sia presente.
    if (!user || !user.Uid) {
      return res.status(400).json({ error: 'ID utente mancante nella richiesta.' });
    }

    // --- NUOVO: Data Sanitization & Formatting ---
    // Assicuriamoci che i dati inviati a Supabase siano oggetti JSON validi,
    // non stringhe. Questo è fondamentale per poterli interrogare in futuro.
    const sanitizedInputs = typeof inputs === 'string' ? JSON.parse(inputs) : inputs;
    const sanitizedOutputs = typeof outputs === 'string' ? JSON.parse(outputs) : outputs;

    const payload = {
      user_id: user.Uid, // Usiamo l'ID di Outseta (es. "nmDazR0Q")
      inputs: sanitizedInputs,
      outputs: sanitizedOutputs,
    };

    // Inseriamo i dati nella tabella.
    const { error } = await supabase.from('simulazioni_fondo_garanzia').insert(payload);

    if (error) {
      // Se c'è un errore, lo registriamo nei log e lo restituiamo per un debug più facile.
      console.error('Errore Supabase:', error);
      throw error;
    }

    res.status(200).json({ message: 'Simulazione salvata con successo!' });

  } catch (error) {
    // Miglioriamo la gestione degli errori per dare più dettagli in caso di problemi.
    console.error('Errore API completo:', error);
    res.status(500).json({ 
        error: `Errore durante il salvataggio della simulazione: ${error.message}`,
        details: error.details || 'Nessun dettaglio aggiuntivo.'
    });
  }
}
