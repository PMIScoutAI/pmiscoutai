// /api/extract-with-doc-ai.js
// Questo endpoint riceve un file PDF, lo invia al processore personalizzato di Document AI
// e restituisce i dati strutturati estratti.

import { DocumentProcessorServiceClient } from '@google-cloud/documentai').v1;
import formidable from 'formidable';
import fs from 'fs';

// --- CONFIGURAZIONE ---
// Questi valori vengono letti dalle variabili d'ambiente di Vercel
const gcloudProjectId = process.env.GCLOUD_PROJECT_ID;
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
const location = 'eu'; // Assicurati che sia la stessa regione del tuo processore

// Inizializza il client di Document AI usando le credenziali JSON
// Vercel legge automaticamente la variabile GOOGLE_APPLICATION_CREDENTIALS_JSON
const docAiClient = new DocumentProcessorServiceClient();

// --- FUNZIONI HELPER ---

/**
 * Pulisce una stringa numerica da bilancio e la converte in un numero.
 * @param {string} textValue - Il valore testuale (es. "2.686.879").
 * @returns {number} Il valore numerico (es. 2686879).
 */
function parseFinancialNumber(textValue) {
    if (!textValue) return null;
    // Rimuove spazi, parentesi (per i negativi), punti delle migliaia e converte la virgola
    const cleanedValue = textValue
        .replace(/\s/g, '')
        .replace('(', '-')
        .replace(')', '')
        .replace(/\./g, '')
        .replace(',', '.');
    const number = parseFloat(cleanedValue);
    return isNaN(number) ? null : number;
}


// --- GESTIONE API ---
// Disabilita il bodyParser di Next.js per permettere a formidable di gestire il file
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non permesso' });
    }

    try {
        // 1. Ricevi il file PDF dalla richiesta
        const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
        const [fields, files] = await form.parse(req);
        const pdfFile = files.pdfFile?.[0];

        if (!pdfFile) {
            return res.status(400).json({ error: 'File PDF mancante.' });
        }

        // 2. Leggi il file e convertilo in base64
        const fileContent = fs.readFileSync(pdfFile.filepath);
        const encodedDocument = Buffer.from(fileContent).toString('base64');

        // 3. Prepara la richiesta per Google Document AI
        const processorName = `projects/${gcloudProjectId}/locations/${location}/processors/${processorId}`;
        const request = {
            name: processorName,
            rawDocument: {
                content: encodedDocument,
                mimeType: 'application/pdf',
            },
        };

        console.log(`[DocAI] Invio del documento al processore: ${processorId}`);

        // 4. Chiama il tuo modello personalizzato
        const [result] = await docAiClient.processDocument(request);
        const { entities } = result.document;

        console.log(`[DocAI] Estrazione completata. Trovate ${entities.length} entità.`);

        // 5. Estrai e pulisci i dati in un oggetto semplice
        const extractedData = {};
        for (const entity of entities) {
            // entity.type è il nome dell'etichetta che hai definito (es. "fatturato_anno_corrente")
            // entity.mentionText è il valore che ha trovato (es. "2.686.879")
            extractedData[entity.type] = parseFinancialNumber(entity.mentionText);
        }

        console.log('[DocAI] Dati puliti:', extractedData);

        // 6. Restituisci i dati estratti al frontend
        res.status(200).json({ success: true, data: extractedData });

    } catch (error) {
        console.error('💥 Errore fatale in extract-with-doc-ai:', error);
        res.status(500).json({ error: 'Errore interno del server durante l\'estrazione dei dati.' });
    }
}
