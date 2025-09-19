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
    
    console.log(`📧 Banking Analysis per email: ${userEmail}`);
    
    // 1. Trova utente
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();
      
    if (userError || !userData) {
      console.error('❌ Utente non trovato:', userError);
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    console.log(`✅ Utente trovato: ${userData.id}`);
    
    // 2. Recupera tutte le analisi XBRL dell'utente
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('checkup_sessions')
      .select('id, created_at')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });
      
    if (sessionsError) {
      console.error('❌ Errore recupero sessioni:', sessionsError);
      return res.status(500).json({ message: 'Errore recupero sessioni' });
    }
    
    console.log(`📊 Sessioni trovate: ${sessionsData?.length || 0}`);
    
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
        
        console.log(`🔍 Elaborazione analisi per: ${analysisData.company_name}`);
        console.log(`   - Attivo Circolante: ${metrics.attivoCircolante?.currentYear}`);
        console.log(`   - Passività Correnti: ${metrics.passivitaCorrente?.currentYear}`);
        console.log(`   - Debiti Breve: ${metrics.debitiBreveTermine?.currentYear}`);
        
        const currentRatio = calculateCurrentRatio(metrics);
        console.log(`   - Current Ratio calcolato: ${currentRatio}`);
        
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
          current_ratio: currentRatio,
          raw_parsed_data: analysisData.raw_parsed_data  // Passa anche il raw_parsed_data
        });
      }
    }
    
    console.log(`✅ Totale analisi elaborate: ${analyses.length}`);
    
    // 4. Se è selezionata un'analisi specifica, calcola score bancabilità
    const selectedSessionId = req.query.session_id;
    let bankingScore = null;
        
    if (selectedSessionId) {
      console.log(`🎯 Calcolo banking score per session: ${selectedSessionId}`);
      const selectedAnalysis = analyses.find(a => a.session_id === selectedSessionId);
      if (selectedAnalysis) {
        bankingScore = calculateBankingScore(selectedAnalysis);
        console.log(`📊 Banking Score calcolato:`, bankingScore);
      }
    }
    
    res.status(200).json({
      analyses,
      banking_score: bankingScore
    });
    
  } catch (error) {
    console.error('💥 Errore banking-analysis:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

// Funzioni di calcolo
function calculateEBITDA(metrics) {
  const utile = metrics.utilePerdita?.currentYear || 0;
  const imposte = metrics.imposte?.currentYear || 0;
  const oneriFinanziari = metrics.oneriFinanziari?.currentYear || 0;
  const ammortamenti = metrics.ammortamenti?.currentYear || 0;
    
  const ebitda = utile + imposte + oneriFinanziari + ammortamenti;
  console.log(`   📈 EBITDA: ${utile} + ${imposte} + ${oneriFinanziari} + ${ammortamenti} = ${ebitda}`);
  
  return ebitda;
}

function calculateCurrentRatio(metrics) {
  const attivoCircolante = metrics.attivoCircolante?.currentYear || 0;
  
  // CORREZIONE: usa passivitaCorrente invece di debitiBreveTermine
  let passivoCorrente = metrics.passivitaCorrente?.currentYear;
  
  if (!passivoCorrente || passivoCorrente === 0) {
    console.warn('   ⚠️ passivitaCorrente non disponibile, uso debitiBreveTermine come fallback');
    passivoCorrente = metrics.debitiBreveTermine?.currentYear || 0;
  }
  
  if (passivoCorrente === 0 || attivoCircolante === 0) {
    console.warn('   ⚠️ Impossibile calcolare Current Ratio - dati mancanti');
    return null;
  }
  
  const ratio = attivoCircolante / passivoCorrente;
  console.log(`   ✅ Current Ratio: ${attivoCircolante.toLocaleString()} / ${passivoCorrente.toLocaleString()} = ${ratio.toFixed(2)}`);
  
  return ratio;
}

function calculateBankingScore(analysis) {
  console.log('🧮 Calcolo Banking Score per:', analysis.company_name);
  
  const ebitda = analysis.ebitda || 0;
  const debitiTotali = analysis.debiti_totali || 0;
  const patrimonioNetto = analysis.patrimonio_netto || 0;
    
  // DSCR semplificato
  const dscr = ebitda > 0 ? ebitda / (debitiTotali * 0.08) : 0; // Stima rata al 8%
    
  // Classe MCC
  let mccClass = 3; // Default
  if (analysis.current_ratio > 1.8 && debitiTotali/patrimonioNetto < 1.5) mccClass = 2;
  if (analysis.current_ratio < 1.2 || debitiTotali/patrimonioNetto > 3) mccClass = 4;
    
  // Esposizione massima (3x EBITDA rule of thumb)
  const maxDebt = ebitda * 3;
  
  const debtEquity = patrimonioNetto > 0 ? debitiTotali / patrimonioNetto : 0;
  
  console.log(`   - DSCR: ${dscr.toFixed(2)}`);
  console.log(`   - MCC Class: ${mccClass}`);
  console.log(`   - Debt/Equity: ${debtEquity.toFixed(2)}`);
  console.log(`   - Current Ratio: ${analysis.current_ratio}`);
    
  return {
    dscr_ratio: dscr,
    mcc_class: mccClass,
    max_sustainable_debt: maxDebt,
    current_ratio: analysis.current_ratio,
    debt_equity: debtEquity,
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
