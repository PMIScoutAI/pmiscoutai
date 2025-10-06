// /pages/api/valuta-pmi/calculate.js
// API per eseguire il calcolo della valutazione aziendale.
// VERSIONE 2.1 - Rimosso il parametro 'management_quality' dal calcolo.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const industryMultiples = {
  '46': { sector_name: 'Commercio all\'ingrosso', revenue: 0.8, ebitda: 6.5 },
  '47': { sector_name: 'Commercio al dettaglio', revenue: 0.7, ebitda: 6.0 },
  '10': { sector_name: 'Industrie alimentari', revenue: 0.9, ebitda: 7.5 },
  '62': { sector_name: 'Produzione di software', revenue: 3.5, ebitda: 12.0 },
  '41': { sector_name: 'Costruzione di edifici', revenue: 0.6, ebitda: 5.5 },
  '71': { sector_name: 'Servizi di architettura e ingegneria', revenue: 1.2, ebitda: 8.0 },
  'default': { sector_name: 'Altro', revenue: 1.0, ebitda: 7.0 },
};

// Funzione per calcolare il fattore di aggiustamento qualitativo
const calculateAdjustmentFactor = (inputs) => {
  let adjustment = 1.0;
  
  // Aggiustamenti basati sulla posizione di mercato
  const marketPositionAdjustments = { leader: 1.15, challenger: 1.05, follower: 0.95, niche: 1.0 };
  adjustment *= marketPositionAdjustments[inputs.market_position] || 1.0;
  
  // Aggiustamenti basati sulla concentrazione dei clienti
  const customerConcentrationAdjustments = { low: 1.05, medium: 1.0, high: 0.9 };
  adjustment *= customerConcentrationAdjustments[inputs.customer_concentration] || 1.0;

  // Aggiustamenti basati sul rischio tecnologico
  const technologyRiskAdjustments = { low: 1.05, medium: 1.0, high: 0.95 };
  adjustment *= technologyRiskAdjustments[inputs.technology_risk] || 1.0;
  
  // Limita il fattore per evitare risultati estremi
  return Math.max(0.7, Math.min(1.5, adjustment));
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
    const outsetaResponse = await fetch('https://pmiscout.outseta.com/api/v1/profile', { headers: { Authorization: `Bearer ${outsetaToken}` } });
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido' });
    const outsetaUser = await outsetaResponse.json();
    const { data: userRow } = await supabase.from('users').select('id').eq('outseta_user_id', outsetaUser.Uid).single();
    if (!userRow) throw new Error('Utente non autorizzato.');

    const { data: session, error: sessionError } = await supabase.from('valuations').select('*').eq('session_id', sessionId).eq('user_id', userRow.id).single();
    if (sessionError) throw new Error('Sessione non trovata.');

    const years = session.years_analyzed.sort((a,b) => b-a);
    const latestYear = years[0];
    const dataN = updatedData[latestYear];
    
    const atecoDivision = session.sector_ateco;
    const multiples = industryMultiples[atecoDivision] || industryMultiples.default;
    
    const evFromEbitda = dataN.ebitda * multiples.ebitda;
    const evFromRevenue = dataN.ricavi * multiples.revenue;
    const baseEnterpriseValue = (evFromEbitda * 0.75) + (evFromRevenue * 0.25);
    
    const adjustmentFactor = calculateAdjustmentFactor(valuationInputs);
    const adjustedEnterpriseValue = baseEnterpriseValue * adjustmentFactor;
    
    const equityValue = adjustedEnterpriseValue - dataN.pfn;
    
    const results = {
      fair_market_value: Math.round(equityValue),
      conservative_value: Math.round(equityValue * 0.85),
      optimistic_value: Math.round(equityValue * 1.15),
      calculation_details: {
        base_ev: Math.round(baseEnterpriseValue),
        adjustment_factor: parseFloat(adjustmentFactor.toFixed(2)),
        adjusted_ev: Math.round(adjustedEnterpriseValue),
        pfn_used: dataN.pfn,
        multiples_used: {
          sector: multiples.sector_name,
          ebitda: multiples.ebitda,
          revenue: multiples.revenue,
        },
        inputs_used: {
          ...dataN,
          ...valuationInputs
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
    
    console.log(`[${sessionId}] ✅ Valutazione completata e salvata.`);
    
    return res.status(200).json({ success: true, results });

  } catch (error) {
    console.error(`💥 Errore in calculate:`, error);
    return res.status(500).json({ error: error.message || 'Errore interno del server.' });
  }
}

