// /utils/supabaseClient.js
// Questo file inizializza il client Supabase e lo esporta per essere usato in tutta l'app.

import { createClient } from '@supabase/supabase-js';

// Recupera le variabili d'ambiente per la connessione a Supabase.
// Assicurati che siano definite nel tuo file .env.local e nelle impostazioni di Vercel.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Controlla che le variabili d'ambiente siano state caricate correttamente.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Le variabili d\'ambiente Supabase non sono state definite. Assicurati di aver creato un file .env.local e di averle impostate su Vercel.');
}

// Crea e esporta un'unica istanza del client Supabase.
// Usare un'unica istanza previene problemi di connessione e ottimizza le performance.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
