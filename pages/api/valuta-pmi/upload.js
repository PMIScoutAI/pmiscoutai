// /pages/api/valuta-pmi/upload.js
// Valuta-PMI: Upload XBRL, Parse dati finanziari e crea sessione valutazione
// VERSIONE 4.3 - Funzione di estrazione anni ultra-robusta

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
// ESTRAZIONE ANNI - VERSIONE ULTRA-ROBUSTA
// Fix per problema anni vecchi (es. 2017-2018 invece di 2023-2024)
// ============================================

const findYearColumns = (sheetData, sessionId = 'unknown') => {
  console.log(`[${sessionId}] 🔍 Inizio ricerca colonne degli anni...`);
  
  const currentYear = new Date().getFullYear();
  const minValidYear = currentYear - 5; // Solo ultimi 5 anni
  const maxValidYear = currentYear + 1;
  
  console.log(`[${sessionId}]   📅 Range anni validi: ${minValidYear}-${maxValidYear}`);
  console.log(`[${sessionId}]   📅 Anno corrente: ${currentYear}`);
  
  // ============================================
  // STRATEGIA 1: Cerca SOLO nelle prime 3 righe (header principale)
  // ============================================
  
  const headerRowsToScan = Math.min(3, sheetData.length);
  let candidateYears = [];
  
  console.log(`[${sessionId}]   🎯 Strategia 1: Scansione righe header (0-${headerRowsToScan-1})`);
  
  for (let rowIdx = 0; rowIdx < headerRowsToScan; rowIdx++) {
    const row = sheetData[rowIdx];
    if (!row || row.length === 0) continue;
    
    // Analizza TUTTE le colonne (non solo da 2 in poi)
    for (let colIdx = 0; colIdx < Math.min(row.length, 20); colIdx++) {
      const cellValue = row[colIdx];
      if (cellValue === null || cellValue === undefined) continue;
      
      const cellStr = String(cellValue).trim();
      if (cellStr === '') continue;
      
      // Cerca anno con formato semplice: deve contenere 4 cifre 20XX
      const yearMatch = cellStr.match(/20(\d{2})/);
      
      if (yearMatch) {
        const year = parseInt('20' + yearMatch[1], 10);
        
        // Log di debug per ogni anno trovato
        console.log(`[${sessionId}]     • R${rowIdx}C${colIdx}: "${cellStr}" → Anno ${year}`);
        
        // Verifica se è nell'intervallo valido
        if (year >= minValidYear && year <= maxValidYear) {
        
          // Controlla se è una cella HEADER (non un valore di dato)
          // Gli header sono tipicamente:
          // - Nelle prime 3 righe
          // - Contengono solo l'anno o "31/12/2024" o "Esercizio 2024"
          // - NON contengono molti altri numeri
          
          const hasOnlyYearInfo = cellStr.length < 50 && // Cella corta
                                  (cellStr.match(/\d+/g) || []).length <= 3; // Max 3 gruppi di cifre
          
          if (hasOnlyYearInfo) {
            candidateYears.push({
              year: year,
              col: colIdx,
              row: rowIdx,
              cell: cellStr,
              priority: rowIdx === 0 ? 10 : (rowIdx === 1 ? 5 : 1) // Priorità alla riga 0
            });
            
            console.log(`[${sessionId}]       ✅ Candidato valido: ${year} in colonna ${colIdx}`);
          } else {
            console.log(`[${sessionId}]       ⚠️ Scartato (troppo complesso): "${cellStr}"`);
          }
        } else {
          console.log(`[${sessionId}]       ❌ Scartato (anno troppo vecchio o futuro): ${year}`);
        }
      }
    }
  }
  
  // ============================================
  // STRATEGIA 2: Se non trova nulla, estendi a 10 righe
  // ============================================
  
  if (candidateYears.length < 2) {
    console.log(`[${sessionId}]   🔄 Strategia 2: Estendo ricerca a 10 righe...`);
    
    const extendedRowsToScan = Math.min(10, sheetData.length);
    
    for (let rowIdx = headerRowsToScan; rowIdx < extendedRowsToScan; rowIdx++) {
      const row = sheetData[rowIdx];
      if (!row || row.length === 0) continue;
      
      for (let colIdx = 2; colIdx < Math.min(row.length, 15); colIdx++) {
        const cellValue = row[colIdx];
        if (cellValue === null || cellValue === undefined) continue;
        
        const cellStr = String(cellValue).trim();
        if (cellStr === '') continue;
        
        const yearMatch = cellStr.match(/20(\d{2})/);
        
        if (yearMatch) {
          const year = parseInt('20' + yearMatch[1], 10);
          
          if (year >= minValidYear && year <= maxValidYear) {
            const hasOnlyYearInfo = cellStr.length < 50 && (cellStr.match(/\d+/g) || []).length <= 3;
            
            if (hasOnlyYearInfo) {
              candidateYears.push({
                year: year,
                col: colIdx,
                row: rowIdx,
                cell: cellStr,
                priority: 1
              });
              
              console.log(`[${sessionId}]     • R${rowIdx}C${colIdx}: "${cellStr}" → Anno ${year} ✅`);
            }
          }
        }
      }
    }
  }
  
  // ============================================
  // VALIDAZIONE E SELEZIONE
  // ============================================
  
  if (candidateYears.length < 2) {
    console.error(`[${sessionId}]   ❌ FALLIMENTO: trovati solo ${candidateYears.length} anni validi`);
    console.log(`[${sessionId}]   🔎 Debug - Stampo TUTTE le prime 5 righe per analisi manuale:`);
    
    for (let i = 0; i < Math.min(5, sheetData.length); i++) {
      console.log(`[${sessionId}]     Riga ${i}:`, sheetData[i]?.slice(0, 10));
    }
    
    // FALLBACK con anni più recenti
    return {
      currentYearCol: 3,
      previousYearCol: 4,
      years: [
        { year: currentYear - 1, col: 4, row: 0, isFallback: true },
        { year: currentYear, col: 3, row: 0, isFallback: true }
      ],
      warning: `ATTENZIONE: Impossibile trovare anni automaticamente. Usando fallback ${currentYear-1}/${currentYear}.`,
      requiresManualValidation: true
    };
  }
  
  // Rimuovi duplicati (stesso anno)
  const uniqueYears = [];
  const seenYears = new Set();
  
  for (const candidate of candidateYears) {
    if (!seenYears.has(candidate.year)) {
      seenYears.add(candidate.year);
      uniqueYears.push(candidate);
    }
  }
  
  // Ordina per priorità (riga 0 prima) poi per anno decrescente
  uniqueYears.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.year - a.year;
  });
  
  // Prendi i 2 più recenti
  const twoMostRecent = uniqueYears.slice(0, 2);
  
  // Ordina in ordine cronologico [vecchio, nuovo]
  twoMostRecent.sort((a, b) => a.year - b.year);
  
  // ============================================
  // VALIDAZIONE FINALE
  // ============================================
  
  const result = {
    currentYearCol: twoMostRecent[1].col,
    previousYearCol: twoMostRecent[0].col,
    years: twoMostRecent
  };
  
  console.log(`[${sessionId}]   ✅ Anni finali selezionati:`);
  console.log(`[${sessionId}]     • N-1 = ${twoMostRecent[0].year} (colonna ${twoMostRecent[0].col}, riga ${twoMostRecent[0].row})`);
  console.log(`[${sessionId}]     • N   = ${twoMostRecent[1].year} (colonna ${twoMostRecent[1].col}, riga ${twoMostRecent[1].row})`);
  
  // Controlli di sicurezza
  const warnings = [];
  
  if (twoMostRecent[0].col === twoMostRecent[1].col) {
    warnings.push('Gli anni sono nella stessa colonna');
    console.error(`[${sessionId}]   ❌ ERRORE: stessa colonna ${twoMostRecent[0].col}!`);
  }
  
  const yearDiff = Math.abs(twoMostRecent[1].year - twoMostRecent[0].year);
  if (yearDiff !== 1) {
    warnings.push(`Gli anni non sono consecutivi (distanza: ${yearDiff} anni)`);
    console.warn(`[${sessionId}]   ⚠️ ATTENZIONE: anni non consecutivi`);
  }
  
  // CONTROLLO CRITICO: anni troppo vecchi
  if (twoMostRecent[1].year < currentYear - 3) {
    warnings.push(`ATTENZIONE: l'anno più recente (${twoMostRecent[1].year}) è troppo vecchio`);
    console.error(`[${sessionId}]   ❌ CRITICO: anno più recente è ${twoMostRecent[1].year}, sospetto di estrazione errata`);
    result.requiresManualValidation = true;
  }
  
  if (warnings.length > 0) {
    result.warning = warnings.join('; ');
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

    // 7. TROVA ANNI (con validazione critica)
    const yearColsBS = findYearColumns(balanceSheetData, sessionId);
    const yearColsIS = findYearColumns(incomeStatementData, sessionId);

    // CONTROLLO CRITICO: Se gli anni sono troppo vecchi, blocca e chiedi input manuale
    if (yearColsBS.requiresManualValidation || yearColsIS.requiresManualValidation) {
      console.error(`[${sessionId}] ❌ VALIDAZIONE FALLITA: anni estratti sembrano errati`);
      
      await supabase
        .from('valuations')
        .update({ 
          status: 'year_validation_required',
          error_message: `Gli anni estratti (${yearColsBS.years.map(y => y.year).join(', ')}) sembrano non corretti. Verifica manualmente.`
        })
        .eq('session_id', sessionId);
      
      return res.status(400).json({ 
        error: 'Impossibile determinare gli anni del bilancio automaticamente',
        sessionId: sessionId,
        detectedYears: yearColsBS.years.map(y => y.year),
        requiresManualInput: true
      });
    }

    const yearsExtracted = yearColsBS.years.map(y => y.year);
    console.log(`[${sessionId}] 📅 Anni validati:`, yearsExtracted);

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

