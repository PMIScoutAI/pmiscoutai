// /pages/api/valuta-pmi/calculate.js
// API per eseguire il calcolo della valutazione aziendale.
// VERSIONE 3.0 - Multipli Damodaran + Sconto Liquidità Bagna + Logica Semplificata

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// MULTIPLI SETTORE - DAMODARAN 2025
// ============================================
const SETTORI_ITALIANI = [
  { id: 'manifatturiero_generale', nome: 'Manifatturiero - Generale', ev_ebitda: 7.86, ev_ebit: 8.81, liquidita: 'medio' },
  { id: 'manifatturiero_metalli', nome: 'Manifatturiero - Metalli', ev_ebitda: 8.68, ev_ebit: 12.27, liquidita: 'medio' },
  { id: 'manifatturiero_plastica', nome: 'Manifatturiero - Plastica/Gomma', ev_ebitda: 13.31, ev_ebit: 22.13, liquidita: 'medio' },
  { id: 'manifatturiero_macchinari', nome: 'Manifatturiero - Macchinari', ev_ebitda: 15.35, ev_ebit: 20.02, liquidita: 'medio' },
  { id: 'manifatturiero_elettronica', nome: 'Manifatturiero - Elettronica', ev_ebitda: 17.28, ev_ebit: 28.93, liquidita: 'liquido' },
  { id: 'alimentare_produzione', nome: 'Alimentare - Produzione', ev_ebitda: 11.17, ev_ebit: 14.76, liquidita: 'medio' },
  { id: 'alimentare_distribuzione', nome: 'Alimentare - Distribuzione', ev_ebitda: 10.77, ev_ebit: 16.86, liquidita: 'medio' },
  { id: 'ristorazione', nome: 'Ristorazione', ev_ebitda: 18.67, ev_ebit: 32.11, liquidita: 'illiquido' },
  { id: 'retail_abbigliamento', nome: 'Retail - Abbigliamento', ev_ebitda: 9.22, ev_ebit: 14.64, liquidita: 'medio' },
  { id: 'retail_alimentare', nome: 'Retail - Alimentare', ev_ebitda: 7.74, ev_ebit: 16.89, liquidita: 'medio' },
  { id: 'retail_specializzato', nome: 'Retail - Specializzato', ev_ebitda: 9.90, ev_ebit: 19.99, liquidita: 'medio' },
  { id: 'retail_edilizia', nome: 'Retail - Edilizia', ev_ebitda: 15.75, ev_ebit: 20.75, liquidita: 'medio' },
  { id: 'edilizia_costruzioni', nome: 'Edilizia - Costruzioni', ev_ebitda: 15.65, ev_ebit: 24.03, liquidita: 'illiquido' },
  { id: 'edilizia_materiali', nome: 'Edilizia - Materiali', ev_ebitda: 13.14, ev_ebit: 17.28, liquidita: 'medio' },
  { id: 'trasporti_logistica', nome: 'Trasporti - Logistica', ev_ebitda: 11.33, ev_ebit: 25.31, liquidita: 'medio' },
  { id: 'servizi_professionali', nome: 'Servizi Professionali', ev_ebitda: 16.75, ev_ebit: 23.77, liquidita: 'medio' },
  { id: 'software_it', nome: 'Software/IT', ev_ebitda: 27.98, ev_ebit: 37.85, liquidita: 'liquido' },
  { id: 'ecommerce', nome: 'E-commerce', ev_ebitda: 28.08, ev_ebit: null, liquidita: 'liquido' },
  { id: 'sanita_prodotti', nome: 'Sanità - Prodotti', ev_ebitda: 21.20, ev_ebit: 33.63, liquidita: 'medio' },
  { id: 'sanita_servizi', nome: 'Sanità - Servizi', ev_ebitda: 11.32, ev_ebit: 15.15, liquidita: 'medio' },
  { id: 'turismo_hotel', nome: 'Turismo/Hotel', ev_ebitda: 15.42, ev_ebit: 28.23, liquidita: 'illiquido' },
  { id: 'energia_rinnovabili', nome: 'Energia - Rinnovabili', ev_ebitda: 11.30, ev_ebit: 31.91, liquidita: 'medio' },
  { id: 'commercio_auto', nome: 'Commercio Auto', ev_ebitda: 14.42, ev_ebit: 21.68, liquidita: 'medio' },
  { id: 'tessile', nome: 'Tessile', ev_ebitda: 9.22, ev_ebit: 14.64, liquidita: 'medio' },
  { id: 'packaging', nome: 'Packaging', ev_ebitda: 9.46, ev_ebit: 15.43, liquidita: 'medio' }
];

// ============================================
// SCONTO LIQUIDITÀ - BAGNA 2020
// ============================================
const SCONTO_LIQUIDITA_BAGNA = {
  grande: { liquido: 0.10, medio: 0.125, illiquido: 0.15 },
  media: { liquido: 0.20, medio: 0.225, illiquido: 0.25 },
  piccola: { liquido: 0.30, medio: 0.325, illiquido: 0.35 },
  micro: { liquido: 0.35, medio: 0.375, illiquido: 0.40 }
};

// ============================================
// FUNZIONI CALCOLO
// ============================================

// Trova settore dai multipli
const getSettoreMultiples = (settoreId) => {
  const settore = SETTORI_ITALIANI.find(s => s.id === settoreId);
  if (!settore) {
    console.warn(`⚠️ Settore ${settoreId} non trovato, uso default`);
    return SETTORI_ITALIANI.find(s => s.id === 'manifatturiero_generale');
  }
  return settore;
};

// Calcola sconto liquidità
const calculateLiquidityDiscount = (dimensione, liquiditaSettore) => {
  const dim = dimensione.toLowerCase();
  const liq = liquiditaSettore.toLowerCase();
  
  if (!SCONTO_LIQUIDITA_BAGNA[dim] || !SCONTO_LIQUIDITA_BAGNA[dim][liq]) {
    console.warn(`⚠️ Parametri sconto non validi: ${dimensione}/${liquiditaSettore}, uso default`);
    return 0.225; // Default: media/medio
  }
  
  return SCONTO_LIQUIDITA_BAGNA[dim][liq];
};

// Calcola crescita ricavi
const calculateGrowthAdjustment = (ricaviN, ricaviN1) => {
  if (!ricaviN1 || ricaviN1 === 0) return 0;
  
  const growth = ((ricaviN - ricaviN1) / ricaviN1) * 100;
  
  if (growth > 20) return 0.12;
  if (growth >= 10) return 0.06;
  if (growth >= 3) return 0.02;
  if (growth >= 0) return 0;
  return -0.20;
};

// Calcola aggiustamento margine lordo
const calculateMarginAdjustment = (margineLordo) => {
  if (margineLordo === null || margineLordo === undefined) return 0;
  
  if (margineLordo > 60) return 0.08;
  if (margineLordo >= 40) return 0.04;
  if (margineLordo >= 25) return 0;
  return -0.12;
};

// Calcola aggiustamento posizione mercato
const calculateMarketPositionAdjustment = (position) => {
  const adjustments = {
    leader: 0.08,
    challenger: 0.03,
    follower: -0.08,
    niche: 0.02
  };
  return adjustments[position] || 0;
};

// Calcola aggiustamento indebitamento (AUTOMATICO)
const calculateDebtAdjustment = (debitiTotali, ebitda) => {
  if (!ebitda || ebitda === 0) return -0.15; // Se EBITDA zero/negativo, rischio alto
  
  const debtRatio = debitiTotali / ebitda;
  
  if (debtRatio < 2) return 0.03;  // Basso
  if (debtRatio <= 4) return -0.05; // Medio
  return -0.15; // Alto
};

// Calcola aggiustamento rischio tecnologico
const calculateTechRiskAdjustment = (techRisk) => {
  const adjustments = {
    low: 0.05,
    medium: 0,
    high: -0.15
  };
  return adjustments[techRisk] || 0;
};

// Calcola tutti i fattori di aggiustamento EV
const calculateEVAdjustments = (inputs, dataN, dataN1) => {
  const factors = {
    growth: calculateGrowthAdjustment(dataN.ricavi, dataN1?.ricavi),
    margin: calculateMarginAdjustment(inputs.margine_lordo),
    market_position: calculateMarketPositionAdjustment(inputs.market_position),
    debt: calculateDebtAdjustment(dataN.debiti_finanziari_ml + dataN.debiti_finanziari_breve, dataN.ebitda),
    tech_risk: calculateTechRiskAdjustment(inputs.technology_risk)
  };
  
  const totalAdjustment = Object.values(factors).reduce((sum, val) => sum + val, 0);
  
  return { factors, totalAdjustment };
};

// Calcola aggiustamento concentrazione clienti (SOLO su Equity)
const calculateCustomerConcentrationAdjustment = (concentration) => {
  if (concentration === null || concentration === undefined) return 0;
  
  if (concentration > 50) return -0.20;
  if (concentration >= 30) return -0.10;
  if (concentration >= 15) return 0;
  return 0.05;
};

// ============================================
// HANDLER PRINCIPALE
// ============================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    const { sessionId, updatedData, valuationInputs } = req.body;
    if (!sessionId || !updatedData || !valuationInputs) {
      return res.status(400).json({ error: 'Dati incompleti per il calcolo.' });
    }

    // Autenticazione
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante' });
    
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('outseta_user_id', outsetaUser.Uid)
      .single();
    
    if (!userRow) throw new Error('Utente non autorizzato.');

    // Recupera sessione
    const { data: session, error: sessionError } = await supabase
      .from('valuations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userRow.id)
      .single();
    
    if (sessionError) throw new Error('Sessione non trovata.');

    const years = session.years_analyzed.sort((a,b) => b-a);
    const yearN = years[0];
    const yearN1 = years[1];
    const dataN = updatedData[yearN];
    const dataN1 = updatedData[yearN1];
    
    console.log(`[${sessionId}] 📊 Inizio calcolo valutazione`);
    console.log(`[${sessionId}]   Settore: ${valuationInputs.settore}`);
    console.log(`[${sessionId}]   Dimensione: ${valuationInputs.dimensione}`);
    
    // STEP 1: Multipli settore
    const settore = getSettoreMultiples(valuationInputs.settore);
    const multiploEbitda = settore.ev_ebitda;
    
    // STEP 2: Valutazione base EV/EBITDA
    const evBase = dataN.ebitda * multiploEbitda;
    console.log(`[${sessionId}]   EV Base (EBITDA ${dataN.ebitda} × ${multiploEbitda}): €${evBase.toFixed(0)}`);
    
    // STEP 3: Sconto liquidità
    const scontoLiquidita = calculateLiquidityDiscount(valuationInputs.dimensione, settore.liquidita);
    const evPostSconto = evBase * (1 - scontoLiquidita);
    console.log(`[${sessionId}]   Sconto Liquidità (${(scontoLiquidita * 100).toFixed(1)}%): €${evPostSconto.toFixed(0)}`);
    
    // STEP 4: Fattori aggiustamento EV
    const { factors, totalAdjustment } = calculateEVAdjustments(valuationInputs, dataN, dataN1);
    const evAggiustato = evPostSconto * (1 + totalAdjustment);
    console.log(`[${sessionId}]   Fattori EV (+${(totalAdjustment * 100).toFixed(1)}%): €${evAggiustato.toFixed(0)}`);
    
    // STEP 5: Sottrazione PFN → Equity Value
    const equityValueLordo = evAggiustato - dataN.pfn;
    console.log(`[${sessionId}]   Equity Lordo (EV - PFN): €${equityValueLordo.toFixed(0)}`);
    
    // STEP 6: Aggiustamento concentrazione clienti (SOLO su Equity)
    const concentrationAdj = calculateCustomerConcentrationAdjustment(valuationInputs.customer_concentration);
    const equityValueNetto = equityValueLordo * (1 + concentrationAdj);
    console.log(`[${sessionId}]   Concentrazione Clienti (${(concentrationAdj * 100).toFixed(1)}%): €${equityValueNetto.toFixed(0)}`);
    
    // STEP 7: Scenari
    const results = {
      fair_market_value: Math.round(equityValueNetto),
      conservative_value: Math.round(equityValueNetto * 0.85),
      optimistic_value: Math.round(equityValueNetto * 1.15),
      calculation_details: {
        step1_ev_base: Math.round(evBase),
        step1_multiplo: multiploEbitda,
        step2_sconto_liquidita_pct: parseFloat((scontoLiquidita * 100).toFixed(1)),
        step2_ev_post_sconto: Math.round(evPostSconto),
        step3_fattori_ev: {
          crescita_ricavi: parseFloat((factors.growth * 100).toFixed(1)),
          margine_lordo: parseFloat((factors.margin * 100).toFixed(1)),
          posizione_mercato: parseFloat((factors.market_position * 100).toFixed(1)),
          indebitamento: parseFloat((factors.debt * 100).toFixed(1)),
          rischio_tecnologico: parseFloat((factors.tech_risk * 100).toFixed(1)),
          totale: parseFloat((totalAdjustment * 100).toFixed(1))
        },
        step3_ev_aggiustato: Math.round(evAggiustato),
        step4_pfn_sottratta: Math.round(dataN.pfn),
        step4_equity_lordo: Math.round(equityValueLordo),
        step5_concentrazione_clienti_pct: parseFloat((concentrationAdj * 100).toFixed(1)),
        step5_equity_netto: Math.round(equityValueNetto),
        settore: {
          nome: settore.nome,
          multiplo_ebitda: settore.ev_ebitda,
          liquidita: settore.liquidita
        },
        dimensione_azienda: valuationInputs.dimensione,
        inputs_used: {
          ...dataN,
          ...valuationInputs,
          ricavi_n1: dataN1?.ricavi,
          crescita_ricavi_pct: dataN1?.ricavi ? parseFloat((((dataN.ricavi - dataN1.ricavi) / dataN1.ricavi) * 100).toFixed(1)) : null,
          debt_ebitda_ratio: dataN.ebitda ? parseFloat(((dataN.debiti_finanziari_ml + dataN.debiti_finanziari_breve) / dataN.ebitda).toFixed(2)) : null
        }
      }
    };
    
    // Salva risultati
    const { error: updateError } = await supabase
      .from('valuations')
      .update({
        historical_data: updatedData,
        valuation_inputs: valuationInputs,
        results_data: results,
        status: 'completed'
      })
      .eq('session_id', sessionId);
      
    if (updateError) throw updateError;
    
    console.log(`[${sessionId}] ✅ Valutazione completata: €${results.fair_market_value.toLocaleString('it-IT')}`);
    
    return res.status(200).json({ success: true, results });

  } catch (error) {
    console.error(`💥 Errore in calculate:`, error);
    return res.status(500).json({ error: error.message || 'Errore interno del server.' });
  }
}
