// /pages/api/user-analyses.js
// API per recuperare la cronologia delle analisi dell'utente

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Accetta solo richieste GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Ottieni l'email dell'utente dal token Outseta
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autenticazione mancante' });
    }

    // Verifica il token con Outseta
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });

    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token non valido' });
    }

    const outsetaUser = await outsetaResponse.json();
    const userEmail = outsetaUser.Email;

    console.log(`[user-analyses] Richiesta per utente: ${userEmail}`);

    // 2. Trova l'utente nel database tramite email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      console.log(`[user-analyses] Utente non trovato per email: ${userEmail}`);
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // 3. Query per ottenere le analisi dell'utente
    const { data: analyses, error: analysesError } = await supabase
      .from('analysis_results')
      .select(`
        company_name,
        health_score,
        created_at,
        session_id,
        checkup_sessions!inner(
          id,
          user_id
        )
      `)
      .eq('checkup_sessions.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6);

    if (analysesError) {
      console.error('[user-analyses] Errore query analisi:', analysesError);
      return res.status(500).json({ error: 'Errore nel recupero delle analisi' });
    }

    // 4. Formatta i dati per il frontend
    const formattedAnalyses = analyses.map(analysis => ({
      company_name: analysis.company_name || 'Azienda Sconosciuta',
      health_score: analysis.health_score,
      created_at: analysis.created_at,
      session_id: analysis.session_id
    }));

    console.log(`[user-analyses] Trovate ${formattedAnalyses.length} analisi per ${userEmail}`);

    return res.status(200).json({
      success: true,
      analyses: formattedAnalyses
    });

  } catch (error) {
    console.error('[user-analyses] Errore generale:', error);
    return res.status(500).json({ 
      error: 'Errore interno del server',
      details: error.message 
    });
  }
}
