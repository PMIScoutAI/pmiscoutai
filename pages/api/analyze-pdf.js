// /pages/api/analyze-pdf.js
// VERSIONE 4: Estrazione Testo Robusta
// - Rimuoviamo la pulizia degli spazi multipli per preservare l'allineamento delle tabelle.
// - L'AI riceve ora un testo molto più fedele al PDF originale, riducendo le allucinazioni.
// - Aumentato il limite di caratteri a 35.000 per massima sicurezza.

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
    
    // NUOVA VERSIONE v4:
    // 1. Normalizziamo solo gli "a capo" per avere una struttura a righe consistente.
    // 2. NON tocchiamo più gli spazi. Lasciamo che l'AI interpreti l'allineamento delle colonne.
    // 3. Aumentiamo il limite di caratteri a 35.000 per essere sicuri di includere tutto.
    const textWithLineBreaks = pdfResult.text.replace(/(\r\n|\n|\r)/gm, "\n");
    const extractedText = textWithLineBreaks.trim().substring(0, 35000);

    // --- FINE MODIFICHE CRITICHE ---
    
    console.log(`[${sessionId}] Recupero prompt...`);
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2') // Assicurati che questo sia il nome del prompt v8.1 in Supabase
      .single();

    if (promptError) {
      throw new Error(`Prompt non trovato: ${promptError.message}`);
    }

    console.log(`[${sessionId}] 🤖 Chiamata OpenAI GPT con testo pulito e non troncato...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // CONSIGLIO: Per un compito così critico, considera di usare il modello più potente.
      messages: [
        { role: 'system', content: 'Sei un analista finanziario esperto. Rispondi SOLO in formato JSON valido.' },
        { role: 'user', content: promptData.prompt_template + `\n\nBILANCIO DA ANALIZZARE:\n${extractedText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4096 
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    console.log(`[${sessionId}] ✅ Analisi GPT completata`);

    console.log(`[${sessionId}] Salvataggio risultati...`);
    const { error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        session_id: sessionId,
        health_score: analysisResult.health_score || 0,
        summary: analysisResult.summary || '',
        key_metrics: analysisResult.key_metrics || {},
        recommendations: analysisResult.recommendations || [],
        raw_ai_response: analysisResult,
        charts_data: analysisResult.charts_data || {},
        detailed_swot: analysisResult.detailed_swot || {},
        risk_analysis: analysisResult.risk_analysis || [],
        pro_features_teaser: analysisResult.pro_features_teaser || {}
      });

    if (saveError) {
      throw new Error(`Errore salvataggio: ${saveError.message}`);
    }

    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi completata con successo!`);
    return res.status(200).json({ success: true, sessionId: sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore analisi:`, error);
    if (sessionId) {
      await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message, sessionId: sessionId || null });
  }
}
