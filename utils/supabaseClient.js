import { createClient } from '@supabase/supabase-js'

// --- Metodo Sicuro con Variabili d'Ambiente ---
// Questo codice leggerà le chiavi in modo sicuro dalle impostazioni del tuo hosting (Vercel).
// NON devi scrivere le chiavi qui.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Crea e esporta il client di Supabase che userai in tutta l'applicazione
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- NUOVA FUNZIONE PER SINCRONIZZARE L'AUTENTICAZIONE ---
/**
 * Sincronizza la sessione di Outseta con Supabase Auth.
 * Questa funzione deve essere chiamata dopo che l'utente ha effettuato il login con Outseta.
 * Prende il token di accesso da Outseta e lo usa per creare una sessione in Supabase.
 * @returns {Promise<boolean>} - Restituisce true se la sincronizzazione ha successo, altrimenti false.
 */
export const syncSupabaseAuth = async () => {
  try {
    // Verifica che Outseta sia disponibile
    if (typeof window.Outseta?.getAccessToken !== 'function') {
      throw new Error('Outseta non è disponibile o non è ancora stato caricato.');
    }
    
    // Recupera il token di accesso da Outseta
    const token = await window.Outseta.getAccessToken();
    if (!token) {
      throw new Error('Token di accesso di Outseta non trovato.');
    }

    // Usa il token per creare una sessione in Supabase
    // NOTA: Questo richiede che tu abbia configurato Supabase per accettare i JWT di Outseta.
    // Vai su Supabase -> Authentication -> Providers -> JWT e inserisci il tuo JWKS URL e Issuer di Outseta.
    const { error } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: token, // Per semplicità usiamo lo stesso token, potrebbe scadere.
    });

    if (error) {
      throw error;
    }

    console.log('Sessione Supabase sincronizzata con successo con il token di Outseta.');
    return true;

  } catch (error) {
    console.error('Errore durante la sincronizzazione della sessione Supabase:', error.message);
    return false;
  }
};
