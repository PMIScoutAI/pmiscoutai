import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  const { method } = req;

  try {
    // POST - Inserimento nuovo contratto
    if (method === 'POST') {
      const { user_email, contract_data } = req.body;

      // 1. Trova utente
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user_email)
        .single();

      if (userError || !userData) {
        return res.status(404).json({ message: 'Utente non trovato' });
      }

      // 2. Salva contratto
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .insert({
          user_id: userData.id,
          bank_name: contract_data.bank_name,
          amount: contract_data.amount,
          rate_tan: contract_data.rate_tan,
          rate_taeg: contract_data.rate_taeg,
          duration_months: contract_data.duration_months,
          loan_type: contract_data.loan_type,
          monthly_payment: contract_data.monthly_payment,
          start_date: contract_data.start_date || null,
          guarantees: contract_data.guarantees
        })
        .select()
        .single();

      if (contractError) {
        console.error('Errore salvataggio contratto:', contractError);
        return res.status(500).json({ message: 'Errore salvataggio contratto' });
      }

      return res.status(200).json({
        contract: contractData,
        message: 'Contratto salvato con successo'
      });
    }

    // PUT - Aggiornamento contratto esistente
    if (method === 'PUT') {
      const { contract_id, contract_data } = req.body;

      if (!contract_id) {
        return res.status(400).json({ message: 'Contract ID è richiesto' });
      }

      // Aggiorna il contratto
      const { data: updatedContract, error: updateError } = await supabase
        .from('contracts')
        .update({
          bank_name: contract_data.bank_name,
          amount: contract_data.amount,
          rate_tan: contract_data.rate_tan,
          rate_taeg: contract_data.rate_taeg,
          duration_months: contract_data.duration_months,
          loan_type: contract_data.loan_type,
          monthly_payment: contract_data.monthly_payment,
          start_date: contract_data.start_date || null,
          guarantees: contract_data.guarantees,
          updated_at: new Date().toISOString()
        })
        .eq('id', contract_id)
        .select()
        .single();

      if (updateError) {
        console.error('Errore aggiornamento contratto:', updateError);
        return res.status(500).json({ message: 'Errore aggiornamento contratto' });
      }

      return res.status(200).json({
        contract: updatedContract,
        message: 'Contratto aggiornato con successo'
      });
    }

    // DELETE - Cancellazione contratto
    if (method === 'DELETE') {
      const { contract_id } = req.body;

      if (!contract_id) {
        return res.status(400).json({ message: 'Contract ID è richiesto' });
      }

      // Elimina il contratto
      const { error: deleteError } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contract_id);

      if (deleteError) {
        console.error('Errore eliminazione contratto:', deleteError);
        return res.status(500).json({ message: 'Errore eliminazione contratto' });
      }

      return res.status(200).json({
        message: 'Contratto eliminato con successo'
      });
    }

    // Metodo non supportato
    return res.status(405).json({ message: 'Method Not Allowed' });

  } catch (error) {
    console.error('Errore API save-contract:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
