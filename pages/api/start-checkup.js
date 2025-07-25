// /pages/api/start-checkup.js
// AGGIORNATO: Usa modulo AI separato per mantenere il codice pulito
// Gestisce form data + upload PDF + creazione sessione + trigger AI analysis

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { launchAIAnalysis } from '../../lib/ai-analysis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurazione per gestire file upload
export const config = {
  api: {
    bodyParser: false, // Disabilita il body parser di Next.js per gestire FormData
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Estrai il token di autenticazione dall'header
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autenticazione mancante.' });
    }

    // 2. Verifica il token con Outseta
    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` },
    });
    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token Outseta non valido o scaduto.' });
    }
    const outsetaUser = await outsetaResponse.json();

    // 3. Sincronizza/ottieni l'utente
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName,
    });

    if (userError) {
      throw new Error(`Errore durante la sincronizzazione: ${userError.message}`);
    }

    // 4. Parsing del FormData
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB max
      filter: ({ mimetype }) => mimetype && mimetype.includes('pdf'), // Solo PDF
    });

    const [fields, files] = await form.parse(req);
    
    const companyName = fields.companyName?.[0];
    const vatNumber = fields.vatNumber?.[0] || '';
    const pdfFile = files.pdfFile?.[0];

    if (!companyName) {
      throw new Error('Nome azienda è obbligatorio');
    }
    if (!pdfFile) {
      throw new Error('File PDF è obbligatorio');
    }

    console.log(`✅ Dati ricevuti: ${companyName}, PDF: ${pdfFile.originalFilename}`);

    // 5. Crea/aggiorna azienda
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({
        user_id: userId,
        company_name: companyName,
        vat_number: vatNumber,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (companyError) {
      throw new Error(`Errore creazione azienda: ${companyError.message}`);
    }

    // 6. Crea sessione checkup
    const { data: session, error: sessionError } = await supabase
      .from('checkup_sessions')
      .insert({
        user_id: userId,
        company_id: company.id,
        status: 'processing',
        session_name: `Check-UP ${companyName} - ${new Date().toLocaleDateString()}`
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Errore creazione sessione: ${sessionError.message}`);
    }

    // 7. Upload PDF su Storage
    const fileName = `${session.id}_${pdfFile.originalFilename}`;
    const fileBuffer = fs.readFileSync(pdfFile.filepath);
    
    const { error: uploadError } = await supabase.storage
      .from('checkup-documents')
      .upload(`public/${session.id}/${fileName}`, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Errore upload PDF: ${uploadError.message}`);
    }

    console.log(`✅ PDF caricato: ${fileName}`);

    // 8. NUOVO: Trigger AI Analysis tramite modulo separato
    try {
      await launchAIAnalysis(session.id);
      console.log(`✅ Analisi AI avviata per sessione: ${session.id}`);
    } catch (aiError) {
      console.error('⚠️ Errore avvio analisi AI:', aiError);
      // Non blocchiamo il flusso, l'analisi può essere ritentata
      // La sessione rimane in 'processing' e può essere ripresa
    }

    // 9. Incrementa checkup_count
    const { data: currentUser } = await supabase
      .from('users')
      .select('checkup_count')
      .eq('id', userId)
      .single();

    await supabase
      .from('users')
      .update({ 
        checkup_count: (currentUser?.checkup_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    console.log(`✅ Check-UP avviato con successo. SessionID: ${session.id}`);

    // 10. Risposta con sessionId per redirect
    return res.status(200).json({
      success: true,
      message: 'Check-UP avviato con successo',
      sessionId: session.id,
      userId: userId
    });

  } catch (error) {
    console.error('💥 Errore nella funzione API:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
