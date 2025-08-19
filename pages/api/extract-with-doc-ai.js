// /api/extract-with-doc-ai.js
// Questo endpoint riceve un file PDF, lo invia al processore personalizzato di Document AI
// e restituisce i dati strutturati estratti.

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import formidable from 'formidable';
import fs from 'fs';

// --- CONFIGURAZIONE ---
const gcloudProjectId = process.env.GCLOUD_PROJECT_ID;
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
const location = 'eu'; // Assicurati che sia la stessa regione del tuo processore

// --- FIX: Inizializzazione Corretta del Client per Vercel ---
// Leggiamo esplicitamente le credenziali dalla variabile d'ambiente.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    throw new Error("La variabile d'ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON non è impostata.");
}
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const docAiClient = new DocumentProcessorServiceClient({ credentials });


// --- FUNZIONI HELPER (invariate) ---
function parseFinancialNumber(textValue) {
    if (!textValue) return null;
    const cleanedValue = textValue
        .replace(/\s/g, '')
        .replace('(', '-')
        .replace(')', '')
        .replace(/\./g, '')
        .replace(',', '.');
    const number = parseFloat(cleanedValue);
    return isNaN(number) ? null : number;
}


// --- GESTIONE API (invariata) ---
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
        const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
        const [fields, files] = await form.parse(req);
        const pdfFile = files.pdfFile?.[0];

        if (!pdfFile) {
            return res.status(400).json({ error: 'File PDF mancante.' });
        }

        const fileContent = fs.readFileSync(pdfFile.filepath);
        const encodedDocument = Buffer.from(fileContent).toString('base64');

        const processorName = `projects/${gcloudProjectId}/locations/${location}/processors/${processorId}`;
        const request = {
            name: processorName,
            rawDocument: {
                content: encodedDocument,
                mimeType: 'application/pdf',
            },
        };

        console.log(`[DocAI] Invio del documento al processore: ${processorId}`);
        const [result] = await docAiClient.processDocument(request);
        const { entities } = result.document;

        console.log(`[DocAI] Estrazione completata. Trovate ${entities.length} entità.`);
        const extractedData = {};
        for (const entity of entities) {
            extractedData[entity.type] = parseFinancialNumber(entity.mentionText);
        }

        console.log('[DocAI] Dati puliti:', extractedData);
        res.status(200).json({ success: true, data: extractedData });

    } catch (error) {
        console.error('💥 Errore fatale in extract-with-doc-ai:', error);
        res.status(500).json({ error: 'Errore interno del server durante l\'estrazione dei dati.' });
    }
}
