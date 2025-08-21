// /api/start-checkup-hd.js
// VERSIONE FINALE E DINAMICA: Recupera il prompt per l'analisi direttamente da Supabase.

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { formatDocumentsAsString } from "langchain/util/document";
import { z } from "zod";

// Inizializzazione dei client
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });

export const config = { api: { bodyParser: false } };

// --- FUNZIONI HELPER PER L'ANALISI ---

function calculateMetrics(data) {
    const revenue_current = data.fatturato_anno_corrente || 0;
    const revenue_previous = data.fatturato_anno_precedente || 0;
    const net_income_current = data.utile_esercizio_anno_corrente || 0;
    const equity_current = data.patrimonio_netto_anno_corrente || 0;

    const crescita_fatturato_perc = revenue_previous !== 0
        ? parseFloat((((revenue_current - revenue_previous) / revenue_previous) * 100).toFixed(2))
        : null;

    const roe = equity_current !== 0
        ? parseFloat(((net_income_current / equity_current) * 100).toFixed(2))
        : null;

    return { crescita_fatturato_perc, roe, revenue_current, revenue_previous };
}

// FIX: Spostato 'recommendations' per rispecchiare l'output effettivo dell'LLM.
const analysisSchema = z.object({
  health_score: z.number().int().min(0).max(100).describe("Numero intero da 0 a 100 che rappresenta la salute finanziaria."),
  summary: z.string().describe("Riassunto dell'analisi in 2-3 frasi, basato sui dati."),
  key_metrics: z.object({
    crescita_fatturato_perc: z.object({ value: z.number().nullable(), label: z.string() }),
    roe: z.object({ value: z.number().nullable(), label: z.string() }),
    charts_data: z.object({
        revenue_trend: z.object({ current_year: z.number().nullable(), previous_year: z.number().nullable() })
    }),
    detailed_swot: z.object({
        strengths: z.array(z.string()).describe("Punti di forza basati su dati numerici."),
        weaknesses: z.array(z.string()).describe("Punti di debolezza basati su dati numerici."),
        opportunities: z.array(z.string()).describe("Opportunità basate su dati numerici."),
        threats: z.array(z.string()).describe("Minacce basate su dati numerici.")
    }),
    // L'IA sta mettendo 'recommendations' qui, come fratello di 'detailed_swot'
    recommendations: z.array(z.string()).describe("Raccomandazioni concrete e misurabili.")
  }),
});


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  
  let session;
  try {
    // FASE 1 e 2 (invariate)
    const userId = '11111111-1111-1111-1111-111111111111';
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    const [fields, files] = await form.parse(req);
    const companyName = fields.companyName?.[0], pdfFile = files.pdfFile?.[0], extractedDataJson = fields.extractedDataJson?.[0];
    if (!companyName || !pdfFile || !extractedDataJson) return res.status(400).json({ error: 'Dati mancanti.' });
    const extractedData = JSON.parse(extractedDataJson);
    const { data: company, error: companyError } = await supabase.from('companies').upsert({ user_id: userId, company_name: companyName }, { onConflict: 'user_id, company_name' }).select().single();
    if (companyError) throw new Error(`Errore DB (companies): ${companyError.message}`);
    if (!company) throw new Error('Impossibile creare o trovare l\'azienda nel database.');
    const { data: sessionData, error: sessionError } = await supabase.from('checkup_sessions_hd').insert({ user_id: userId, company_id: company.id, status: 'processing', session_name: `Check-UP HD ${companyName}` }).select().single();
    if (sessionError) throw new Error(`Errore DB (checkup_sessions_hd): ${sessionError.message}`);
    session = sessionData;
    console.log(`[HD/${session.id}] Sessione creata, avvio processo completo...`);
    await supabase.from('risultati_estratti_hd').insert({ session_id: session.id, ...extractedData });
    const loader = new PDFLoader(pdfFile.filepath);
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const splitDocs = await splitter.splitDocuments(docs);
    const docsWithMetadata = splitDocs.map(doc => ({ ...doc, metadata: { ...doc.metadata, session_id: session.id } }));
    await SupabaseVectorStore.fromDocuments(docsWithMetadata, embeddings, { client: supabase, tableName: 'documents', queryName: 'match_documents' });
    console.log(`[HD/${session.id}] Indicizzazione completata.`);

    // --- FASE 3: ANALISI FINALE CON PROMPT DINAMICO ---
    console.log(`[HD/${session.id}] Avvio analisi finale con LLM...`);
    
    // NUOVO: Recupera il prompt dal database
    const promptName = 'ANALISI_FINALE_HD_V1'; // Potresti passare questo dal frontend in futuro
    console.log(`[HD/${session.id}] Recupero prompt: ${promptName}`);
    const { data: promptDataRow, error: promptError } = await supabase
        .from('ai_prompts')
        .select('prompt_template')
        .eq('name', promptName)
        .single();

    if (promptError || !promptDataRow) {
        throw new Error(`Impossibile recuperare il prompt '${promptName}' da Supabase: ${promptError?.message}`);
    }
    
    const promptTemplate = promptDataRow.prompt_template;
    
    // Prepara i dati da inserire nel template
    const metrics = calculateMetrics(extractedData);
    const promptPayload = { ...metrics, document_context: formatDocumentsAsString(docs).substring(0, 10000) };
    
    // Inserisce i dati nel template
    const systemPrompt = promptTemplate.replace('{data}', JSON.stringify(promptPayload, null, 2));

    const model = new ChatOpenAI({ modelName: "gpt-4-turbo", temperature: 0.1 });
    const structuredModel = model.withStructuredOutput(analysisSchema);
    const analysisResult = await structuredModel.invoke(systemPrompt);
    console.log(`[HD/${session.id}] Report AI generato con prompt dinamico.`);

    // Salvataggio e completamento (invariato)
    await supabase.from('analysis_results_hd').insert({
      session_id: session.id,
      raw_parsed_data: extractedData,
      final_analysis: analysisResult,
      summary: analysisResult.summary
    });
    console.log(`[HD/${session.id}] Risultati finali salvati.`);
    await supabase.from('checkup_sessions_hd').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', session.id);
    console.log(`[HD/${session.id}] ✅ Processo completo terminato.`);
    
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore fatale in start-checkup-hd (unificato):', error);
    if (session?.id) await supabase.from('checkup_sessions_hd').update({ status: 'failed', error_message: `Errore: ${error.message}` }).eq('id', session.id);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
