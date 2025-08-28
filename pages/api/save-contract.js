import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  try {
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
        start_date: contract_data.start_date,
        guarantees: contract_data.guarantees
      })
      .select()
      .single();
    if (contractError) {
      console.error('Errore salvataggio contratto:', contractError);
      return res.status(500).json({ message: 'Errore salvataggio contratto' });
    }
    // 3. Calcola confronto con mercato (richiama market-rates API)
    // In produzione, fare chiamata interna o condividere logica
    res.status(200).json({
      contract: contractData,
      message: 'Contratto salvato con successo'
    });
  } catch (error) {
    console.error('Errore save-contract:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
