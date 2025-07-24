// /utils/api.js
// Versione ultra-semplificata. Contiene solo la funzione per il test di sincronizzazione.

/**
 * Chiama la nostra API Vercel per sincronizzare l'utente.
 * @returns {Promise<object>} Il risultato della chiamata API.
 */
async function syncUserOnly() {
  // 1. Ottieni il token di accesso di Outseta per l'autenticazione.
  const outsetaToken = await window.Outseta.getAccessToken();
  if (!outsetaToken) {
    throw new Error('Impossibile ottenere il token di autenticazione. Effettua nuovamente il login.');
  }

  // 2. Esegui la chiamata alla nostra API ultra-semplice.
  // Non inviamo nessun dato nel corpo, perché il token nell'header è sufficiente.
  const response = await fetch('/api/start-checkup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${outsetaToken}`,
    },
  });

  const result = await response.json();
  if (!response.ok) {
    // Se la risposta non è OK, lancia un errore con il messaggio dal server.
    throw new Error(result.error || `Si è verificato un errore (status: ${response.status})`);
  }

  return result;
}

export const api = {
  syncUserOnly,
};
