// /pages/api/piano-economico/upload.js
// VERSIONE 3.0 - Autenticazione con Outseta (come Valuta-PMI)
// Fix: Usa outseta_user_id invece di email

import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { parseForm } from '../../../lib/parseForm';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// UTILITY FUNCTIONS
// ============================================

const parseValue = (val) => {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    let cleanVal = val.trim();
    const isNegative = cleanVal.startsWith('(') && cleanVal.endsWith(')');
    if (isNegative) cleanVal = '-' + cleanVal.substring(1, cleanVal.length - 1);
    cleanVal = cleanVal
      .replace(/\u00A0/g, '')
      .replace(/['\s]/g, '')
      .replace(/\u2212/g, '-')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const num = parseFloat(cleanVal);
    return isNaN(num) ? null : num;
  }
  return null;
};

const findYearColumns = (sheetData) => {
  const yearRegex = /(19|20)\d{2}/;
  let years = [];
  for (let i = 0; i < Math.min(sheetData.length, 40); i++) {
    const row = sheetData[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').trim();
      const match = cell.match(yearRegex);
      if (match) years.push({ year: parseInt(match[0], 10), col: j });
    }
    if (years.length >= 2) break;
  }
  if (years.length < 2) {
    console.warn('Colonne anni non trovate, uso fallback 3 e 4.');
    return { currentYearCol: 3, previousYearCol: 4 };
  }
  years.sort((a, b) => b.year - a.year);
  return { currentYearCol: years[0].col, previousYearCol: years[1].col };
};

const findValueInSheetImproved = (sheetData, searchConfigs, yearCols, metricName) => {
  for (const config of searchConfigs) {
    const primaryTerms = config.primary.map(t => t.toLowerCase().trim());
    const exclusionTerms = (config.exclusion || []).map(t => t.toLowerCase().trim());
    for (const row of sheetData) {
      let description = '';
      for (let i = 0; i < Math.min(row.length, 6); i++) {
        description += String(row[i] || '').toLowerCase().trim() + ' ';
      }
      description = description.replace(/\s+/g, ' ').trim();
      const allPrimaryTermsFound = primaryTerms.every(term => description.includes(term));
      const anyExclusionTermsFound = exclusionTerms.some(term => description.includes(term));
      if (allPrimaryTermsFound && !anyExclusionTermsFound) {
        const result = {
          currentYear: parseValue(row[yearCols.currentYearCol]),
          previousYear: parseValue(row[yearCols.previousYearCol])
        };
        if (result.currentYear !== null || result.previousYear !== null) {
          return result;
        }
      }
    }
  }
  return { currentYear: null, previousYear: null };
};

// ============================================
// METRIC CONFIGS
// ============================================

const metricsConfigs = {
  fatturato: [
    { primary: ['a) ricavi delle vendite e delle prestazioni'] },
    { primary: ['ricavi delle vendite'] },
    { primary: ['valore della produzione'], exclusion: ['costi', 'differenza'] }
  ],
  costiProduzione: [
    { primary: ['b) costi della produzione'] },
    { primary: ['costi della produzione'], exclusion: ['valore'] }
  ],
  costiPersonale: [
    { primary: ['costi per prestazioni di lavoro dipendente'] },
    { primary: ['costi per lavoro dipendente'] },
    { primary: ['personale'] }
  ],
  costiMateriePrime: [
    { primary: ['materie prime'] },
    { primary: ['costi materie prime'] }
  ],
  costiServizi: [
    { primary: ['costi per servizi'] },
    { primary: ['servizi'] }
  ],
  costiGodimento: [
    { primary: ['costi per godimento beni di terzi'] },
    { primary: ['godimento beni'] }
  ],
  oneriDiversi: [
    { primary: ['oneri diversi di gestione'] },
    { primary: ['oneri diversi'] }
  ],
  ammortamenti: [
    { primary: ['ammortamenti e svalutazioni'] },
    { primary: ['ammortamenti'] }
  ],
  oneriFinanziari: [
    { primary: ['interessi e altri oneri finanziari'] },
    { primary: ['oneri finanziari'] }
  ],
  utile: [
    { primary: ['utile (perdita) dell\'esercizio'] },
    { primary: ['risultato dell\'esercizio'] },
    { primary: ['risultato prima delle imposte'] }
  ],
  totaleAttivo: [
    { primary: ['totale attivo', 'a+b+c'] },
    { primary: ['totale attivo'], exclusion: ['circolante', 'corrente'] }
  ],
  patrimonioNetto: [
    { primary: ['totale patrimonio netto'] },
    { primary: ['a) patrimonio netto'] }
  ],
  debitiTotali: [
    { primary: ['totale debiti'] },
    { primary: ['d) debiti'] }
  ],
  imposte: [
    { primary: ['imposte sul reddito dell\'esercizio'] },
    { primary: ['imposte sul reddito'] }
  ]
};

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const sessionId = uuidv4();

  console.log(`[${sessionId}] 🚀 Avvio upload Piano Economico (v3.0 - Outseta Auth)`);

  try {
    // ============================================
    // STEP 1: AUTENTICAZIONE VIA OUTSETA
    // ============================================

    console.log(`[${sessionId}] 🔐 Verifica token Outseta...`);
    
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      console.error(`[${sessionId}] ❌ Token Outseta mancante`);
      return res.status(401).json({ error: 'Token di autenticazione mancante' });
    }

    // Verifica token con Outseta
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });

    if (!outsetaResponse.ok) {
      console.error(`[${sessionId}] ❌ Token Outseta non valido`);
      return res.status(401).json({ error: 'Token non valido' });
    }

    const outsetaUser = await outsetaResponse.json();
    console.log(`[${sessionId}] ✅ Token Outseta valido per: ${outsetaUser.Email}`);

    // ============================================
    // STEP 2: RECUPERA/CREA USER DA OUTSETA
    // ============================================

    console.log(`[${sessionId}] 👤 Ricerca user con outseta_user_id: ${outsetaUser.Uid}`);

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .upsert(
        {
          outseta_user_id: outsetaUser.Uid,
          email: outsetaUser.Email,
          first_name: outsetaUser.FirstName || '',
          last_name: outsetaUser.LastName || ''
        },
        { onConflict: 'outseta_user_id' }
      )
      .select('id')
      .single();

    if (userError || !userRow) {
      console.error(`[${sessionId}] ❌ Errore recupero/creazione user:`, userError);
      return res.status(500).json({ error: 'Impossibile autenticare utente' });
    }

    console.log(`[${sessionId}] ✅ User ID trovato/creato: ${userRow.id}`);

    // ============================================
    // STEP 3: PARSE MULTIPART FORM DATA
    // ============================================

    console.log(`[${sessionId}] 📦 Parsing form data...`);
    const { fields, files } = await parseForm(req);

    console.log(`[${sessionId}] ✅ Fields:`, Object.keys(fields));
    console.log(`[${sessionId}] ✅ Files:`, Object.keys(files));

    if (!files.file) {
      console.error(`[${sessionId}] ❌ Nessun file trovato`);
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // Estrai il file
    const fileObj = Array.isArray(files.file) ? files.file[0] : files.file;
    const fileBuffer = fs.readFileSync(fileObj.filepath);
    console.log(`[${sessionId}] 📂 File size: ${fileBuffer.length} bytes`);

    // ============================================
    // STEP 4: PARSE EXCEL FILE
    // ============================================

    console.log(`[${sessionId}] 📋 Parsing Excel...`);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheets = workbook.SheetNames;

    console.log(`[${sessionId}] 📋 Fogli trovati: ${sheets.join(', ')}`);

    if (sheets.length === 0) {
      return res.status(400).json({ error: 'File Excel vuoto o non valido' });
    }

    const firstSheet = workbook.Sheets[sheets[0]];
    const sheetData = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

    console.log(`[${sessionId}] ✅ File parsato: ${sheetData.length} righe`);

    // ============================================
    // STEP 5: EXTRACT YEAR COLUMNS
    // ============================================

    const yearCols = findYearColumns(sheetData);
    console.log(`[${sessionId}] 📅 Colonne anni: N=${yearCols.currentYearCol}, N-1=${yearCols.previousYearCol}`);

    // ============================================
    // STEP 6: EXTRACT METRICS
    // ============================================

    const metrics = {
      fatturato: findValueInSheetImproved(sheetData, metricsConfigs.fatturato, yearCols, 'Fatturato'),
      costiProduzione: findValueInSheetImproved(sheetData, metricsConfigs.costiProduzione, yearCols, 'Costi Produzione'),
      costiPersonale: findValueInSheetImproved(sheetData, metricsConfigs.costiPersonale, yearCols, 'Costi Personale'),
      costiMateriePrime: findValueInSheetImproved(sheetData, metricsConfigs.costiMateriePrime, yearCols, 'Materie Prime'),
      costiServizi: findValueInSheetImproved(sheetData, metricsConfigs.costiServizi, yearCols, 'Servizi'),
      costiGodimento: findValueInSheetImproved(sheetData, metricsConfigs.costiGodimento, yearCols, 'Godimento'),
      oneriDiversi: findValueInSheetImproved(sheetData, metricsConfigs.oneriDiversi, yearCols, 'Oneri Diversi'),
      ammortamenti: findValueInSheetImproved(sheetData, metricsConfigs.ammortamenti, yearCols, 'Ammortamenti'),
      oneriFinanziari: findValueInSheetImproved(sheetData, metricsConfigs.oneriFinanziari, yearCols, 'Oneri Finanziari'),
      utile: findValueInSheetImproved(sheetData, metricsConfigs.utile, yearCols, 'Utile'),
      totaleAttivo: findValueInSheetImproved(sheetData, metricsConfigs.totaleAttivo, yearCols, 'Totale Attivo'),
      patrimonioNetto: findValueInSheetImproved(sheetData, metricsConfigs.patrimonioNetto, yearCols, 'Patrimonio Netto'),
      debitiTotali: findValueInSheetImproved(sheetData, metricsConfigs.debitiTotali, yearCols, 'Debiti Totali'),
      imposte: findValueInSheetImproved(sheetData, metricsConfigs.imposte, yearCols, 'Imposte')
    };

    console.log(`[${sessionId}] 📊 Metriche estratte:`, {
      fatturato: metrics.fatturato.currentYear,
      costiPersonale: metrics.costiPersonale.currentYear,
      ammortamenti: metrics.ammortamenti.currentYear,
      utile: metrics.utile.currentYear
    });

    // ============================================
    // STEP 7: CALCULATE PERCENTAGES
    // ============================================

    const fatturatoCorrente = metrics.fatturato.currentYear || 1;

    const incidenze = {
      mp_pct: fatturatoCorrente > 0 ? (metrics.costiMateriePrime.currentYear || 0) / fatturatoCorrente * 100 : 0,
      servizi_pct: fatturatoCorrente > 0 ? (metrics.costiServizi.currentYear || 0) / fatturatoCorrente * 100 : 0,
      godimento_pct: fatturatoCorrente > 0 ? (metrics.costiGodimento.currentYear || 0) / fatturatoCorrente * 100 : 0,
      oneri_pct: fatturatoCorrente > 0 ? (metrics.oneriDiversi.currentYear || 0) / fatturatoCorrente * 100 : 0
    };

    console.log(`[${sessionId}] 📈 Incidenze % calcolate:`, incidenze);

    // ============================================
    // STEP 8: EXTRACT FORM FIELDS
    // ============================================

    const companyName = Array.isArray(fields.companyName) 
      ? fields.companyName[0] 
      : fields.companyName || 'Azienda';
    
    const scenario = Array.isArray(fields.scenario)
      ? fields.scenario[0]
      : fields.scenario || 'base';

    console.log(`[${sessionId}] 🏢 Company: ${companyName}, Scenario: ${scenario}`);

    // ============================================
    // STEP 9: SAVE TO SUPABASE
    // ============================================

    console.log(`[${sessionId}] 💾 Salvataggio in Supabase...`);

    const { error: insertError } = await supabase
      .from('piano_economico_sessions')
      .insert({
        id: sessionId,
        user_id: userRow.id,
        user_email: outsetaUser.Email,
        company_name: companyName,
        
        // Anno 0 (storico)
        anno0_ricavi: metrics.fatturato.currentYear,
        anno0_costi_personale: metrics.costiPersonale.currentYear,
        anno0_mp: metrics.costiMateriePrime.currentYear,
        anno0_servizi: metrics.costiServizi.currentYear,
        anno0_godimento: metrics.costiGodimento.currentYear,
        anno0_oneri_diversi: metrics.oneriDiversi.currentYear,
        anno0_ammortamenti: metrics.ammortamenti.currentYear,
        anno0_oneri_finanziari: metrics.oneriFinanziari.currentYear,
        anno0_utile: metrics.utile.currentYear,
        
        // Incidenze %
        mp_pct: incidenze.mp_pct,
        servizi_pct: incidenze.servizi_pct,
        godimento_pct: incidenze.godimento_pct,
        oneri_pct: incidenze.oneri_pct,
        
        // Metadati
        ateco_code: null,
        scenario_type: scenario,
        growth_rate_override: null,
        capital_needed: null,
        
        status: 'ready_to_generate'
      });

    if (insertError) {
      console.error(`[${sessionId}] ❌ Errore insert Supabase:`, insertError);
      return res.status(500).json({ error: 'Errore salvataggio sessione', details: insertError.message });
    }

    console.log(`[${sessionId}] ✅ Sessione creata e salvata`);

    // ============================================
    // STEP 10: CLEANUP E RESPONSE
    // ============================================

    try {
      fs.unlinkSync(fileObj.filepath);
    } catch (e) {
      console.warn(`[${sessionId}] ⚠️ Errore eliminazione file temporaneo:`, e.message);
    }

    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      userId: userRow.id,
      userEmail: outsetaUser.Email,
      message: 'File caricato e parsato con successo',
      status: 'ready_to_generate',
      metriche_estratte: {
        fatturato: metrics.fatturato.currentYear,
        costi_personale: metrics.costiPersonale.currentYear,
        ammortamenti: metrics.ammortamenti.currentYear,
        utile: metrics.utile.currentYear
      },
      incidenze: incidenze
    });

  } catch (error) {
    console.error(`[${sessionId}] 💥 Errore fatale:`, error);
    return res.status(500).json({
      error: error.message || 'Errore durante l\'elaborazione del file',
      sessionId: sessionId,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// ============================================
// DISABLE DEFAULT BODY PARSER
// ============================================

export const config = {
  api: {
    bodyParser: false,
  },
};
