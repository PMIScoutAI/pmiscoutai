// pages/api/market-rates.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Funzione di stima (ultima risorsa)
function getEstimatedRates(atecoDiv, ratingClass) {
  const baseRates = {
    '41': { avg: 5.9, spread: 1.5 }, // Costruzioni (Aggiornato)
    '62': { avg: 5.6, spread: 1.4 }, // Servizi IT (Aggiornato)
    'default': { avg: 6.2, spread: 1.8 }
  };
  const sector = baseRates[atecoDiv] || baseRates.default;
  const classMultiplier = [0.85, 0.95, 1.0, 1.15, 1.3][ratingClass - 1] || 1.0;
  const avgRate = sector.avg * classMultiplier;
  return {
    avg_rate: parseFloat(avgRate.toFixed(2)),
    min_rate: parseFloat((avgRate - sector.spread / 2).toFixed(2)),
    max_rate: parseFloat((avgRate + sector.spread / 2).toFixed(2))
  };
}

// Calcola il range stimato per l'utente
function calculateUserRange(marketData) {
  const spread = (marketData.max_rate - marketData.min_rate) * 0.7; // Range più stretto
  const userMin = marketData.avg_rate - spread / 2;
  const userMax = marketData.avg_rate + spread / 2;
  return `${userMin.toFixed(2)}% - ${userMax.toFixed(2)}%`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { ateco_division, rating_class, loan_type } = req.query;
    console.log(`[MarketRates] Richiesta per ATECO: ${ateco_division}, Classe: ${rating_class}, Tipo: ${loan_type || 'chirografario'}`);

    let marketData;
    let source = 'estimated';
    let benchmark_date = new Date().toISOString();

    // --- Inizio Ricerca a Cascata ---

    // 1. Ricerca Specifica (Settore + Rating)
    console.log('[MarketRates] Step 1: Tento ricerca specifica (settore + rating)...');
    const { data: specificBenchmark, error: specificError } = await supabase
      .from('market_benchmarks')
      .select('*')
      .eq('ateco_division', ateco_division)
      .eq('rating_class', rating_class)
      .eq('loan_type', loan_type || 'chirografario')
      .maybeSingle(); // Usa maybeSingle per non dare errore se non trova righe

    if (specificError && specificError.code !== 'PGRST116') {
        console.error('[MarketRates] Errore DB Step 1:', specificError);
    }
    
    if (specificBenchmark) {
      console.log('[MarketRates] ✅ Step 1: Trovato benchmark specifico.');
      marketData = {
        avg_rate: specificBenchmark.avg_rate,
        min_rate: specificBenchmark.min_rate,
        max_rate: specificBenchmark.max_rate
      };
      source = 'database_specific';
      benchmark_date = specificBenchmark.valid_from || specificBenchmark.updated_at;
    } else {
      // 2. Ricerca Generica (Solo Settore)
      console.log('[MarketRates] ⚠️ Step 1 Fallito. Step 2: Tento ricerca generica (solo settore)...');
      const { data: genericBenchmarks, error: genericError } = await supabase
        .from('market_benchmarks')
        .select('avg_rate, min_rate, max_rate, valid_from, updated_at')
        .eq('ateco_division', ateco_division)
        .eq('loan_type', loan_type || 'chirografario');

      if (genericError) {
          console.error('[MarketRates] Errore DB Step 2:', genericError);
      }

      if (genericBenchmarks && genericBenchmarks.length > 0) {
        console.log(`[MarketRates] ✅ Step 2: Trovati ${genericBenchmarks.length} benchmark. Calcolo la media.`);
        const count = genericBenchmarks.length;
        const avg_rate = genericBenchmarks.reduce((sum, item) => sum + parseFloat(item.avg_rate), 0) / count;
        const min_rate = genericBenchmarks.reduce((sum, item) => sum + parseFloat(item.min_rate), 0) / count;
        const max_rate = genericBenchmarks.reduce((sum, item) => sum + parseFloat(item.max_rate), 0) / count;

        marketData = {
          avg_rate: parseFloat(avg_rate.toFixed(2)),
          min_rate: parseFloat(min_rate.toFixed(2)),
          max_rate: parseFloat(max_rate.toFixed(2)),
        };
        source = 'database_generic';
        benchmark_date = genericBenchmarks[0].valid_from || genericBenchmarks[0].updated_at;
      } else {
        // 3. Stima di Fallback
        console.log('[MarketRates] 💥 Step 2 Fallito. Step 3: Uso stima di fallback.');
        marketData = getEstimatedRates(ateco_division, rating_class);
        source = 'estimated';
      }
    }

    const userRange = calculateUserRange(marketData);

    res.status(200).json({
      market_avg: marketData.avg_rate,
      market_range: `${marketData.min_rate}% - ${marketData.max_rate}%`,
      your_estimated_range: userRange,
      source: source,
      benchmark_date: benchmark_date
    });

  } catch (error) {
    console.error('Errore in market-rates:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

