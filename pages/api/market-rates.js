import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  try {
    const { ateco_division, rating_class, loan_type } = req.query;
    // Cerca benchmark nel database
    const { data: benchmark, error } = await supabase
      .from('market_benchmarks')
      .select('*')
      .eq('ateco_division', ateco_division)
      .eq('rating_class', rating_class)
      .eq('loan_type', loan_type || 'chirografario')
      .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Errore query benchmark:', error);
    }
    // Fallback con dati stimati se non trovato nel DB
    let marketData;
    if (benchmark) {
      marketData = {
        avg_rate: benchmark.avg_rate,
        min_rate: benchmark.min_rate,
        max_rate: benchmark.max_rate
      };
    } else {
      marketData = getEstimatedRates(ateco_division, rating_class, loan_type);
    }
    // Calcola range per il profilo utente
    const userRange = calculateUserRange(marketData, rating_class);
    res.status(200).json({
      market_avg: marketData.avg_rate,
      market_range: `${marketData.min_rate}% - ${marketData.max_rate}%`,
      your_estimated_range: userRange,
      benchmark_date: benchmark?.updated_at || new Date().toISOString()
    });
  } catch (error) {
    console.error('Errore market-rates:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
function getEstimatedRates(atecoDiv, ratingClass, loanType) {
  // Dati stimati basati su Banca d'Italia (da aggiornare con dati reali)
  const baseRates = {
    '41': { avg: 4.2, spread: 1.5 }, // Costruzioni
    '42': { avg: 4.0, spread: 1.2 }, // Ingegneria civile
    '62': { avg: 3.8, spread: 1.0 }, // Servizi IT
    'default': { avg: 4.5, spread: 1.8 }
  };
  const sector = baseRates[atecoDiv] || baseRates.default;
  const classMultiplier = [0.7, 0.85, 1.0, 1.3, 1.8][ratingClass - 1] || 1.0;
  const avgRate = sector.avg * classMultiplier;
  return {
    avg_rate: parseFloat(avgRate.toFixed(2)),
    min_rate: parseFloat((avgRate - sector.spread/2).toFixed(2)),
    max_rate: parseFloat((avgRate + sector.spread/2).toFixed(2))
  };
}
function calculateUserRange(marketData, ratingClass) {
  // Range stimato per l'utente specifico (più stretto del mercato)
  const spread = (marketData.max_rate - marketData.min_rate) * 0.6; // 60% dello spread mercato
  const userMin = marketData.avg_rate - spread/2;
  const userMax = marketData.avg_rate + spread/2;
  return `${userMin.toFixed(2)}% - ${userMax.toFixed(2)}%`;
}
