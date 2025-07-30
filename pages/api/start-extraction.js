// /pages/api/start-extraction.js
// FASE 1 del nuovo flusso di analisi.
// Questo endpoint riceve il PDF, crea una sessione e chiama l'AI
// SOLO per estrarre i dati numerici grezzi.
// Restituisce i dati estratti e un ID di sessione al frontend
// per popolare il popup di verifica.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

// Prompt specifico per la SOLA estrazione dei dati
const EXTRACTION_PROMPT = `
  Sei un ragioniere esperto nell'estrazione di dati da bilanci italiani.
  Analizza il testo fornito e restituisci ESCLUSIVAMENTE un oggetto JSON con questa struttura,
  popolando i valori per 'current_year' e 'previous_year' con i numeri esatti che trovi nelle tabelle di bilancio.
  Se un valore non esiste, usa null.

  {
    "revenue": { "previous_year": null, "current_year": null },
    "circulating_assets": { "previous_year": null, "current_year": null },
    "short_term_debt": { "previous_year": null, "current_year": null },
    "total_debt": { "previous_year": null, "current_year": null },
    "net_equity": { "previous_year": null, "current_year": null }
  }
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Autenticazione e gestione utente
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante.' });
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, { headers: { Authorization: `Bearer ${outsetaToken}` } });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido.' });
    const outsetaUser = await outsetaResponse.json();
    const { data: userId } = await supabase.rpc('get_or_create_user', { p_outseta_id: outsetaUser.Uid, p_email: outsetaUser.Email, p_first_name: outsetaUser.FirstName, p_last_name: outsetaUser.LastName });

    // 2. Parsing del form e del file
    const form = formidable({ maxFileSize: 5 * 1024 * 1024, filter: ({ mimetype }) => mimetype && mimetype.includes('pdf') });
    const [fields, files] = await form.parse(req);
    const companyName = fields.companyName?.[0];
    const pdfFile = files.pdfFile?.[0];
    if (!companyName || !pdfFile) throw new Error('Dati mancanti.');

    // 3. Creazione della sessione e upload file
    const { data: company } = await supabase.from('companies').upsert({ user_id: userId, company_name: companyName }, { onConflict: 'user_id' }).select().single();
    const { data: session, error: sessionError } = await supabase.from('checkup_sessions').insert({ 
        user_id: userId, 
        company_id: company.id, 
        status: 'extracting', // Nuovo stato iniziale
        session_name: `Check-UP ${companyName} - ${new Date().toLocaleDateString('it-IT')}`
    }).select().single();
    if(sessionError) throw new Error(sessionError.message);

    const fileName = `${session.id}_${pdfFile.originalFilename}`;
    const fileBuffer = fs.readFileSync(pdfFile.filepath);
    await supabase.storage.from('checkup-documents').upload(`public/${session.id}/${fileName}`, fileBuffer, { contentType: 'application/pdf', upsert: true });

    // 4. Estrazione del testo dal PDF
    const pdfResult = await pdfParse(fileBuffer);
    const extractedText = pdfResult.text.replace(/\s+/g, ' ').trim().substring(0, 8000);

    // 5. Chiamata AI per la SOLA estrazione dati
    console.log(`[${session.id}] 🤖 Chiamata OpenAI per estrazione dati...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: `BILANCIO DA CUI ESTRARRE I DATI:\n${extractedText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const extractedData = JSON.parse(completion.choices[0].message.content);
    console.log(`[${session.id}] ✅ Dati grezzi estratti con successo`);

    // 6. Restituzione dei dati al frontend per la verifica
    return res.status(200).json({ 
        success: true, 
        sessionId: session.id,
        extractedData: extractedData 
    });

  } catch (error) {
    console.error('💥 Errore durante l\'estrazione:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
