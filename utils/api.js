// /utils/api.js
// Versione che usa 'fetch' per un controllo più diretto sulle chiamate API.

// Il client supabase non è più usato per le chiamate alle funzioni in questo file,
// ma potrebbe servire se aggiungerai altre funzioni che non usano 'fetch'.
import { supabase } from './supabaseClient';

// Definiamo l'URL completo della nostra Edge Function
const API_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-router`;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Sincronizza l'utente di Outseta con il database Supabase.
 * @param {object} outsetaUser - L'oggetto utente recuperato da Outseta.
 * @returns {Promise<object>}
 */
async function syncUser(outsetaUser) {
  try {
    const response = await fetch(API_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Le chiavi di Supabase sono necessarie per l'autenticazione della richiesta
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: 'sync-user',
        outsetaUser,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      // Se la risposta non è OK, lancia un errore con il messaggio dal server
      throw new Error(result.error || `Errore API (status: ${response.status})`);
    }
    return result;

  } catch (err) {
    console.error(`Errore di rete o fetch [sync-user]:`, err);
    // Questo errore ora cattura problemi di rete come CORS o fallimenti di connessione
    throw new Error(err.message || 'Failed to send a request to the Edge Function');
  }
}

/**
 * Avvia il processo di checkup inviando i dati del form e il file.
 * @param {string} userId - L'ID dell'utente dal nostro database.
 * @param {object} formData - I dati del form dell'azienda.
 * @param {File} file - Il file PDF del bilancio.
 * @returns {Promise<object>}
 */
async function processCheckup(userId, formData, file) {
  try {
    const submissionData = new FormData();
    submissionData.append('action', 'process-checkup');
    submissionData.append('userId', userId);
    submissionData.append('formData', JSON.stringify(formData));
    submissionData.append('file', file);

    const response = await fetch(API_FUNCTION_URL, {
      method: 'POST',
      headers: {
        // Con FormData, il browser imposta 'Content-Type' automaticamente. Non specificarlo qui.
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: submissionData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `Errore API (status: ${response.status})`);
    }
    return result;

  } catch (err) {
    console.error(`Errore di rete o fetch [process-checkup]:`, err);
    throw new Error(err.message || "Failed to send a request to the Edge Function");
  }
}

// Esporta l'oggetto api per un uso pulito in tutta l'app
export const api = {
  syncUser,
  processCheckup,
};
