// /pages/api/valuta-pmi/upload.js
// Valuta-PMI: Upload XBRL, Parse dati finanziari e crea sessione valutazione
// VERSIONE 3.0 - Fix anni corretti + parsing debiti civilistico + estrazione nome azienda + date esercizi

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import xlsx from 'xlsx';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

// ============================================
// FUNZIONI UTILITY
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

// ============================================
// FIX 1: ESTRAZIONE ANNI CORRETTA
// ============================================

const findYearColumns = (sheetData) => {
  console.log('🔍 Ricerca colonne degli anni...');
  
  const yearRegex = /(20\d{2})/;
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/; // es. 31/12/2023
  let years = [];
  
  // Cerca nelle prime 30 righe (header + intestazioni)
  for (let i = 0; i < Math.min(sheetData.length, 30); i++) {
    const row = sheetData[i];
    
    for (let j = 2; j < row.length; j++) {
      const cell = String(row[j] ?? '').trim();
      
      // Cerca pattern data completa (es. "31/12/2023" o "Esercizio al 31/12/2023")
      const dateMatch = cell.match(dateRegex);
      if (dateMatch) {
        const year = parseInt(dateMatch[3], 10);
        const fullDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
        
        const currentYear = new Date().getFullYear();
        if (year >= 2015 && year <= currentYear + 1) {
          if (!years.find(y => y.year === year)) {
            years.push({ 
              year, 
              col: j, 
              endDate: fullDate,
              source: 'date_pattern'
            });
            console.log(`  ✅ Anno ${year} trovato in colonna ${j} (data: ${fullDate})`);
          }
        }
        continue;
      }
      
      // Se non trova la data completa, cerca solo l'anno
      const yearMatch = cell.match(yearRegex);
      if (yearMatch) {
        const year = parseInt(yearMatch[1], 10);
        const currentYear = new Date().getFullYear();
        
        // Filtri più stringenti per evitare falsi positivi
        const isHeader = i < 15; // Deve essere nelle prime 15 righe
        const cellLength = cell.length;
        const isLikelyYear = cellLength <= 20; // Celle brevi (non descrizioni lunghe)
        
        if (year >= 2015 && year <= currentYear + 1 && isHeader && isLikelyYear) {
          if (!years.find(y => y.year === year)) {
            years.push({ 
              year, 
              col: j,
              endDate: `${year}-12-31`, // Assume fine anno
              source: 'year_only'
            });
            console.log(`  ✅ Anno ${year} trovato in colonna ${j} (solo anno)`);
          }
        }
      }
    }
    
    // Se ha trovato almeno 2 anni, fermati
    if (years.length >= 2) break;
  }
  
  // Fallback: usa colonne di default solo se non trova NULLA
  if (years.length < 2) {
    console.warn('⚠️ Anni non trovati, uso colonne di default');
    const currentYear = new Date().getFullYear();
    return { 
      currentYearCol: 3, 
      previousYearCol: 4, 
      years: [
        { year: currentYear - 1, col: 4, endDate: `${currentYear - 1}-12-31` },
        { year: currentYear, col: 3, endDate: `${currentYear}-12-31` }
      ]
    };
  }
  
  // Rimuovi duplicati e ordina per anno decrescente
  const uniqueYears = [...new Map(years.map(item => [item.year, item])).values()];
  uniqueYears.sort((a, b) => b.year - a.year);
  
  console.log(`✅ Anni finali estratti:`, uniqueYears.map(y => `${y.year} (col ${y.col})`));
  
  return { 
    currentYearCol: uniqueYears[0].col, 
    previousYearCol: uniqueYears[1]?.col || uniqueYears[0].col + 1,
    years: uniqueYears.slice(0, 2).reverse() // [vecchio, nuovo]
  };
};

// ============================================
// ESTRAZIONE DATE ESERCIZI DA SEZIONE DEDICATA
// ============================================

const extractFiscalYearDates = (companyInfoData) => {
  console.log('📅 Ricerca date esercizi...');
  
  const fiscalYears = [];
  let currentExercise = null;
  let previousExercise = null;
  
  for (let i = 0; i < companyInfoData.length; i++) {
    const row = companyInfoData[i];
    
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase().trim();
      
      // Cerca "Esercizio di riferimento" o "Esercizio precedente"
      if (cell.includes('esercizio di riferimento') || cell.includes('esercizio corrente')) {
        currentExercise = { type: 'current', startDate: null, endDate: null };
        console.log('  ✅ Trovato "Esercizio di riferimento"');
        
        // Cerca le date nelle righe successive
        for (let k = i; k < Math.min(i + 10, companyInfoData.length); k++) {
          const nextRow = companyInfoData[k];
          const rowText = nextRow.join(' ').toLowerCase();
          
          if (rowText.includes('inizio')) {
            // Cerca la data nella stessa riga o colonna successiva
            for (let m = 0; m < nextRow.length; m++) {
              const dateMatch = String(nextRow[m] || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (dateMatch) {
                currentExercise.startDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                console.log(`    └─ Inizio: ${currentExercise.startDate}`);
                break;
              }
            }
          }
          
          if (rowText.includes('fine') || rowText.includes('chiusura')) {
            for (let m = 0; m < nextRow.length; m++) {
              const dateMatch = String(nextRow[m] || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (dateMatch) {
                currentExercise.endDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                console.log(`    └─ Fine: ${currentExercise.endDate}`);
                break;
              }
            }
          }
        }
      }
      
      if (cell.includes('esercizio precedente')) {
        previousExercise = { type: 'previous', startDate: null, endDate: null };
        console.log('  ✅ Trovato "Esercizio precedente"');
        
        for (let k = i; k < Math.min(i + 10, companyInfoData.length); k++) {
          const nextRow = companyInfoData[k];
          const rowText = nextRow.join(' ').toLowerCase();
          
          if (rowText.includes('inizio')) {
            for (let m = 0; m < nextRow.length; m++) {
              const dateMatch = String(nextRow[m] || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (dateMatch) {
                previousExercise.startDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                console.log(`    └─ Inizio: ${previousExercise.startDate}`);
                break;
              }
            }
          }
          
          if (rowText.includes('fine') || rowText.includes('chiusura')) {
            for (let m = 0; m < nextRow.length; m++) {
              const dateMatch = String(nextRow[m] || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (dateMatch) {
                previousExercise.endDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                console.log(`    └─ Fine: ${previousExercise.endDate}`);
                break;
              }
            }
          }
        }
      }
    }
  }
  
  // Componi l'array finale
  if (previousExercise?.endDate) {
    const year = parseInt(previousExercise.endDate.split('-')[0], 10);
    fiscalYears.push({
      year,
      startDate: previousExercise.startDate || `${year}-01-01`,
      endDate: previousExercise.endDate
    });
  }
  
  if (currentExercise?.endDate) {
    const year = parseInt(currentExercise.endDate.split('-')[0], 10);
    fiscalYears.push({
      year,
      startDate: currentExercise.startDate || `${year}-01-01`,
      endDate: currentExercise.endDate
    });
  }
  
  console.log('📅 Date esercizi estratte:', fiscalYears);
  return fiscalYears;
};

// ============================================
// FIX 2: ESTRAZIONE NOME AZIENDA DA XBRL
// ============================================

const extractCompanyName = (companyInfoData) => {
  console.log('🏢 Ricerca nome azienda...');
  
  const searchTerms = [
    'denominazione',
    'ragione sociale',
    'nome della ditta',
    'nome impresa',
    'ditta',
    'società'
  ];
  
  for (const row of companyInfoData) {
    for (let i = 0; i < row.length; i++) {
      const cell = String(row[i] || '').toLowerCase().trim();
      
      // Controlla se la cella contiene uno dei termini di ricerca
      if (searchTerms.some(term => cell.includes(term))) {
        // Il nome dovrebbe essere nella cella successiva
        for (let j = i + 1; j < row.length; j++) {
          const valueCell = String(row[j] || '').trim();
          
          // Esclude celle vuote, numeri puri, date, codici fiscali
          if (valueCell && 
              valueCell.length > 3 && 
              valueCell.length < 100 &&
              !/^\d+$/.test(valueCell) && // Non solo numeri
              !/^\d{2}\/\d{2}\/\d{4}$/.test(valueCell)) { // Non date
            
            console.log(`  ✅ Nome azienda trovato: "${valueCell}"`);
            return valueCell;
          }
        }
      }
    }
  }
  
  console.log('  ⚠️ Nome azienda non trovato nel file XBRL');
  return null;
};

// ============================================
// FIX 3: PARSING DEBITI CIVILISTICO
// ============================================

const findDebitiFinanziariCivilistico = (sheetData, yearCols, sessionId) => {
  console.log(`[${sessionId}] 🔍 Ricerca Debiti secondo schema civilistico italiano...`);
  
  let debitiML = { currentYear: 0, previousYear: 0 };
  let debitiBreve = { currentYear: 0, previousYear: 0 };
  
  let inSezioneDebiti = false;
  let foundAny = false;
  
  for (const row of sheetData) {
    // Concatena le prime colonne per formare la descrizione
    let desc = '';
    for (let i = 0; i < Math.min(row.length, 6); i++) {
      desc += String(row[i] || '').toLowerCase().trim() + ' ';
    }
    desc = desc.replace(/\s+/g, ' ').trim();
    
    // STEP 1: Trova la sezione D) DEBITI
    if (!inSezioneDebiti && (
        desc.includes('d) debiti') || 
        desc.includes('d. debiti') ||
        desc.includes('d)debiti')
    )) {
      inSezioneDebiti = true;
      console.log(`[${sessionId}]   ✅ Sezione D) DEBITI trovata`);
      continue;
    }
    
    // STEP 2: Esci se arrivi alla sezione successiva
    if (inSezioneDebiti && (
        desc.match(/^e\)/) || 
        desc.includes('totale passivo') ||
        desc.includes('totale passività')
    )) {
      console.log(`[${sessionId}]   ℹ️ Fine sezione debiti`);
      break;
    }
    
    if (!inSezioneDebiti) continue;
    
    // STEP 3: Identifica le voci rilevanti
    const isD1 = desc.includes('d.1') || desc.includes('d1') || desc.includes('obbligazioni');
    const isD3 = desc.includes('d.3') || desc.includes('d3') || desc.includes('debiti verso banche');
    const isD4 = desc.includes('d.4') || desc.includes('d4') || desc.includes('altri finanziatori');
    
    // STEP 4: Identifica se è oltre o entro l'esercizio
    const isOltre = desc.includes('oltre') || 
                    desc.includes("oltre l'esercizio") ||
                    desc.includes('oltre esercizio') ||
                    desc.includes('medio/lungo termine') ||
                    desc.includes('m/l termine') ||
                    desc.includes('consolidati');
                    
    const isEntro = desc.includes('entro') || 
                    desc.includes("entro l'esercizio") ||
                    desc.includes('entro esercizio') ||
                    desc.includes('breve termine') ||
                    desc.includes('quota corrente') ||
                    desc.includes('correnti');
    
    // STEP 5: Se è una voce di debito finanziario, estrai i valori
    if ((isD1 || isD3 || isD4) && (isOltre || isEntro)) {
      const cur = parseValue(row[yearCols.currentYearCol]);
      const prev = parseValue(row[yearCols.previousYearCol]);
      
      if (cur !== null || prev !== null) {
        foundAny = true;
        
        if (isOltre) {
          debitiML.currentYear += (cur || 0);
          debitiML.previousYear += (prev || 0);
          console.log(`[${sessionId}]   └─ M/L: N=${cur}, N-1=${prev} | "${desc.substring(0, 50)}..."`);
        } else if (isEntro) {
          debitiBreve.currentYear += (cur || 0);
          debitiBreve.previousYear += (prev || 0);
          console.log(`[${sessionId}]   └─ Breve: N=${cur}, N-1=${prev} | "${desc.substring(0, 50)}..."`);
        }
      }
    }
  }
  
  // Se non trova nessun debito, ritorna NULL (NO STIME!)
  if (!foundAny || (debitiML.currentYear === 0 && debitiBreve.currentYear === 0)) {
    console.log(`[${sessionId}]   ⚠️ Debiti finanziari NON trovati nel bilancio`);
    return { 
      ml_termine: { currentYear: null, previousYear: null },
      breve_termine: { currentYear: null, previousYear: null }
    };
  }
  
  console.log(`[${sessionId}]   ✅ Totale Debiti M/L: N=${debitiML.currentYear}, N-1=${debitiML.previousYear}`);
  console.log(`[${sessionId}]   ✅ Totale Debiti Breve: N=${debitiBreve.currentYear}, N-1=${debitiBreve.previousYear}`);
  
  return { 
    ml_termine: debitiML, 
    breve_termine: debitiBreve 
  };
};

// ============================================
// FUNZIONI DI RICERCA ALTRE METRICHE
// ============================================

const findValueInSheet = (sheetData, searchConfigs, yearCols, metricName) => {
  for (const config of searchConfigs) {
    const primaryTerms = config.primary.map(t => t.toLowerCase().trim());
    const exclusionTerms = (config.exclusion || []).map(t => t.toLowerCase().trim());
    
    for (const row of sheetData) {
      let description = '';
      for (let i = 0; i < Math.min(row.length, 6); i++) {
        description += String(row[i] || '').toLowerCase().trim() + ' ';
      }
      description = description.replace(/\s+/g, ' ').trim();
      
      const allPrimaryFound = primaryTerms.every(term => description.includes(term));
      const anyExclusionFound = exclusionTerms.some(term => description.includes(term));
      
      if (allPrimaryFound && !anyExclusionFound) {
        const result = {
          currentYear: parseValue(row[yearCols.currentYearCol]),
          previousYear: parseValue(row[yearCols.previousYearCol])
        };
        if (result.currentYear !== null || result.previousYear !== null) {
          console.log(`[${metricName}] Trovato: "${description.substring(0, 50)}..." | N=${result.currentYear}, N-1=${result.previousYear}`);
          return result;
        }
      }
    }
  }
  console.log(`[${metricName}] Non trovato`);
  return { currentYear: null, previousYear: null };
};

const metricsConfigs = {
  fatturato: [
    { primary: ["a) ricavi delle vendite e delle prestazioni"] }, 
    { primary: ["ricavi delle vendite"] }
  ],
  patrimonioNetto: [
    { primary: ["totale patrimonio netto"] }, 
    { primary: ["a) patrimonio netto"] }
  ],
  disponibilitaLiquide: [
    { primary: ["disponibilità liquide"] }
  ],
  utilePerdita: [
    { primary: ["utile (perdita) dell'esercizio"] }, 
    { primary: ["risultato dell'esercizio"] }
  ],
  imposte: [
    { primary: ["imposte sul reddito dell'esercizio"] }, 
    { primary: ["imposte sul reddito"] }
  ],
  oneriFinanziari: [
    { primary: ["interessi e altri oneri finanziari"] }
  ],
  ammortamenti: [
    { primary: ["ammortamenti e svalutazioni"] }
  ]
};

const findSimpleValue = (sheetData, searchTexts) => {
  const normalizedSearchTexts = searchTexts.map(t => t.toLowerCase().trim());
  for (const row of sheetData) {
    for (let j = 0; j < row.length; j++) {
      const cellContent = String(row[j] || '').toLowerCase().trim();
      if (normalizedSearchTexts.some(searchText => cellContent.includes(searchText))) {
        for (let k = j + 1; k < row.length; k++) {
          const valueCell = String(row[k] || '').trim();
          if (valueCell && valueCell !== '' && !normalizedSearchTexts.some(st => valueCell.toLowerCase().includes(st))) {
            return valueCell;
          }
        }
      }
    }
  }
  return null;
};

// ============================================
// HANDLER PRINCIPALE
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non permesso' });
  
  let sessionId = null;
  
  try {
    // 1. AUTENTICAZIONE
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });
    
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userRow } = await supabase
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
    
    if (!userRow) throw new Error('Impossibile autenticare utente');

    // 2. PARSE FORM
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const fileInput = files.file?.[0];
    if (!fileInput) return res.status(400).json({ error: 'Nessun file XBRL caricato' });
    
    // 3. LEGGI FILE XBRL
    const fileBuffer = fs.readFileSync(fileInput.filepath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const balanceSheet = workbook.Sheets['T0002'] || workbook.Sheets['T0001'];
    const incomeStatement = workbook.Sheets['T0006'] || workbook.Sheets['T0005'];
    const companyInfo = workbook.Sheets['T0000'];
    
    if (!balanceSheet || !incomeStatement) {
      throw new Error('Fogli XBRL mancanti (T0002/T0006 o T0001/T0005)');
    }

    const balanceSheetData = xlsx.utils.sheet_to_json(balanceSheet, { header: 1 });
    const incomeStatementData = xlsx.utils.sheet_to_json(incomeStatement, { header: 1 });
    const companyInfoData = companyInfo ? xlsx.utils.sheet_to_json(companyInfo, { header: 1 }) : [];
    
    // 4. ESTRAI NOME AZIENDA (FIX 2)
    let companyName = extractCompanyName(companyInfoData);
    
    // Fallback: usa il nome inserito manualmente dall'utente
    if (!companyName) {
      companyName = String(fields.companyName?.[0] || '').trim() || 'Azienda non specificata';
      console.log(`⚠️ Nome azienda da input manuale: "${companyName}"`);
    }
    
    // 5. CREA AZIENDA
    const { data: companyRow } = await supabase
      .from('companies')
      .upsert(
        { user_id: userRow.id, company_name: companyName }, 
        { onConflict: 'user_id,company_name' }
      )
      .select('id')
      .single();
    
    if (!companyRow) throw new Error('Impossibile creare azienda');
    
    // 6. CREA SESSIONE
    sessionId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await supabase
      .from('valuations')
      .insert({ 
        session_id: sessionId, 
        user_id: userRow.id, 
        company_name: companyName, 
        status: 'processing' 
      });
    
    console.log(`[${sessionId}] 🚀 Sessione valutazione creata per "${companyName}"`);

    // 7. TROVA ANNI E DATE ESERCIZI (FIX 1)
    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);
    
    // Estrai gli anni dalle colonne
    const yearsExtracted = yearColsBS.years.map(y => parseInt(y.year, 10));
    
    // Estrai le date ESATTE dal foglio T0000
    let fiscalYears = extractFiscalYearDates(companyInfoData);
    
    // Fallback: se non trova le date, usa quelle dalle colonne
    if (fiscalYears.length === 0) {
      console.log('⚠️ Date esercizi non trovate in T0000, uso date dalle colonne');
      fiscalYears = yearColsBS.years.map(y => ({
        year: parseInt(y.year, 10),
        endDate: y.endDate,
        startDate: `${y.year}-01-01`
      }));
    }
    
    // Assicurati che l'ordine sia: [anno vecchio, anno nuovo]
    fiscalYears.sort((a, b) => a.year - b.year);
    
    console.log(`[${sessionId}] 📅 Anni estratti:`, yearsExtracted);
    console.log(`[${sessionId}] 📅 Date esercizi:`, fiscalYears);

    // 8. ESTRAI ATECO
    const atecoRaw = companyInfoData.length > 0 
      ? findSimpleValue(companyInfoData, ['settore di attività prevalente', 'codice ateco']) 
      : null;
    const atecoCode = atecoRaw?.match(/(\d{2})/)?.[1] || null;
    console.log(`[${sessionId}] 🏢 ATECO estratto: ${atecoCode}`);

    // 9. ESTRAI METRICHE
    const metrics = {};
    for (const key in metricsConfigs) {
      metrics[key] = findValueInSheet(
        ['patrimonioNetto', 'disponibilitaLiquide'].includes(key) ? balanceSheetData : incomeStatementData,
        metricsConfigs[key],
        ['patrimonioNetto', 'disponibilitaLiquide'].includes(key) ? yearColsBS : yearColsIS,
        key
      );
    }
    
    // 10. ESTRAI DEBITI FINANZIARI (FIX 3 - NIENTE FALLBACK!)
    const debitiFinanziari = findDebitiFinanziariCivilistico(balanceSheetData, yearColsBS, sessionId);
    
    // 11. CALCOLA EBITDA
    const ebitda = {
      currentYear: (metrics.utilePerdita.currentYear || 0) + (metrics.imposte.currentYear || 0) + (metrics.oneriFinanziari.currentYear || 0) + (metrics.ammortamenti.currentYear || 0),
      previousYear: (metrics.utilePerdita.previousYear || 0) + (metrics.imposte.previousYear || 0) + (metrics.oneriFinanziari.previousYear || 0) + (metrics.ammortamenti.previousYear || 0)
    };
    
    console.log(`[${sessionId}] 💰 EBITDA calcolato: N=${ebitda.currentYear}, N-1=${ebitda.previousYear}`);
    
    // 12. CALCOLA PFN (usa null se debiti non trovati)
    const pfn = {
      currentYear: debitiFinanziari.ml_termine.currentYear !== null && debitiFinanziari.breve_termine.currentYear !== null
        ? (debitiFinanziari.ml_termine.currentYear || 0) + (debitiFinanziari.breve_termine.currentYear || 0) - (metrics.disponibilitaLiquide.currentYear || 0)
        : null,
      previousYear: debitiFinanziari.ml_termine.previousYear !== null && debitiFinanziari.breve_termine.previousYear !== null
        ? (debitiFinanziari.ml_termine.previousYear || 0) + (debitiFinanziari.breve_termine.previousYear || 0) - (metrics.disponibilitaLiquide.previousYear || 0)
        : null
    };
    
    console.log(`[${sessionId}] 📊 PFN calcolata: N=${pfn.currentYear}, N-1=${pfn.previousYear}`);

    // 13. PREPARA DATI STORICI
    const yearN_1 = yearsExtracted[0];
    const yearN = yearsExtracted[1];
    
    const historicalData = {
      [yearN]: {
        ricavi: metrics.fatturato.currentYear,
        ebitda: ebitda.currentYear,
        patrimonio_netto: metrics.patrimonioNetto.currentYear,
        debiti_finanziari_ml: debitiFinanziari.ml_termine.currentYear,
        debiti_finanziari_breve: debitiFinanziari.breve_termine.currentYear,
        disponibilita_liquide: metrics.disponibilitaLiquide.currentYear,
        pfn: pfn.currentYear
      },
      [yearN_1]: {
        ricavi: metrics.fatturato.previousYear,
        ebitda: ebitda.previousYear,
        patrimonio_netto: metrics.patrimonioNetto.previousYear,
        debiti_finanziari_ml: debitiFinanziari.ml_termine.previousYear,
        debiti_finanziari_breve: debitiFinanziari.breve_termine.previousYear,
        disponibilita_liquide: metrics.disponibilitaLiquide.previousYear,
        pfn: pfn.previousYear
      }
    };
    
    const valuationInputs = {
      market_position: 'follower',
      customer_concentration: 'medium',
      technology_risk: 'medium'
    };
    
    // 14. SALVA DATI (+ fiscal_years)
    const { error: updateError } = await supabase
      .from('valuations')
      .update({
        years_analyzed: yearsExtracted,
        fiscal_years: fiscalYears, // NUOVO CAMPO CON DATE!
        historical_data: historicalData,
        valuation_inputs: valuationInputs,
        sector_ateco: atecoCode,
        status: 'data_entry'
      })
      .eq('session_id', sessionId);
    
    if (updateError) {
      console.error(`[${sessionId}] ❌ Errore update:`, updateError);
      throw updateError;
    }
    
    console.log(`[${sessionId}] ✅ Dati salvati correttamente su Supabase`);
    
    return res.status(200).json({ 
      success: true, 
      sessionId: sessionId,
      companyName: companyName,
      years: yearsExtracted
    });

  } catch (error) {
    console.error(`[${sessionId || 'NO_SESSION'}] ❌ Errore upload XBRL:`, error);
    if (sessionId) {
      await supabase
        .from('valuations')
        .update({ 
          status: 'failed', 
          error_message: error.message 
        })
        .eq('session_id', sessionId);
    }
    return res.status(500).json({ 
      error: error.message || "Errore durante l'upload del file" 
    });
  }
}
