// /utils/api.js
// MODIFICA: Aggiunta funzione startCheckup() per gestire form + upload PDF
// Mantiene semplicità esistente + nuova funzione per il flusso completo Check-UP AI

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
 const response = await fetch('/api/start-checkup', {
   method: 'POST',
   headers: {
     'Authorization': `Bearer ${outsetaToken}`,
   },
 });

 const result = await response.json();
 if (!response.ok) {
   throw new Error(result.error || `Si è verificato un errore (status: ${response.status})`);
 }

 return result;
}

/**
* NUOVO: Avvia il Check-UP AI completo con form data + upload PDF
* @param {FormData} formData - Dati del form (companyName, vatNumber, pdfFile)
* @returns {Promise<object>} Risultato con sessionId per redirect
*/
async function startCheckup(formData) {
 // 1. Ottieni il token Outseta
 const outsetaToken = await window.Outseta.getAccessToken();
 if (!outsetaToken) {
   throw new Error('Impossibile ottenere il token di autenticazione. Effettua nuovamente il login.');
 }

 // 2. Chiama API estesa con FormData
 const response = await fetch('/api/start-checkup', {
   method: 'POST',
   headers: {
     'Authorization': `Bearer ${outsetaToken}`,
     // NON aggiungere Content-Type per FormData - il browser lo gestisce automaticamente
   },
   body: formData
 });

 const result = await response.json();
 if (!response.ok) {
   throw new Error(result.error || `Si è verificato un errore (status: ${response.status})`);
 }

 return result;
}

export const api = {
 syncUserOnly,
 startCheckup, // NUOVO
};
