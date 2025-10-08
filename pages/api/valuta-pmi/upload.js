// /pages/api/valuta-pmi/upload.js
// Valuta-PMI: Upload XBRL, Parse dati finanziari e crea sessione valutazione
// VERSIONE 4.2 - Funzione di estrazione anni con diagnostica avanzata

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
// ESTRAZIONE ANNI - VERSIONE ROBUSTA E DIAGNOSTICA
// ============================================

const findYearColumns = (sheetData, sessionId = 'unknown') => {
  console.log(`[${sessionId}] 🔍 Inizio ricerca colonne degli anni...`);
  
  // STEP 1: Configura range di ricerca intelligente
  const maxRowsToScan = Math.min(sheetData.length, 30); // Aumentato a 30 righe
  const currentYear = new Date().getFullYear();
  const minValidYear = 2015;
  const maxValidYear = currentYear + 1;
  
  console.log(`[${sessionId}]   📊 Righe da analizzare: ${maxRowsToScan}`);
  console.log(`[${sessionId}]   📅 Range anni validi: ${minValidYear}-${maxValidYear}`);
  
  // STEP 2: Pattern multipli per catturare diversi formati
  const yearPatterns = [
    /\b(20\d{2})\b/,         // Anno isolato: 2023
    /(\d{2}\/\d{2}\/)?(20\d{2})/,   // Con/senza data: 31/12/2023 o 2023
    /anno\s+(20\d{2})/i,       // "Anno 2023"
    /esercizio\s+(20\d{2})/i,   // "Esercizio 2023"
    /(20\d{2})\s*$/,           // Anno alla fine della cella
    /^(20\d{2})/               // Anno all'inizio della cella
  ];
  
  let foundYears = [];
  let debugInfo = [];
  
  // STEP 3: Scansione intelligente con logging dettagliato
  for (let rowIdx = 0; rowIdx < maxRowsToScan; rowIdx++) {
    const row = sheetData[rowIdx];
    if (!row || row.length === 0) continue;
    
    // Analizza da colonna 2 in poi (salta le prime 2 colonne descrittive)
    for (let colIdx = 2; colIdx < Math.min(row.length, 15); colIdx++) {
      const cellValue = row[colIdx];
      
      // Salta celle vuote/null/undefined
      if (cellValue === null || cellValue === undefined) continue;
      
      // Converti in stringa e pulisci
      const cellStr = String(cellValue).trim();
      if (cellStr === '') continue;
      
      // Prova tutti i pattern
      for (const pattern of yearPatterns) {
        const match = cellStr.match(pattern);
        
        if (match) {
          const yearStr = match[1] || match[0].replace(/\D/g, '').slice(-4);
          const year = parseInt(yearStr, 10);
          
          // Salva info di debug
          debugInfo.push({
            row: rowIdx,
            col: colIdx,
            cell: cellStr.substring(0, 30),
            year: year,
            valid: year >= minValidYear && year <= maxValidYear
          });
          
          // Valida l'anno
          if (year >= minValidYear && year <= maxValidYear) {
            const exists = foundYears.find(y => y.year === year);
            
            if (!exists) {
              foundYears.push({ year, col: colIdx, row: rowIdx });
              console.log(`[${sessionId}]   ✅ Anno ${year} trovato in R${rowIdx}C${colIdx}: "${cellStr}"`);
            } else if (exists.col !== colIdx) {
              console.log(`[${sessionId}]   ⚠️ Anno ${year} già trovato in C${exists.col}, ignorato duplicato in C${colIdx}`);
            }
          }
          
          break; // Esci dal loop dei pattern se hai trovato un match
        }
      }
    }
    
    // Early exit: se hai trovato almeno 2 anni validi nelle prime 20 righe, fermati
    if (foundYears.length >= 2 && rowIdx >= 20) {
      console.log(`[${sessionId}]   ℹ️ Trovati 2+ anni nelle prime ${rowIdx} righe, interrompo ricerca`);
      break;
    }
  }
  
  // STEP 4: Logging diagnostico se non trova abbastanza anni
  if (foundYears.length < 2) {
    console.warn(`[${sessionId}]   ⚠️ ATTENZIONE: trovati solo ${foundYears.length} anni!`);
    console.log(`[${sessionId}]   🔎 Debug - Celle analizzate con potenziali anni:`);
    
    debugInfo.slice(0, 10).forEach(info => {
      console.log(`[${sessionId}]     • R${info.row}C${info.col}: "${info.cell}" → ${info.year} ${info.valid ? '✓' : '✗ (fuori range)'}`);
    });
    
    // FALLBACK: usa colonne di default
    console.log(`[${sessionId}]   🔄 Applico fallback con colonne predefinite`);
    return {
      currentYearCol: 3,
      previousYearCol: 4,
      years: [
        { year: currentYear - 1, col: 4, row: 0, isFallback: true },
        { year: currentYear, col: 3, row: 0, isFallback: true }
      ],
      warning: 'Anni non trovati automaticamente, usate colonne di default'
    };
  }
  
  // STEP 5: Ordina e seleziona i 2 anni più recenti
  foundYears.sort((a, b) => b.year - a.year); // Decrescente per anno
  const twoMostRecent = foundYears.slice(0, 2);
  
  // Riordina in ordine cronologico crescente [vecchio, nuovo]
  twoMostRecent.sort((a, b) => a.year - b.year);
  
  const result = {
    currentYearCol: twoMostRecent[1].col,    // Anno più recente (N)
    previousYearCol: twoMostRecent[0].col,   // Anno precedente (N-1)
    years: twoMostRecent
  };
  
  console.log(`[${sessionId}]   ✅ Anni selezionati:`);
  console.log(`[${sessionId}]     • N-1 = ${twoMostRecent[0].year} (colonna ${twoMostRecent[0].col})`);
  console.log(`[${sessionId}]     • N   = ${twoMostRecent[1].year} (colonna ${twoMostRecent[1].col})`);
  
  // STEP 6: Validazione aggiuntiva
  if (twoMostRecent[0].col === twoMostRecent[1].col) {
    console.error(`[${sessionId}]   ❌ ERRORE: entrambi gli anni nella stessa colonna ${twoMostRecent[0].col}!`);
    result.warning = 'Gli anni sono nella stessa colonna, risultati potrebbero essere errati';
  }
  
  if (Math.abs(twoMostRecent[1].year - twoMostRecent[0].year) !== 1) {
    console.warn(`[${sessionId}]   ⚠️ ATTENZIONE: anni non consecutivi (${twoMostRecent[0].year} e ${twoMostRecent[1].year})`);
    result.warning = 'Gli anni trovati non sono consecutivi';
  }
  
  return result;
};


// ============================================
// PARSING DEBITI CIVILISTICO
// ============================================
const findDebitiFinanziariCivilistico = (sheetData, yearCols, sessionId) => {
  console.log(`[${sessionId}] 🔍 Ricerca Debiti secondo schema civilistico italiano...`);

  let debitiML = { currentYear: 0, previousYear: 0 };
  let debitiBreve = { currentYear: 0, previousYear: 0 };

  let inSezioneDebiti = false;
  let foundAny = false;

  for (const row of sheetData) {
    let desc = '';
    for (let i = 0; i < Math.min(row.length, 6); i++) {
      desc += String(row[i] || '').toLowerCase().trim() + ' ';
    }
    desc = desc.replace(/\s+/g, ' ').trim();

    if (!inSezioneDebiti && (
        desc.includes('d) debiti') || 
        desc.includes('d. debiti') ||
        desc.includes('d)debiti') ||
        desc.includes('d debiti')
    )) {
      inSezioneDebiti = true;
      console.log(`[${sessionId}]   ✅ Sezione D) DEBITI trovata`);
      continue;
    }

    if (inSezioneDebiti && (
        desc.match(/^e[\)\.]/) || 
        desc.includes('totale passivo') ||
        desc.includes('totale passività')
    )) {
      console.log(`[${sessionId}]   ℹ️ Fine sezione debiti`);
      break;
    }

    if (!inSezioneDebiti) continue;

    const isEntro = /esigibili\s+entro\s+l['']esercizio\s+successivo/i.test(desc);
    const isOltre = /esigibili\s+oltre\s+l['']esercizio\s+successivo/i.test(desc);

    if (isEntro || isOltre) {
      const cur = parseValue(row[yearCols.currentYearCol]);
      const prev = parseValue(row[yearCols.previousYearCol]);

      if (cur !== null || prev !== null) {
        foundAny = true;

        if (isOltre) {
          debitiML.currentYear += (cur || 0);
          debitiML.previousYear += (prev || 0);
          console.log(`[${sessionId}]   └─ M/L: N=${cur}, N-1=${prev} | "${desc.substring(0, 50)}..."`);
        }

        if (isEntro) {
          debitiBreve.currentYear += (cur || 0);
          debitiBreve.previousYear += (prev || 0);
          console.log(`[${sessionId}]   └─ Breve: N=${cur}, N-1=${prev} | "${desc.substring(0, 50)}..."`);
        }
      }
    }
  }

  if (!foundAny || (debitiML.currentYear === 0 && debitiBreve.currentYear === 0)) {
    console.log(`[${sessionId}]   ⚠️ Debiti non trovati → richiede input manuale`);
    return {
      breve_termine: { currentYear: null, previousYear: null },
      ml_termine: { currentYear: null, previousYear: null },
      requiresManualEntry: true
    };
  }

  console.log(`[${sessionId}]   ✅ Debiti M/L: N=${debitiML.currentYear}, N-1=${debitiML.previousYear}`);
  console.log(`[${sessionId}]   ✅ Debiti Breve: N=${debitiBreve.currentYear}, N-1=${debitiBreve.previousYear}`);

  return {
    breve_termine: debitiBreve,
    ml_termine: debitiML,
    requiresManualEntry: false
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
  ebitda: [ 
    { primary: ["margine operativo lordo (ebitda)"] },
    { primary: ["ebitda"] }
  ],
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
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });
    
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userRow } = await supabase
      .from('users')
      .upsert({ 
          outseta_user_id: outsetaUser.Uid, 
          email: outsetaUser.Email, 
          first_name: outsetaUser.FirstName || '', 
          last_name: outsetaUser.LastName || '' 
        }, { onConflict: 'outseta_user_id' })
      .select('id')
      .single();
    
    if (!userRow) throw new Error('Impossibile autenticare utente');

    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const fileInput = files.file?.[0];
    if (!fileInput) return res.status(400).json({ error: 'Nessun file XBRL caricato' });
    
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
    
    const companyName = String(fields.companyName?.[0] || '').trim() || 'Azienda non specificata';
    
    const { data: companyRow } = await supabase
      .from('companies')
      .upsert({ user_id: userRow.id, company_name: companyName }, { onConflict: 'user_id,company_name' })
      .select('id')
      .single();
    
    if (!companyRow) throw new Error('Impossibile creare azienda');
    
    sessionId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await supabase.from('valuations').insert({ 
        session_id: sessionId, 
        user_id: userRow.id, 
        company_name: companyName, 
        status: 'processing' 
      });
    
    console.log(`[${sessionId}] 🚀 Sessione valutazione creata per "${companyName}"`);

    // 7. TROVA ANNI (NUOVA VERSIONE ROBUSTA)
    const yearColsBS = findYearColumns(balanceSheetData, sessionId);
    const yearColsIS = findYearColumns(incomeStatementData, sessionId);
    
    // Gestisci eventuali warning
    if (yearColsBS.warning || yearColsIS.warning) {
      console.warn(`[${sessionId}] ⚠️ Warning estrazione anni:`, {
        statPatrimoniale: yearColsBS.warning,
        contoEconomico: yearColsIS.warning
      });
    }

    // Se entrambi hanno fallback, potresti voler segnalare all'utente
    if (yearColsBS.years[0]?.isFallback && yearColsIS.years[0]?.isFallback) {
      // Opzionale: aggiungi un flag nel response per mostrare un avviso all'utente
      console.error(`[${sessionId}] ❌ CRITICO: impossibile estrarre anni automaticamente`);
    }

    const yearsExtracted = yearColsBS.years.map(y => y.year);
    console.log(`[${sessionId}] 📅 Anni estratti:`, yearsExtracted);
    console.log(`[${sessionId}] 📊 Colonne SP: N=${yearColsBS.currentYearCol}, N-1=${yearColsBS.previousYearCol}`);
    console.log(`[${sessionId}] 📊 Colonne CE: N=${yearColsIS.currentYearCol}, N-1=${yearColsIS.previousYearCol}`);

    const atecoRaw = companyInfoData.length > 0 ? findSimpleValue(companyInfoData, ['settore di attività prevalente', 'codice ateco']) : null;
    const atecoCode = atecoRaw?.match(/(\d{2})/)?.[1] || null;
    console.log(`[${sessionId}] 🏢 ATECO estratto: ${atecoCode}`);

    const metrics = {};
    for (const key in metricsConfigs) {
      const isBalanceSheetMetric = ['patrimonioNetto', 'disponibilitaLiquide'].includes(key);
      metrics[key] = findValueInSheet(
        isBalanceSheetMetric ? balanceSheetData : incomeStatementData,
        metricsConfigs[key],
        isBalanceSheetMetric ? yearColsBS : yearColsIS,
        key
      );
    }
    
    const debitiFinanziari = findDebitiFinanziariCivilistico(balanceSheetData, yearColsBS, sessionId);
    
    const historicalData = {};
    yearsExtracted.forEach((year, index) => {
        const yearKey = index === 1 ? 'currentYear' : 'previousYear';
        historicalData[year] = {
            ricavi: metrics.fatturato[yearKey],
            ebitda: metrics.ebitda[yearKey],
            patrimonio_netto: metrics.patrimonioNetto[yearKey],
            debiti_finanziari_ml: debitiFinanziari.ml_termine[yearKey],
            debiti_finanziari_breve: debitiFinanziari.breve_termine[yearKey],
            disponibilita_liquide: metrics.disponibilitaLiquide[yearKey],
        };
    });

    const valuationInputs = {
      market_position: 'follower',
      customer_concentration: 'medium',
      technology_risk: 'medium'
    };
    
    const { error: updateError } = await supabase
      .from('valuations')
      .update({
        years_analyzed: yearsExtracted,
        historical_data: historicalData,
        valuation_inputs: valuationInputs,
        sector_ateco: atecoCode,
        status: debitiFinanziari.requiresManualEntry ? 'data_entry' : 'complete'
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

