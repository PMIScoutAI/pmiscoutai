// /pages/api/piano-economico/[sessionId]/results.js
// Recupera i risultati del piano economico generato

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId mancante' });
  }

  console.log(`[${sessionId}] 📊 Recupero risultati piano economico...`);

  try {
    // Recupera sessione da Supabase
    const { data: session, error: sessionError } = await supabase
      .from('piano_economico_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error(`[${sessionId}] ❌ Sessione non trovata`);
      return res.status(404).json({ error: 'Sessione non trovata' });
    }

    if (session.status !== 'completed') {
      console.warn(`[${sessionId}] ⚠️ Piano non ancora generato. Status: ${session.status}`);
      return res.status(202).json({
        error: 'Piano ancora in elaborazione',
        status: session.status
      });
    }

    // Struttura dati per il response
    const pianoData = {
      sessionId: session.id,
      companyName: session.company_name,
      createdAt: session.created_at,
      completedAt: session.completed_at,
      growthRateApplied: session.growth_rate_override || 'settore',
      scenarioType: session.scenario_type,

      // Anni
      anno0: {
        ricavi: session.anno0_ricavi,
        costiPersonale: session.anno0_costi_personale,
        materiePrime: session.anno0_mp,
        servizi: session.anno0_servizi,
        godimento: session.anno0_godimento,
        oneriDiversi: session.anno0_oneri_diversi,
        ammortamenti: session.anno0_ammortamenti,
        oneriFinanziari: session.anno0_oneri_finanziari,
        utileNetto: session.anno0_utile,
        ebitda: session.anno0_ricavi - (
          session.anno0_costi_personale + session.anno0_mp + 
          session.anno0_servizi + session.anno0_godimento + session.anno0_oneri_diversi
        ),
        ebit: (session.anno0_ricavi - (
          session.anno0_costi_personale + session.anno0_mp + 
          session.anno0_servizi + session.anno0_godimento + session.anno0_oneri_diversi
        )) - session.anno0_ammortamenti,
        margineEbitda: 0,
        margineEbit: 0,
        margineNetto: 0
      },

      anno1: session.anno1_data || {},
      anno2: session.anno2_data || {},
      anno3: session.anno3_data || {},

      // KPI
      kpi: session.kpi_derivati || {},

      // Sensibilità
      sensibilita: session.sensibilita || {
        ricavi_minus10: { ricavi: 0, ebitda: 0, margine_ebitda: 0 },
        ricavi_baseline: { ricavi: 0, ebitda: 0, margine_ebitda: 0 },
        ricavi_plus10: { ricavi: 0, ebitda: 0, margine_ebitda: 0 }
      },

      // Narrative
      narrative: session.narrative || '',

      // Growth rate applicato
      growth_rate_applied: session.growth_rate_applied || 0
    };

    // Calcola margini per anno0
    if (pianoData.anno0.ricavi > 0) {
      pianoData.anno0.margineEbitda = (pianoData.anno0.ebitda / pianoData.anno0.ricavi) * 100;
      pianoData.anno0.margineEbit = (pianoData.anno0.ebit / pianoData.anno0.ricavi) * 100;
      pianoData.anno0.margineNetto = (pianoData.anno0.utileNetto / pianoData.anno0.ricavi) * 100;
    }

    console.log(`[${sessionId}] ✅ Risultati recuperati con successo`);

    return res.status(200).json({
      success: true,
      data: pianoData
    });

  } catch (error) {
    console.error(`[${sessionId}] 💥 Errore:`, error);
    return res.status(500).json({
      error: error.message || 'Errore recupero risultati',
      sessionId: sessionId
    });
  }
}
