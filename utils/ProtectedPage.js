// /utils/ProtectedPage.js
// VERSIONE FINALE E CORRETTA: Usa l'evento 'outseta.ready' per un'autenticazione a prova di errore.

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const OUTSETA_LOGIN_URL = process.env.NEXT_PUBLIC_OUTSETA_LOGIN_URL || 'https://pmiscout.outseta.com/auth?widgetMode=login';

/**
 * Hook React per la gestione dell'utente autenticato.
 * ORA USA LA EDGE FUNCTION PER UN LOGIN SICURO.
 */
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [outsetaToken, setOutsetaToken] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // Definiamo la nostra logica di autenticazione in una funzione separata.
    const handleAuth = async () => {
      if (!isMounted) return;

      try {
        // Ora che l'evento 'outseta.ready' è scattato, possiamo usare le sue funzioni con sicurezza.
        const token = window.Outseta.getAuthToken();
        if (!token) {
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.replace(`${OUTSETA_LOGIN_URL}&returnUrl=${returnUrl}`);
          return;
        }
        if (isMounted) setOutsetaToken(token);

        // Chiama la Edge Function per scambiare il token Outseta con un JWT Supabase
        console.log('🔄 Chiamata alla Edge Function per il token Supabase...');
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-supabase-jwt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        if (data.error) throw new Error(`Errore dalla Edge Function: ${data.error}`);
        console.log('✅ Token Supabase ricevuto.');

        // Usa il JWT per fare il login sicuro in Supabase
        const { error: signInError } = await supabase.auth.signInWithJwt(data.custom_jwt);
        if (signInError) throw signInError;

        // Recupera la sessione utente completa da Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          const outsetaUser = await window.Outseta.getUser();
          setUser({
            ...session.user,
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
            uid: outsetaUser.Uid,
          });
          console.log('✅ Utente autenticato con Supabase:', session.user.id);
        } else if (isMounted) {
          throw new Error("Impossibile recuperare la sessione utente dopo il login.");
        }

      } catch (err) {
        console.error('Errore durante l\'inizializzazione dell\'utente:', err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    // ✅ FIX: Invece di un ciclo di attesa, ci mettiamo in ascolto dell'evento 'outseta.ready'.
    // Questo è il modo corretto e robusto per interagire con lo script di Outseta.
    // La funzione 'handleAuth' verrà eseguita solo quando Outseta sarà completamente caricato.
    window.addEventListener('outseta.ready', handleAuth);

    // Funzione di pulizia per rimuovere l'event listener quando il componente viene smontato
    return () => {
      isMounted = false;
      window.removeEventListener('outseta.ready', handleAuth);
    };
  }, []);

  // Restituisce l'utente e il token Outseta originale
  return { user, outsetaToken, loading, error };
}

/**
 * Componente wrapper per proteggere le pagine.
 * Questa parte non necessita di modifiche.
 */
export function ProtectedPage({ children, loadingComponent }) {
  const { user, outsetaToken, loading, error } = useUser();

  if (loading) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">Verifica autenticazione...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-bold">Errore di autenticazione: {error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Ricarica
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return typeof children === 'function' ? children(user, outsetaToken) : children;
}
