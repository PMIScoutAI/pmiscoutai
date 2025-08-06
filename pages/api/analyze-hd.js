// /api/analyze-hd.js
// ULTRA-MINIMAL (deterministico, senza LLM): estrae 2 voci (anno più recente)
// - revenue_current  = Totale valore della produzione
// - net_income_current = Utile (perdita) dell’esercizio
// *_previous = null

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { formatDocumentsAsString } from "langchain/util/document";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------- Helpers ----------
const numberPattern = /-?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g;

const parseIt = (s) => {
  if (typeof s !== 'string') return 0;
  const m = s.replace(/\u00A0/g, ' ').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?/);
  if (!m) return 0;
  return parseFloat(m[0].replace(/\./g, '').replace(',', '.')) || 0;
};

const sanitizeContext = (txt) => {
  if (!txt) return "";
  const t = txt
    .replace(/\u00A0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ');
  // Rimuovi riferimenti a capogruppo/riassunti
  return t.split('\n').filter(l =>
    !/prospetto riepilogativo/i.test(l) &&
    !/direzione e coordinamento/i.test(l) &&
    !/capogruppo/i.test(l) &&
    !/consolidato/i.test(l)
  ).join('\n');
};

// Estrae il PRIMO numero dopo la label (colonna anno più recente)
const extractAfterLabel = (ctx, labelRegex, lookahead = 600) => {
  const re = new RegExp(labelRegex, 'i');
  const m = re.exec(ctx);
  if (!m) return 0;
  const slice = ctx.slice(m.index, m.index + lookahead);
  const nums = slice.match(numberPattern);
  if (!nums || !nums.length) return 0;
  return parseIt(nums[0]); // primo numero = colonna anno corrente (nelle tavole XBRL)
};

const extractRevenueCurrent = (ctx) => {
  const patterns = [
    /Totale\s+(del\s+)?valore\s+della\s+produzione/,
    /A\)\s*Valore\s+della\s+produzione/,      // alcune stampe riportano la riga senza "Totale"
    /Valore\s+della\s+produzione/            // fallback generico
  ];
  for (const p of patterns) {
    const v = extractAfterLabel(ctx, p);
    if (v > 0) return v;
  }
  // Fallback: A1 + A5 se presenti
  const a1 = extractAfterLabel(ctx, /1\)\s*ricavi\s+delle\s+vendite\s+e\s+delle\s+prestazioni/);
  const a5 = extractAfterLabel(ctx, /5\)\s*altri\s+ricavi\s+e\s+proventi/);
  return (a1 > 0 && a5 > 0) ? (a1 + a5) : 0;
};

const extractNetIncomeCurrent = (ctx) => {
  const patterns = [
    /21\)\s*Utile\s*\(perdita\)\s*dell'?esercizio/,
    /Utile\s*\(perdita\)\s*dell'?esercizio/
  ];
  for (const p of patterns) {
    const v = extractAfterLabel(ctx, p);
    if (v !== 0) return v;
  }
  return 0;
};

// ---------- Handler ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'SessionId mancante' });

  try {
    console.log(`[Analyze-HD/${sessionId}] Start deterministic extraction (2 fields).`);

    // Retrieval unico, ampio e diversificato
    const vectorStore = new SupabaseVectorStore(
      new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
      { client: supabase, tableName: 'documents', queryName: 'match_documents' }
    );
    const retriever = vectorStore.asRetriever({
      k: 60,
      searchType: 'mmr',
      searchKwargs: { filter: { session_id: sessionId }, lambda: 0.5 },
    });

    const query = "Conto economico | Valore della produzione | Totale valore della produzione | Utile (perdita) dell'esercizio | 31/12 | A) Valore della produzione | 21) Utile";
    const docs = await retriever.getRelevantDocuments(query);

    const raw = formatDocumentsAsString(docs);
    const context = sanitizeContext(raw);

    const revenue_current = extractRevenueCurrent(context);
    const net_income_current = extractNetIncomeCurrent(context);

    const output = {
      revenue_current,
      revenue_previous: null,
      net_income_current,
      net_income_previous: null
    };

    console.log(`[Analyze-HD/${sessionId}] OUTPUT →`, output);

    await supabase.from('analysis_results_hd').insert({
      session_id: sessionId,
      raw_parsed_data: output,
      summary: `Estrazione deterministica (2 voci) completata.`
    });

    await supabase.from('checkup_sessions_hd')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    return res.status(200).json({ success: true, sessionId, data: output });

  } catch (error) {
    console.error(`💥 [Analyze-HD/${sessionId}] Errore fatale:`, error);
    await supabase.from('checkup_sessions_hd')
      .update({ status: 'failed', error_message: error.message })
      .eq('id', sessionId);
    return res.status(500).json({ error: error.message });
  }
}
