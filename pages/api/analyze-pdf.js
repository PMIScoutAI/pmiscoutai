// pages/api/analyze-pdf.js
// Versione potenziata con fallback, validazione, log diagnostici e salvataggio esteso

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import { Canvas } from 'skia-canvas';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

class NodeCanvasFactory {
  create(width, height) {
    const canvas = new Canvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getPageImageAsBase64(pdfDocument, pageNumber) {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 3.0 });
  const canvasFactory = new NodeCanvasFactory();
  const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
  const renderContext = { canvasContext: context, viewport, canvasFactory };
  await page.render(renderContext).promise;
  return (await canvas.toBuffer('image/jpeg')).toString('base64');
}

async function extractDataWithVision(imageBase64, prompt) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `Estrai i dati finanziari dall'immagine fornita e rispondi solo con un oggetto JSON valido.` },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.0
  });

  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch (e) {
    console.error('❌ Vision output malformato:', completion.choices[0].message.content);
    throw new Error('Errore parsing JSON da Vision');
  }
}

function validateExtractedData(data) {
  const fields = [
    'total_assets_current', 'total_assets_previous',
    'total_debt_current', 'total_debt_previous',
    'net_equity_current', 'net_equity_previous',
    'revenue_current', 'revenue_previous'
  ];
  const missing = [];
  for (const field of fields) {
    const value = data[field];
    if (value === null || isNaN(Number(value))) {
      missing.push(field);
    }
  }
  return missing;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

    const { data: files } = await supabase.storage.from('checkup-documents').list(`public/${sessionId}`);
    const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf')) || files[0];
    const { data: pdfData } = await supabase.storage.from('checkup-documents').download(`public/${sessionId}/${pdfFile.name}`);
    const pdfBuffer = await pdfData.arrayBuffer();
    const pdfDocument = await pdfjsLib.getDocument(new Uint8Array(pdfBuffer)).promise;

    let spPageNum = -1, cePageNum = -1;
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const lowerText = textContent.items.map(item => item.str).join(' ').toLowerCase();
      if (spPageNum === -1 && lowerText.includes('stato patrimoniale') && lowerText.includes('totale attivo')) spPageNum = i;
      if (cePageNum === -1 && lowerText.includes('conto economico') && (lowerText.includes('valore della produzione') || lowerText.includes('ricavi delle vendite'))) cePageNum = i;
      if (spPageNum !== -1 && cePageNum !== -1) break;
    }
    if (spPageNum === -1 || cePageNum === -1) throw new Error('Pagine chiave non trovate');

    const spImage = await getPageImageAsBase64(pdfDocument, spPageNum);
    const ceImage = await getPageImageAsBase64(pdfDocument, cePageNum);
    const spRawText = (await (await pdfDocument.getPage(spPageNum)).getTextContent()).items.map(i => i.str).join(' ');
    const ceRawText = (await (await pdfDocument.getPage(cePageNum)).getTextContent()).items.map(i => i.str).join(' ');

    const spPrompt = `Estrai i dati dall'immagine usando la struttura JSON. Se non chiaro, usa il testo:
"""
${spRawText}
"""`;
    const cePrompt = `Estrai i dati dall'immagine usando la struttura JSON. Se non chiaro, usa il testo:
"""
${ceRawText}
"""`;

    let spData = await extractDataWithVision(spImage, spPrompt);
    let ceData = await extractDataWithVision(ceImage, cePrompt);
    let extractedRawData = { ...spData, ...ceData };

    const missingFields = validateExtractedData(extractedRawData);

    if (missingFields.length > 0) {
      console.warn(`[${sessionId}] ⚠️ Campi mancanti o null:`, missingFields);
    }

    const { data: promptData } = await supabase.from('ai_prompts').select('prompt_template').eq('name', 'FINANCIAL_ANALYSIS_V2').single();
    const finalPrompt = `${promptData.prompt_template}\n\nUSA ESCLUSIVAMENTE I SEGUENTI DATI:\n${JSON.stringify(extractedRawData)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Sei un analista finanziario esperto.' },
        { role: 'user', content: finalPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096
    });

    const analysisResult = JSON.parse(completion.choices[0].message.content);

    await supabase.from('analysis_results').insert({
      session_id: sessionId,
      health_score: analysisResult.health_score || 0,
      summary: analysisResult.summary || '',
      key_metrics: analysisResult.key_metrics || {},
      recommendations: analysisResult.recommendations || [],
      raw_ai_response: analysisResult,
      charts_data: analysisResult.charts_data || {},
      detailed_swot: analysisResult.detailed_swot || {},
      risk_analysis: analysisResult.risk_analysis || [],
      pro_features_teaser: analysisResult.pro_features_teaser || {},
      raw_text_reference: { stato_patrimoniale: spRawText, conto_economico: ceRawText },
      vision_output: { sp: spData, ce: ceData },
      missing_fields: missingFields
    });

    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    return res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore analisi:`, error);
    if (sessionId) await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    return res.status(500).json({ error: error.message, sessionId });
  }
}
