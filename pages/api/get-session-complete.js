// /pages/api/get-session-complete.js
// VERSIONE CORRETTA E SICURA - Con autenticazione Outseta

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
    // ✅ FIX: Autenticazione Outseta obbligatoria
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autenticazione mancante.' });
    }

    // Verifica token con Outseta
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });

    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token di autenticazione non valido.' });
    }

    const outsetaUser = await outsetaResponse.json();
    
    // ✅ FIX: Ottieni userId dal database usando l'ID Outseta verificato
    const { data: userId } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName
    });

    // ✅ FIX: SessionId solo dai query params (sicuro ora che abbiamo l'utente verificato)
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId è richiesto' });
    }

    console.log(`🔍 Recupero sessione ${sessionId} per utente autenticato ${userId}`);

    // 1️⃣ PRIMA QUERY: Recupera la sessione e l'azienda collegata
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('*, companies(*)')
      .eq('id', sessionId)
      .eq('user_id', userId) // ✅ Usa l'userId verificato
      .single();

    if (sessionError) {
      console.error('❌ Errore query sessione:', sessionError);
      return res.status(404).json({ error: 'Sessione non trovata o accesso negato.' });
    }

    if (!session) {
      return res.status(404).json({ error: 'Sessione non trovata.' });
    }

    // 2️⃣ SECONDA QUERY: Recupera i risultati dell'analisi
    console.log(`🔍 Recupero risultati analisi per sessione ${sessionId}`);
    
    const { data: results, error: analysisError } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('session_id', sessionId);

    // ✅ FIX: Gestione errori migliorata
    let analysisData = null;
    
    if (analysisError) {
      console.error('⚠️ Errore query risultati analisi:', analysisError);
      // Continuiamo, ma il frontend saprà che non ci sono risultati
    } else if (results && results.length > 0) {
      analysisData = results[0];
      console.log(`✅ Risultati analisi trovati (ID: ${analysisData.id})`);
    } else {
      console.log(`🟡 Nessun risultato di analisi per sessione ${sessionId} (potrebbe essere in elaborazione)`);
    }

    // 3️⃣ Costruisci e restituisci la risposta
    const response = {
      ...session,
      analysisData,
      // ✅ FIX: Aggiungi metadati utili per il frontend
      meta: {
        hasAnalysis: !!analysisData,
        sessionStatus: session.status,
        lastUpdated: session.updated_at || session.created_at
      }
    };
    
    // ✅ FIX: Log ridotto per produzione
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Dati sessione restituiti:', {
        sessionId: session.id,
        status: session.status,
        hasAnalysis: !!analysisData,
        companyName: session.companies?.company_name
      });
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('💥 Errore grave in get-session-complete:', error);
    
    // ✅ FIX: Non esporre dettagli interni in produzione
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Errore interno del server'
      : error.message;
    
    return res.status(500).json({ error: errorMessage });
  }
}
