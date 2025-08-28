import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  try {
    const userEmail = req.query.email;
    if (!userEmail) {
      return res.status(400).json({ message: 'Email non fornita' });
    }
    // 1. Trova utente
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();
    if (userError || !userData) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    // 2. Recupera tutte le analisi XBRL dell'utente
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('checkup_sessions')
      .select('id, created_at')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });
    if (sessionsError) {
      return res.status(500).json({ message: 'Errore recupero sessioni' });
    }
    // 3. Per ogni sessione, recupera i dati di analysis_results
    const analyses = [];
    for (const session of sessionsData) {
      const { data: analysisData, error: analysisError } = await supabase
        .from('analysis_results')
        .select('company_name, health_score, raw_parsed_data, created_at')
        .eq('session_id', session.id)
        .single();
      if (analysisData) {
        const rawData = analysisData.raw_parsed_data || {};
        const metrics = rawData.metrics || {};
                
        analyses.push({
          session_id: session.id,
          company_name: analysisData.company_name,
          health_score: analysisData.health_score,
          created_at: analysisData.created_at,
          ateco_code: rawData.context?.ateco_code,
          fatturato: metrics.fatturato?.currentYear,
          ebitda: calculateEBITDA(metrics),
          debiti_totali: metrics.debitiTotali?.currentYear,
          patrimonio_netto: metrics.patrimonioNetto?.currentYear,
          current_ratio: calculateCurrentRatio(metrics)
        });
      }
    }
    // 4. Se è selezionata un'analisi specifica, calcola score bancabilità
    const selectedSessionId = req.query.session_id;
    let bankingScore = null;
        
    if (selectedSessionId) {
      const selectedAnalysis = analyses.find(a => a.session_id === selectedSessionId);
      if (selectedAnalysis) {
        bankingScore = calculateBankingScore(selectedAnalysis);
      }
    }
    res.status(200).json({
      analyses,
      banking_score: bankingScore
    });
  } catch (error) {
    console.error('Errore banking-analysis:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// Funzioni di calcolo (riutilizzare logiche da simulazione-fondo-garanzia.js)
function calculateEBITDA(metrics) {
  const utile = metrics.utilePerdita?.currentYear || 0;
  const imposte = metrics.imposte?.currentYear || 0;
  const oneriFinanziari = metrics.oneriFinanziari?.currentYear || 0;
  const ammortamenti = metrics.ammortamenti?.currentYear || 0;
    
  return utile + imposte + oneriFinanziari + ammortamenti;
}

function calculateCurrentRatio(metrics) {
  const attivoCircolante = metrics.attivoCircolante?.currentYear || 0;
  const debitiBreve = metrics.debitiBreveTermine?.currentYear || 0;
    
  return debitiBreve > 0 ? attivoCircolante / debitiBreve : 0;
}

function calculateBankingScore(analysis) {
  // Riutilizza logica estimateCreditClass da simulazione-fondo-garanzia.js
  // Calcola DSCR, classe MCC, esposizione massima sostenibile
    
  const ebitda = analysis.ebitda || 0;
  const debitiTotali = analysis.debiti_totali || 0;
  const patrimonioNetto = analysis.patrimonio_netto || 0;
    
  // DSCR semplificato
  const dscr = ebitda > 0 ? ebitda / (debitiTotali * 0.08) : 0; // Stima rata al 8%
    
  // Classe MCC (riutilizza logica esistente)
  let mccClass = 3; // Default
  if (analysis.current_ratio > 1.8 && debitiTotali/patrimonioNetto < 1.5) mccClass = 2;
  if (analysis.current_ratio < 1.2 || debitiTotali/patrimonioNetto > 3) mccClass = 4;
    
  // Esposizione massima (3x EBITDA rule of thumb)
  const maxDebt = ebitda * 3;
    
  return {
    dscr_ratio: dscr,
    mcc_class: mccClass,
    max_sustainable_debt: maxDebt,
    current_ratio: analysis.current_ratio,
    debt_equity: patrimonioNetto > 0 ? debitiTotali / patrimonioNetto : 0,
    recommendation: generateRecommendation(dscr, mccClass, analysis.current_ratio)
  };
}

function generateRecommendation(dscr, mccClass, currentRatio) {
  if (currentRatio < 1.2) {
    return "Priorità: migliorare liquidità prima di richiedere nuovi finanziamenti";
  }
  if (mccClass <= 2) {
    return "Profilo creditizio buono - puoi negoziare condizioni competitive";
  }
  return "Considera garanzie aggiuntive per ottenere tassi migliori";
}
