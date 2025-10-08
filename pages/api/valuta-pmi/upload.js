// /pages/api/valuta-pmi/upload.js
// Valuta-PMI: Upload XBRL, Parse dati finanziari e crea sessione valutazione
// VERSIONE 8.0 - LOGICA ANNI IBRIDA (Semplice + Validata)

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
// LOGICA ANNI IBRIDA: Semplice + Validata
// ============================================

/**
 * STRATEGIA:
 * 1. Prova a leggere gli anni dall'header XBRL (semplificato)
 * 2. Se fallisce, usa logica statica con anno corrente - 1
 * 3. Valida SEMPRE che i dati estratti abbiano senso
 * 4. Se c'è discrepanza, chiedi conferma all'utente
 */

const extractAndValidateYears = (balanceSheetData, incomeStatementData, sessionId) => {
  console.log(`[${sessionId}] 📅 Inizio estrazione e validazione anni...`);
  
  const currentYear = new Date().getFullYear();
  
  // ============================================
  // STEP 1: Prova estrazione SEMPLIFICATA dall'header
  // ============================================
  
  const tryExtractYearsFromHeader = (sheetData) => {
    // Cerca SOLO nelle prime 3 righe, SOLO nelle colonne 2-6
    for (let row = 0; row < Math.min(3, sheetData.length); row++) {
      for (let col = 2; col <= 6; col++) {
        const cell = String(sheetData[row]?.[col] || '').trim();
        
        // Pattern semplice: cerca 4 cifre che iniziano con "20"
        const match = cell.match(/20(\d{2})/);
        if (match) {
          const year = parseInt('20' + match[1], 10);
          
          // Valida che sia negli ultimi 5 anni
          if (year >= currentYear - 5 && year <= currentYear) {
            return { year, col, found: true };
          }
        }
      }
    }
    return { found: false };
  };
  
  const extractedBS = tryExtractYearsFromHeader(balanceSheetData);
  const extractedIS = tryExtractYearsFromHeader(incomeStatementData);
  
  console.log(`[${sessionId}]   🔍 Estrazione header:`, {
    statoPatrimoniale: extractedBS.found ? `${extractedBS.year} (col ${extractedBS.col})` : 'non trovato',
    contoEconomico: extractedIS.found ? `${extractedIS.year} (col ${extractedIS.col})` : 'non trovato'
  });
  
  // ============================================
  // STEP 2: Determina anni e colonne
  // ============================================
  
  let yearN, yearN1, colN, colN1;
  let extractionMethod = 'unknown';
  
  if (extractedBS.found) {
    // CASO 1: Estrazione riuscita - usa anni dall'header
    yearN = extractedBS.year;
    yearN1 = yearN - 1;
    colN = extractedBS.col;
    colN1 = extractedBS.col + 1; // Assumi colonna successiva per N-1
    extractionMethod = 'header_extraction';
    
    console.log(`[${sessionId}]   ✅ Metodo: Estrazione da header`);
    
  } else {
    // CASO 2: Estrazione fallita - usa logica statica
    yearN = currentYear - 1;
    yearN1 = yearN - 1;
    colN = 3;
    colN1 = 4;
    extractionMethod = 'static_fallback';
    
    console.log(`[${sessionId}]   🔄 Metodo: Fallback statico (anno corrente - 1)`);
  }
  
  console.log(`[${sessionId}]   📊 Configurazione:`, {
    yearN: yearN,
    yearN1: yearN1,
    colN: colN,
    colN1: colN1,
    metodo: extractionMethod
  });
  
  // ============================================
  // STEP 3: VALIDAZIONE CRITICA
  // ============================================
  
  const warnings = [];
  
  // Validazione 1: Gli anni sono troppo vecchi?
  if (yearN < currentYear - 3) {
    warnings.push({
      severity: 'high',
      code: 'OLD_YEAR',
      message: `L'anno più recente (${yearN}) è troppo vecchio. Il bilancio potrebbe essere stato depositato in ritardo.`
    });
  }
  
  // Validazione 2: Gli anni sono consecutivi?
  if (yearN - yearN1 !== 1) {
    warnings.push({
      severity: 'critical',
      code: 'NON_CONSECUTIVE',
      message: `Gli anni ${yearN1} e ${yearN} non sono consecutivi.`
    });
  }
  
  // Validazione 3: Le colonne sono diverse?
  if (colN === colN1) {
    warnings.push({
      severity: 'critical',
      code: 'SAME_COLUMN',
      message: `Anno N e N-1 risultano nella stessa colonna (${colN}).`
    });
  }
  
  // Validazione 4: Anno futuro?
  if (yearN > currentYear) {
    warnings.push({
      severity: 'critical',
      code: 'FUTURE_YEAR',
      message: `L'anno ${yearN} è nel futuro. Possibile errore di estrazione.`
    });
  }
  
  // ============================================
  // STEP 4: VALIDAZIONE INCROCIATA CON VALORI
  // ============================================
  
  const validateExtractedValues = (metrics) => {
    const valueWarnings = [];
    
    // Check 1: Ricavi N > Ricavi N-1? (crescita normale)
    const ricaviN = metrics.fatturato?.currentYear;
    const ricaviN1 = metrics.fatturato?.previousYear;
    
    if (ricaviN && ricaviN1) {
      const growth = ((ricaviN - ricaviN1) / ricaviN1) * 100;
      
      // Se crescita > 200% o < -80%, probabile inversione colonne
      if (growth > 200 || growth < -80) {
        valueWarnings.push({
          severity: 'high',
          code: 'ANOMALOUS_GROWTH',
          message: `Crescita ricavi anomala: ${growth.toFixed(1)}%. Possibile inversione colonne o errore estrazione anni.`,
          data: { ricaviN, ricaviN1, growth }
        });
      }
    }
    
    // Check 2: Valori nulli su entrambi gli anni?
    const allMetrics = Object.keys(metrics);
    const nullCount = allMetrics.filter(key => 
      metrics[key]?.currentYear === null && metrics[key]?.previousYear === null
    ).length;
    
    if (nullCount > allMetrics.length / 2) {
      valueWarnings.push({
        severity: 'critical',
        code: 'TOO_MANY_NULLS',
        message: `Oltre il 50% delle metriche non è stato estratto. Possibile problema con colonne o anni.`
      });
    }
    
    return valueWarnings;
  };
  
  // ============================================
  // STEP 5: Return completo
  // ============================================
  
  return {
    yearCols: {
      currentYearCol: colN,
      previousYearCol: colN1
    },
    years: [yearN1, yearN],
    extractionMethod: extractionMethod,
    warnings: warnings,
    requiresUserConfirmation: warnings.some(w => w.severity === 'critical'),
    
    // Funzione per validazione post-estrazione
    validateExtractedValues: validateExtractedValues
  };
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

    // STEP 7: Estrai e valida anni
    const yearConfig = extractAndValidateYears(balanceSheetData, incomeStatementData, sessionId);

    // Log warnings
    if (yearConfig.warnings.length > 0) {
      console.warn(`[${sessionId}] ⚠️ Warning estrazione anni:`);
      yearConfig.warnings.forEach(w => {
        console.warn(`[${sessionId}]   [${w.severity.toUpperCase()}] ${w.code}: ${w.message}`);
      });
    }

    const yearCols = yearConfig.yearCols;
    const yearsExtracted = yearConfig.years;

    console.log(`[${sessionId}] 📅 Anni finali: N=${yearsExtracted[1]}, N-1=${yearsExtracted[0]}`);
    console.log(`[${sessionId}] 📊 Colonne: N=${yearCols.currentYearCol}, N-1=${yearCols.previousYearCol}`);
    console.log(`[${sessionId}] 🔧 Metodo: ${yearConfig.extractionMethod}`);


    const atecoRaw = companyInfoData.length > 0 ? findSimpleValue(companyInfoData, ['settore di attività prevalente', 'codice ateco']) : null;
    const atecoCode = atecoRaw?.match(/(\d{2})/)?.[1] || null;
    console.log(`[${sessionId}] 🏢 ATECO estratto: ${atecoCode}`);

    // STEP 8: Estrai metriche
    const metrics = {};
    for (const key in metricsConfigs) {
      const isBalanceSheetMetric = ['patrimonioNetto', 'disponibilitaLiquide'].includes(key);
      metrics[key] = findValueInSheet(
        isBalanceSheetMetric ? balanceSheetData : incomeStatementData,
        metricsConfigs[key],
        yearCols,
        key
      );
    }
    
    const debitiFinanziari = findDebitiFinanziariCivilistico(balanceSheetData, yearCols, sessionId);
    
    const historicalData = {};
    const yearN1 = yearsExtracted[0];
    const yearN = yearsExtracted[1];

    historicalData[yearN1] = { // Anno vecchio
        ricavi: metrics.fatturato.previousYear,
        ebitda: metrics.ebitda.previousYear,
        patrimonio_netto: metrics.patrimonioNetto.previousYear,
        debiti_finanziari_ml: debitiFinanziari.ml_termine.previousYear,
        debiti_finanziari_breve: debitiFinanziari.breve_termine.previousYear,
        disponibilita_liquide: metrics.disponibilitaLiquide.previousYear,
    };
    historicalData[yearN] = { // Anno nuovo
        ricavi: metrics.fatturato.currentYear,
        ebitda: metrics.ebitda.currentYear,
        patrimonio_netto: metrics.patrimonioNetto.currentYear,
        debiti_finanziari_ml: debitiFinanziari.ml_termine.currentYear,
        debiti_finanziari_breve: debitiFinanziari.breve_termine.currentYear,
        disponibilita_liquide: metrics.disponibilitaLiquide.currentYear,
    };

    // STEP 9: VALIDAZIONE INCROCIATA
    const valueWarnings = yearConfig.validateExtractedValues(metrics);

    if (valueWarnings.length > 0) {
      console.warn(`[${sessionId}] ⚠️ Warning validazione valori:`);
      valueWarnings.forEach(w => {
        console.warn(`[${sessionId}]   [${w.severity.toUpperCase()}] ${w.code}: ${w.message}`);
        if (w.data) console.warn(`[${sessionId}]     Dati:`, w.data);
      });
    }

    const valuationInputs = {
      market_position: 'follower',
      customer_concentration: 'medium',
      technology_risk: 'medium'
    };
    
    // STEP 10 & 11: Se ci sono warning critici o tutto OK
    const allWarnings = [...yearConfig.warnings, ...valueWarnings];
    const hasCriticalWarnings = allWarnings.some(w => w.severity === 'critical');

    if (hasCriticalWarnings) {
      console.error(`[${sessionId}] ❌ Rilevati warning critici - Richiesta conferma utente`);
      
      await supabase
        .from('valuations')
        .update({ 
          status: 'needs_validation',
          years_analyzed: yearsExtracted,
          historical_data: historicalData,
          valuation_inputs: valuationInputs,
          sector_ateco: atecoCode,
          // Salva i warning per mostrarli all'utente
          metadata: {
            extraction_method: yearConfig.extractionMethod,
            warnings: allWarnings
          }
        })
        .eq('session_id', sessionId);
      
      return res.status(200).json({ 
        success: true, 
        sessionId: sessionId,
        companyName: companyName,
        years: yearsExtracted,
        status: 'needs_validation',
        warnings: allWarnings.map(w => ({
          severity: w.severity,
          message: w.message
        }))
      });
    }

    // Procedi normalmente se non ci sono errori critici
    const { error: updateError } = await supabase
      .from('valuations')
      .update({
        years_analyzed: yearsExtracted, // Salva come [vecchio, nuovo]
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

