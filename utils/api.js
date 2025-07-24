// /utils/api.js
// Versione che usa il client Supabase nel modo corretto per le chiamate.

import { supabase } from './supabaseClient';

const API_FUNCTION_NAME = 'api-router';

/**
 * Sincronizza l'utente di Outseta con il database Supabase.
 * @param {object} outsetaUser - L'oggetto utente recuperato da Outseta.
 * @returns {Promise<object>}
 */
async function syncUser(outsetaUser) {
  try {
    // La libreria supabase.functions.invoke gestisce la stringa JSON da sola.
    // Passare un oggetto direttamente è il modo corretto.
    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: { // NON usiamo più JSON.stringify qui
        action: 'sync-user',
        outsetaUser,
      },
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`Errore API [sync-user]:`, err);
    throw new Error('Impossibile sincronizzare il profilo utente.');
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

    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: submissionData, // Per FormData, il body è corretto così
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`Errore API [process-checkup]:`, err);
    throw new Error("Si è verificato un errore durante l'avvio dell'analisi.");
  }
}

// Esporta l'oggetto api per un uso pulito in tutta l'app
export const api = {
  syncUser,
  processCheckup,
};
