// /utils/api.js
// Contiene la logica per chiamare la nostra API backend su Vercel.

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Avvia il processo di checkup inviando tutti i dati alla nostra API Vercel.
 * @param {object} companyData - Dati dell'azienda dal form.
 * @param {File} file - Il file PDF da analizzare.
 * @param {string} promptName - Il nome del prompt selezionato dall'utente.
 * @returns {Promise<object>} Il risultato della chiamata API (es. { sessionId: '...' }).
 */
async function startCheckupProcess(companyData, file, promptName) {
  // 1. Validazione client-side prima di qualsiasi chiamata di rete.
  if (!file) {
    throw new Error('Nessun file selezionato.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Il file è troppo grande. La dimensione massima è ${MAX_FILE_SIZE_MB} MB.`);
  }

  // 2. Ottieni il token di accesso di Outseta per l'autenticazione.
  const outsetaToken = await window.Outseta.getAccessToken();
  if (!outsetaToken) {
    throw new Error('Impossibile ottenere il token di autenticazione. Effettua nuovamente il login.');
  }

  // 3. Prepara i dati da inviare usando FormData, ideale per i file.
  const submissionData = new FormData();
  // Passiamo il token, i dati del form e il prompt scelto come campi separati.
  submissionData.append('outsetaToken', outsetaToken);
  submissionData.append('formData', JSON.stringify(companyData));
  submissionData.append('promptName', promptName); // <-- MODIFICA: Aggiunto il nome del prompt
  submissionData.append('file', file);

  // 4. Esegui la chiamata alla nostra singola API intelligente.
  const response = await fetch('/api/start-checkup', {
    method: 'POST',
    body: submissionData,
    // NOTA: Non impostare l'header 'Content-Type' quando usi FormData con fetch,
    // il browser lo farà per te nel modo corretto, includendo il 'boundary'.
  });

  const result = await response.json();
  if (!response.ok) {
    // Se la risposta non è OK, lancia un errore con il messaggio dal server.
    // Gestisce sia errori stringa che oggetti errore.
    const errorMessage = result.error === 'LIMIT_REACHED' ? 'LIMIT_REACHED' : (result.error || `Si è verificato un errore (status: ${response.status})`);
    throw new Error(errorMessage);
  }

  return result;
}

export const api = {
  startCheckupProcess,
};
