// /pages/api/get-session-complete.js
// FIX TEMPORANEO - Senza autenticazione per debug veloce

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // ✅ FIX TEMPORANEO: Prendi userId dai query params (per ora)
    const { sessionId, userId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId è richiesto' });
    }
    
    // Se userId non è fornito, proviamo a recuperare la sessione senza filtro utente
    let session;
    
    if (userId) {
      console.log(`🔍 Recupero sessione ${sessionId} per utente ${userId}`);
      
      const { data, error } = await supabase
        .from('checkup_sessions')
        .select('*, companies(*)')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
        
      if (error || !data) {
        console.error('❌ Errore query sessione con userId:', error);
        return res.status(404).json({ error: 'Sessione non trovata.' });
      }
      session = data;
    } else {
      console.log(`🔍 Recupero sessione ${sessionId} senza filtro utente`);
      
      const { data, error } = await supabase
        .from('checkup_sessions')
        .select('*, companies(*)')
        .eq('id', sessionId)
        .single();
        
      if (error || !data) {
        console.error('❌ Errore query sessione:', error);
        return res.status(404).json({ error: 'Sessione non trovata.' });
      }
      session = data;
    }

    // 2️⃣ Recupera i risultati dell'analisi
    console.log(`🔍 Recupero risultati analisi per sessione ${sessionId}`);
    
    const { data: results, error: analysisError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('session_id', sessionId);

    let analysisData = null;
    
    if (analysisError) {
      console.error('⚠️ Errore query risultati analisi:', analysisError);
    } else if (results && results.length > 0) {
      analysisData = results[0];
      console.log(`✅ Risultati analisi trovati (ID: ${analysisData.id})`);
    } else {
      console.log(`🟡 Nessun risultato di analisi per sessione ${sessionId}`);
    }

    // 3️⃣ Costruisci risposta
    const response = {
      ...session,
      analysisData,
      meta: {
        hasAnalysis: !!analysisData,
        sessionStatus: session.status,
        lastUpdated: session.updated_at || session.created_at
      }
    };
    
    console.log('✅ Dati sessione restituiti:', {
      sessionId: session.id,
      status: session.status,
      hasAnalysis: !!analysisData,
      companyName: session.companies?.company_name
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('💥 Errore grave in get-session-complete:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
