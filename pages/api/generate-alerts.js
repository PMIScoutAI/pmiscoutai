// pages/api/generate-alerts.js

import { createClient } from '@supabase/supabase-js';

// ✅ MODIFICA: Utilizzo delle variabili d'ambiente server-side per maggiore sicurezza.
// Queste chiavi bypassano le policy RLS e sono adatte per l'uso in backend.
// Assicurati di averle impostate nelle Environment Variables del tuo progetto Vercel.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Funzione aggiornata per leggere i dati reali da Supabase.
 * Recupera l'ultima analisi dell'utente autenticato per generare alert contestuali.
 */
async function getLatestUserAnalysis(req) {
  try {
    // Step 1: Recuperare user_id dell'utente tramite email (logica allineata a /api/user-analyses)
    const userEmail = req.query.email || 'investimentolibero@gmail.com'; // fallback in beta

    if (!userEmail) {
        console.warn('Email utente non fornita nella richiesta.');
        return { hasAnalysis: false, context: null };
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError || !userData) {
      console.error(`Utente non trovato per l'email: ${userEmail}`, userError);
      return { hasAnalysis: false, context: null };
    }
    const userId = userData.id;

    // Step 2: Trovare l'ultima checkup_session per l'utente
    const { data: sessionData, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('id') // ✅ FIX: La colonna si chiama 'id', non 'session_id'
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !sessionData) {
      // Non è un errore, l'utente potrebbe non avere ancora analisi
      console.log(`Nessuna sessione di analisi trovata per l'utente con id: ${userId}`);
      return { hasAnalysis: false, context: null };
    }
    // Usiamo un alias per mantenere la coerenza con il resto del codice
    const { id: session_id } = sessionData;

    // Step 3: Leggere i dati contestuali da analysis_results
    const { data: analysisData, error: analysisError } = await supabase
      .from('analysis_results')
      .select('health_score, raw_parsed_data')
      .eq('session_id', session_id)
      .single();

    if (analysisError || !analysisData) {
      console.error(`Dati di analisi non trovati per session_id: ${session_id}`, analysisError);
      return { hasAnalysis: false, context: null };
    }

    // Step 4: Estrarre e restituire il contesto per il filtro
    const rawData = JSON.parse(analysisData.raw_parsed_data || '{}');
    const contextData = rawData.context || {};
    
    return {
      hasAnalysis: true,
      context: {
        ateco_code: contextData.ateco_code || null, // Restituisce null se non presente
        region: contextData.region || "Italia", // Fallback a "Italia" se mancante
        health_score: analysisData.health_score
      }
    };

  } catch (error) {
    console.error("Errore imprevisto in getLatestUserAnalysis:", error);
    return { hasAnalysis: false, context: null };
  }
}

// Fonte dati per gli alert (in MVP può essere una lista hardcoded)
const allAlerts = [
  // --- FISCALE ---
  {
    id: 1,
    titolo: "Scadenza IVA – 31/08",
    categoria: "fiscale",
    urgenza: "alta",
    descrizione: "Ricorda il versamento trimestrale dell'IVA se sei un contribuente trimestrale.",
    cta: "Verifica scadenze",
    link: "#",
    tags: { region: ['all'], ateco: ['all'] }
  },
  {
    id: 2,
    titolo: "Acconto IRES/IRAP",
    categoria: "fiscale",
    urgenza: "media",
    descrizione: "Controlla le scadenze per il versamento degli acconti di novembre.",
    cta: "Dettagli",
    link: "#",
    tags: { region: ['all'], ateco: ['all'] }
  },
  // --- BANDI ---
  {
    id: 3,
    titolo: "Bando Transizione 5.0",
    categoria: "bando",
    urgenza: "media",
    descrizione: "Crediti d'imposta per investimenti in digitalizzazione e sostenibilità.",
    cta: "Scopri di più",
    link: "#",
    tags: { region: ['all'], ateco: ['all'] }
  },
  {
    id: 4,
    titolo: "Bando Costruzioni Sostenibili - Abruzzo",
    categoria: "bando",
    urgenza: "alta",
    descrizione: "Contributi regionali per l'adozione di materiali e tecniche eco-sostenibili nel settore edile.",
    cta: "Partecipa ora",
    link: "#",
    tags: { region: ['Abruzzo'], ateco: ['41', '42', '43'] }
  },
  // --- NORMATIVA ---
  {
    id: 7,
    titolo: "Nuovo Regolamento Sicurezza Cantieri",
    categoria: "normativa",
    urgenza: "alta",
    descrizione: "Pubblicati aggiornamenti normativi cruciali sulla sicurezza nei cantieri edili.",
    cta: "Leggi la norma",
    link: "#",
    tags: { region: ['all'], ateco: ['41', '42', '43'] }
  },
  {
    id: 8,
    titolo: "Decreto Flussi 2025",
    categoria: "normativa",
    urgenza: "media",
    descrizione: "Pubblicate le nuove quote per l'ingresso di lavoratori extracomunitari.",
    cta: "Consulta il decreto",
    link: "#",
    tags: { region: ['all'], ateco: ['all'] }
  },
];


export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // La richiesta (req) viene passata alla funzione per accedere ai query params
    const { hasAnalysis, context } = await getLatestUserAnalysis(req);

    if (!hasAnalysis) {
      return res.status(200).json([]);
    }

    const ateco = context?.ateco_code;
    const atecoDivision = ateco ? ateco.substring(0, 2) : null;
    const region = context?.region || 'Italia';

    const relevantAlerts = allAlerts.filter(alert => {
      const regionMatch = alert.tags.region.includes('all') || alert.tags.region.includes(region);
      const atecoMatch = alert.tags.ateco.includes('all') || (atecoDivision && alert.tags.ateco.includes(atecoDivision));
      return regionMatch && atecoMatch;
    });

    const finalAlerts = [];
    const fiscalAlert = relevantAlerts.find(a => a.categoria === 'fiscale');
    const bandoAlert = relevantAlerts.find(a => a.categoria === 'bando');
    const normativaAlert = relevantAlerts.find(a => a.categoria === 'normativa');

    if (fiscalAlert) finalAlerts.push(fiscalAlert);
    if (bandoAlert) finalAlerts.push(bandoAlert);
    if (normativaAlert) finalAlerts.push(normativaAlert);

    if (finalAlerts.length === 0) {
      finalAlerts.push({
        titolo: "Calendario fiscale di fine mese",
        categoria: "fiscale",
        urgenza: "bassa",
        descrizione: "Controlla le principali scadenze fiscali e contributive in arrivo.",
        cta: "Dettagli",
        link: "#"
      });
    }

    res.status(200).json(finalAlerts.slice(0, 3));

  } catch (error) {
    console.error("Errore in /api/generate-alerts:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
