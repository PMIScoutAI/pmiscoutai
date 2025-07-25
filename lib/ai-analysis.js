// /lib/ai-analysis.js
// Modulo dedicato per gestire l'analisi AI tramite Vercel API
// Mantiene pulito start-checkup.js e centralizza la logica AI

/**
 * Lancia l'analisi AI per una sessione di checkup
 * @param {string} sessionId - ID della sessione da analizzare
 * @returns {Promise<object>} Risultato dell'analisi
 */
export async function launchAIAnalysis(sessionId) {
  if (!sessionId) {
    throw new Error('SessionId è richiesto per l\'analisi AI');
  }

  console.log(`🤖 Avvio analisi AI per sessione: ${sessionId}`);

  try {
    // Verifica che tutte le variabili d'ambiente siano presenti
    const vercelApiUrl = process.env.VERCEL_AI_API_URL;
    const internalSecret = process.env.INTERNAL_SECRET;

    if (!vercelApiUrl) {
      throw new Error('VERCEL_AI_API_URL non configurata nelle variabili d\'ambiente');
    }

    if (!internalSecret) {
      throw new Error('INTERNAL_SECRET non configurata nelle variabili d\'ambiente');
    }

    // Chiamata all'API Vercel per l'analisi
    const response = await fetch(`${vercelApiUrl}/api/analyze-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalSecret}`,
        'User-Agent': 'PMIScout-Frontend/1.0'
      },
      body: JSON.stringify({ 
        session_id: sessionId,
        timestamp: new Date().toISOString()
      }),
      // Timeout di 5 minuti per l'analisi AI
      signal: AbortSignal.timeout(300000)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Vercel errore ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    
    console.log(`✅ Analisi AI completata per sessione: ${sessionId}`);
    
    return {
      success: true,
      sessionId: sessionId,
      message: 'Analisi AI avviata con successo',
      vercelResponse: result
    };

  } catch (error) {
    console.error(`❌ Errore analisi AI per sessione ${sessionId}:`, error);
    
    // Distingui tra errori di timeout e altri errori
    if (error.name === 'TimeoutError') {
      throw new Error('Timeout durante l\'analisi AI - riprova tra qualche minuto');
    }
    
    if (error.message.includes('fetch')) {
      throw new Error('Errore di connessione con il servizio AI - riprova più tardi');
    }
    
    // Rilancia l'errore originale per altri casi
    throw error;
  }
}

/**
 * Verifica lo stato di una sessione di analisi
 * @param {string} sessionId - ID della sessione da verificare
 * @returns {Promise<object>} Stato dell'analisi
 */
export async function checkAnalysisStatus(sessionId) {
  if (!sessionId) {
    throw new Error('SessionId è richiesto per verificare lo stato');
  }

  try {
    const vercelApiUrl = process.env.VERCEL_AI_API_URL;
    const internalSecret = process.env.INTERNAL_SECRET;

    const response = await fetch(`${vercelApiUrl}/api/analysis-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalSecret}`
      },
      body: JSON.stringify({ session_id: sessionId })
    });

    if (!response.ok) {
      throw new Error(`Errore verifica stato: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error(`❌ Errore verifica stato per sessione ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Configurazione del modulo AI
 */
export const AI_CONFIG = {
  TIMEOUT_MS: 300000, // 5 minuti
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000 // 5 secondi tra i retry
};
