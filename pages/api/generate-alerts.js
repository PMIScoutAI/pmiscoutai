// pages/api/generate-alerts.js

/**
 * NOTA PER L'INTEGRAZIONE REALE:
 * Questo è un endpoint MVP che SIMULA il recupero dei dati e la logica di business.
 * Le sezioni contrassegnate con "// TODO:" indicano dove inserire la logica reale
 * per l'autenticazione e il recupero dei dati dal tuo database (es. Supabase).
 */

// Funzione per simulare il recupero dell'ultima analisi dell'utente
async function getLatestUserAnalysis() {
  // TODO: Sostituire questa funzione con la logica reale.
  // 1. Recuperare l'utente autenticato dalla sessione/cookie (es. tramite Supabase Auth).
  // 2. Interrogare il database per trovare l'ultima 'checkup_sessions' per l'user_id.
  // 3. Eseguire una join con 'analysis_results' per ottenere i dati di contesto.
  
  // Esempio di dati simulati per un utente con un'analisi nel settore costruzioni in Abruzzo
  // Questo simula il risultato della query al DB.
  return {
    hasAnalysis: true,
    context: {
      ateco_code: "41.00.00", // Costruzioni
      region: "Abruzzo",
      health_score: 65, // Usato come proxy per "PMI"
    }
  };

  // Esempio per un utente senza analisi:
  // return { hasAnalysis: false, context: null };
  
  // Esempio per un'analisi senza regione:
  // return { hasAnalysis: true, context: { ateco_code: "70.22.09", region: null, health_score: 80 } };
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
    const { hasAnalysis, context } = await getLatestUserAnalysis();

    // Caso 1: Utente senza analisi, restituisce array vuoto
    if (!hasAnalysis) {
      return res.status(200).json([]);
    }

    const ateco = context?.ateco_code; // es. "41.00.00"
    const atecoDivision = ateco ? ateco.substring(0, 2) : null; // es. "41"
    const region = context?.region || 'Italia'; // Fallback a 'Italia'

    // Logica di filtraggio
    const relevantAlerts = allAlerts.filter(alert => {
      const regionMatch = alert.tags.region.includes('all') || alert.tags.region.includes(region);
      const atecoMatch = alert.tags.ateco.includes('all') || (atecoDivision && alert.tags.ateco.includes(atecoDivision));
      return regionMatch && atecoMatch;
    });

    // Logica di selezione e priorità (max 1 per categoria)
    const finalAlerts = [];
    const fiscalAlert = relevantAlerts.find(a => a.categoria === 'fiscale');
    const bandoAlert = relevantAlerts.find(a => a.categoria === 'bando');
    const normativaAlert = relevantAlerts.find(a => a.categoria === 'normativa');

    if (fiscalAlert) finalAlerts.push(fiscalAlert);
    if (bandoAlert) finalAlerts.push(bandoAlert);
    if (normativaAlert) finalAlerts.push(normativaAlert);

    // Caso 2: Nessun alert specifico trovato, restituisce un alert generico
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

    // Restituisce fino a 3 alert selezionati
    res.status(200).json(finalAlerts.slice(0, 3));

  } catch (error) {
    console.error("Errore in /api/generate-alerts:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
