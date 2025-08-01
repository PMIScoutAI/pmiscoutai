// /pages/api/analyze-pdf.js
// VERSIONE COMPLETA CON PARSING TESTUALE + VISION + COLONNA raw_parsed_data ESTESA

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import { Canvas } from 'skia-canvas';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

function parseFinancialsFromText(spText, ceText) {
  const extract = (regex, text) => {
    const match = text.match(regex);
    if (!match) return null;
    const value = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    return isNaN(value) ? null : value;
  };

  const revenue_current = extract(/ricavi.*?([\d.,]+)/i, ceText);
  const revenue_previous = extract(/ricavi.*?(?:\d[\d.,]+)[^\d]+([\d.,]+)/i, ceText); // seconda colonna
  const total_assets = extract(/totale attivo[^0-9]*([\d.,]+)/i, spText);
  const total_debt = extract(/debiti[^0-9]*([\d.,]+)/i, spText);
  const net_equity = extract(/patrimonio netto[^0-9]*([\d.,]+)/i, spText);
  const current_assets = extract(/attivo circolante[^0-9]*([\d.,]+)/i, spText);
  const short_term_debt = extract(/debiti.*?entro.*?(?:\d[\d.,]+)[^\d]+([\d.,]+)/i, spText);

  const current_ratio = (current_assets && short_term_debt) ? current_assets / short_term_debt : null;
  const revenue_growth = (revenue_current && revenue_previous) ? ((revenue_current - revenue_previous) / revenue_previous) * 100 : null;
  const debt_equity = (net_equity && net_equity !== 0) ? total_debt / net_equity : null;

  return {
    revenue_current,
    revenue_previous,
    total_assets,
    total_debt,
    net_equity,
    current_assets,
    short_term_debt,
    current_ratio,
    revenue_growth,
    debt_equity
  };
}

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
      { role: 'system', content: 'Estrai i dati dall\'immagine fornita e rispondi solo con un oggetto JSON valido.' },
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
    throw new Error('Errore parsing JSON da Vision');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let sessionId = '';
  try {
    const authHeader = req.headers.authorization;
    const providedSecret = authHeader?.split('Bearer ')[1];
    if (!providedSecret || providedSecret !== process.env.INTERNAL_SECRET)
      return res.status(401).json({ error: 'Unauthorized' });

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
      const text = (await page.getTextContent()).items.map(item => item.str).join(' ').toLowerCase();
      if (spPageNum === -1 && text.includes('stato patrimoniale')) spPageNum = i;
      if (cePageNum === -1 && text.includes('conto economico')) cePageNum = i;
      if (spPageNum !== -1 && cePageNum !== -1) break;
    }

    const spPage = await pdfDocument.getPage(spPageNum);
    const cePage = await pdfDocument.getPage(cePageNum);
    const spText = (await spPage.getTextContent()).items.map(i => i.str).join(' ');
    const ceText = (await cePage.getTextContent()).items.map(i => i.str).join(' ');

    const parsedData = parseFinancialsFromText(spText, ceText);

    const spImg = await getPageImageAsBase64(pdfDocument, spPageNum);
    const ceImg = await getPageImageAsBase64(pdfDocument, cePageNum);

    const spPrompt = `Estrai i dati JSON da questa pagina di stato patrimoniale:\n${spText}`;
    const cePrompt = `Estrai i ricavi da questa pagina di conto economico:\n${ceText}`;

    const spAI = await extractDataWithVision(spImg, spPrompt);
    const ceAI = await extractDataWithVision(ceImg, cePrompt);

    const extractedData = {
      ...parsedData,
      ...spAI,
      ...ceAI
    };

    const { data: promptData } = await supabase.from('ai_prompts').select('prompt_template').eq('name', 'FINANCIAL_ANALYSIS_V2').single();
    const finalPrompt = promptData.prompt_template + `\n\nUSA SOLO QUESTI DATI:\n${JSON.stringify(extractedData)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Sei un analista finanziario. Rispondi solo in JSON.' },
        { role: 'user', content: finalPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const analysis = JSON.parse(completion.choices[0].message.content);

    await supabase.from('analysis_results').insert({
      session_id: sessionId,
      health_score: analysis.health_score || 0,
      summary: analysis.summary || '',
      key_metrics: analysis.key_metrics || {},
      recommendations: analysis.recommendations || [],
      raw_ai_response: analysis,
      charts_data: analysis.charts_data || {},
      detailed_swot: analysis.detailed_swot || {},
      risk_analysis: analysis.risk_analysis || [],
      pro_features_teaser: analysis.pro_features_teaser || {},
      raw_parsed_data: parsedData || {}
    });

    await supabase.from('checkup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);

    res.status(200).json({ success: true, sessionId });

  } catch (error) {
    console.error('Errore:', error);
    if (sessionId) {
      await supabase.from('checkup_sessions').update({ status: 'failed', error_message: error.message }).eq('id', sessionId);
    }
    res.status(500).json({ error: error.message });
  }
}
