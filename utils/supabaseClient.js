import { createClient } from '@supabase/supabase-js'

// --- Metodo Sicuro con Variabili d'Ambiente ---
// Questo codice leggerà le chiavi in modo sicuro dalle impostazioni del tuo hosting (Vercel).
// NON devi scrivere le chiavi qui.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Crea e esporta il client di Supabase che userai in tutta l'applicazione
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
