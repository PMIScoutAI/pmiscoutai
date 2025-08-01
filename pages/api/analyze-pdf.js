// /pages/api/analyze-pdf.js
// VERSIONE 7.3: Correzione Errore di Sintassi per il Deploy
// - Sostituite le virgolette singole/doppie con i backticks (template literals `` ` ``) nelle stringhe di `content` per le chiamate OpenAI.
// - Questa modifica risolve l'errore di sintassi "Expected ',', got 'analisi'" che bloccava il build su Vercel.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import { Canvas } from 'skia-canvas';

// Fix di compatibilità per pdfjs-dist in ambiente Node.js su Vercel.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

// Helper per renderizzare una pagina PDF
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Funzione helper per convertire una pagina specifica in immagine Base64
async function getPageImageAsBase64(pdfDocument, pageNumber) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvasFactory = new NodeCanvasFactory();
    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
    const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvasFactory: canvasFactory,
    };
    await page.render(renderContext).promise;
    return (await canvas.toBuffer('image/jpeg')).toString('base64');
}

// Funzione helper per una chiamata Vision mirata
async function extractDataWithVision(imageBase64, prompt) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            // --- CORREZIONE SINTASSI ---
            { role: 'system', content: `Estrai i dati finanziari dall'immagine fornita e rispondi solo con un oggetto JSON valido.` },
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } }
                ]
            }
        ],
        response_format: { type: "json_object" },
        temperature: 0.0,
    });
    return JSON.parse(completion.choices[0].message.content);
}


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

    console.log(`[${sessionId}] Download del PDF...`);
    const { data: files, error: listError } = await supabase.storage.from('checkup-documents').list(`public/${sessionId}`);
    if (listError || !files || files.length === 0) throw new Error('Nessun file trovato');
    const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf')) || files[0];
    const { data: pdfData, error: downloadError } = await supabase.storage.from('checkup-documents').download(`public/${sessionId}/${pdfFile.name}`);
    if (downloadError) throw new Error(`Errore download: ${downloadError.message}`);
    const pdfBuffer = await pdfData.arrayBuffer();
    
    const pdfDocument = await pdfjsLib.getDocument(new Uint8Array(pdfBuffer)).promise;
    
    // FASE 1: IDENTIFICA LE PAGINE CHIAVE
    console.log(`[${sessionId}] FASE 1: Identificazione pagine chiave...`);
    let spPageNum = -1, cePageNum = -1;
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const lowerPageText = textContent.items.map(item => item.str).join(' ').toLowerCase();
        
        if (spPageNum === -1 && lowerPageText.includes('stato patrimoniale') && lowerPageText.includes('totale attivo')) {
            spPageNum = i;
        }
        if (cePageNum === -1 && lowerPageText.includes('conto economico') && (lowerPageText.includes('valore della produzione') || lowerPageText.includes('ricavi delle vendite'))) {
            cePageNum = i;
        }
        if (spPageNum !== -1 && cePageNum !== -1) break;
    }

    if (spPageNum === -1 || cePageNum === -1) {
        throw new Error(`Impossibile identificare le pagine necessarie. Stato Patrimoniale: ${spPageNum}, Conto Economico: ${cePageNum}`);
    }
    console.log(`[${sessionId}] Pagine identificate -> Stato Patrimoniale: ${spPageNum}, Conto Economico: ${cePageNum}`);

    // FASE 2: ESTRAZIONE MIRATA CON VISION
    console.log(`[${sessionId}] FASE 2: Estrazione dati mirata con Vision...`);
    const spImage = await getPageImageAsBase64(pdfDocument, spPageNum);
    const ceImage = await getPageImageAsBase64(pdfDocument, cePageNum);

    const spData = await extractDataWithVision(spImage, `Estrai 'Totale attivo', 'Totale debiti (D)', e 'Totale patrimonio netto (A)' per l'anno corrente e precedente. Usa le chiavi: total_assets_current, total_assets_previous, total_debt_current, total_debt_previous, net_equity_current, net_equity_previous.`);
    const ceData = await extractDataWithVision(ceImage, `Estrai 'ricavi delle vendite e delle prestazioni' per l'anno corrente e precedente. Usa le chiavi: revenue_current, revenue_previous.`);
    
    const extractedRawData = { ...spData, ...ceData };
    console.log(`[${sessionId}] Dati grezzi estratti:`, extractedRawData);

    // FASE 3: ANALISI FINALE SU DATI PULITI
    console.log(`[${sessionId}] FASE 3: Analisi finale su dati puliti...`);
    const { data: promptData, error: promptError } = await supabase.from('ai_prompts').select('prompt_template').eq('name', 'FINANCIAL_ANALYSIS_V2').single();
    if (promptError) throw new Error(`Prompt non trovato: ${promptError.message}`);

    const finalPrompt = promptData.prompt_template + `\n\nUSA ESCLUSIVAMENTE I SEGUENTI DATI NUMERICI PRE-ESTRATTI PER ESEGUIRE L'ANALISI:\n${JSON.stringify(extractedRawData)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        // --- CORREZIONE SINTASSI ---
        { role: 'system', content: `Sei un analista finanziario esperto. Usa i dati pre-estratti forniti per eseguire l'analisi e rispondi SOLO in formato JSON valido.` },
        { role: 'user', content: finalPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096 
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    console.log(`[${sessionId}] ✅ Analisi finale completata`);

    // --- SALVATAGGIO ---
    console.log(`[${sessionId}] Salvataggio risultati...`);
    const { error: saveError } = await supabase.from('analysis_results').insert({
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
