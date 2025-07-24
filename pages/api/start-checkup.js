// /pages/api/start-checkup.js
// Versione ultra-semplificata con la correzione del nome della variabile d'ambiente.

import { createClient } from '@supabase/supabase-js';

// --- MODIFICA CHIAVE ---
// Usiamo i nomi corretti delle variabili d'ambiente che hai impostato su Vercel.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, // Corretto da SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Estrai il token di autenticazione dall'header.
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autenticazione mancante.' });
    }

    // 2. Verifica il token con Outseta.
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` },
    });
    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token Outseta non valido o scaduto.' });
    }
    const outsetaUser = await outsetaResponse.json();

    // 3. Chiama la funzione nel database per sincronizzare l'utente.
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName,
    });

    if (userError) {
      throw new Error(`Errore durante la sincronizzazione con il database: ${userError.message}`);
    }

    console.log(`✅ Utente sincronizzato con successo. ID Supabase: ${userId}`);

    // 4. Rispondi con un messaggio di successo.
    return res.status(200).json({
      success: true,
      message: 'Utente verificato e registrato con successo.',
      userId: userId
    });

  } catch (error) {
    console.error('💥 Errore nella funzione API:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
