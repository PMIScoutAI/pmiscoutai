// /pages/api/company-xbrl-details.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { session_id } = req.query;
  
  if (!session_id) {
    return res.status(400).json({ error: 'Session ID richiesto' });
  }

  try {
    console.log(`[company-xbrl-details] Cerco dati per session: ${session_id}`);

    // Recupera i dati XBRL completi per la sessione
    const { data: xbrlData, error: xbrlError } = await supabase
      .from('analysis_results')
      .select(`
        company_name,
        health_score,
        analysis_data,
        created_at,
        session_id
      `)
      .eq('session_id', session_id)
      .single();

    if (xbrlError || !xbrlData) {
      console.log(`[company-xbrl-details] Dati non trovati per session: ${session_id}`, xbrlError);
      return res.status(404).json({ error: 'Dati azienda non trovati' });
    }

    // Estrai i dati dal JSON analysis_data
    const analysisData = xbrlData.analysis_data || {};
    
    // Mappa ai campi del calcolatore
    const mappedData = {
      // Dati finanziari correnti
      revenue: analysisData.ricavi_vendite_prestazioni || '',
      ebitda: calculateEBITDA(analysisData) || '',
      netIncome: analysisData.utile_perdita_esercizio || '',
      
      // Se hai dati dell'anno precedente nel JSON
      previousRevenue: analysisData.ricavi_vendite_prestazioni_precedente || '',
      previousEbitda: calculateEBITDA(analysisData, true) || '',
      previousNetIncome: analysisData.utile_perdita_esercizio_precedente || '',
      
      // Metriche calcolate
      grossMargin: calculateGrossMargin(analysisData),
      
      // Inferisci dimensione azienda
      companySize: determineCompanySize(analysisData.ricavi_vendite_prestazioni),
      
      // Calcola livello debito
      debtLevel: calculateDebtLevel(analysisData)
    };

    console.log(`[company-xbrl-details] Dati mappati per: ${xbrlData.company_name}`);

    return res.status(200).json({
      success: true,
      companyName: xbrlData.company_name,
      healthScore: xbrlData.health_score,
      mappedData,
      rawData: analysisData,
      lastUpdate: xbrlData.created_at
    });

  } catch (error) {
    console.error('[company-xbrl-details] Errore generale:', error);
    return res.status(500).json({ 
      error: 'Errore server',
      details: error.message 
    });
  }
}

// Funzioni helper per i calcoli
function calculateEBITDA(data, isPrevious = false) {
  const suffix = isPrevious ? '_precedente' : '';
  const utile = data[`utile_perdita_esercizio${suffix}`] || 0;
  const imposte = data[`imposte_reddito${suffix}`] || 0;
  const oneriFinanziari = data[`oneri_finanziari${suffix}`] || 0;
  const ammortamenti = data[`ammortamenti_svalutazioni${suffix}`] || 0;
  
  if (!utile && !imposte && !oneriFinanziari && !ammortamenti) return '';
  return utile + imposte + oneriFinanziari + ammortamenti;
}

function calculateGrossMargin(data) {
  const ricavi = data.ricavi_vendite_prestazioni || 0;
  const costiProduzione = data.costi_produzione || 0;
  
  if (!ricavi || !costiProduzione) return '';
  return Math.round(((ricavi - costiProduzione) / ricavi) * 100);
}

function determineCompanySize(ricavi) {
  if (!ricavi) return 'micro';
  if (ricavi > 50000000) return 'large';
  if (ricavi > 10000000) return 'medium';
  if (ricavi > 2000000) return 'small';
  return 'micro';
}

function calculateDebtLevel(data) {
  const debiti = data.debiti || 0;
  const ebitda = calculateEBITDA(data) || 1;
  
  if (!debiti || !ebitda) return 'medium';
  const ratio = debiti / ebitda;
  
  if (ratio > 4) return 'high';
  if (ratio < 2) return 'low';
  return 'medium';
}
