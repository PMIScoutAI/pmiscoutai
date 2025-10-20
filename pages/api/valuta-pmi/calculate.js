// FILE: calculate.js - VERSIONE SEMPLIFICATA
// Percorso: pages/api/valuta-pmi/calculate.js
// RIMOZIONE COMPLETA: Margine Lordo, Posizione Mercato, Rischio Tech, Concentrazione Clienti

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

const SCONTO_LIQUIDITA_BAGNA = {
  grande: { liquido: 0.10, medio: 0.125, illiquido: 0.15 },
  media: { liquido: 0.20, medio: 0.225, illiquido: 0.25 },
  piccola: { liquido: 0.30, medio: 0.325, illiquido: 0.35 },
  micro: { liquido: 0.35, medio: 0.375, illiquido: 0.40 }
};

const getSettoreMultiples = (settoreId) => {
  const settore = SETTORI_ITALIANI.find(s => s.id === settoreId);
  if (!settore) {
    console.warn(`⚠️ Settore ${settoreId} non trovato, uso default`);
    return SETTORI_ITALIANI.find(s => s.id === 'manifatturiero_generale');
  }
  return settore;
};

const calculateLiquidityDiscount = (dimensione, liquiditaSettore) => {
  const dim = dimensione.toLowerCase();
  const liq = liquiditaSettore.toLowerCase();
  
  if (!SCONTO_LIQUIDITA_BAGNA[dim] || !SCONTO_LIQUIDITA_BAGNA[dim][liq]) {
    return 0.225;
  }
  
  return SCONTO_LIQUIDITA_BAGNA[dim][liq];
};

// ✅ SEMPLIFICATO: Solo crescita ricavi
const calculateGrowthAdjustment = (ricaviN, ricaviN1) => {
  if (!ricaviN1 || ricaviN1 === 0) return 0;
  
  const growth = ((ricaviN - ricaviN1) / ricaviN1) * 100;
  
  if (growth > 20) return 0.12;
  if (growth >= 10) return 0.06;
  if (growth >= 3) return 0.02;
  if (growth >= 0) return 0;
  return -0.20;
};

// ✅ SEMPLIFICATO: Solo indebitamento
const calculateDebtAdjustment = (debitiTotali, ebitda) => {
  if (!ebitda || ebitda === 0) return -0.15;
  
  const debtRatio = debitiTotali / ebitda;
  
  if (debtRatio < 2) return 0.03;
  if (debtRatio <= 4) return -0.05;
  return -0.15;
};

// ✅ NUOVO: Calcolo aggiustamenti semplificato (solo 2 fattori)
const calculateEVAdjustments = (dataN, dataN1) => {
  const factors = {
    growth: calculateGrowthAdjustment(dataN.ricavi, dataN1?.ricavi),
    debt: calculateDebtAdjustment(dataN.debiti_finanziari_ml + dataN.debiti_finanziari_breve, dataN.ebitda)
  };
  
  const totalAdjustment = Object.values(factors).reduce((sum, val) => sum + val, 0);
  
  return { factors, totalAdjustment };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    const { sessionId, updatedData, valuationInputs } = req.body;
    if (!sessionId || !updatedData || !valuationInputs) {
      return res.status(400).json({ error: 'Dati incompleti per il calcolo.' });
    }

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
    
    console.log(`[${sessionId}] 📊 Inizio calcolo valutazione SEMPLIFICATA`);
    
    // STEP 1: Multipli settore
    const settore = getSettoreMultiples(valuationInputs.settore);
    const multiploEbitda = settore.ev_ebitda;
    
    // STEP 2: Valutazione base
    const evBase = dataN.ebitda * multiploEbitda;
    
    // STEP 3: Sconto liquidità
    const scontoLiquidita = calculateLiquidityDiscount(valuationInputs.dimensione, settore.liquidita);
    const evPostSconto = evBase * (1 - scontoLiquidita);
    
    // STEP 4: Fattori aggiustamento (SOLO crescita + debito)
    const { factors, totalAdjustment } = calculateEVAdjustments(dataN, dataN1);
    const evAggiustato = evPostSconto * (1 + totalAdjustment);
    
    // STEP 5: Equity Value (sottrazione PFN)
    const equityValue = evAggiustato - dataN.pfn;
    
    const results = {
      fair_market_value: Math.round(equityValue),
      conservative_value: Math.round(equityValue * 0.85),
      optimistic_value: Math.round(equityValue * 1.15),
      calculation_details: {
        step1_ev_base: Math.round(evBase),
        step1_multiplo: multiploEbitda,
        step2_sconto_liquidita_pct: parseFloat((scontoLiquidita * 100).toFixed(1)),
        step2_ev_post_sconto: Math.round(evPostSconto),
        step3_fattori_ev: {
          crescita_ricavi: parseFloat((factors.growth * 100).toFixed(1)),
          indebitamento: parseFloat((factors.debt * 100).toFixed(1)),
          totale: parseFloat((totalAdjustment * 100).toFixed(1))
        },
        step3_ev_aggiustato: Math.round(evAggiustato),
        step4_pfn_sottratta: Math.round(dataN.pfn),
        step4_equity_value: Math.round(equityValue),
        settore: {
          nome: settore.nome,
          multiplo_ebitda: settore.ev_ebitda,
          liquidita: settore.liquidita
        },
        dimensione_azienda: valuationInputs.dimensione,
        inputs_used: {
          ebitda: dataN.ebitda,
          ricavi: dataN.ricavi,
          ricavi_n1: dataN1?.ricavi,
          crescita_ricavi_pct: dataN1?.ricavi ? parseFloat((((dataN.ricavi - dataN1.ricavi) / dataN1.ricavi) * 100).toFixed(1)) : null,
          debt_ebitda_ratio: dataN.ebitda ? parseFloat(((dataN.debiti_finanziari_ml + dataN.debiti_finanziari_breve) / dataN.ebitda).toFixed(2)) : null,
          pfn: dataN.pfn
        }
      }
    };
    
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
    console.error(`💥 Errore:`, error);
    return res.status(500).json({ error: error.message || 'Errore interno del server.' });
  }
}
