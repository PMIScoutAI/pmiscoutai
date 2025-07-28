// /pages/api/analyze-pdf.js
// VERSIONE 2: Aggiornato per usare il prompt V2 e salvare i nuovi dati.

import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let sessionId = '';
  
  try {
    // Le sezioni da 1 a 6 rimangono invariate (Autenticazione, Download, Parsing etc.)
    // ... (codice di autenticazione, recupero sessione, download PDF, parsing) ...
    const { session_id } = req.body;
    sessionId = session_id;
    if (!sessionId) return res.status(400).json({ error: 'session_id è richiesto' });
    const { data: pdfData } = await supabase.storage.from('checkup-documents').download(`public/${sessionId}/nome_file.pdf`); // Semplificato
    const pdfBuffer = await pdfData.arrayBuffer();
    const pdfResult = await pdfParse(Buffer.from(pdfBuffer));
    let extractedText = pdfResult.text.replace(/\s+/g, ' ').trim().substring(0, 4000);
    // ...

    // 7. Recupera prompt AI (MODIFICA QUI)
    console.log(`[${sessionId}] Recupero prompt V2...`);
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2') // <-- MODIFICA: Usiamo il nuovo prompt V2
      .single();

    if (promptError) {
      throw new Error(`Prompt V2 non trovato: ${promptError.message}`);
    }

    // 8. Analisi GPT (invariata)
    console.log(`[${sessionId}] 🤖 Chiamata OpenAI GPT con prompt V2...`);
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
    console.log(`[${sessionId}] ✅ Analisi GPT V2 completata`);

    // 9. Salva risultati (MODIFICA QUI)
    console.log(`[${sessionId}] Salvataggio risultati V2...`);
    const { error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        session_id: sessionId,
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

    // 10. Aggiorna sessione a completata (invariato)
    await supabase.from('checkup_sessions').update({ status: 'completed' }).eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi V2 completata con successo!`);
    return res.status(200).json({ success: true, sessionId: sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore analisi:`, error);
    if (sessionId) {
      await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message, sessionId: sessionId || null });
  }
}
