// /pages/api/analyze-pdf.js
// VERSIONE DEFINITIVA: Implementa un flusso robusto a due fasi (Estrazione -> Analisi).

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

// Inizializzazione client Supabase e OpenAI
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
    const viewport = page.getViewport({ scale: 3.0 }); // Alta risoluzione
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

// Funzione helper per una chiamata Vision mirata e robusta
async function extractDataWithVision(imageBase64, prompt) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
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

    try {
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        console.error('❌ Vision output malformato:', completion.choices[0].message.content);
        throw new Error('Errore parsing JSON da Vision');
    }
}


// Handler principale dell'API
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let sessionId = '';
  
  try {
    // 1. Autenticazione e Setup
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
    
    // 2. Identificazione Pagine Chiave
    console.log(`[${sessionId}] Identificazione pagine chiave...`);
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

    // Controllo di sicurezza fondamentale
    if (spPageNum === -1 || cePageNum === -1) {
        throw new Error(`Impossibile identificare le pagine necessarie. Stato Patrimoniale: ${spPageNum}, Conto Economico: ${cePageNum}`);
    }
    console.log(`[${sessionId}] Pagine identificate -> Stato Patrimoniale: ${spPageNum}, Conto Economico: ${cePageNum}`);

    // 3. ESTRAZIONE DATI CON AI (Metodo Ibrido)
    console.log(`[${sessionId}] Estrazione dati mirata con Vision (Ibrido)...`);
    
    const spImage = await getPageImageAsBase64(pdfDocument, spPageNum);
    const ceImage = await getPageImageAsBase64(pdfDocument, cePageNum);

    const spPage = await pdfDocument.getPage(spPageNum);
    const spRawText = (await spPage.getTextContent()).items.map(i => i.str).join(' ');

    const cePage = await pdfDocument.getPage(cePageNum);
    const ceRawText = (await cePage.getTextContent()).items.map(i => i.str).join(' ');

    const spPromptHybrid = `Estrai i dati dall'immagine usando la struttura JSON fornita. Usa l'immagine come fonte primaria. Se un dato non è chiaro nell'immagine, usa il testo grezzo fornito come riferimento per trovarlo.

**Testo Grezzo di Riferimento:**
"""
${spRawText}
"""

**Formato JSON di Output (solo numeri):**
{
  "total_assets_current": ...,
  "total_assets_previous": ...,
  "total_debt_current": ...,
  "total_debt_previous": ...,
  "net_equity_current": ...,
  "net_equity_previous": ...
}`;
    
    const cePromptHybrid = `Estrai i dati dall'immagine usando la struttura JSON fornita. Usa l'immagine come fonte primaria. Se un dato non è chiaro nell'immagine, usa il testo grezzo fornito come riferimento per trovarlo.

**Testo Grezzo di Riferimento:**
"""
${ceRawText}
"""

**Formato JSON di Output (solo numeri):**
{
  "revenue_current": ...,
  "revenue_previous": ...
}`;

    const spData = await extractDataWithVision(spImage, spPromptHybrid);
    const ceData = await extractDataWithVision(ceImage, cePromptHybrid);
    
    const extractedData = { ...spData, ...ceData };
    console.log(`[${sessionId}] Dati grezzi estratti e puliti:`, extractedData);

    if (Object.keys(extractedData).length === 0 || !Object.values(extractedData).some(v => v !== null)) {
        throw new Error("L'estrazione dati con Vision non ha prodotto risultati validi.");
    }
    
    // 4. ANALISI FINALE CON AI (su dati puliti)
    console.log(`[${sessionId}] Analisi finale su dati puliti...`);
    const { data: promptData, error: promptError } = await supabase.from('ai_prompts').select('prompt_template').eq('name', 'FINANCIAL_ANALYSIS_V2').single();
    if (promptError) throw new Error(`Prompt non trovato: ${promptError.message}`);

    const finalPrompt = promptData.prompt_template + `\n\nUSA ESCLUSIVAMENTE I SEGUENTI DATI NUMERICI PRE-ESTRATTI PER ESEGUIRE L'ANALISI:\n${JSON.stringify(extractedData)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `Sei un analista finanziario esperto. Usa i dati pre-estratti forniti per eseguire l'analisi e rispondi SOLO in formato JSON valido.` },
        { role: 'user', content: finalPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096 
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    console.log(`[${sessionId}] ✅ Analisi finale completata`);

    // 5. SALVATAGGIO
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
        pro_features_teaser: analysisResult.pro_features_teaser || {},
        // Salva i dati grezzi ESTRATTI dall'AI per debug e coerenza
        raw_parsed_data: extractedData || {}
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
