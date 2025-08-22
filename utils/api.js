// /utils/api.js
// VERSIONE 1.0: Client API robusto basato su Fetch.
// - Non richiede librerie esterne come Axios.
// - Gestisce automaticamente il recupero del token di autenticazione da Outseta.
// - Mima la struttura di risposta di Axios (`response.data`) per la massima compatibilità.
// - Esporta un oggetto `api` con metodi `get` e `post`.

/**
 * Recupera il token di autenticazione da Outseta.
 * @returns {Promise<string|null>} Il token JWT o null.
 */
const getAuthToken = async () => {
  // Assicurati che il codice venga eseguito solo nel browser
  if (typeof window !== 'undefined' && window.Outseta) {
    try {
      // getAccessToken gestisce il refresh del token in automatico
      const token = await window.Outseta.getAccessToken();
      return token;
    } catch (error) {
      console.error("Errore nel recuperare il token da Outseta:", error);
      return null;
    }
  }
  return null;
};

/**
 * Esegue una richiesta POST all'API interna.
 * Gestisce sia FormData (per i file) sia oggetti JSON.
 * @param {string} url - L'endpoint dell'API (es. '/start-checkup').
 * @param {FormData|object} body - Il corpo della richiesta.
 * @returns {Promise<object>} Un oggetto che mima la risposta di Axios, con { data }.
 */
const post = async (url, body) => {
  const token = await getAuthToken();
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Se il body non è FormData, lo trasformiamo in JSON e impostiamo l'header corretto.
  // Per FormData, il browser imposta l'header 'Content-Type' automaticamente.
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(`/api${url}`, {
    method: 'POST',
    headers,
    body,
  });

  const responseData = await response.json();

  if (!response.ok) {
    // Se la risposta non è positiva, lanciamo un errore.
    const error = new Error(responseData.error || 'La richiesta API è fallita');
    error.response = { data: responseData }; // Mimiamo la struttura di errore di Axios
    throw error;
  }

  // Ritorna un oggetto compatibile con la sintassi `response.data` usata nel frontend.
  return { data: responseData };
};

/**
 * Esegue una richiesta GET all'API interna.
 * @param {string} url - L'endpoint dell'API (es. '/get-session-complete?sessionId=...').
 * @returns {Promise<object>} Un oggetto che mima la risposta di Axios, con { data }.
 */
const get = async (url) => {
    const token = await getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api${url}`, {
        method: 'GET',
        headers,
    });

    const responseData = await response.json();

    if (!response.ok) {
        const error = new Error(responseData.error || 'La richiesta API è fallita');
        error.response = { data: responseData };
        throw error;
    }

    return { data: responseData };
};


// Esportiamo un oggetto `api` che contiene i metodi,
// così l'import `import { api } from '...'` nelle tue pagine funziona correttamente.
export const api = {
  post,
  get,
};
