// /utils/api.js
// Versione che propaga i messaggi di errore dettagliati dal server.

import { supabase } from './supabaseClient';

const API_FUNCTION_NAME = 'api-router';

/**
 * Sincronizza l'utente di Outseta con il database Supabase.
 * @param {object} outsetaUser - L'oggetto utente recuperato da Outseta.
 * @returns {Promise<object>}
 */
async function syncUser(outsetaUser) {
  try {
    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: {
        action: 'sync-user',
        outsetaUser,
      },
    });

    // Se la chiamata alla funzione ha successo ma la logica interna fallisce,
    // la funzione potrebbe restituire un errore nel corpo della risposta.
    // Il client Supabase lo cattura nell'oggetto 'error'.
    if (error) {
      throw error;
    }
    
    return data;

  } catch (err) {
    // MODIFICA CHIAVE:
    // Invece di creare un nuovo errore generico, propaghiamo il messaggio
    // di errore originale proveniente da Supabase.
    console.error(`Errore dettagliato dalla funzione API [sync-user]:`, err);
    throw new Error(err.message || 'Si è verificato un errore sconosciuto durante la sincronizzazione.');
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
      body: submissionData,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`Errore API [process-checkup]:`, err);
    throw new Error(err.message || "Si è verificato un errore durante l'avvio dell'analisi.");
  }
}

// Esporta l'oggetto api per un uso pulito in tutta l'app
export const api = {
  syncUser,
  processCheckup,
};
