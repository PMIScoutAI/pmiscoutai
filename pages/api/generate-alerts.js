// pages/api/generate-alerts.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateImpactWithAI(alert, context) {
  const { company_name, ateco_code } = context;
  const prompt = `Sintetizza in massimo 30 parole l'impatto per ${company_name}, impresa del settore ${ateco_code}, di questo avviso: "${alert.descrizione}".`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chiamata a OpenAI fallita con status: ${response.status}`);
    }

    const data = await response.json();
    const impatto_ai = data.choices[0]?.message?.content.trim() || '';

    return { impatto_ai, prompt_usato: prompt };
  } catch (error) {
    console.error("Errore durante la chiamata a OpenAI:", error);
    return { impatto_ai: '', prompt_usato: prompt };
  }
}

async function getLatestUserAnalysisContext(userId) {
  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !sessionData) {
      console.log(`Nessuna sessione di analisi trovata per l'utente con id: ${userId}`);
      return { hasAnalysis: false, context: null };
    }

const { data: analysisData, error: analysisError } = await supabase
  .from('analysis_results')
  .select('health_score, raw_parsed_data, company_name')
  .eq('session_id', sessionData.id)
  .single();

    if (analysisError || !analysisData) {
      console.error(`Dati di analisi non trovati per session_id: ${sessionData.id}`, analysisError);
      return { hasAnalysis: false, context: null };
    }

    const rawData = analysisData.raw_parsed_data || {};
    const contextData = rawData.context || {};
    
return {
  hasAnalysis: true,
  context: {
    company_name: analysisData.company_name || "la tua azienda",
    ateco_code: contextData.ateco_code || null
      }
    };
  } catch (error) {
    console.error("Errore imprevisto in getLatestUserAnalysisContext:", error);
    return { hasAnalysis: false, context: null };
  }
}

const allAlerts = [
  { id: 1, titolo: "Scadenza IVA – 31/08", categoria: "fiscale", urgenza: "alta", descrizione: "Ricorda il versamento trimestrale dell'IVA se sei un contribuente trimestrale.", cta: "Verifica scadenze", link: "#", tags: { region: ['all'], ateco: ['all'] } },
  { id: 2, titolo: "Acconto IRES/IRAP", categoria: "fiscale", urgenza: "media", descrizione: "Controlla le scadenze per il versamento degli acconti di novembre.", cta: "Dettagli", link: "#", tags: { region: ['all'], ateco: ['all'] } },
  { id: 3, titolo: "Bando Transizione 5.0", categoria: "bando", urgenza: "media", descrizione: "Crediti d'imposta per investimenti in digitalizzazione e sostenibilità.", cta: "Scopri di più", link: "#", tags: { region: ['all'], ateco: ['all'] } },
  { id: 4, titolo: "Bando Costruzioni Sostenibili - Abruzzo", categoria: "bando", urgenza: "alta", descrizione: "Contributi regionali per l'adozione di materiali e tecniche eco-sostenibili nel settore edile.", cta: "Partecipa ora", link: "#", tags: { region: ['Abruzzo'], ateco: ['41', '42', '43'] } },
  { id: 7, titolo: "Nuovo Regolamento Sicurezza Cantieri", categoria: "normativa", urgenza: "alta", descrizione: "Pubblicati aggiornamenti normativi cruciali sulla sicurezza nei cantieri edili.", cta: "Leggi la norma", link: "#", tags: { region: ['all'], ateco: ['41', '42', '43'] } },
  { id: 8, titolo: "Decreto Flussi 2025", categoria: "normativa", urgenza: "media", descrizione: "Pubblicate le nuove quote per l'ingresso di lavoratori extracomunitari.", cta: "Consulta il decreto", link: "#", tags: { region: ['all'], ateco: ['all'] } },
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const userEmail = req.query.email;
    if (!userEmail) {
      return res.status(400).json({ message: 'Email non fornita' });
    }

    const { data: userData, error: userError } = await supabase.from('users').select('id').eq('email', userEmail).single();
    if (userError || !userData) {
      console.error(`Handler: Utente non trovato per l'email: ${userEmail}`, userError);
      return res.status(200).json([]);
    }
    const userId = userData.id;

    const now = new Date().toISOString();
    const { data: existingAlerts, error: existingAlertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .lte('valid_from', now)
      .or(`valid_to.is.null,valid_to.gte.${now}`)
      .order('created_at', { ascending: false })
      .limit(3);

    if (existingAlertsError) {
      console.error("Errore lettura alert esistenti:", existingAlertsError);
    }

    if (existingAlerts && existingAlerts.length > 0) {
      console.log(`Trovati ${existingAlerts.length} alert validi nel DB per l'utente ${userId}.`);
      return res.status(200).json(existingAlerts);
    }

    console.log(`Nessun alert valido trovato, ne genero di nuovi per l'utente ${userId}.`);
    const { hasAnalysis, context } = await getLatestUserAnalysisContext(userId);

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

    let finalAlerts = [];
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
    finalAlerts = finalAlerts.slice(0, 3);

    if (finalAlerts.length > 0) {
      const alertsToInsert = finalAlerts.map(alert => ({
        user_id: userId,
        titolo: alert.titolo,
        categoria: alert.categoria,
        urgenza: alert.urgenza,
        descrizione: alert.descrizione,
        cta: alert.cta,
        link: alert.link,
        valid_from: new Date().toISOString(),
        valid_to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from('alerts')
        .insert(alertsToInsert)
        .select();

      if (insertError) {
        console.error("Errore durante il salvataggio dei nuovi alert:", insertError);
        return res.status(200).json(finalAlerts);
      } 
      
      if (insertedData) {
        console.log(`Salvati ${insertedData.length} nuovi alert per l'utente ${userId}. Inizio arricchimento AI...`);
        
        const enrichedAlerts = await Promise.all(
          insertedData.map(async (alert) => {
            const { impatto_ai, prompt_usato } = await generateImpactWithAI(alert, context);
            
            if (impatto_ai) {
              const { error: updateError } = await supabase
                .from('alerts')
                .update({ impatto_ai, prompt_usato })
                .eq('id', alert.id);

              if (updateError) {
                console.error(`Errore durante l'aggiornamento dell'alert ${alert.id} con i dati AI:`, updateError);
              }
            }
            return { ...alert, impatto_ai, prompt_usato };
          })
        );
        
        console.log("Arricchimento AI completato.");
        return res.status(200).json(enrichedAlerts);
      }
    }

    res.status(200).json(finalAlerts);

  } catch (error) {
    console.error("Errore handler /api/generate-alerts:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
