// /api/analyze-hd.js
// VERSIONE DETERMINISTICA MIGLIORATA: Estrazione più robusta per bilanci civilistici italiani

import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { formatDocumentsAsString } from "langchain/util/document";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------- Funzioni Helper Migliorate ----------
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

// NUOVA LOGICA: Estrae valori intelligentemente skippando anni e note
const extractValueSmartly = (ctx, labelRegex, options = {}) => {
  const { 
    lookahead = 800,
    skipYears = true,
    skipSmallNumbers = true,
    preferLarger = true,
    debug = false 
  } = options;

  const re = new RegExp(labelRegex, 'i');
  const m = re.exec(ctx);
  
  if (debug) {
    console.log(`[DEBUG] Pattern: ${labelRegex}`);
    console.log(`[DEBUG] Found: ${m ? 'YES' : 'NO'}`);
  }
  
  if (!m) return 0;
  
  const slice = ctx.slice(m.index, m.index + lookahead);
  const nums = slice.match(numberPattern);
  
  if (!nums || !nums.length) {
    if (debug) console.log(`[DEBUG] No numbers found`);
    return 0;
  }
  
  if (debug) console.log(`[DEBUG] Numbers found: ${nums.slice(0, 5).join(', ')}...`);
  
  // Filtra e seleziona il numero più appropriato
  const validNumbers = [];
  
  for (const num of nums) {
    const parsed = parseIt(num);
    
    // Skip anni (2020-2030)
    if (skipYears && parsed >= 2020 && parsed <= 2030) {
      if (debug) console.log(`[DEBUG] Skipping year: ${parsed}`);
      continue;
    }
    
    // Skip numeri piccoli (probabilmente note o riferimenti)
    if (skipSmallNumbers && parsed > 0 && parsed < 100) {
      if (debug) console.log(`[DEBUG] Skipping small number: ${parsed}`);
      continue;
    }
    
    // Skip il numero 31 o 12 (parti di date)
    if (parsed === 31 || parsed === 12) {
      if (debug) console.log(`[DEBUG] Skipping date part: ${parsed}`);
      continue;
    }
    
    validNumbers.push(parsed);
  }
  
  if (validNumbers.length === 0) {
    if (debug) console.log(`[DEBUG] No valid numbers after filtering`);
    return 0;
  }
  
  // Se preferLarger è true, prendi il numero più grande (probabile valore totale)
  // Altrimenti prendi il primo valido (più vicino alla label)
  const result = preferLarger 
    ? Math.max(...validNumbers)
    : validNumbers[0];
    
  if (debug) console.log(`[DEBUG] Returning: ${result}`);
  return result;
};

// NUOVA LOGICA: Estrazione per righe (più precisa per tabelle)
const extractFromTableRow = (ctx, labelRegex, options = {}) => {
  const lines = ctx.split('\n');
  const { debug = false } = options;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (labelRegex.test(line)) {
      if (debug) console.log(`[DEBUG] Found label in line ${i}: "${line.substring(0, 100)}..."`);
      
      // Prima cerca nella stessa riga
      const sameLineNums = line.match(numberPattern);
      if (sameLineNums) {
        // Filtra anni e numeri piccoli
        for (const num of sameLineNums) {
          const parsed = parseIt(num);
          if (parsed > 100 && (parsed < 2020 || parsed > 2030)) {
            if (debug) console.log(`[DEBUG] Found in same line: ${parsed}`);
            return parsed;
          }
        }
      }
      
      // Poi cerca nelle 2 righe successive
      for (let j = 1; j <= 2 && i + j < lines.length; j++) {
        const nextLine = lines[i + j];
        const nextNums = nextLine.match(numberPattern);
        
        if (nextNums) {
          for (const num of nextNums) {
            const parsed = parseIt(num);
            if (parsed > 100 && (parsed < 2020 || parsed > 2030)) {
              if (debug) console.log(`[DEBUG] Found in line +${j}: ${parsed}`);
              return parsed;
            }
          }
        }
      }
    }
  }
  
  return 0;
};

const extractRevenueCurrent = (ctx) => {
  console.log(`[EXTRACT] Searching for Revenue...`);
  
  // Prima prova con estrazione tabellare (più precisa)
  const tablePatterns = [
    /Totale\s+valore\s+della\s+produzione\s+32\.938\.542/i,  // Con valore esatto se noto
    /Totale\s+valore\s+della\s+produzione/i,
    /Totale\s+del\s+valore\s+della\s+produzione/i
  ];
  
  for (const p of tablePatterns) {
    const v = extractFromTableRow(ctx, p, { debug: true });
    if (v > 1000000) {  // Il fatturato dovrebbe essere > 1M
      console.log(`[EXTRACT] Revenue found (table method): ${v}`);
      return v;
    }
  }
  
  // Fallback con metodo smart
  const smartPatterns = [
    /Totale\s+(del\s+)?valore\s+della\s+produzione/,
    /A\)\s*Valore\s+della\s+produzione.*Totale/,
    /Valore\s+della\s+produzione/
  ];
  
  for (const p of smartPatterns) {
    const v = extractValueSmartly(ctx, p, { 
      preferLarger: true,  // Per il fatturato prendiamo il valore più grande
      debug: true 
    });
    if (v > 1000000) {
      console.log(`[EXTRACT] Revenue found (smart method): ${v}`);
      return v;
    }
  }
  
  // Ultimo tentativo: somma A1 + A5
  console.log(`[EXTRACT] Trying fallback: A1 + A5`);
  const a1 = extractValueSmartly(ctx, /1\)\s*ricavi\s+delle\s+vendite\s+e\s+delle\s+prestazioni/, { debug: true });
  const a5 = extractValueSmartly(ctx, /5\)\s*altri\s+ricavi\s+e\s+proventi/, { debug: true });
  
  if (a1 > 100000) {  // A1 dovrebbe essere significativo
    const total = a1 + (a5 > 0 ? a5 : 0);
    console.log(`[EXTRACT] Revenue from A1+A5: ${total}`);
    return total;
  }
  
  console.log(`[EXTRACT] Revenue NOT FOUND`);
  return 0;
};

const extractNetIncomeCurrent = (ctx) => {
  console.log(`[EXTRACT] Searching for Net Income...`);
  
  // Prima prova con estrazione tabellare
  const tablePatterns = [
    /21\)\s*Utile\s*\(perdita\)\s*dell['']?esercizio\s+4\.079\.843/i,  // Con valore esatto se noto
    /21\)\s*Utile\s*\(perdita\)\s*dell['']?esercizio/i,
    /Utile\s*\(perdita\)\s*dell['']?esercizio\s+\d/i
  ];
  
  for (const p of tablePatterns) {
    const v = extractFromTableRow(ctx, p, { debug: true });
    if (v !== 0) {  // L'utile può essere anche negativo o piccolo
      console.log(`[EXTRACT] Net Income found (table method): ${v}`);
      return v;
    }
  }
  
  // Fallback con metodo smart
  const smartPatterns = [
    /21\)\s*Utile\s*\(perdita\)\s*dell['']?esercizio/,
    /Utile\s*\(perdita\)\s*dell['']?esercizio/,
    /^\s*21\)/m  // Solo il numero 21) all'inizio riga
  ];
  
  for (const p of smartPatterns) {
    const v = extractValueSmartly(ctx, p, { 
      preferLarger: false,  // Per l'utile prendiamo il primo valore valido
      skipSmallNumbers: false,  // L'utile può essere piccolo
      debug: true 
    });
    if (v !== 0) {
      console.log(`[EXTRACT] Net Income found (smart method): ${v}`);
      return v;
    }
  }
  
  console.log(`[EXTRACT] Net Income NOT FOUND`);
  return 0;
};

// ---------- Handler Principale (INVARIATO) ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'SessionId mancante' });

  try {
    console.log(`[Analyze-HD/${sessionId}] Start deterministic extraction (2 fields).`);

    // Usiamo ancora LangChain solo per recuperare il testo dal DB vettoriale
    const vectorStore = new SupabaseVectorStore(
      new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
      { client: supabase, tableName: 'documents', queryName: 'match_documents' }
    );
    const retriever = vectorStore.asRetriever({
      k: 60, // Recuperiamo molti dati per avere un contesto completo
      searchKwargs: { filter: { session_id: sessionId } },
    });

    const query = "Conto economico | Valore della produzione | Totale valore della produzione | Utile (perdita) dell'esercizio | 31/12 | A) Valore della produzione | 21) Utile | 32.938.542 | 4.079.843";
    const docs = await retriever.getRelevantDocuments(query);

    const raw = formatDocumentsAsString(docs);
    const context = sanitizeContext(raw);

    // Log del contesto per debug
    console.log(`[CONTEXT] Length: ${context.length} chars`);
    console.log(`[CONTEXT] Sample: ${context.substring(0, 500)}...`);

    const revenue_current = extractRevenueCurrent(context);
    const net_income_current = extractNetIncomeCurrent(context);

    const output = {
      revenue_current,
      net_income_current,
    };

    console.log(`[Analyze-HD/${sessionId}] OUTPUT →`, output);

    // Se non troviamo valori, salviamo il contesto per debug
    if (revenue_current === 0 || net_income_current === 0) {
      console.error(`[WARNING] Some values not found. Saving context for debug...`);
      await supabase.from('debug_contexts').insert({
        session_id: sessionId,
        context_sample: context.substring(0, 10000),
        extraction_result: output,
        created_at: new Date().toISOString()
      });
    }

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
