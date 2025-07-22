import { createClient } from '@supabase/supabase-js'

// Recupera l'URL e la chiave ANON dal tuo progetto Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'IL_TUO_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'LA_TUA_SUPABASE_ANON_KEY';

// Crea e esporta il client di Supabase che userai in tutta l'applicazione
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
