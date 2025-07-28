// /pages/api/start-checkup.js
// VERSIONE 2: Aggiornato per usare il prompt V2 e salvare i nuovi dati.

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // Le sezioni da 1 a 7 rimangono invariate (Autenticazione, Parsing, Upload etc.)
    // ... (codice di autenticazione, sync utente, parsing form, creazione azienda/sessione, upload PDF) ...
    
    // --- Esempio semplificato dei passaggi precedenti per chiarezza ---
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante.' });
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, { headers: { Authorization: `Bearer ${outsetaToken}` } });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido.' });
    const outsetaUser = await outsetaResponse.json();
    const { data: userId } = await supabase.rpc('get_or_create_user', { p_outseta_id: outsetaUser.Uid, p_email: outsetaUser.Email, p_first_name: outsetaUser.FirstName, p_last_name: outsetaUser.LastName });
    const form = formidable({ maxFileSize: 5 * 1024 * 1024, filter: ({ mimetype }) => mimetype && mimetype.includes('pdf') });
    const [fields, files] = await form.parse(req);
    const companyName = fields.companyName?.[0];
    const pdfFile = files.pdfFile?.[0];
    if (!companyName || !pdfFile) throw new Error('Dati mancanti.');
    const { data: company } = await supabase.from('companies').upsert({ user_id: userId, company_name: companyName }, { onConflict: 'user_id' }).select().single();
    const { data: session } = await supabase.from('checkup_sessions').insert({ user_id: userId, company_id: company.id, status: 'processing' }).select().single();
    const fileName = `${session.id}_${pdfFile.originalFilename}`;
    const fileBuffer = fs.readFileSync(pdfFile.filepath);
    await supabase.storage.from('checkup-documents').upload(`public/${session.id}/${fileName}`, fileBuffer, { contentType: 'application/pdf', upsert: true });
    // --- Fine esempio semplificato ---


    // 7. ANALISI AI
    let extractedText = '';
    try {
      const pdfResult = await pdfParse(fileBuffer);
      extractedText = pdfResult.text.replace(/\s+/g, ' ').trim().substring(0, 4000);
      if (extractedText.length < 200) throw new Error('Testo insufficiente');
    } catch (pdfError) {
      // Logica di fallback invariata
      console.log(`[${session.id}] ⚠️ PDF parsing fallito, uso dati simulati`);
      extractedText = `BILANCIO ${companyName.toUpperCase()} - ESERCIZIO 2023...`;
    }

    // 8. Prompt AI (MODIFICA QUI)
    console.log(`[${session.id}] Recupero prompt V2...`);
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2') // <-- MODIFICA: Usiamo il nuovo prompt V2
      .single();

    if (promptError) {
      throw new Error(`Prompt V2 non trovato: ${promptError.message}`);
    }

    // 9. Chiamata GPT (invariata)
    console.log(`[${session.id}] 🤖 Chiamata GPT con prompt V2...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sei un analista finanziario esperto. Rispondi SOLO in formato JSON valido.' },
        { role: 'user', content: promptData.prompt_template + `\n\nBILANCIO DA ANALIZZARE:\n${extractedText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2500 // Aumentato leggermente per output più ricco
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    console.log(`[${session.id}] ✅ GPT V2 completato`);

    // 10. Salva risultati (MODIFICA QUI)
    console.log(`[${session.id}] Salvataggio risultati V2...`);
    const { error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        session_id: session.id,
        health_score: analysisResult.health_score || 0,
        summary: analysisResult.summary || '',
        key_metrics: analysisResult.key_metrics || {},
        swot: analysisResult.swot || {}, // Manteniamo il vecchio per retrocompatibilità
        recommendations: analysisResult.recommendations || [],
        raw_ai_response: analysisResult,
        
        // --- NUOVI CAMPI DA SALVARE ---
        charts_data: analysisResult.charts_data || {},
        detailed_swot: analysisResult.detailed_swot || {},
        risk_analysis: analysisResult.risk_analysis || [],
        pro_features_teaser: analysisResult.pro_features_teaser || {}
      });

    if (saveError) {
      throw new Error(`Errore salvataggio V2: ${saveError.message}`);
    }

    // 11. Completa sessione (invariato)
    await supabase.from('checkup_sessions').update({ status: 'completed' }).eq('id', session.id);
    
    // 12. Incrementa contatore (invariato)
    // ...

    console.log(`✅ [${session.id}] Analisi V2 completata con successo!`);
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore completo:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
