// /pages/api/user-analyses.js
// API SEMPLIFICATA - Usa solo email utente corrente

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
    // Prendi email dal query parameter o session
    const userEmail = req.query.email || 'investimentolibero@gmail.com'; // hardcode per test
    
    console.log(`[user-analyses] Cerco analisi per: ${userEmail}`);

    // 1. Trova utente tramite email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      console.log(`[user-analyses] Utente non trovato: ${userEmail}`);
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    console.log(`[user-analyses] Trovato user_id: ${user.id}`);

    // 2. Query semplificata - prende TUTTE le analisi dell'utente
    const { data: analyses, error: analysesError } = await supabase
      .from('analysis_results')
      .select(`
        company_name,
        health_score,
        created_at,
        session_id
      `)
      .in('session_id', 
        // Subquery per prendere session_id dell'utente
        supabase
          .from('checkup_sessions')
          .select('id')
          .eq('user_id', user.id)
      )
      .order('created_at', { ascending: false })
      .limit(6);

    if (analysesError) {
      console.error('[user-analyses] Errore query:', analysesError);
      return res.status(500).json({ error: 'Errore database' });
    }

    // 3. Filtra solo analisi con nome valido
    const validAnalyses = analyses.filter(a => 
      a.company_name && 
      a.company_name !== 'T0000.D01.1.001.002.002' && 
      a.company_name !== 'Azienda Sconosciuta'
    );

    console.log(`[user-analyses] Trovate ${analyses.length} analisi totali, ${validAnalyses.length} valide`);

    return res.status(200).json({
      success: true,
      analyses: validAnalyses
    });

  } catch (error) {
    console.error('[user-analyses] Errore:', error);
    return res.status(500).json({ 
      error: 'Errore server',
      details: error.message 
    });
  }
}
