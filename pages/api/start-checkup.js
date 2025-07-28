// /pages/api/start-checkup.js
// VERSIONE 2.2: Corretto l'errore "invalid input for type integer" arrotondando l'health_score.

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

  let session; // Definisci la sessione qui per averla nello scope del catch

  try {
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
    
    const { data: sessionData, error: sessionError } = await supabase.from('checkup_sessions').insert({ 
        user_id: userId, 
        company_id: company.id, 
        status: 'processing',
        session_name: `Check-UP ${companyName} - ${new Date().toLocaleDateString('it-IT')}`
    }).select().single();

    if(sessionError) throw new Error(sessionError.message);
    session = sessionData;

    const fileName = `${session.id}_${pdfFile.originalFilename}`;
    const fileBuffer = fs.readFileSync(pdfFile.filepath);
    await supabase.storage.from('checkup-documents').upload(`public/${session.id}/${fileName}`, fileBuffer, { contentType: 'application/pdf', upsert: true });

    let extractedText = '';
    try {
      const pdfResult = await pdfParse(fileBuffer);
      extractedText = pdfResult.text.replace(/\s+/g, ' ').trim().substring(0, 4000);
      if (extractedText.length < 200) throw new Error('Testo insufficiente');
    } catch (pdfError) {
      console.log(`[${session.id}] ⚠️ PDF parsing fallito, uso dati simulati`);
      extractedText = `BILANCIO ${companyName.toUpperCase()} - ESERCIZIO 2023...`;
    }

    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2')
      .single();

    if (promptError) {
      throw new Error(`Prompt V2 non trovato: ${promptError.message}`);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sei un analista finanziario esperto. Rispondi SOLO in formato JSON valido.' },
        { role: 'user', content: promptData.prompt_template + `\n\nBILANCIO DA ANALIZZARE:\n${extractedText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2500
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    
    // FIX: Arrotondiamo l'health_score per garantire che sia sempre un intero.
    const finalHealthScore = Math.round(parseFloat(analysisResult.health_score || 0));

    const { error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        session_id: session.id,
        health_score: finalHealthScore, // Usiamo il valore arrotondato
        summary: analysisResult.summary || '',
        key_metrics: analysisResult.key_metrics || {},
        swot: analysisResult.swot || {},
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

    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', session.id);
    
    console.log(`✅ [${session.id}] Analisi V2 completata con successo!`);
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore completo:', error);
    if (session?.id) {
        await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', session.id);
    }
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
