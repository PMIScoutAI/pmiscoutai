// /pages/api/analyze-xbrl.js
// VERSIONE 7.3 (ROBUSTA E PROFESSIONALE): Implementa tutte le correzioni suggerite.
// - Cerca le colonne degli anni in modo indipendente per ogni foglio.
// - Utilizza una funzione di parsing dei numeri di livello professionale.
// - Cerca le descrizioni in un range di colonne più ampio.
// - Cerca l'utile prima nel Conto Economico.
// - Allineato il nome del bucket e migliorata la lettura del file.

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import xlsx from 'xlsx';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ✅ FIX: Funzione di parsing potenziata per gestire vari formati numerici.
 */
const parseValue = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let cleanVal = val.trim();
        const isNegative = cleanVal.startsWith('(') && cleanVal.endsWith(')');
        if (isNegative) {
            cleanVal = '-' + cleanVal.substring(1, cleanVal.length - 1);
        }
        cleanVal = cleanVal.replace(/\u00A0/g, '');   // NBSP
        cleanVal = cleanVal.replace(/['\s]/g, '');    // spazi/apostrofi
        cleanVal = cleanVal.replace(/\u2212/g, '-');  // minus unicode
        cleanVal = cleanVal.replace(/\./g, '').replace(',', '.'); // migliaia/decimali EU
        cleanVal = cleanVal.replace(/[^\d.-]/g, '');  // togli simboli (es. %)
        const num = parseFloat(cleanVal);
        return isNaN(num) ? null : num;
    }
    return null;
};

/**
 * ✅ FIX: Trova le colonne degli anni in modo più tollerante e profondo.
 */
const findYearColumns = (sheetData) => {
    const yearRegex = /(19|20)\d{2}/;
    let years = [];
    for (let i = 0; i < Math.min(sheetData.length, 40); i++) { // Controlla più righe
        const row = sheetData[i];
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] ?? '').trim();
            const match = cell.match(yearRegex);
            if (match) {
                years.push({ year: parseInt(match[0], 10), col: j });
            }
        }
        if (years.length >= 2) break;
    }
    if (years.length < 2) return { currentYearCol: 3, previousYearCol: 4 }; // Fallback
    
    years.sort((a, b) => b.year - a.year);
    return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

/**
 * ✅ FIX: Funzione di ricerca che usa colonne dinamiche e cerca in un range più ampio.
 */
const findValueInSheet = (sheetData, searchTexts, yearCols) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    
    for (const row of sheetData) {
        // Cerca la descrizione nelle prime 6 colonne
        for (let i = 0; i < 6; i++) {
            const description = String(row[i] || '').toLowerCase().trim();
            if (normalizedSearchTexts.some(searchText => description.includes(searchText))) {
                const rawCurrent = row[yearCols.currentYearCol];
                const rawPrevious = row[yearCols.previousYearCol];
                return { currentYear: parseValue(rawCurrent), previousYear: parseValue(rawPrevious) };
            }
        }
    }
    return { currentYear: null, previousYear: null };
};

/**
 * ✅ FIX: Funzione di ricerca per valori testuali migliorata.
 */
const findSimpleValue = (sheetData, searchTexts) => {
    const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
    for (const row of sheetData) {
        const descriptionCell = [row[0], row[1], row[2], row[3], row[4], row[5]]
            .map(c => String(c || '').toLowerCase().trim())
            .join(' ');

        if (normalizedSearchTexts.some(searchText => descriptionCell.includes(searchText))) {
            for (let j = 0; j < row.length; j++) {
                if (typeof row[j] === 'string' && row[j].trim() && !normalizedSearchTexts.some(st => row[j].toLowerCase().includes(st))) {
                    return row[j].trim();
                }
            }
        }
    }
    return null;
};


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId è richiesto' });
  }
  
  console.log(`[${sessionId}] Avvio analisi XBRL (versione stabile 7.3).`);

  try {
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('*, companies(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) throw new Error('Sessione non trovata.');
    if (!session.file_path) throw new Error('Percorso del file non trovato.');

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('checkup-documents')
      .download(session.file_path);

    if (downloadError) throw new Error('Impossibile scaricare il file di bilancio.');
    
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true, raw: false });
    
    const companyInfoSheet = workbook.Sheets['T0000'];
    const balanceSheet = workbook.Sheets['T0002'];
    const incomeStatement = workbook.Sheets['T0006'];

    if (!companyInfoSheet || !balanceSheet || !incomeStatement) {
        throw new Error("Uno o più fogli di lavoro standard (T0000, T0002, T0006) non sono stati trovati.");
    }

    const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1 });
    const companyInfoData = xlsx.utils.sheet_to_json(companyInfoSheet, { header: 1 });

    // ✅ FIX: Colonne degli anni identificate per ogni foglio
    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);

    const companyName = findSimpleValue(companyInfoData, ['denominazione', 'ragione sociale', 'impresa', 'società']) || 'Azienda Analizzata';

    const sedeRow = findSimpleValue(companyInfoData, ["sede"]);
    const regionMatch = sedeRow ? sedeRow.match(/\(([^)]+)\)/) : null;
    const region = regionMatch ? regionMatch[1] : null;

    const context = {
        ateco: findSimpleValue(companyInfoData, ["codice ateco", "attività prevalente"]),
        region: region
    };

    const metrics = {
        fatturato: findValueInSheet(incomeStatementData, ["ricavi delle vendite", "valore della produzione"], yearColsIS),
        // ✅ FIX: Cerca l'utile prima nel CE, poi nello SP
        utilePerdita: findValueInSheet(incomeStatementData, ["utile (perdita) dell'esercizio", "risultato dell'esercizio"], yearColsIS) || findValueInSheet(balanceSheetData, ["utile (perdita) dell'esercizio", "risultato dell'esercizio"], yearColsBS),
        totaleAttivo: findValueInSheet(balanceSheetData, ["totale attivo"], yearColsBS),
        patrimonioNetto: findValueInSheet(balanceSheetData, ["patrimonio netto"], yearColsBS),
        debitiTotali: findValueInSheet(balanceSheetData, ["debiti"], yearColsBS),
        costiProduzione: findValueInSheet(incomeStatementData, ["costi della produzione"], yearColsIS),
        ammortamenti: findValueInSheet(incomeStatementData, ["ammortamenti e svalutazioni"], yearColsIS),
        oneriFinanziari: findValueInSheet(incomeStatementData, ["interessi e altri oneri finanziari"], yearColsIS),
        attivoCircolante: findValueInSheet(balanceSheetData, ["attivo circolante"], yearColsBS),
        debitiBreveTermine: findValueInSheet(balanceSheetData, ["debiti esigibili entro l'esercizio successivo"], yearColsBS),
        creditiClienti: findValueInSheet(balanceSheetData, ["crediti verso clienti"], yearColsBS),
        rimanenze: findValueInSheet(balanceSheetData, ["rimanenze"], yearColsBS),
        disponibilitaLiquide: findValueInSheet(balanceSheetData, ["disponibilità liquide"], yearColsBS),
    };

    const dataForPrompt = `
Dati Aziendali per ${companyName}:

Contesto Aziendale:
- Regione: ${context.region || 'N/D'}
- Codice ATECO (Settore): ${context.ateco || 'N/D'}

Principali Voci di Conto Economico (Anno Corrente N / Anno Precedente N-1):
- Fatturato: ${metrics.fatturato.currentYear} / ${metrics.fatturato.previousYear}
- Costi della Produzione: ${metrics.costiProduzione.currentYear} / ${metrics.costiProduzione.previousYear}
- Ammortamenti e Svalutazioni: ${metrics.ammortamenti.currentYear} / ${metrics.ammortamenti.previousYear}
- Oneri Finanziari: ${metrics.oneriFinanziari.currentYear} / ${metrics.oneriFinanziari.previousYear}
- Utile/(Perdita) d'esercizio: ${metrics.utilePerdita.currentYear} / ${metrics.utilePerdita.previousYear}

Principali Voci di Stato Patrimoniale (Anno Corrente N / Anno Precedente N-1):
- Totale Attivo: ${metrics.totaleAttivo.currentYear} / ${metrics.totaleAttivo.previousYear}
- Patrimonio Netto: ${metrics.patrimonioNetto.currentYear} / ${metrics.patrimonioNetto.previousYear}
- Debiti Totali: ${metrics.debitiTotali.currentYear} / ${metrics.debitiTotali.previousYear}
- Attivo Circolante: ${metrics.attivoCircolante.currentYear} / ${metrics.attivoCircolante.previousYear}
- Debiti a Breve Termine: ${metrics.debitiBreveTermine.currentYear} / ${metrics.debitiBreveTermine.previousYear}
- Crediti verso Clienti: ${metrics.creditiClienti.currentYear} / ${metrics.creditiClienti.previousYear}
- Rimanenze: ${metrics.rimanenze.currentYear} / ${metrics.rimanenze.previousYear}
- Disponibilità Liquide: ${metrics.disponibilitaLiquide.currentYear} / ${metrics.disponibilitaLiquide.previousYear}
`;

    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V2')
      .single();

    if (promptError || !promptData) throw new Error("Prompt 'FINANCIAL_ANALYSIS_V2' non trovato.");

    const finalPrompt = `${promptData.prompt_template}\n\n### DATI ESTRATTI DAL BILANCIO ###\n${dataForPrompt}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: finalPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    const resultToSave = {
      session_id: sessionId,
      health_score: analysisResult.health_score,
      key_metrics: analysisResult.key_metrics,
      swot: analysisResult.detailed_swot,
      recommendations: analysisResult.recommendations,
      charts_data: analysisResult.charts_data,
      summary: analysisResult.summary,
      raw_ai_response: analysisResult,
      detailed_swot: analysisResult.detailed_swot,
      risk_analysis: analysisResult.risk_analysis,
      pro_features_teaser: analysisResult.pro_features_teaser,
      raw_parsed_data: { metrics, context }
    };
    
    const { error: saveError } = await supabase.from('analysis_results').insert(resultToSave);
    if (saveError) throw new Error(`Salvataggio fallito: ${saveError.message}`);

    await supabase
      .from('checkup_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    console.log(`[${sessionId}] 🎉 Analisi XBRL completata con successo!`);
    return res.status(200).json({ success: true, sessionId: sessionId });

  } catch (error) {
    console.error(`💥 [${sessionId || 'NO_SESSION'}] Errore fatale in analyze-xbrl:`, error.message);
    if (sessionId) {
      await supabase
        .from('checkup_sessions')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', sessionId);
    }
    return res.status(500).json({ error: error.message });
  }
}
