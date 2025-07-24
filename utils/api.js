// /utils/api.js
// Versione che implementa le best practice: usa il client Supabase per l'auth,
// controlla la dimensione del file e gestisce gli errori in modo robusto.

import { supabase } from './supabaseClient';

const API_FUNCTION_NAME = 'api-router';
// Definiamo un limite massimo per la dimensione del file (es. 5MB)
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Sincronizza l'utente di Outseta con il database Supabase.
 * Usa supabase.functions.invoke per gestire automaticamente il token utente.
 * @param {object} outsetaUser - L'oggetto utente recuperato da Outseta.
 * @returns {Promise<object>}
 */
async function syncUser(outsetaUser) {
  try {
    // supabase.functions.invoke allega automaticamente l'header 'Authorization'
    // con il token JWT dell'utente loggato. È il metodo più sicuro.
    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: {
        action: 'sync-user',
        outsetaUser,
      },
    });

    if (error) {
      // Se la funzione restituisce un errore, lo lanciamo per gestirlo nell'UI.
      throw error;
    }
    return data;
  } catch (err) {
    console.error(`Errore API [sync-user]:`, err);
    // Propaga il messaggio di errore originale per un debug più facile.
    throw new Error(err.message || 'Impossibile sincronizzare il profilo utente.');
  }
}

/**
 * Avvia il processo di checkup.
 * Controlla la dimensione del file prima di inviarlo.
 * @param {string} userId - L'ID dell'utente dal nostro database.
 * @param {object} formData - I dati del form dell'azienda.
 * @param {File} file - Il file PDF del bilancio.
 * @returns {Promise<object>}
 */
async function processCheckup(userId, formData, file) {
  // 1. Controllo sulla dimensione del file prima di qualsiasi chiamata di rete.
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const errorMessage = `Il file è troppo grande. La dimensione massima è ${MAX_FILE_SIZE_MB} MB.`;
    console.error(errorMessage);
    // Rifiuta la Promise con un errore chiaro per l'utente.
    return Promise.reject(new Error(errorMessage));
  }

  try {
    const submissionData = new FormData();
    submissionData.append('action', 'process-checkup');
    submissionData.append('userId', userId);
    submissionData.append('formData', JSON.stringify(formData));
    submissionData.append('file', file);

    // Anche per FormData, supabase.functions.invoke è il metodo preferito.
    // Gestisce l'autenticazione e gli header corretti.
    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: submissionData,
    });

    if (error) {
      throw error;
    }
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
