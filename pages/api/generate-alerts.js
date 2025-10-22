// pages/api/generate-alerts.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateImpactWithAI(alert, context) {
  const { company_name, ateco_code } = context;

  // Prompt più dettagliato per sfruttare le capacità di GPT-4o-mini
  const prompt = `Sei un esperto consulente fiscale e normativo per PMI italiane.

DATA ODIERNA: ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}

CONTESTO AZIENDA:
- Nome: ${company_name}
- Settore ATECO: ${ateco_code || 'non specificato'}
- Categoria alert: ${alert.categoria}

AVVISO DA ANALIZZARE:
"${alert.descrizione}"

COMPITO:
Genera un'analisi dell'impatto concreto di questo avviso per questa specifica azienda.

REQUISITI:
- Massimo 30 parole
- Linguaggio professionale ma accessibile
- Focalizzati su azioni concrete che il commercialista deve intraprendere
- Se menzioni scadenze, verifica che siano realistiche rispetto alla data odierna
- NON inventare date o bandi se non sei certo

FORMATO: Testo diretto senza introduzioni.`.trim();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI HTTP ${response.status}:`, errorText);
      throw new Error(`OpenAI API failed with status ${response.status}`);
    }

    const data = await response.json();
    const impatto_ai = data.choices[0]?.message?.content.trim() || '';

    if (!impatto_ai) {
      console.warn(`⚠️ GPT-4o-mini returned empty response for alert: ${alert.titolo}`);
    }

    return { impatto_ai, prompt_usato: prompt };

  } catch (error) {
    console.error(`❌ Errore GPT-4o-mini per alert "${alert.titolo}":`, error.message);
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

    // FIX 1: Estrazione della regione da multiple sorgenti possibili
    const region = contextData.region || contextData.sede_legale?.regione || null;

return {
  hasAnalysis: true,
  context: {
    company_name: analysisData.company_name || "la tua azienda",
    ateco_code: contextData.ateco_code || null,
    region: region
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
  // Fallback generico sempre disponibile
  { id: 99, titolo: "Calendario fiscale di fine mese", categoria: "fiscale", urgenza: "bassa", descrizione: "Controlla le principali scadenze fiscali e contributive in arrivo.", cta: "Dettagli", link: "#", tags: { region: ['all'], ateco: ['all'] } },
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
      console.log(`✅ Trovati ${existingAlerts.length} alert validi in cache per user ${userId}`);
      return res.status(200).json(existingAlerts);
    }

    console.log(`ℹ️ Nessun alert in cache, genero nuovi alert per user ${userId}`);
    const { hasAnalysis, context } = await getLatestUserAnalysisContext(userId);

    if (!hasAnalysis) {
      console.log(`⚠️ User ${userId} non ha analisi disponibili, nessun alert generato`);
      return res.status(200).json([]);
    }

    const ateco = context?.ateco_code;
    const atecoDivision = ateco ? ateco.substring(0, 2) : null;
    const region = context?.region || 'Italia';

    console.log(`📊 Context estratto: ATECO=${ateco}, Division=${atecoDivision}, Region=${region}`);

    // FIX 2: Sistema di scoring per maggiore flessibilità nel matching
    const relevantAlerts = allAlerts
      .map(alert => {
        let score = 0;

        // Scoring per regione
        if (alert.tags.region.includes(region)) {
          score += 10; // Match perfetto regione
        } else if (alert.tags.region.includes('all')) {
          score += 5; // Match generico regione
        }

        // Scoring per ATECO
        if (atecoDivision && alert.tags.ateco.includes(atecoDivision)) {
          score += 10; // Match perfetto ATECO
        } else if (alert.tags.ateco.includes('all')) {
          score += 5; // Match generico ATECO
        }

        // Bonus per urgenza alta
        if (alert.urgenza === 'alta') {
          score += 3;
        } else if (alert.urgenza === 'media') {
          score += 1;
        }

        return { ...alert, relevance_score: score };
      })
      .filter(alert => alert.relevance_score > 0) // Solo alert con almeno qualche match
      .sort((a, b) => b.relevance_score - a.relevance_score); // Ordina per rilevanza

    let finalAlerts = [];
    const fiscalAlert = relevantAlerts.find(a => a.categoria === 'fiscale');
    const bandoAlert = relevantAlerts.find(a => a.categoria === 'bando');
    const normativaAlert = relevantAlerts.find(a => a.categoria === 'normativa');

    if (fiscalAlert) finalAlerts.push(fiscalAlert);
    if (bandoAlert) finalAlerts.push(bandoAlert);
    if (normativaAlert) finalAlerts.push(normativaAlert);

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
        // Errore 23505 = violazione unique constraint (alert duplicati)
        if (insertError.code === '23505') {
          console.log(`ℹ️ Alert già esistenti per user ${userId} (duplicati rilevati)`);
          return res.status(200).json(existingAlerts || finalAlerts);
        }

        // Altri errori sono problemi veri
        console.error("❌ Errore salvataggio alert:", insertError);
        return res.status(500).json({ message: 'Errore durante il salvataggio degli alert' });
      } 
      
      if (insertedData) {
        console.log(`💾 Salvati ${insertedData.length} nuovi alert per user ${userId}. Avvio arricchimento AI...`);
        
        const enrichedAlerts = await Promise.all(
          insertedData.map(async (alert) => {
            const { impatto_ai, prompt_usato } = await generateImpactWithAI(alert, context);
            
            if (impatto_ai && impatto_ai.length > 0) {
              const { error: updateError } = await supabase
                .from('alerts')
                .update({ impatto_ai, prompt_usato })
                .eq('id', alert.id);

              if (updateError) {
                console.error(`❌ Update fallito per alert ${alert.id}:`, updateError);
              } else {
                console.log(`✅ Alert "${alert.titolo}" arricchito con AI (${impatto_ai.length} char)`);
              }
            } else {
              console.warn(`⚠️ Alert "${alert.titolo}": impatto_ai vuoto, non salvato nel DB`);
            }
            return { ...alert, impatto_ai, prompt_usato };
          })
        );
        
        console.log(`🎉 Arricchimento AI completato per user ${userId}`);
        return res.status(200).json(enrichedAlerts);
      }
    }

    res.status(200).json(finalAlerts);

  } catch (error) {
    console.error("Errore handler /api/generate-alerts:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
