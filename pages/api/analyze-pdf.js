// /pages/api/analyze-pdf.js
// VERSIONE 3: Corretta l'estrazione del testo dal PDF.
// - Aumentato il limite di caratteri da 4.000 a 30.000 per inviare il testo completo del bilancio.
// - Modificata la logica di pulizia del testo per preservare gli "a capo" (\n), mantenendo la struttura delle tabelle.

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
    const authHeader = req.headers.authorization;
    const providedSecret = authHeader?.split('Bearer ')[1];
    if (!providedSecret || providedSecret !== process.env.INTERNAL_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { session_id } = req.body;
    sessionId = session_id;
    if (!sessionId) return res.status(400).json({ error: 'session_id è richiesto' });

    await supabase.from('checkup_sessions').update({ status: 'processing' }).eq('id', sessionId);

    const { data: files, error: listError } = await supabase.storage.from('checkup-documents').list(`public/${sessionId}`);
    if (listError || !files || files.length === 0) throw new Error('Nessun file trovato');
    const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf')) || files[0];
    const { data: pdfData, error: downloadError } = await supabase.storage.from('checkup-documents').download(`public/${sessionId}/${pdfFile.name}`);
    if (downloadError) throw new Error(`Errore download: ${downloadError.message}`);

    const pdfBuffer = await pdfData.arrayBuffer();
    const pdfResult = await pdfParse(Buffer.from(pdfBuffer));
    
    // --- INIZIO MODIFICHE CRITICHE ---
    
    // VECCHIA VERSIONE (PROBLEMATICA):
    // let extractedText = pdfResult.text.replace(/\s+/g, ' ').trim().substring(0, 4000);

    // NUOVA VERSIONE CORRETTA:
    // 1. Preserviamo gli "a capo" (\n) per mantenere la struttura delle tabelle, fondamentale per l'AI.
    // 2. Riduciamo solo gli spazi multipli sulla stessa riga.
    // 3. Aumentiamo il limite di caratteri a 30.000 per assicurare che l'intero bilancio venga inviato.
    const textWithLineBreaks = pdfResult.text.replace(/(\r\n|\n|\r)/gm, "\n");
    const extractedText = textWithLineBreaks.replace(/ {2,}/g, ' ').trim().substring(0, 30000);

    // --- FINE MODIFICHE CRITICHE ---
    
    console.log(`[${sessionId}] Recupero prompt V2...`); // Nota: il nome del prompt è rimasto V2, ma la logica è aggiornata
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2') // Assicurati che questo sia il nome del prompt v8.1 in Supabase
      .single();

    if (promptError) {
      throw new Error(`Prompt V2 non trovato: ${promptError.message}`);
    }

    console.log(`[${sessionId}] 🤖 Chiamata OpenAI GPT con prompt V2 e testo corretto...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sei un analista finanziario esperto. Rispondi SOLO in formato JSON valido.' },
        { role: 'user', content: promptData.prompt_template + `\n\nBILANCIO DA ANALIZZARE:\n${extractedText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4096 // Aumentato per gestire output più grandi
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    console.log(`[${sessionId}] ✅ Analisi GPT V2 completata`);

    console.log(`[${sessionId}] Salvataggio risultati V2...`);
    const { error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        session_id: sessionId,
        health_score: analysisResult.health_score || 0,
        summary: analysisResult.summary || '',
        key_metrics: analysisResult.key_metrics || {},
        swot: analysisResult.swot || {}, // Questo campo potrebbe essere obsoleto se usi solo detailed_swot
        recommendations: analysisResult.recommendations || [],
        raw_ai_response: analysisResult,
        charts_data: analysisResult.charts_data || {},
        detailed_swot: analysisResult.detailed_swot || {},
        risk_analysis: analysisResult.risk_analysis || [],
        pro_features_teaser: analysisResult.pro_features_teaser || {}
      });

    if (saveError) {
      throw new Error(`Errore salvataggio V2: ${saveError.message}`);
    }

    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);

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
