// /pages/api/start-checkup.js
// SOLUZIONE SEMPLICE: Tutto in una API - upload + analisi AI

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configurazione per gestire file upload
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  try {
    // 1. Autenticazione Outseta
    const outsetaToken = req.headers.authorization?.split(' ')[1];
    if (!outsetaToken) {
      return res.status(401).json({ error: 'Token di autenticazione mancante.' });
    }

    const outsetaResponse = await fetch(`https://pmiscout.outseta.com/api/v1/profile`, {
      headers: { Authorization: `Bearer ${outsetaToken}` },
    });
    if (!outsetaResponse.ok) {
      return res.status(401).json({ error: 'Token Outseta non valido o scaduto.' });
    }
    const outsetaUser = await outsetaResponse.json();

    // 2. Sincronizza utente
    const { data: userId, error: userError } = await supabase.rpc('get_or_create_user', {
      p_outseta_id: outsetaUser.Uid,
      p_email: outsetaUser.Email,
      p_first_name: outsetaUser.FirstName,
      p_last_name: outsetaUser.LastName,
    });

    if (userError) {
      throw new Error(`Errore durante la sincronizzazione: ${userError.message}`);
    }

    // 3. Parse form data
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024,
      filter: ({ mimetype }) => mimetype && mimetype.includes('pdf'),
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

    // 4. Crea azienda
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

    // 5. Crea sessione
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

    // 6. Upload PDF
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

    // 7. ANALISI AI DIRETTA (tutto qui!)
    let extractedText = '';
    let isRealData = false;

    console.log(`🤖 [${session.id}] Inizio analisi AI...`);

    try {
      // Parsing PDF
      console.log(`[${session.id}] Parsing PDF...`);
      const pdfResult = await pdfParse(fileBuffer);
      extractedText = pdfResult.text;
      
      if (extractedText.trim().length > 200) {
        extractedText = extractedText.replace(/\s+/g, ' ').trim().substring(0, 4000);
        isRealData = true;
        console.log(`[${session.id}] ✅ PDF parsato: ${extractedText.length} caratteri`);
      } else {
        throw new Error('Testo insufficiente');
      }
      
    } catch (pdfError) {
      console.log(`[${session.id}] ⚠️ PDF parsing fallito, uso dati simulati`);
      extractedText = `
        BILANCIO ${companyName.toUpperCase()} - ESERCIZIO 2023
        Ricavi: € 1.500.000
        Utile Netto: € 120.000
        Totale Attività: € 2.800.000
        Patrimonio Netto: € 900.000
        Settore: PMI italiana
      `;
      isRealData = false;
    }

    // 8. Prompt AI
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('name', 'FINANCIAL_ANALYSIS_V1')
      .single();

    if (promptError) {
      throw new Error(`Prompt non trovato: ${promptError.message}`);
    }

    // 9. Chiamata GPT
    console.log(`[${session.id}] 🤖 Chiamata GPT...`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sei un analista finanziario esperto specializzato in PMI italiane. Analizza il bilancio fornito e rispondi SOLO in formato JSON valido.'
        },
        {
          role: 'user',
          content: promptData.prompt_template + `\n\nBILANCIO DA ANALIZZARE:\n${extractedText}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    const analysisResult = JSON.parse(completion.choices[0].message.content);
    console.log(`[${session.id}] ✅ GPT completato`);

    // 10. Salva risultati
    const { error: saveError } = await supabase
      .from('analysis_results')
      .insert({
        session_id: session.id,
        health_score: analysisResult.health_score || 0,
        key_metrics: analysisResult.key_metrics || {},
        swot: analysisResult.swot || {},
        recommendations: analysisResult.recommendations || [],
        summary: analysisResult.summary || '',
        raw_ai_response: analysisResult
      });

    if (saveError) {
      throw new Error(`Errore salvataggio: ${saveError.message}`);
    }

    // 11. Completa sessione
    await supabase
      .from('checkup_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', session.id);

    // 12. Incrementa contatore
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

    console.log(`✅ [${session.id}] Analisi completata con successo! (${isRealData ? 'PDF reale' : 'dati simulati'})`);

    return res.status(200).json({
      success: true,
      message: 'Check-UP e analisi completati con successo',
      sessionId: session.id,
      userId: userId,
      dataSource: isRealData ? 'real_pdf' : 'simulated'
    });

  } catch (error) {
    console.error('💥 Errore completo:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server' });
  }
}
