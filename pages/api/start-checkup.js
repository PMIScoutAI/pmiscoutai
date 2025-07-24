// /pages/api/start-checkup.js
// Versione super-semplificata per testare la connessione di base.
// IGNORA volutamente il file upload per ora.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Estrai i dati (SENZA il file)
    const { companyData } = req.body;
    const outsetaToken = req.headers.authorization?.split(' ')[1];

    if (!outsetaToken || !companyData) {
      return res.status(400).json({ error: 'Dati mancanti.' });
    }

    // 2. Verifica il token Outseta
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` },
    });
    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token Outseta non valido.' });
    }
    const outsetaUser = await outsetaResponse.json();

    // 3. Sincronizza l'utente nel database
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName,
    });

    if (userError) {
      throw new Error(`Errore DB (get_or_create_user): ${userError.message}`);
    }

    console.log(`✅ TEST DI CONNESSIONE RIUSCITO per utente ID: ${userId}`);

    // 4. Rispondi con un successo parziale
    // Usiamo un ID fittizio per il redirect, solo per questo test.
    return res.status(200).json({
      success: true,
      sessionId: 'test-success', // ID fittizio
      message: 'Connessione base a Vercel e Supabase OK!',
    });

  } catch (error) {
    console.error('💥 Errore nella funzione di test:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
