// pages/api/generate-alerts.js

import { createClient } from '@supabase/supabase-js';
import { applyRateLimit } from '../../utils/rateLimitMiddleware';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateAlertsWithAI(context) {
  const { company_name, ateco_code } = context;
  const atecoDivision = ateco_code ? ateco_code.substring(0, 2) : 'non specificato';
  
  const prompt = `Sei un esperto di normative fiscali, bandi e obblighi per PMI italiane.

DATA ODIERNA: ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}

AZIENDA: ${company_name}
SETTORE ATECO: ${ateco_code || 'non specificato'} (Divisione ${atecoDivision})

COMPITO:
Genera 3 alert urgenti e reali per questa PMI italiana. Ogni alert deve riguardare:
1. Un alert FISCALE (scadenze imminenti nei prossimi 30-60 giorni, versamenti, dichiarazioni)
2. Un alert BANDO (agevolazioni/crediti d'imposta attivi o in apertura per questo settore)
3. Un alert NORMATIVA (nuovi obblighi/regolamenti entrati in vigore o in arrivo per questo settore)

REGOLE CRITICHE:
- USA SOLO informazioni verificabili e realistiche
- Per scadenze fiscali: usa quelle standard del calendario fiscale italiano (IVA, IRES, IRAP, F24, ecc.)
- Per bandi: se non conosci bandi specifici attuali, suggerisci categorie generiche (es. "Verifica bandi Transizione 4.0")
- Per normative: fai riferimento a obblighi generali del settore (sicurezza, GDPR, ambiente, ecc.)
- NON inventare nomi specifici di bandi o decreti se non sei certo
- Linguaggio: professionale ma accessibile per commercialisti
- Ogni descrizione deve essere AZIONABILE (cosa deve fare il commercialista)

FORMATO RISPOSTA (rispetta esattamente, separa ogni alert con "---"):
TITOLO: [max 60 caratteri, chiaro e specifico]
CATEGORIA: fiscale
URGENZA: [alta|media|bassa]
DESCRIZIONE: [100-150 caratteri, concreto e azionabile con riferimento al settore]
CTA: [2-3 parole, es: "Verifica scadenze"]
---
TITOLO: [max 60 caratteri]
CATEGORIA: bando
URGENZA: [alta|media|bassa]
DESCRIZIONE: [100-150 caratteri, specifico per il settore ATECO]
CTA: [2-3 parole]
---
TITOLO: [max 60 caratteri]
CATEGORIA: normativa
URGENZA: [alta|media|bassa]
DESCRIZIONE: [100-150 caratteri, obblighi reali del settore]
CTA: [2-3 parole]`;

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
        max_tokens: 800,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI HTTP ${response.status}:`, errorText);
      throw new Error(`OpenAI failed: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0]?.message?.content.trim() || '';

    console.log(`🤖 Risposta raw AI:\n${rawText.substring(0, 300)}...`);

    // Parsa la risposta
    const alertBlocks = rawText.split('---').filter(block => block.trim());
    const parsedAlerts = alertBlocks.map((block, index) => {
      const lines = block.trim().split('\n');
      const alert = {};
      
      lines.forEach(line => {
        const cleanLine = line.trim();
        if (cleanLine.startsWith('TITOLO:')) {
          alert.titolo = cleanLine.replace('TITOLO:', '').trim();
        }
        if (cleanLine.startsWith('CATEGORIA:')) {
          alert.categoria = cleanLine.replace('CATEGORIA:', '').trim().toLowerCase();
        }
        if (cleanLine.startsWith('URGENZA:')) {
          alert.urgenza = cleanLine.replace('URGENZA:', '').trim().toLowerCase();
        }
        if (cleanLine.startsWith('DESCRIZIONE:')) {
          alert.descrizione = cleanLine.replace('DESCRIZIONE:', '').trim();
        }
        if (cleanLine.startsWith('CTA:')) {
          alert.cta = cleanLine.replace('CTA:', '').trim();
        }
      });

      // Validazione
      if (!alert.titolo || !alert.categoria || !alert.descrizione) {
        console.warn(`⚠️ Alert ${index + 1} incompleto:`, alert);
        return null;
      }

      // Normalizza categoria
      if (!['fiscale', 'bando', 'normativa'].includes(alert.categoria)) {
        alert.categoria = 'fiscale';
      }

      // Normalizza urgenza
      if (!['alta', 'media', 'bassa'].includes(alert.urgenza)) {
        alert.urgenza = 'media';
      }

      // Default CTA
      if (!alert.cta) {
        alert.cta = 'Scopri di più';
      }

      return alert;
    });

    const validAlerts = parsedAlerts.filter(a => a !== null);
    console.log(`✅ Generati ${validAlerts.length} alert validi da AI`);

    return validAlerts;
    
  } catch (error) {
    console.error('❌ Errore generazione alert AI:', error.message);
    return [];
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
        company_name: analysisData.company_name || "l'azienda",
        ateco_code: contextData.ateco_code || null,
        region: contextData.region || null
      }
    };
  } catch (error) {
    console.error("Errore imprevisto in getLatestUserAnalysisContext:", error);
    return { hasAnalysis: false, context: null };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 🛡️ Rate Limiting (con feature flag per rollback sicuro)
  const rateLimitError = applyRateLimit(req, res);
  if (rateLimitError) {
    return res.status(429).json(rateLimitError);
  }

  try {
    const userEmail = req.query.email;
    const forceRefresh = req.query.refresh === 'true';

    if (!userEmail) {
      return res.status(400).json({ message: 'Email non fornita' });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError || !userData) {
      console.error(`Handler: Utente non trovato per l'email: ${userEmail}`, userError);
      return res.status(200).json([]);
    }
    const userId = userData.id;

    // Controlla se ci sono alert in cache (validi negli ultimi 7 giorni)
    if (!forceRefresh) {
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
    } else {
      console.log(`🔄 Refresh forzato per user ${userId}, ignoro cache`);
    }

    console.log(`ℹ️ Nessun alert in cache, genero nuovi alert AI per user ${userId}`);
    
    const { hasAnalysis, context } = await getLatestUserAnalysisContext(userId);

    if (!hasAnalysis) {
      console.log(`⚠️ User ${userId} non ha analisi disponibili, nessun alert generato`);
      return res.status(200).json([]);
    }

    console.log(`📊 Context estratto: Company=${context.company_name}, ATECO=${context.ateco_code}`);

    // GENERA ALERT CON AI (niente array hardcoded)
    const generatedAlerts = await generateAlertsWithAI(context);

    if (generatedAlerts.length === 0) {
      console.warn(`⚠️ AI non ha generato alert, uso fallback`);
      // Fallback se AI fallisce completamente
      return res.status(200).json([{
        titolo: "Verifica scadenze fiscali",
        categoria: "fiscale",
        urgenza: "media",
        descrizione: "Controlla le prossime scadenze fiscali e contributive per la tua attività",
        cta: "Dettagli",
        link: "#",
        impatto_ai: null,
        prompt_usato: null
      }]);
    }

    // Salva nel DB (cache per 7 giorni)
    const alertsToInsert = generatedAlerts.map(alert => ({
      user_id: userId,
      titolo: alert.titolo,
      categoria: alert.categoria,
      urgenza: alert.urgenza,
      descrizione: alert.descrizione,
      cta: alert.cta || "Scopri di più",
      link: "#",
      impatto_ai: alert.descrizione, // La descrizione È già l'impatto AI
      prompt_usato: `AI-generated for ${context.company_name} (ATECO ${context.ateco_code})`,
      valid_from: new Date().toISOString(),
      valid_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 giorni
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('alerts')
      .insert(alertsToInsert)
      .select();

    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`ℹ️ Alert già esistenti per user ${userId} (duplicati rilevati)`);
        // Riprova a leggere dalla cache
        const { data: existingAlerts } = await supabase
          .from('alerts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3);
        return res.status(200).json(existingAlerts || generatedAlerts);
      }
      
      console.error("❌ Errore salvataggio alert:", insertError);
      return res.status(500).json({ message: 'Errore durante il salvataggio degli alert' });
    }

    if (insertedData) {
      console.log(`💾 Salvati ${insertedData.length} nuovi alert AI per user ${userId}`);
      return res.status(200).json(insertedData);
    }

    res.status(200).json(generatedAlerts);

  } catch (error) {
    console.error("❌ Errore handler /api/generate-alerts:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
