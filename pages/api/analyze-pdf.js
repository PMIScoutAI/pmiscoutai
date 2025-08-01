// /pages/api/analyze-pdf.js
// VERSIONE 6: Sostituzione di `canvas` con `skia-canvas`
// - Rimosso `canvas` per risolvere i problemi di build su Vercel.
// - Introdotto `skia-canvas`, un'alternativa basata su WebAssembly senza dipendenze di sistema.
// - Aggiornata la logica di creazione del canvas per essere compatibile con la nuova libreria.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
// NUOVA DIPENDENZA: skia-canvas invece di canvas
import { Canvas } from 'skia-canvas';

// Helper per renderizzare una pagina PDF, aggiornato per skia-canvas
class NodeCanvasFactory {
  create(width, height) {
    // La sintassi cambia leggermente: new Canvas() invece di createCanvas()
    const canvas = new Canvas(width, height);
    const context = canvas.getContext('2d');
    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

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

    console.log(`[${sessionId}] Download del PDF da Supabase...`);
    const { data: files, error: listError } = await supabase.storage.from('checkup-documents').list(`public/${sessionId}`);
    if (listError || !files || files.length === 0) throw new Error('Nessun file trovato');
    const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf')) || files[0];
    const { data: pdfData, error: downloadError } = await supabase.storage.from('checkup-documents').download(`public/${sessionId}/${pdfFile.name}`);
    if (downloadError) throw new Error(`Errore download: ${downloadError.message}`);

    const pdfBuffer = await pdfData.arrayBuffer();

    console.log(`[${sessionId}] Conversione delle pagine PDF in immagini con skia-canvas...`);
    const loadingTask = pdfjsLib.getDocument(new Uint8Array(pdfBuffer));
    const pdfDocument = await loadingTask.promise;
    const imageBase64Strings = [];
    
    const numPagesToProcess = Math.min(pdfDocument.numPages, 7);

    for (let i = 1; i <= numPagesToProcess; i++) {
      const page = await pdfDocument.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvasFactory = new NodeCanvasFactory();
      const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvasFactory: canvasFactory,
      };

      await page.render(renderContext).promise;
      const imageBase64 = (await canvas.toBuffer('image/jpeg')).toString('base64');
      imageBase64Strings.push(imageBase64);
      console.log(`[${sessionId}] Pagina ${i} convertita in immagine.`);
    }
    
    console.log(`[${sessionId}] Recupero prompt...`);
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2')
      .single();

    if (promptError) throw new Error(`Prompt non trovato: ${promptError.message}`);
    
    const userMessages = [
        { type: 'text', text: promptData.prompt_template + "\n\nANALIZZA LE SEGUENTI IMMAGINI DELLE PAGINE DI BILANCIO:" }
    ];

    imageBase64Strings.forEach(base64 => {
        userMessages.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: "high"
            }
        });
    });

    console.log(`[${sessionId}] 🤖 Chiamata OpenAI GPT-4o con Vision...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Sei un analista finanziario esperto. Analizza le immagini fornite e rispondi SOLO in formato JSON valido.' },
        { role: 'user', content: userMessages }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096 
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    console.log(`[${sessionId}] ✅ Analisi Vision completata`);

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

    if (saveError) throw new Error(`Errore salvataggio: ${saveError.message}`);

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
