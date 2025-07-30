// /utils/api.js
// VERSIONE FINALE: Gestisce sia il flusso Veloce che quello Assistito.

/**
 * Chiama la nostra API Vercel per sincronizzare l'utente.
 * @returns {Promise<object>} Il risultato della chiamata API.
 */
async function syncUserOnly() {
    const outsetaToken = await window.Outseta.getAccessToken();
    if (!outsetaToken) {
        throw new Error('Impossibile ottenere il token di autenticazione. Effettua nuovamente il login.');
    }
    // NOTA: Questa chiamata potrebbe dover puntare a un endpoint diverso se 'start-checkup' viene modificato
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
 * FLUSSO VELOCE (ORIGINALE)
 * Avvia il Check-UP AI completo con un'unica chiamata.
 * @param {FormData} formData - Dati del form (companyName, vatNumber, pdfFile)
 * @returns {Promise<object>} Risultato con sessionId per redirect
 */
async function startCheckup(formData) {
    const outsetaToken = await window.Outseta.getAccessToken();
    if (!outsetaToken) {
        throw new Error('Impossibile ottenere il token di autenticazione. Effettua nuovamente il login.');
    }
    const response = await fetch('/api/start-checkup', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${outsetaToken}`,
        },
        body: formData
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `Si è verificato un errore (status: ${response.status})`);
    }
    return result;
}

/**
 * NUOVO - FLUSSO ASSISTITO - FASE 1
 * Chiama il nuovo endpoint per la sola estrazione dei dati grezzi.
 * @param {FormData} formData - Contiene i dati del form e il file PDF.
 * @returns {Promise<object>} - La risposta con sessionId e i dati estratti.
 */
async function startExtraction(formData) {
    const outsetaToken = await window.Outseta.getAccessToken();
    const response = await fetch('/api/start-extraction', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${outsetaToken}`,
        },
        body: formData,
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante l\'estrazione dei dati.');
    }
    return response.json();
}

/**
 * NUOVO - FLUSSO ASSISTITO - FASE 2
 * Chiama il nuovo endpoint per generare il report finale con i dati corretti.
 * @param {object} payload - Contiene session_id e correctedData.
 * @returns {Promise<object>} - La risposta con il finalSessionId per il redirect.
 */
async function generateFinalReport(payload) {
    const outsetaToken = await window.Outseta.getAccessToken();
    const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${outsetaToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante la generazione del report.');
    }
    return response.json();
}


export const api = {
    syncUserOnly,
    startCheckup,
    startExtraction,      // NUOVO
    generateFinalReport,  // NUOVO
};
