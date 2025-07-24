// /utils/api.js
// Versione aggiornata che usa il client Supabase e FormData per l'upload.

import { supabase } from './supabaseClient'; // Importa il client Supabase

const API_FUNCTION_NAME = 'api-router';

// --- Funzioni API specifiche ---

/**
 * Sincronizza l'utente di Outseta con il database Supabase.
 * @param {object} outsetaUser - L'oggetto utente recuperato da Outseta.
 * @returns {Promise<object>}
 */
async function syncUser(outsetaUser) {
  try {
    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: JSON.stringify({
        action: 'sync-user',
        outsetaUser,
      }),
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`Errore API [sync-user]:`, err);
    throw new Error('Impossibile sincronizzare il profilo utente.');
  }
}

/**
 * Avvia il processo di checkup inviando i dati del form e il file tramite FormData.
 * @param {string} userId - L'ID dell'utente dal nostro database.
 * @param {object} formData - I dati del form dell'azienda.
 * @param {File} file - Il file PDF del bilancio.
 * @returns {Promise<object>}
 */
async function processCheckup(userId, formData, file) {
  try {
    // 1. Prepara il corpo della richiesta usando FormData.
    // Questo è il modo corretto e più efficiente per caricare file.
    const submissionData = new FormData();
    submissionData.append('action', 'process-checkup');
    submissionData.append('userId', userId);
    submissionData.append('formData', JSON.stringify(formData));
    submissionData.append('file', file);

    // 2. Chiama la Edge Function. Il client Supabase imposterà
    // automaticamente l'header 'Content-Type' corretto per FormData.
    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: submissionData,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`Errore API [process-checkup]:`, err);
    throw new Error("Si è verificato un errore durante l'avvio dell'analisi.");
  }
}

/**
 * Recupera i risultati di un'analisi completata.
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
async function getAnalysis(sessionId) {
    // Questa funzione può rimanere come l'avevi scritta, ma per coerenza
    // la adattiamo per usare il client Supabase.
    try {
        const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
            body: JSON.stringify({
                action: 'get-analysis',
                sessionId,
            })
        });
        if (error) throw error;
        return data;
    } catch (err) {
        console.error(`Errore API [get-analysis]:`, err);
        throw new Error("Impossibile recuperare i risultati dell'analisi.");
    }
}


// Esporta l'oggetto api per un uso pulito in tutta l'app
export const api = {
  syncUser,
  processCheckup,
  getAnalysis,
};
