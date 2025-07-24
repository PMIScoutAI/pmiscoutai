// /utils/api.js
// Versione definitiva secondo l'architettura BFF.
// Contiene solo le funzioni per comunicare con le nostre API su Vercel.

// Definiamo un limite massimo per la dimensione del file (es. 5MB)
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Processo completo per avviare un checkup.
 * Questo è l'unico punto di contatto tra il frontend e il nostro backend Vercel.
 * @param {object} companyData - Dati dell'azienda dal form.
 * @param {File} file - Il file PDF da analizzare.
 * @returns {Promise<string>} L'ID della sessione creata.
 */
async function startCheckupProcess(companyData, file) {
  // 1. Validazione client-side
  if (!file) {
    throw new Error('Nessun file selezionato.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Il file è troppo grande. La dimensione massima è ${MAX_FILE_SIZE_MB} MB.`);
  }

  // 2. Ottieni il token di accesso di Outseta per autenticare la nostra richiesta
  const outsetaToken = await window.Outseta.getAccessToken();
  if (!outsetaToken) {
    throw new Error('Impossibile ottenere il token di autenticazione. Effettua nuovamente il login.');
  }

  // --- Step A: Chiama la nostra API per preparare la sessione e ottenere la Signed URL ---
  const startResponse = await fetch('/api/start-checkup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${outsetaToken}`,
    },
    body: JSON.stringify({ companyData, fileName: file.name }),
  });

  const startResult = await startResponse.json();
  if (!startResponse.ok) {
    throw new Error(startResult.error || 'Errore durante la creazione della sessione.');
  }
  const { sessionId, signedUploadUrl } = startResult;

  // --- Step B: Carica il file direttamente su Supabase Storage usando la Signed URL ---
  const uploadResponse = await fetch(signedUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  });

  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.text();
    console.error("Errore di caricamento su Supabase:", uploadError);
    throw new Error('Errore durante il caricamento del file.');
  }

  // --- Step C: Chiama la nostra API per avviare l'analisi AI in background ---
  const triggerResponse = await fetch('/api/trigger-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${outsetaToken}`,
      },
      body: JSON.stringify({ sessionId }),
  });

  if (!triggerResponse.ok) {
      const triggerError = await triggerResponse.json();
      throw new Error(triggerError.error || 'Errore durante l\'avvio dell\'analisi.');
  }

  // Se tutto è andato a buon fine, restituisci l'ID della sessione
  return sessionId;
}

export const api = {
  // L'unica funzione esportata è quella che avvia l'intero processo.
  startCheckupProcess,
};
