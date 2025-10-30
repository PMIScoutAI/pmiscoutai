// /pages/api/piano-economico/[sessionId]/generate.js
// VERSIONE 1.0 - Core Engine Generazione Piano Economico
// Logica basata esattamente sul prompt allegato

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// CONFIGURAZIONE TASSI CRESCITA PER SETTORE
// ============================================

const GROWTH_RATES_BY_SECTOR = {
  // Tech/AI/Digital
  '26': { default: 10.0, conservative: 7.0, optimistic: 15.0, name: 'Informatica' },
  '62': { default: 10.0, conservative: 7.0, optimistic: 15.0, name: 'Servizi IT' },
  '63': { default: 9.0, conservative: 6.0, optimistic: 14.0, name: 'Elaborazione dati' },
  
  // Industria
  '20': { default: 3.5, conservative: 2.0, optimistic: 5.5, name: 'Chimica' },
  '25': { default: 3.0, conservative: 1.5, optimistic: 5.0, name: 'Metalli' },
  '27': { default: 3.5, conservative: 2.0, optimistic: 5.5, name: 'Energia elettrica' },
  '28': { default: 3.2, conservative: 1.8, optimistic: 5.2, name: 'Macchinari' },
  '29': { default: 3.3, conservative: 1.9, optimistic: 5.3, name: 'Autoveicoli' },
  
  // Commercio
  '45': { default: 2.5, conservative: 1.0, optimistic: 4.0, name: 'Commercio auto' },
  '46': { default: 2.3, conservative: 0.8, optimistic: 3.8, name: 'Commercio all\'ingrosso' },
  '47': { default: 2.2, conservative: 0.7, optimistic: 3.7, name: 'Commercio al dettaglio' },
  
  // Servizi
  '49': { default: 2.8, conservative: 1.2, optimistic: 4.3, name: 'Trasporti' },
  '55': { default: 2.0, conservative: 0.5, optimistic: 3.5, name: 'Alloggio' },
  '56': { default: 2.1, conservative: 0.6, optimistic: 3.6, name: 'Ristorazione' },
  '58': { default: 3.5, conservative: 1.5, optimistic: 5.5, name: 'Editoria' },
  '68': { default: 2.4, conservative: 0.9, optimistic: 3.9, name: 'Immobiliare' },
  '69': { default: 2.2, conservative: 0.7, optimistic: 3.7, name: 'Attività professionali' },
  
  // Default: per settori non mappati
  'default': { default: 2.5, conservative: 1.5, optimistic: 4.0, name: 'Settore generico' }
};

// ============================================
// UTILITY: OTTIENI TASSO CRESCITA
// ============================================

const getGrowthRate = (atecoDivision, scenarioType, overrideRate) => {
  // Se l'utente ha specificato un override, usalo
  if (overrideRate && overrideRate > 0) {
    console.log(`[GROWTH] Usando rate override: ${overrideRate}%`);
    return Math.min(overrideRate, 20); // Cap a 20%
  }

  // Altrimenti usa il tasso del settore
  const sectorConfig = GROWTH_RATES_BY_SECTOR[atecoDivision] || GROWTH_RATES_BY_SECTOR.default;
  const baseRate = sectorConfig[scenarioType] || sectorConfig.default;

  // Vincoli del prompt: min 2%, max 10% (tranne tech)
  const isHighTech = ['26', '62', '63'].includes(atecoDivision);
  const maxRate = isHighTech ? 20 : 10;
  const minRate = 2;

  const rate = Math.max(minRate, Math.min(baseRate, maxRate));
  console.log(`[GROWTH] Settore: ${sectorConfig.name} | Scenario: ${scenarioType} | Rate: ${rate}%`);
  
  return rate;
};

// ============================================
// CORE: GENERAZIONE PIANO ECONOMICO
// ============================================

const generatePianoEconomico = (anno0Data, incidenze, growthRate, sessionId) => {
  console.log(`[${sessionId}] 🎯 Inizio generazione piano con tasso: ${growthRate}%`);

  // Dati anno 0
  const anno0 = {
    ricavi: anno0Data.anno0_ricavi || 0,
    costiPersonale: anno0Data.anno0_costi_personale || 0,
    materiePrime: anno0Data.anno0_mp || 0,
    servizi: anno0Data.anno0_servizi || 0,
    godimento: anno0Data.anno0_godimento || 0,
    oneriDiversi: anno0Data.anno0_oneri_diversi || 0,
    ammortamenti: anno0Data.anno0_ammortamenti || 0,
    oneriFinanziari: anno0Data.anno0_oneri_finanziari || 0,
    utile: anno0Data.anno0_utile || 0
  };

  // Calcola EBITDA e EBIT anno 0 (se non presenti)
  anno0.ebitda = anno0.ricavi - (
    anno0.costiPersonale + anno0.materiePrime + anno0.servizi + anno0.godimento + anno0.oneriDiversi
  );
  anno0.ebit = anno0.ebitda - anno0.ammortamenti;

  const result = { anno0 };

  // ============================================
  // GENERA ANNI 1, 2, 3
  // ============================================

  for (let year = 1; year <= 3; year++) {
    const annoN = year === 1 ? anno0 : result[`anno${year - 1}`];
    const anno = {};

    // --- RICAVI: crescita composta ---
    anno.ricavi = annoN.ricavi * Math.pow(1 + growthRate / 100, 1);

    // --- COSTI PERSONALE: inflazione 2% ---
    anno.costiPersonale = annoN.costiPersonale * 1.02;

    // --- COSTI VARIABILI: % su ricavi (da incidenze) ---
    anno.materiePrime = anno.ricavi * (incidenze.mp_pct / 100);
    anno.servizi = anno.ricavi * (incidenze.servizi_pct / 100);
    anno.godimento = anno.ricavi * (incidenze.godimento_pct / 100);
    anno.oneriDiversi = anno.ricavi * (incidenze.oneri_pct / 100);

    // --- EBITDA ---
    anno.ebitda = anno.ricavi - (
      anno.costiPersonale + anno.materiePrime + anno.servizi + anno.godimento + anno.oneriDiversi
    );

    // --- AMMORTAMENTI: flat (no nuovo capex) ---
    anno.ammortamenti = anno0.ammortamenti;

    // --- EBIT ---
    anno.ebit = anno.ebitda - anno.ammortamenti;

    // --- ONERI FINANZIARI: (assumption: nessun nuovo debito) ---
    anno.oneriFinanziari = anno0.oneriFinanziari;

    // --- EBT ---
    anno.ebt = anno.ebit - anno.oneriFinanziari;

    // --- IMPOSTE: IRES 24% + IRAP 3,9% su EBIT ---
    anno.imposte = anno.ebit * 0.279; // 0.24 + 0.039

    // --- UTILE NETTO ---
    anno.utileNetto = anno.ebt - anno.imposte;

    // --- MARGINI % ---
    anno.margineEbitda = anno.ricavi > 0 ? (anno.ebitda / anno.ricavi) * 100 : 0;
    anno.margineEbit = anno.ricavi > 0 ? (anno.ebit / anno.ricavi) * 100 : 0;
    anno.margineNetto = anno.ricavi > 0 ? (anno.utileNetto / anno.ricavi) * 100 : 0;

    result[`anno${year}`] = anno;

    console.log(`[${sessionId}] 📊 ANNO ${year}: Ricavi=${anno.ricavi.toFixed(0)}€ | EBITDA=${anno.ebitda.toFixed(0)}€ | Utile=${anno.utileNetto.toFixed(0)}€`);
  }

  return result;
};

// ============================================
// CALCOLO KPI BANCABILI
// ============================================

const calculateKpis = (pianoData, anno0Data, sessionId) => {
  console.log(`[${sessionId}] 🏦 Calcolo KPI bancabili...`);

  const anno1 = pianoData.anno1;
  const anno3 = pianoData.anno3;
  const anno0 = pianoData.anno0;

  // CAGR Ricavi 3 anni
  const cagr = anno0.ricavi > 0 
    ? (Math.pow(anno3.ricavi / anno0.ricavi, 1 / 3) - 1) * 100 
    : 0;

  // Margine EBITDA medio
  const margineEbitdaMedio = (anno1.margineEbitda + pianoData.anno2.margineEbitda + anno3.margineEbitda) / 3;

  // Leverage (D/EBITDA) - usa dati anno0 se disponibili
  const debitiTotali = anno0Data.debiti_totali || 0;
  const leverage = anno3.ebitda > 0 ? debitiTotali / anno3.ebitda : 0;

  // Interest Coverage (EBIT / Oneri Finanziari)
  const interestCoverage = anno3.oneriFinanziari > 0 
    ? anno3.ebit / anno3.oneriFinanziari 
    : 999; // Infinito se no oneri

  // ROE (Utile / Patrimonio Netto) - stima conservativa
  const patrimonioNetto = anno0Data.patrimonio_netto || 0;
  const roe = patrimonioNetto > 0 ? (anno3.utileNetto / patrimonioNetto) * 100 : 0;

  // ROI (EBIT / Totale Attivo)
  const totaleAttivo = anno0Data.totale_attivo || 0;
  const roi = totaleAttivo > 0 ? (anno3.ebit / totaleAttivo) * 100 : 0;

  const kpis = {
    cagr_ricavi: parseFloat(cagr.toFixed(2)),
    margine_ebitda_medio: parseFloat(margineEbitdaMedio.toFixed(2)),
    leverage_y3: parseFloat(leverage.toFixed(2)),
    interest_coverage_y3: parseFloat(interestCoverage.toFixed(2)),
    roe_y3: parseFloat(roe.toFixed(2)),
    roi_y3: parseFloat(roi.toFixed(2)),
    breakeven_assessment: leverage < 1.5 ? 'SOSTENIBILE' : leverage < 2.5 ? 'MONITORARE' : 'CRITICO'
  };

  console.log(`[${sessionId}] ✅ KPI Calcolati:`, {
    CAGR: `${kpis.cagr_ricavi}%`,
    'Leverage': `${kpis.leverage_y3}x`,
    'Interest Coverage': `${kpis.interest_coverage_y3}x`,
    'Assessment': kpis.breakeven_assessment
  });

  return kpis;
};

// ============================================
// ANALISI SENSIBILITÀ
// ============================================

const calculateSensitivity = (pianoData, incidenze, growthRate, sessionId) => {
  console.log(`[${sessionId}] 📊 Calcolo sensibilità...`);

  const anno0 = pianoData.anno0;
  const sensibilita = {};

  // Variazioni: -10%, baseline, +10% sui ricavi
  const variazioni = [
    { label: 'ricavi_minus10', factor: 0.9 },
    { label: 'ricavi_baseline', factor: 1.0 },
    { label: 'ricavi_plus10', factor: 1.1 }
  ];

  for (const var_ of variazioni) {
    const fattoreRicavi = var_.factor;
    const anno3Adjusted = {};

    // Ricavi con fattore
    anno3Adjusted.ricavi = anno0.ricavi * Math.pow(1 + growthRate / 100, 3) * fattoreRicavi;

    // Costi variabili scale con ricavi
    anno3Adjusted.costiPersonale = anno0.costiPersonale * 1.02 ** 3; // Non scala
    anno3Adjusted.materiePrime = anno3Adjusted.ricavi * (incidenze.mp_pct / 100);
    anno3Adjusted.servizi = anno3Adjusted.ricavi * (incidenze.servizi_pct / 100);
    anno3Adjusted.godimento = anno3Adjusted.ricavi * (incidenze.godimento_pct / 100);
    anno3Adjusted.oneriDiversi = anno3Adjusted.ricavi * (incidenze.oneri_pct / 100);

    // EBITDA
    anno3Adjusted.ebitda = anno3Adjusted.ricavi - (
      anno3Adjusted.costiPersonale + anno3Adjusted.materiePrime + 
      anno3Adjusted.servizi + anno3Adjusted.godimento + anno3Adjusted.oneriDiversi
    );

    // EBIT
    anno3Adjusted.ebit = anno3Adjusted.ebitda - anno0.ammortamenti;

    // Margine EBITDA
    anno3Adjusted.margineEbitda = anno3Adjusted.ricavi > 0 
      ? (anno3Adjusted.ebitda / anno3Adjusted.ricavi) * 100 
      : 0;

    sensibilita[var_.label] = {
      ricavi: parseFloat(anno3Adjusted.ricavi.toFixed(0)),
      ebitda: parseFloat(anno3Adjusted.ebitda.toFixed(0)),
      margine_ebitda: parseFloat(anno3Adjusted.margineEbitda.toFixed(2))
    };
  }

  return sensibilita;
};

// ============================================
// GENERAZIONE NARRATIVE (Semplice, non IA)
// ============================================

const generateNarrative = (pianoData, incidenze, growthRate, kpis, companyName) => {
  const anno0 = pianoData.anno0;
  const anno3 = pianoData.anno3;

  const narrative = `
PIANO ECONOMICO TRIENNALE - ${companyName.toUpperCase()}

EXECUTIVE SUMMARY
Il presente piano economico triennale muove da un bilancio storico caratterizzato da ricavi di €${anno0.ricavi.toLocaleString('it-IT', { maximumFractionDigits: 0 })} e un EBITDA di €${anno0.ebitda.toLocaleString('it-IT', { maximumFractionDigits: 0 })} (margine ${(anno0.ebitda / anno0.ricavi * 100).toFixed(1)}%).

Con un tasso di crescita annua del ${growthRate}% (in linea con i benchmark settoriali), il piano stima ricavi a €${anno3.ricavi.toLocaleString('it-IT', { maximumFractionDigits: 0 })} entro il 2027, con EBITDA atteso a €${anno3.ebitda.toLocaleString('it-IT', { maximumFractionDigits: 0 })} e utile netto di €${anno3.utileNetto.toLocaleString('it-IT', { maximumFractionDigits: 0 })}. La traiettoria è ${kpis.breakeven_assessment === 'SOSTENIBILE' ? 'sostenibile' : 'da monitorare'}.

DRIVER DI CRESCITA
La crescita è sostenuta da: (a) espansione organica in linea con il settore di operatività, (b) stabilità dei margini operativi attraverso controllo dei costi, (c) effetto leva finanziaria moderato con riduzione progressiva del leverage.

METRICHE CHIAVE
- CAGR Ricavi 3 anni: ${kpis.cagr_ricavi}%
- Margine EBITDA medio: ${kpis.margine_ebitda_medio}%
- Leverage (D/EBITDA) Year 3: ${kpis.leverage_y3}x
- Interest Coverage Year 3: ${kpis.interest_coverage_y3}x
- Assessment complessivo: ${kpis.breakeven_assessment}

FATTORI DI RISCHIO
Il piano presuppone: (i) continuità operativa e stabilità della domanda, (ii) assenza di significativi incrementi nei prezzi delle materie prime, (iii) mantenimento dell'efficienza costi corrente, (iv) nessun nuovo indebitamento.

CONCLUSIONI
Il piano rappresenta uno scenario prudenziale basato su ipotesi conservative. È consigliabile un monitoraggio trimestrale dei KPI principali e una revisione annuale del piano in base ai risultati consuntivi.
`;

  return narrative.trim();
};

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'SessionId mancante' });
  }

  console.log(`[${sessionId}] 🚀 Avvio generazione piano economico...`);

  try {
    // ============================================
    // STEP 1: RECUPERA SESSIONE DA SUPABASE
    // ============================================

    const { data: session, error: sessionError } = await supabase
      .from('piano_economico_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error(`[${sessionId}] ❌ Sessione non trovata`);
      return res.status(404).json({ error: 'Sessione non trovata' });
    }

    console.log(`[${sessionId}] ✅ Sessione recuperata: ${session.company_name}`);

    // ============================================
    // STEP 2: OTTIENI TASSO DI CRESCITA
    // ============================================

    const atecoDivision = session.ateco_code?.substring(0, 2) || '00';
    const growthRate = getGrowthRate(
      atecoDivision,
      session.scenario_type || 'base',
      session.growth_rate_override
    );

    // ============================================
    // STEP 3: GENERA PIANO
    // ============================================

    const pianoData = generatePianoEconomico(
      session,
      {
        mp_pct: session.mp_pct || 0,
        servizi_pct: session.servizi_pct || 0,
        godimento_pct: session.godimento_pct || 0,
        oneri_pct: session.oneri_pct || 0
      },
      growthRate,
      sessionId
    );

    // ============================================
    // STEP 4: CALCOLA KPI
    // ============================================

    const kpis = calculateKpis(pianoData, session, sessionId);

    // ============================================
    // STEP 5: ANALISI SENSIBILITÀ
    // ============================================

    const sensibilita = calculateSensitivity(
      pianoData,
      {
        mp_pct: session.mp_pct || 0,
        servizi_pct: session.servizi_pct || 0,
        godimento_pct: session.godimento_pct || 0,
        oneri_pct: session.oneri_pct || 0
      },
      growthRate,
      sessionId
    );

    // ============================================
    // STEP 6: NARRATIVE
    // ============================================

    const narrative = generateNarrative(pianoData, session, growthRate, kpis, session.company_name);

    // ============================================
    // STEP 7: SALVA RISULTATI IN SUPABASE
    // ============================================

    const { error: updateError } = await supabase
      .from('piano_economico_sessions')
      .update({
        anno1_data: pianoData.anno1,
        anno2_data: pianoData.anno2,
        anno3_data: pianoData.anno3,
        kpi_derivati: kpis,
        sensibilita: sensibilita,
        narrative: narrative,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error(`[${sessionId}] ❌ Errore update Supabase:`, updateError);
      return res.status(500).json({ error: 'Errore salvataggio risultati' });
    }

    console.log(`[${sessionId}] ✅ Piano generato e salvato con successo`);

    // ============================================
    // STEP 8: RESPONSE
    // ============================================

    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      status: 'completed',
      data: {
        anno0: pianoData.anno0,
        anno1: pianoData.anno1,
        anno2: pianoData.anno2,
        anno3: pianoData.anno3,
        kpi: kpis,
        sensibilita: sensibilita,
        narrative: narrative,
        growth_rate_applied: growthRate,
        scenario_type: session.scenario_type
      }
    });

  } catch (error) {
    console.error(`[${sessionId}] 💥 Errore fatale:`, error);
    return res.status(500).json({
      error: error.message || 'Errore durante la generazione del piano',
      sessionId: sessionId
    });
  }
}
