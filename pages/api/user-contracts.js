// pages/api/user-contracts.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email è richiesta.' });
  }

  try {
    // 1. Trova l'ID dell'utente basandosi sull'email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.error('User not found for email:', email, userError);
      return res.status(404).json({ error: 'Utente non trovato.' });
    }
    
    const userId = userData.id;

    // 2. Recupera i contratti per l'ID utente dalla tabella 'contracts'
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching contracts:', error);
      throw error;
    }

    res.status(200).json({ contracts: data });
  } catch (error) {
    res.status(500).json({ error: 'Errore durante il recupero dei contratti.', details: error.message });
  }
}

