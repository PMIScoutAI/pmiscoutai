// pages/api/save-simulation.js

import { createClient } from '@supabase/supabase-js';

// Inizializziamo il client di Supabase qui, sul backend.
// Utilizziamo le variabili d'ambiente che hai già configurato su Vercel.
// La SERVICE_ROLE_KEY è una chiave segreta che garantisce l'accesso con pieni poteri
// e non deve MAI essere esposta nel codice del browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Per sicurezza, accettiamo solo richieste di tipo POST a questo endpoint.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Estraiamo i dati inviati dal frontend (dal nostro calcolatore).
    const { user, inputs, outputs } = req.body;

    // Eseguiamo una validazione di sicurezza fondamentale:
    // se non c'è un utente o un ID utente, la richiesta non è valida.
    if (!user || !user.Uid) {
      return res.status(401).json({ error: 'Utente non autenticato o ID mancante.' });
    }

    // Prepariamo il "pacchetto" di dati da inserire nel database.
    // I nomi delle proprietà (user_id, inputs, outputs) devono corrispondere
    // esattamente ai nomi delle colonne che abbiamo creato nella tabella Supabase.
    const payload = {
      user_id: user.Uid, // L'ID dell'utente autenticato
      inputs: inputs,    // L'oggetto JSON con tutti i dati del form
      outputs: outputs,  // L'oggetto JSON con tutti i risultati
    };

    // Eseguiamo l'operazione di inserimento nella tabella 'simulazioni_fondo_garanzia'.
    const { error } = await supabase.from('simulazioni_fondo_garanzia').insert(payload);

    // Se Supabase restituisce un errore durante l'inserimento, lo gestiamo.
    if (error) {
      throw error;
    }

    // Se l'inserimento va a buon fine, inviamo una risposta positiva al frontend.
    res.status(200).json({ message: 'Simulazione salvata con successo!' });

  } catch (error) {
    // In caso di qualsiasi altro errore nel processo, lo registriamo nei log del server
    // e inviamo una risposta di errore generica al frontend.
    console.error('Errore API:', error.message);
    res.status(500).json({ error: 'Errore interno del server durante il salvataggio della simulazione.' });
  }
}
