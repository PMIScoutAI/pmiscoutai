// /pages/api/start-checkup.js
// VERSIONE FINALE - Usa il modulo centralizzato per l'analisi AI

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { launchAIAnalysis } from '../../lib/ai-analysis.js'; // <-- ✅ 1. IMPORTA LA NUOVA FUNZIONE

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  let session;

  try {
    // 1. Autenticazione utente (invariata)
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) return res.status(401).json({ error: 'Token mancante.' });
    
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, { 
      headers: { Authorization: `Bearer ${outsetaToken}` } 
    });
    
    if (!outsetaResponse.ok) return res.status(401).json({ error: 'Token non valido.' });
    
    const outsetaUser = await outsetaResponse.json();
    const { data: userId } = await supabase.rpc('get_or_create_user', { 
      p_outseta_id: outsetaUser.Uid, 
      p_email: outsetaUser.Email, 
      p_first_name: outsetaUser.FirstName, 
      p_last_name: outsetaUser.LastName 
    });

    // 2. Gestione del file (invariata)
    const form = formidable({ 
      maxFileSize: 5 * 1024 * 1024, 
      filter: ({ mimetype }) => mimetype && mimetype.includes('pdf') 
    });
    
    const [fields, files] = await form.parse(req);
    const companyName = fields.companyName?.[0];
    const pdfFile = files.pdfFile?.[0];
    
    if (!companyName || !pdfFile) {
      throw new Error('Nome azienda o file PDF mancante.');
    }

    // 3. Creazione sessione (invariata)
    const { data: company } = await supabase
      .from('companies')
      .upsert({ 
        user_id: userId, 
        company_name: companyName 
      }, { onConflict: 'user_id' })
      .select()
      .single();
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({ 
        user_id: userId, 
        company_id: company.id, 
        status: 'processing',
        session_name: `Check-UP ${companyName} - ${new Date().toLocaleDateString('it-IT')}`
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Errore creazione sessione: ${sessionError.message}`);
    }
    
    session = sessionData;

    // 4. Upload del file (invariata)
    const fileName = `${pdfFile.originalFilename}`;
    const fileBuffer = fs.readFileSync(pdfFile.filepath);
    
    const { error: uploadError } = await supabase.storage
      .from('checkup-documents')
      .upload(`public/${session.id}/${fileName}`, fileBuffer, { 
        contentType: 'application/pdf', 
        upsert: true 
      });

    if (uploadError) {
      throw new Error(`Errore upload file: ${uploadError.message}`);
    }
    
    // ✅ 5. SOSTITUZIONE: Avvio dell'analisi AI tramite il modulo centralizzato
    try {
      console.log(`[${session.id}] Avvio analisi AI tramite il modulo dedicato...`);
    
      // Chiama la funzione robusta e centralizzata dal file /lib/ai-analysis.js
      await launchAIAnalysis(session.id);
    
      console.log(`[${session.id}] Comando di avvio analisi inviato con successo.`);
    
    } catch (error) {
      // Se launchAIAnalysis fallisce (es. per variabili d'ambiente mancanti),
      // il modulo genererà un errore descrittivo che catturiamo qui.
      console.error(`[${session.id}] Il modulo di analisi ha restituito un errore bloccante:`, error.message);
    
      // Aggiorniamo lo stato della sessione nel database per notificare il fallimento.
      await supabase
        .from('checkup_sessions')
        .update({
          status: 'failed',
          error_message: `Errore avvio analisi: ${error.message}`
        })
        .eq('id', session.id);
    }
    
    // 6. Restituisce SEMPRE il session_id (anche se l'analisi è fallita)
    console.log(`✅ [${session.id}] Setup completato, restituisco sessionId`);
    return res.status(200).json({ success: true, sessionId: session.id });

  } catch (error) {
    console.error('💥 Errore fatale in start-checkup:', error);
    
    // Solo errori di setup (non di analisi) segnano la sessione come fallita
    if (session?.id) {
      await supabase
        .from('checkup_sessions')
        .update({ 
          status: 'failed', 
          error_message: `Errore setup: ${error.message}` 
        })
        .eq('id', session.id);
    }
    
    return res.status(500).json({ 
      error: error.message || 'Errore interno del server' 
    });
  }
}
