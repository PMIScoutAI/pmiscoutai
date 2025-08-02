// /api/analyze-pdf.js
// VERSIONE TEXT-ONLY: Risolve l'errore fatale di Vercel rimuovendo la dipendenza
// problematica (skia-canvas) e passando a un'estrazione basata solo su testo,
// più veloce, economica e affidabile per i PDF di alta qualità.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';

// Fix di compatibilità per pdfjs-dist (non richiede più canvas)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

// Inizializzazione client Supabase e OpenAI
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// --- FUNZIONI DI ESTRAZIONE E VALIDAZIONE (ORA BASATE SU TESTO) ---

/**
 * Valida e pulisce l'output JSON ricevuto dall'AI.
 */
function validateAndCleanOutput(data, expectedFields) {
    console.log('Validating Raw AI Output:', JSON.stringify(data, null, 2));
    const cleaned = {};
    let hasValidData = false;

    for (const field of expectedFields) {
        const rawValue = data[field];
        if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
            const numValue = typeof rawValue === 'string' 
                ? parseFloat(rawValue.replace(/\./g, '').replace(',', '.')) 
                : parseFloat(rawValue);

            if (!isNaN(numValue)) {
                cleaned[field] = numValue;
                hasValidData = true;
            } else {
                cleaned[field] = null;
            }
        } else {
            cleaned[field] = null;
        }
    }

    if (!hasValidData) {
        throw new Error(`Nessun dato numerico valido estratto. Output grezzo: ${JSON.stringify(data)}`);
    }
    
    console.log('Cleaned Data:', JSON.stringify(cleaned, null, 2));
    return cleaned;
}

/**
 * Estrae dati usando GPT-4o basandosi solo sul testo grezzo.
 */
async function extractFromRawText(rawText, expectedFields, promptTemplate, sessionId) {
    console.log(`[${sessionId}] Esecuzione estrazione solo testo...`);
    
    const prompt = `${promptTemplate}

Testo del bilancio da cui estrarre i dati:
"""
${rawText}
"""`;
    
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: 'Sei un assistente che estrae dati numerici da un testo e risponde solo in formato JSON.' },
            { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.0,
    });
    
    const parsedContent = JSON.parse(completion.choices[0].message.content);
    return validateAndCleanOutput(parsedContent, expectedFields);
}

// --- HANDLER PRINCIPALE DELL'API ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let sessionId = '';
  
  try {
    // 1. Setup e Autenticazione
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.INTERNAL_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { session_id } = req.body;
    sessionId = session_id;
    if (!sessionId) return res.status(400).json({ error: 'session_id è richiesto' });

    await supabase.from('checkup_sessions').update({ status: 'processing' }).eq('id', sessionId);

    // 2. Download e Caricamento PDF
    console.log(`[${sessionId}] Download del PDF...`);
    const { data: files, error: listError } = await supabase.storage.from('checkup-documents').list(`public/${sessionId}`);
    if (listError || !files || files.length === 0) throw new Error('Nessun file trovato');
    const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf')) || files[0];
    const { data: pdfData, error: downloadError } = await supabase.storage.from('checkup-documents').download(`public/${sessionId}/${pdfFile.name}`);
    if (downloadError) throw new Error(`Errore download: ${downloadError.message}`);
    const pdfBuffer = await pdfData.arrayBuffer();
    const pdfDocument = await pdfjsLib.getDocument(new Uint8Array(pdfBuffer)).promise;
    
    // 3. Identificazione Pagine Chiave e Estrazione Testo
    console.log(`[${sessionId}] Identificazione pagine e estrazione testo...`);
    let spPageNum = -1, cePageNum = -1;
    let spRawText = '', ceRawText = '';

    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = (await page.getTextContent()).items.map(item => item.str).join(' ').toLowerCase();
        if (spPageNum === -1 && textContent.includes('stato patrimoniale') && textContent.includes('totale attivo')) {
          spPageNum = i;
          spRawText = textContent;
        }
        if (cePageNum === -1 && textContent.includes('conto economico') && (textContent.includes('valore della produzione') || textContent.includes('ricavi delle vendite'))) {
          cePageNum = i;
          ceRawText = textContent;
        }
        if (spPageNum !== -1 && cePageNum !== -1) break;
    }

    if (spPageNum === -1 || cePageNum === -1) throw new Error(`Impossibile identificare le pagine necessarie. SP: ${spPageNum}, CE: ${cePageNum}`);
    
    // 4. ESTRAZIONE DATI TESTUALE
    console.log(`[${sessionId}] Avvio estrazione dati testuale...`);

    const spExpectedFields = ['total_assets_current', 'total_assets_previous', 'total_debt_current', 'total_debt_previous', 'net_equity_current', 'net_equity_previous'];
    const spPrompt = `IMPORTANTE: Estrai ESATTAMENTE questi 6 valori numerici dal testo del bilancio fornito:
1. total_assets_current: Totale Attivo anno corrente
2. total_assets_previous: Totale Attivo anno precedente  
3. total_debt_current: Totale Debiti (D) anno corrente
4. total_debt_previous: Totale Debiti (D) anno precedente
5. net_equity_current: Totale Patrimonio Netto (A) anno corrente
6. net_equity_previous: Totale Patrimonio Netto (A) anno precedente
RISPONDI SOLO con questo formato JSON (numeri puri, senza virgole o punti come separatori delle migliaia):
{ "total_assets_current": 1234567, "total_assets_previous": 1234567, "total_debt_current": 1234567, "total_debt_previous": 1234567, "net_equity_current": 1234567, "net_equity_previous": 1234567 }`;

    const ceExpectedFields = ['revenue_current', 'revenue_previous'];
    const cePrompt = `IMPORTANTE: Estrai ESATTAMENTE questi 2 valori numerici dal testo del conto economico:
1. revenue_current: Ricavi delle vendite e delle prestazioni anno corrente
2. revenue_previous: Ricavi delle vendite e delle prestazioni anno precedente
RISPONDI SOLO con questo formato JSON:
{ "revenue_current": 1234567, "revenue_previous": 1234567 }`;
    
    const spData = await extractFromRawText(spRawText, spExpectedFields, spPrompt, sessionId);
    const ceData = await extractFromRawText(ceRawText, ceExpectedFields, cePrompt, sessionId);

    const extractedData = { ...spData, ...ceData };
    console.log(`[${sessionId}] Dati finali estratti:`, JSON.stringify(extractedData, null, 2));

    // 5. ANALISI FINALE CON AI
    console.log(`[${sessionId}] Analisi finale su dati puliti...`);
    const { data: promptData, error: promptError } = await supabase.from('ai_prompts').select('prompt_template').eq('name', 'FINANCIAL_ANALYSIS_V2').single();
    if (promptError) throw new Error(`Prompt non trovato: ${promptError.message}`);

    const finalPrompt = promptData.prompt_template + `\n\nUSA ESCLUSIVAMENTE I SEGUENTI DATI NUMERICI PRE-ESTRATTI PER ESEGUIRE L'ANALISI:\n${JSON.stringify(extractedData)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `Sei un analista finanziario esperto. Usa i dati pre-estratti forniti e rispondi SOLO in formato JSON valido.` },
        { role: 'user', content: finalPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096 
    });
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    
    // 6. SALVATAGGIO
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
