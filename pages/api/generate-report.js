// /pages/api/generate-report.js
// FASE 2 del nuovo flusso di analisi.
// Riceve i dati numerici CONFERMATI dall'utente e l'ID della sessione.
// Chiama l'AI con il prompt completo per generare l'analisi qualitativa,
// salva il report finale e restituisce l'ID per il redirect.

import { createClient } from '@supabase/supabase-js';
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
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  let sessionId = '';

  try {
    // 1. Autenticazione e recupero dati dal body
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante.' });
    // Qui puoi aggiungere la verifica del token Outseta se vuoi una sicurezza aggiuntiva

    const { session_id, correctedData } = req.body;
    sessionId = session_id;
    if (!sessionId || !correctedData) {
      return res.status(400).json({ error: 'session_id e correctedData sono richiesti' });
    }

    await supabase.from('checkup_sessions').update({ status: 'generating' }).eq('id', sessionId);

    // 2. Recupero del prompt di analisi completo da Supabase
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V6') // IMPORTANTE: Usa il nome del tuo prompt più recente
      .single();
    if (promptError) throw new Error(`Prompt non trovato: ${promptError.message}`);

    // 3. Costruzione del contesto per l'AI con i dati CONFERMATI
    const contextForAI = `
      Dati Finanziari Verificati (usali come unica fonte per i calcoli):
      ${JSON.stringify(correctedData, null, 2)}
    `;

    // 4. Chiamata AI per l'analisi qualitativa
    console.log(`[${sessionId}] 🤖 Chiamata OpenAI per analisi finale...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: promptData.prompt_template },
        { role: 'user', content: `Genera l'analisi completa basandoti sui seguenti dati finanziari verificati:\n${contextForAI}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2500
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    console.log(`[${sessionId}] ✅ Analisi finale completata`);

    // 5. Salvataggio del report finale nel database
    const finalHealthScore = Math.round(parseFloat(analysisResult.health_score || 0));
    const { error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        session_id: sessionId,
        health_score: finalHealthScore,
        summary: analysisResult.summary || '',
        key_metrics: analysisResult.key_metrics || {},
        raw_ai_response: analysisResult,
        charts_data: analysisResult.charts_data || {},
        detailed_swot: analysisResult.detailed_swot || {},
        risk_analysis: analysisResult.risk_analysis || [],
        pro_features_teaser: analysisResult.pro_features_teaser || {}
      });
    if (saveError) throw new Error(`Errore salvataggio report finale: ${saveError.message}`);

    // 6. Aggiornamento dello stato finale della sessione
    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Report finale generato con successo!`);
    return res.status(200).json({ success: true, finalSessionId: sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore generazione report:`, error);
    if (sessionId) {
      await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message, sessionId: sessionId || null });
  }
}
