import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Sincronizza e VERIFICA la sessione di Outseta con Supabase Auth.
 * @returns {Promise<boolean>} - Restituisce true se la sincronizzazione e la verifica hanno successo.
 */
export const syncSupabaseAuth = async () => {
  try {
    if (typeof window.Outseta?.getAccessToken !== 'function') {
      throw new Error('Outseta non è disponibile.');
    }
    
    const token = await window.Outseta.getAccessToken();
    if (!token) {
      throw new Error('Token di accesso di Outseta non trovato.');
    }

    // 1. Imposta la sessione con il token di Outseta
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: token, // Usiamo lo stesso token, potrebbe scadere prima.
    });
    if (sessionError) throw sessionError;

    // 2. **VERIFICA IMMEDIATA**: Prova a recuperare l'utente con la nuova sessione.
    // Questo passaggio fallirà se il JWT Provider non è configurato correttamente in Supabase,
    // dandoci un errore chiaro e immediato.
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("La sessione impostata con il token di Outseta non è valida. L'utente Supabase è nullo.");

    console.log('Sessione Supabase sincronizzata e verificata con successo.');
    return true;

  } catch (error) {
    console.error('Errore durante la sincronizzazione della sessione Supabase:', error.message);
    // Aggiungiamo un log più specifico per il debug nella console del browser
    if (error.message.includes('JWT') || error.message.includes('token')) {
        console.error("--- HINT PER LO SVILUPPATORE ---");
        console.error("Questo errore è tipico di una mancata configurazione del JWT Provider in Supabase.");
        console.error("Assicurati di aver aggiunto Outseta come provider di autenticazione JWT nelle impostazioni di Supabase.");
        console.error("--- FINE HINT ---");
    }
    return false;
  }
};
