// /api/analyze-pdf.js
// VERSIONE CORRETTA - Fix di tutti gli errori identificati

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';

// ✅ FIX: Worker URL più stabile
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.mjs';

// Inizializzazione client Supabase e OpenAI
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ FIX: Prompt fallback se ai_prompts non esiste
const FALLBACK_PROMPT = `Analizza i seguenti dati finanziari e fornisci un'analisi completa dell'azienda.

Restituisci un JSON con questa struttura esatta:
{
  "health_score": <numero da 0 a 100>,
  "summary": "<riassunto dell'analisi in 2-3 frasi>",
  "key_metrics": {
    "liquidita": <valore>,
    "solvibilita": <valore>,
    "redditività": <valore>
  },
  "recommendations": [
    "<raccomandazione 1>",
    "<raccomandazione 2>",
    "<raccomandazione 3>"
  ],
  "charts_data": {},
  "detailed_swot": {
    "strengths": ["<forza 1>", "<forza 2>"],
    "weaknesses": ["<debolezza 1>", "<debolezza 2>"],
    "opportunities": ["<opportunità 1>", "<opportunità 2>"],
    "threats": ["<minaccia 1>", "<minaccia 2>"]
  },
  "risk_analysis": [
    {
      "type": "<tipo rischio>",
      "level": "<alto/medio/basso>",
      "description": "<descrizione>"
    }
  ],
  "pro_features_teaser": {
    "message": "Analisi più dettagliate disponibili con PMIScout Pro"
  }
}`;

// --- FUNZIONI DI ESTRAZIONE E VALIDAZIONE ---

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
    // ✅ FIX: Authorization flessibile
    console.log('🔍 Controllo autenticazione...');
    const authHeader = req.headers.authorization;
    const expectedAuth = process.env.INTERNAL_SECRET ? `Bearer ${process.env.INTERNAL_SECRET}` : null;
    
    if (expectedAuth && authHeader !== expectedAuth) {
      console.log('❌ Authorization fallita:', { received: authHeader, expected: expectedAuth });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!expectedAuth) {
      console.log('⚠️ INTERNAL_SECRET non impostato, procedo senza autenticazione');
    } else {
      console.log('✅ Authorization OK');
    }

    const { session_id } = req.body;
    sessionId = session_id;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'session_id è richiesto' });
    }

    console.log(`[${sessionId}] Inizio analisi PDF...`);

    // ✅ FIX: Rimuovi update status ridondante
    // La sessione è già in 'processing' da start-checkup
    // await supabase.from('checkup_sessions').update({ status: 'processing' }).eq('id', sessionId);

    // 2. Download e Caricamento PDF
    console.log(`[${sessionId}] Download del PDF...`);
    const { data: files, error: listError } = await supabase.storage
      .from('checkup-documents')
      .list(`public/${sessionId}`);
      
    if (listError || !files || files.length === 0) {
      throw new Error(`Nessun file trovato per sessione ${sessionId}. Error: ${listError?.message}`);
    }
    
    const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf')) || files[0];
    console.log(`[${sessionId}] File PDF trovato: ${pdfFile.name}`);
    
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('checkup-documents')
      .download(`public/${sessionId}/${pdfFile.name}`);
      
    if (downloadError) {
      throw new Error(`Errore download: ${downloadError.message}`);
    }
    
    const pdfBuffer = await pdfData.arrayBuffer();
    const pdfDocument = await pdfjsLib.getDocument(new Uint8Array(pdfBuffer)).promise;
    
    // 3. Identificazione Pagine Chiave e Estrazione Testo
    console.log(`[${sessionId}] Identificazione pagine (${pdfDocument.numPages} totali)...`);
    let spPageNum = -1, cePageNum = -1;
    let spRawText = '', ceRawText = '';

    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = (await page.getTextContent()).items
          .map(item => item.str)
          .join(' ')
          .toLowerCase();
          
        if (spPageNum === -1 && textContent.includes('stato patrimoniale') && textContent.includes('totale attivo')) {
          spPageNum = i;
          spRawText = textContent;
          console.log(`[${sessionId}] Trovato Stato Patrimoniale a pagina ${i}`);
        }
        
        if (cePageNum === -1 && textContent.includes('conto economico') && (textContent.includes('valore della produzione') || textContent.includes('ricavi delle vendite'))) {
          cePageNum = i;
          ceRawText = textContent;
          console.log(`[${sessionId}] Trovato Conto Economico a pagina ${i}`);
        }
        
        if (spPageNum !== -1 && cePageNum !== -1) break;
    }

    if (spPageNum === -1 || cePageNum === -1) {
      throw new Error(`Impossibile identificare le pagine necessarie. SP: ${spPageNum}, CE: ${cePageNum}`);
    }
    
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

    // ✅ 5. FIX: ANALISI FINALE CON PROMPT FALLBACK
    console.log(`[${sessionId}] Recupero prompt per analisi finale...`);
    
    let finalPromptTemplate = FALLBACK_PROMPT;
    
    // Prova a recuperare il prompt dal database, ma non fallire se non esiste
    try {
      const { data: promptData, error: promptError } = await supabase
        .from('ai_prompts')
        .select('prompt_template')
        .eq('name', 'FINANCIAL_ANALYSIS_V2')
        .single();
        
      if (!promptError && promptData) {
        finalPromptTemplate = promptData.prompt_template;
        console.log(`[${sessionId}] Prompt recuperato dal database`);
      } else {
        console.log(`[${sessionId}] Prompt database non trovato, uso fallback:`, promptError?.message);
      }
    } catch (promptFetchError) {
      console.log(`[${sessionId}] Errore recupero prompt, uso fallback:`, promptFetchError.message);
    }

    const finalPrompt = finalPromptTemplate + `\n\nUSA ESCLUSIVAMENTE I SEGUENTI DATI NUMERICI PRE-ESTRATTI PER ESEGUIRE L'ANALISI:\n${JSON.stringify(extractedData)}`;

    console.log(`[${sessionId}] Avvio analisi finale con OpenAI...`);
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
    console.log(`[${sessionId}] Analisi OpenAI completata`);
    
    // ✅ 6. SALVATAGGIO CON ERROR HANDLING MIGLIORATO
    console.log(`[${sessionId}] Salvataggio risultati su analysis_results...`);
    
    const insertData = {
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
    };

    const { error: saveError, data: savedData } = await supabase
      .from('analysis_results')
      .insert(insertData)
      .select();

    if (saveError) {
      console.error(`[${sessionId}] Errore dettagliato salvataggio:`, {
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
        code: saveError.code
      });
      throw new Error(`Errore salvataggio: ${saveError.message}`);
    }

    console.log(`[${sessionId}] ✅ Dati salvati correttamente:`, savedData?.[0]?.id);
    
    // Update status sessione
    const { error: updateError } = await supabase
      .from('checkup_sessions')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('id', sessionId);
      
    if (updateError) {
      console.error(`[${sessionId}] Errore update sessione:`, updateError);
      // Non è fatale, i risultati sono già salvati
    }

    console.log(`[${sessionId}] 🎉 Analisi completata con successo!`);
    return res.status(200).json({ 
      success: true, 
      sessionId: sessionId,
      resultId: savedData?.[0]?.id 
    });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore analisi completo:`, {
      message: error.message,
      stack: error.stack,
      sessionId: sessionId
    });
    
    if (sessionId) {
      const { error: updateError } = await supabase
        .from('checkup_sessions')
        .update({ 
          status: 'failed', 
          error_message: error.message 
        })
        .eq('id', sessionId);
        
      if (updateError) {
        console.error(`[${sessionId}] Errore update sessione fallita:`, updateError);
      }
    }
    
    return res.status(500).json({ 
      error: error.message, 
      sessionId: sessionId || null 
    });
  }
}
