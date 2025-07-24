// /pages/api/start-checkup.js
// Versione ultra-semplificata. Unico scopo: verificare il token Outseta
// e sincronizzare l'utente nel nostro database Supabase.

import { createClient } from '@supabase/supabase-js';

// Inizializza il client Supabase con la chiave di servizio sicura.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Accetta solo richieste di tipo POST.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Estrai il token di autenticazione dall'header della richiesta.
    const outsetaToken = req.headers.authorization?.split(' ')[1];

    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autenticazione mancante.' });
    }

    // 2. Verifica che il token sia valido chiamando l'API di Outseta.
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` },
    });
    
    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token Outseta non valido o scaduto.' });
    }
    const outsetaUser = await outsetaResponse.json();

    // 3. Chiama la nostra funzione nel database Supabase per trovare o creare l'utente.
    // Questa è la "trasmissione" che registra l'utente.
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName,
    });

    if (userError) {
      // Se la funzione del database fallisce, restituisci un errore dettagliato.
      throw new Error(`Errore durante la sincronizzazione con il database: ${userError.message}`);
    }

    console.log(`✅ Utente sincronizzato con successo. ID Supabase: ${userId}`);

    // 4. Se tutto è andato a buon fine, rispondi con un messaggio di successo.
    return res.status(200).json({
      success: true,
      message: 'Utente verificato e registrato con successo.',
      userId: userId // Restituiamo l'ID del nostro database per usi futuri.
    });

  } catch (error) {
    console.error('💥 Errore nella funzione API:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
