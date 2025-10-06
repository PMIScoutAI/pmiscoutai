// TROVA QUESTA SEZIONE nel tuo pages/api/valuta-pmi/upload.js
// e SOSTITUISCI con questo codice corretto:

// ============================================
// SEZIONE DA SOSTITUIRE (circa riga 200-250)
// ============================================

    // Parsing degli anni CORRETTO
    const yearColsBS = findYearColumns(balanceSheetData);
    const yearColsIS = findYearColumns(incomeStatementData);
    
    // ✅ FIX: Estrai gli anni correttamente
    const yearsExtracted = yearColsBS.years && yearColsBS.years.length > 0 
      ? yearColsBS.years 
      : [new Date().getFullYear() - 1, new Date().getFullYear()];
    
    console.log(`[${sessionId}] 📅 Anni estratti:`, yearsExtracted);

    const atecoRaw = companyInfoData.length > 0 
      ? findSimpleValue(companyInfoData, ['settore di attività prevalente', 'codice ateco']) 
      : null;
    const atecoCode = atecoRaw?.match(/(\d{2})/)?.[1] || null;
    
    console.log(`[${sessionId}] 🏢 ATECO estratto: ${atecoCode}`);

    const metrics = {};
    for (const key in metricsConfigs) {
      metrics[key] = findValueInSheet(
        ['patrimonioNetto', 'disponibilitaLiquide'].includes(key) ? balanceSheetData : incomeStatementData,
        metricsConfigs[key],
        ['patrimonioNetto', 'disponibilitaLiquide'].includes(key) ? yearColsBS : yearColsIS,
        key
      );
    }
    
    const debitiFinanziari = findDebitiFinanziari(balanceSheetData, yearColsBS, sessionId);
    
    const ebitda = {
      currentYear: (metrics.utilePerdita.currentYear || 0) + (metrics.imposte.currentYear || 0) + (metrics.oneriFinanziari.currentYear || 0) + (metrics.ammortamenti.currentYear || 0),
      previousYear: (metrics.utilePerdita.previousYear || 0) + (metrics.imposte.previousYear || 0) + (metrics.oneriFinanziari.previousYear || 0) + (metrics.ammortamenti.previousYear || 0)
    };
    
    console.log(`[${sessionId}] 💰 EBITDA calcolato: N=${ebitda.currentYear}, N-1=${ebitda.previousYear}`);
    
    const pfn = {
      currentYear: (debitiFinanziari.ml_termine.currentYear || 0) + (debitiFinanziari.breve_termine.currentYear || 0) - (metrics.disponibilitaLiquide.currentYear || 0),
      previousYear: (debitiFinanziari.ml_termine.previousYear || 0) + (debitiFinanziari.breve_termine.previousYear || 0) - (metrics.disponibilitaLiquide.previousYear || 0)
    };
    
    console.log(`[${sessionId}] 📊 PFN calcolata: N=${pfn.currentYear}, N-1=${pfn.previousYear}`);

    // ✅ FIX: Usa gli anni estratti correttamente
    const [yearN_1, yearN] = yearsExtracted;
    
    console.log(`[${sessionId}] 📅 Mapping anni: N-1=${yearN_1}, N=${yearN}`);

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
    
    console.log(`[${sessionId}] 📋 Historical data preparato:`, JSON.stringify(historicalData, null, 2));
    
    const valuationInputs = {
      market_position: 'follower',
      customer_concentration: 'medium',
      technology_risk: 'medium'
    };
    
    // ✅ FIX: Salva con anni corretti
    const { error: updateError } = await supabase.from('valuations').update({
      years_analyzed: yearsExtracted, // ← IMPORTANTE: Array corretto
      historical_data: historicalData,
      valuation_inputs: valuationInputs,
      sector_ateco: atecoCode,
      status: 'data_entry'
    }).eq('session_id', sessionId);
    
    if (updateError) {
      console.error(`[${sessionId}] ❌ Errore update:`, updateError);
      throw updateError;
    }
    
    console.log(`[${sessionId}] ✅ Dati salvati correttamente su Supabase`);
    
    return res.status(200).json({ 
      success: true, 
      sessionId: sessionId,
      debug: {
        years: yearsExtracted,
        ateco: atecoCode,
        ricavi_N: metrics.fatturato.currentYear,
        ebitda_N: ebitda.currentYear
      }
    });
