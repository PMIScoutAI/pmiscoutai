// /pages/api/user-analyses.js
// VERSIONE CON FIX: Rimuove l'email di fallback e aggiunge un controllo.

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
    // *** FIX 1: Legge l'email solo dalla query, senza fallback ***
    const userEmail = req.query.email; 
    
    // *** FIX 2: Aggiunge un controllo per assicurarsi che l'email sia presente ***
    if (!userEmail) {
      return res.status(400).json({ error: 'Email utente non fornita nella richiesta' });
    }
    
    console.log(`[user-analyses] Cerco analisi per: ${userEmail}`);

    // 1. Trova utente tramite email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      console.log(`[user-analyses] Utente non trovato: ${userEmail}`, userError);
      // Restituisce una lista vuota se l'utente non è nel DB, per non mostrare un errore in UI
      return res.status(200).json({ success: true, analyses: [] });
    }

    console.log(`[user-analyses] Trovato user_id: ${user.id}`);

    // 2. Prendi i session_id dell'utente
    const { data: sessions, error: sessionsError } = await supabase
      .from('checkup_sessions')
      .select('id')
      .eq('user_id', user.id);

    if (sessionsError) {
      console.error('[user-analyses] Errore sessions:', sessionsError);
      return res.status(500).json({ error: 'Errore nel recupero delle sessioni' });
    }

    const sessionIds = sessions.map(s => s.id);
    console.log(`[user-analyses] Session IDs trovati: ${sessionIds.length}`);

    if (sessionIds.length === 0) {
      return res.status(200).json({ success: true, analyses: [] });
    }

    // 3. Prendi le analisi per quei session_id
    const { data: analyses, error: analysesError } = await supabase
      .from('analysis_results')
      .select('company_name, health_score, created_at, session_id')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(6);

    if (analysesError) {
      console.error('[user-analyses] Errore query:', analysesError);
      return res.status(500).json({ error: 'Errore database' });
    }

    // 4. Filtra solo analisi con nome valido
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
    console.error('[user-analyses] Errore generale:', error);
    return res.status(500).json({ 
      error: 'Errore server',
      details: error.message 
    });
  }
}
