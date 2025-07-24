// pages/api/start-checkup.js
// API intelligente che gestisce tutto il processo di checkup

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

// Configurazione
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OUTSETA_API_KEY = process.env.OUTSETA_API_KEY;
const OUTSETA_API_URL = 'https://pmiscout.outseta.com/api/v1';
const USER_CHECKUP_LIMIT = 15;

// Disabilita il body parser di Next.js per gestire FormData
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Solo POST è permesso
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    console.log('🚀 Start checkup API chiamata');

    // 1. PARSING DELLA RICHIESTA
    // ================================================
    const { fields, files } = await parseForm(req);
    
    // Estrai i dati dal form
    const formData = JSON.parse(fields.formData || '{}');
    const outsetaToken = fields.outsetaToken;
    
    // Validazione base
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autenticazione mancante' });
    }

    if (!formData.company_name || !formData.industry_sector || !formData.company_size) {
      return res.status(400).json({ error: 'Dati azienda incompleti' });
    }

    if (!files.file) {
      return res.status(400).json({ error: 'File bilancio mancante' });
    }

    // Verifica tipo file
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file.mimetype || !file.mimetype.includes('pdf')) {
      return res.status(400).json({ error: 'Il file deve essere un PDF' });
    }

    console.log('✅ Dati form validati');

    // 2. VERIFICA TOKEN OUTSETA
    // ================================================
    const outsetaUser = await verifyOutsetaToken(outsetaToken);
    if (!outsetaUser) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }

    console.log('✅ Utente Outseta verificato:', outsetaUser.Email);

    // 3. SINCRONIZZA UTENTE NEL DATABASE
    // ================================================
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName || null,
      p_last_name: outsetaUser.LastName || null,
      p_full_name: outsetaUser.FullName || null
    });

    if (userError) {
      console.error('❌ Errore creazione utente:', userError);
      return res.status(500).json({ error: 'Errore sincronizzazione utente' });
    }

    console.log('✅ Utente sincronizzato, ID:', userId);

    // 4. CONTROLLA LIMITE UTILIZZO
    // ================================================
    const { data: sessionCount, error: countError } = await supabase.rpc('count_user_sessions', {
      p_user_id: userId
    });

    if (countError) {
      console.error('❌ Errore conteggio sessioni:', countError);
      return res.status(500).json({ error: 'Errore verifica limite' });
    }

    if (sessionCount >= USER_CHECKUP_LIMIT) {
      console.log('⚠️ Limite raggiunto per utente:', userId);
      return res.status(429).json({ 
        error: 'Limite di analisi raggiunto',
        message: `Hai già utilizzato tutte le ${USER_CHECKUP_LIMIT} analisi disponibili nel piano gratuito.`,
        sessionsUsed: sessionCount,
        limit: USER_CHECKUP_LIMIT
      });
    }

    console.log(`✅ Controllo limite OK: ${sessionCount}/${USER_CHECKUP_LIMIT}`);

    // 5. GESTISCI AZIENDA (CREA O AGGIORNA)
    // ================================================
    // Prima cerca se esiste già un'azienda per questo utente
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', userId)
      .single();

    let companyId;
    const companyPayload = {
      user_id: userId,
      company_name: formData.company_name,
      vat_number: formData.vat_number || null,
      industry_sector: formData.industry_sector,
      ateco_code: formData.ateco_code || null,
      company_size: formData.company_size,
      employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
      revenue_range: formData.revenue_range || null,
      location_city: formData.location_city || null,
      location_region: formData.location_region || null,
      website_url: formData.website_url || null,
      description: formData.description || null,
      main_challenges: formData.main_challenges || null,
      business_goals: formData.business_goals || null
    };

    if (existingCompany) {
      // Aggiorna azienda esistente
      const { data: updated, error: updateError } = await supabase
        .from('companies')
        .update(companyPayload)
        .eq('id', existingCompany.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('❌ Errore aggiornamento azienda:', updateError);
        return res.status(500).json({ error: 'Errore aggiornamento dati azienda' });
      }
      companyId = updated.id;
      console.log('✅ Azienda aggiornata:', companyId);
    } else {
      // Crea nuova azienda
      const { data: created, error: createError } = await supabase
        .from('companies')
        .insert(companyPayload)
        .select('id')
        .single();

      if (createError) {
        console.error('❌ Errore creazione azienda:', createError);
        return res.status(500).json({ error: 'Errore creazione azienda' });
      }
      companyId = created.id;
      console.log('✅ Azienda creata:', companyId);
    }

    // 6. CREA SESSIONE DI CHECKUP
    // ================================================
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({
        user_id: userId,
        company_id: companyId,
        session_name: `Analisi per ${formData.company_name}`,
        status: 'waiting_for_file'
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('❌ Errore creazione sessione:', sessionError);
      return res.status(500).json({ error: 'Errore creazione sessione' });
    }

    const sessionId = session.id;
    console.log('✅ Sessione creata:', sessionId);

    // 7. PREPARA UPLOAD FILE
    // ================================================
    // Genera percorso file
    const fileName = `${sessionId}/${file.originalFilename || 'bilancio.pdf'}`;
    
    // Crea signed URL per upload diretto
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('checkup-documents')
      .createSignedUploadUrl(fileName);

    if (uploadError) {
      console.error('❌ Errore creazione upload URL:', uploadError);
      // Rollback: elimina la sessione creata
      await supabase.from('checkup_sessions').delete().eq('id', sessionId);
      return res.status(500).json({ error: 'Errore preparazione upload' });
    }

    console.log('✅ Upload URL creato');

    // 8. CARICA IL FILE DIRETTAMENTE
    // ================================================
    // Leggi il file dal filesystem temporaneo
    const fileBuffer = fs.readFileSync(file.filepath);
    
    // Upload usando l'URL firmato
    const uploadResponse = await fetch(uploadData.signedUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/pdf'
      }
    });

    if (!uploadResponse.ok) {
      console.error('❌ Errore upload file');
      // Rollback: elimina la sessione
      await supabase.from('checkup_sessions').delete().eq('id', sessionId);
      return res.status(500).json({ error: 'Errore upload file' });
    }

    // Aggiorna sessione con percorso file
    await supabase
      .from('checkup_sessions')
      .update({ 
        file_path: fileName,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    console.log('✅ File caricato con successo');

    // 9. TRIGGER ANALISI AI (OPZIONALE)
    // ================================================
    // Qui puoi triggerare l'analisi AI in background
    // Per ora lo lasciamo come placeholder
    triggerAIAnalysis(sessionId).catch(err => {
      console.error('Errore trigger AI:', err);
    });

    // 10. RISPOSTA SUCCESSO
    // ================================================
    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      message: 'Checkup avviato con successo',
      sessionsUsed: sessionCount + 1,
      sessionsRemaining: USER_CHECKUP_LIMIT - (sessionCount + 1)
    });

  } catch (error) {
    console.error('💥 Errore generale:', error);
    return res.status(500).json({ 
      error: 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// FUNZIONI HELPER
// ================================================

// Parser per FormData con formidable
async function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB max
      keepExtensions: true
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// Verifica token con Outseta API
async function verifyOutsetaToken(token) {
  try {
    const response = await fetch(`${OUTSETA_API_URL}/auth/validate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('Token Outseta non valido');
      return null;
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error('Errore verifica Outseta:', error);
    return null;
  }
}

// Trigger analisi AI (placeholder)
async function triggerAIAnalysis(sessionId) {
  // Qui chiamerai la tua funzione di analisi AI
  // Per ora è solo un placeholder
  console.log(`🤖 AI analysis triggered for session: ${sessionId}`);
  
  // Esempio: potresti chiamare un'altra API o una edge function
  // await fetch('/api/analyze', { 
  //   method: 'POST', 
  //   body: JSON.stringify({ sessionId }) 
  // });
}
