// /pages/api/piano-economico/upload.js
// VERSIONE 3.1 - DEBUG COMPLETO
// Logging dettagliato per diagnosticare errori Supabase

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

  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${sessionId}] 🚀 INIZIO UPLOAD PIANO ECONOMICO (v3.1 - DEBUG)`);
  console.log(`${'='.repeat(80)}`);

  try {
    // ============================================
    // STEP 1: AUTENTICAZIONE VIA OUTSETA
    // ============================================

    console.log(`\n[${sessionId}] 🔐 STEP 1: AUTENTICAZIONE OUTSETA`);
    console.log(`[${sessionId}] 📋 Headers ricevuti:`, {
      authorization: req.headers.authorization ? '✅ Presente' : '❌ Mancante',
      contentType: req.headers['content-type']
    });
    
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      console.error(`[${sessionId}] ❌ Token Outseta mancante`);
      return res.status(401).json({ error: 'Token di autenticazione mancante' });
    }

    console.log(`[${sessionId}] 🔍 Token Outseta ricevuto (${outsetaToken.length} char)`);

    // Verifica token con Outseta
    console.log(`[${sessionId}] 🌐 Verifico token con API Outseta...`);
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', {
      headers: { Authorization: `Bearer ${outsetaToken}` }
    });

    console.log(`[${sessionId}] 📊 Risposta Outseta: ${outsetaResponse.status} ${outsetaResponse.statusText}`);

    if (!outsetaResponse.ok) {
      console.error(`[${sessionId}] ❌ Token Outseta non valido (${outsetaResponse.status})`);
      return res.status(401).json({ error: 'Token non valido' });
    }

    const outsetaUser = await outsetaResponse.json();
    console.log(`[${sessionId}] ✅ Autenticazione OK`);
    console.log(`[${sessionId}] 👤 User Outseta:`, {
      Uid: outsetaUser.Uid,
      Email: outsetaUser.Email,
      FirstName: outsetaUser.FirstName,
      LastName: outsetaUser.LastName
    });

    // ============================================
    // STEP 2: RECUPERA/CREA USER DA OUTSETA
    // ============================================

    console.log(`\n[${sessionId}] 👤 STEP 2: GESTIONE USER SUPABASE`);
    console.log(`[${sessionId}] 🔍 Upsert user con outseta_user_id: ${outsetaUser.Uid}`);

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
      .select('id, outseta_user_id, email')
      .single();

    if (userError) {
      console.error(`[${sessionId}] ❌ Errore upsert user:`, {
        message: userError.message,
        code: userError.code,
        details: userError.details,
        hint: userError.hint
      });
      return res.status(500).json({ 
        error: 'Errore autenticazione user', 
        details: userError.message 
      });
    }

    if (!userRow) {
      console.error(`[${sessionId}] ❌ User row è null dopo upsert`);
      return res.status(500).json({ error: 'User row non trovato dopo upsert' });
    }

    console.log(`[${sessionId}] ✅ User creato/trovato:`, {
      id: userRow.id,
      outseta_user_id: userRow.outseta_user_id,
      email: userRow.email
    });

    // ============================================
    // STEP 3: PARSE MULTIPART FORM DATA
    // ============================================

    console.log(`\n[${sessionId}] 📦 STEP 3: PARSE FORM DATA`);
    console.log(`[${sessionId}] 🔄 Parsing multipart form...`);
    
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

    console.log(`\n[${sessionId}] 📋 STEP 4: PARSE EXCEL`);
    console.log(`[${sessionId}] 🔄 Lettura file Excel...`);
    
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheets = workbook.SheetNames;

    console.log(`[${sessionId}] ✅ Fogli trovati: ${sheets.join(', ')}`);

    if (sheets.length === 0) {
      return res.status(400).json({ error: 'File Excel vuoto o non valido' });
    }

    const firstSheet = workbook.Sheets[sheets[0]];
    const sheetData = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

    console.log(`[${sessionId}] ✅ File parsato: ${sheetData.length} righe`);

    // ============================================
    // STEP 5: EXTRACT YEAR COLUMNS
    // ============================================

    console.log(`\n[${sessionId}] 📅 STEP 5: ESTRAI COLONNE ANNI`);
    
    const yearCols = findYearColumns(sheetData);
    console.log(`[${sessionId}] ✅ Colonne anni trovate:`, yearCols);

    // ============================================
    // STEP 6: EXTRACT METRICS
    // ============================================

    console.log(`\n[${sessionId}] 📊 STEP 6: ESTRAI METRICHE`);
    console.log(`[${sessionId}] 🔄 Estrazione valori dal bilancio...`);
    
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

    console.log(`[${sessionId}] ✅ Metriche estratte:`, {
      fatturato: metrics.fatturato.currentYear,
      costiPersonale: metrics.costiPersonale.currentYear,
      ammortamenti: metrics.ammortamenti.currentYear,
      utile: metrics.utile.currentYear
    });

    // ============================================
    // STEP 7: CALCULATE PERCENTAGES
    // ============================================

    console.log(`\n[${sessionId}] 📈 STEP 7: CALCOLA PERCENTUALI`);
    
    const fatturatoCorrente = metrics.fatturato.currentYear || 1;

    const incidenze = {
      mp_pct: fatturatoCorrente > 0 ? (metrics.costiMateriePrime.currentYear || 0) / fatturatoCorrente * 100 : 0,
      servizi_pct: fatturatoCorrente > 0 ? (metrics.costiServizi.currentYear || 0) / fatturatoCorrente * 100 : 0,
      godimento_pct: fatturatoCorrente > 0 ? (metrics.costiGodimento.currentYear || 0) / fatturatoCorrente * 100 : 0,
      oneri_pct: fatturatoCorrente > 0 ? (metrics.oneriDiversi.currentYear || 0) / fatturatoCorrente * 100 : 0
    };

    console.log(`[${sessionId}] ✅ Incidenze calcolate:`, incidenze);

    // ============================================
    // STEP 8: EXTRACT FORM FIELDS
    // ============================================

    console.log(`\n[${sessionId}] 📝 STEP 8: ESTRAI CAMPI FORM`);
    
    const companyName = Array.isArray(fields.companyName) 
      ? fields.companyName[0] 
      : fields.companyName || 'Azienda';
    
    const scenario = Array.isArray(fields.scenario)
      ? fields.scenario[0]
      : fields.scenario || 'base';

    console.log(`[${sessionId}] ✅ Dati form:`, {
      company_name: companyName,
      scenario: scenario
    });

    // ============================================
    // STEP 9: PREPARA DATI PER INSERT
    // ============================================

    console.log(`\n[${sessionId}] 🔧 STEP 9: PREPARA DATI INSERT`);

    const insertData = {
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
    };

    console.log(`[${sessionId}] 📋 Dati da inserire:`, {
      id: insertData.id,
      user_id: insertData.user_id,
      company_name: insertData.company_name,
      status: insertData.status,
      user_email: insertData.user_email,
      anno0_ricavi: insertData.anno0_ricavi,
      anno0_utile: insertData.anno0_utile
    });

    // ============================================
    // STEP 10: VERIFICA STRUTTURA TABELLA
    // ============================================

    console.log(`\n[${sessionId}] 🔍 STEP 10: VERIFICA TABELLA SUPABASE`);
    console.log(`[${sessionId}] 🔄 Query test per verificare tabella...`);

    const { data: testData, error: testError } = await supabase
      .from('piano_economico_sessions')
      .select('*')
      .limit(1);

    if (testError) {
      console.error(`[${sessionId}] ❌ Errore query test:`, {
        message: testError.message,
        code: testError.code,
        details: testError.details
      });
    } else {
      console.log(`[${sessionId}] ✅ Tabella accessibile. Colonne: ${testData.length === 0 ? 'N/D (tabella vuota)' : Object.keys(testData[0]).join(', ')}`);
    }

    // ============================================
    // STEP 11: INSERT A SUPABASE
    // ============================================

    console.log(`\n[${sessionId}] 💾 STEP 11: INSERT A SUPABASE`);
    console.log(`[${sessionId}] 🔄 Eseguo insert...`);

    const { data: insertedData, error: insertError } = await supabase
      .from('piano_economico_sessions')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error(`[${sessionId}] ❌ ERRORE INSERT SUPABASE:`, {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        status: insertError.status
      });
      
      console.error(`[${sessionId}] 📋 Dati tentati:`, insertData);

      return res.status(500).json({ 
        error: 'Errore salvataggio sessione',
        errorDetails: {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        },
        sessionId: sessionId
      });
    }

    console.log(`[${sessionId}] ✅ Insert riuscito!`);
    console.log(`[${sessionId}] 📊 Dati inseriti:`, insertedData);

    // ============================================
    // STEP 12: CLEANUP E RESPONSE
    // ============================================

    console.log(`\n[${sessionId}] 🧹 STEP 12: CLEANUP`);

    try {
      fs.unlinkSync(fileObj.filepath);
      console.log(`[${sessionId}] ✅ File temporaneo eliminato`);
    } catch (e) {
      console.warn(`[${sessionId}] ⚠️ Errore eliminazione file:`, e.message);
    }

    console.log(`\n[${sessionId}] 🎉 UPLOAD COMPLETATO CON SUCCESSO`);
    console.log(`${'='.repeat(80)}\n`);

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
    console.error(`\n[${sessionId}] 💥 ERRORE FATALE:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.log(`${'='.repeat(80)}\n`);
    
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
