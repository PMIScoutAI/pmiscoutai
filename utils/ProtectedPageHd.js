// /utils/ProtectedPageHd.js
// VERSIONE FINALE E STABILE: Risolve il blocco in "verifica autorizzazione"
// usando un'attesa più robusta per lo script di Outseta.

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const OUTSETA_LOGIN_URL = process.env.NEXT_PUBLIC_OUTSETA_LOGIN_URL || 'https://pmiscout.outseta.com/auth?widgetMode=login';

/**
 * Hook React specializzato per il flusso HD.
 */
function useHdUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [outsetaToken, setOutsetaToken] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function initUser() {
      try {
        // ✅ FIX: Torniamo a un'attesa più simile a quella originale e funzionante.
        // Aspettiamo che la funzione `getUser` sia disponibile, non `getAuthToken`.
        let attempts = 0;
        while (typeof window.Outseta?.getUser !== 'function' && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (typeof window.Outseta?.getUser !== 'function') {
          throw new Error('Outseta non è stato caricato correttamente. Ricarica la pagina.');
        }

        // Ora che sappiamo che Outseta è pronto, procediamo.
        const outsetaUser = await window.Outseta.getUser();
        if (!outsetaUser?.Email) {
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.replace(`${OUTSETA_LOGIN_URL}&returnUrl=${returnUrl}`);
          return;
        }

        // E ORA possiamo chiamare getAuthToken con sicurezza
        const token = window.Outseta.getAuthToken();
        if (!token) {
            throw new Error("Impossibile recuperare il token di autenticazione da Outseta.");
        }
        if (isMounted) setOutsetaToken(token);

        // Chiama la Edge Function per ottenere il JWT di Supabase
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-supabase-jwt`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        if (data.error) throw new Error(`Errore dalla Edge Function: ${data.error}`);

        // Usa il JWT per fare il login in Supabase
        const { error: signInError } = await supabase.auth.signInWithJwt(data.custom_jwt);
        if (signInError) throw signInError;

        // Recupera la sessione utente
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          setUser({
            ...session.user,
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
            uid: outsetaUser.Uid,
          });
        } else if (isMounted) {
          throw new Error("Impossibile recuperare la sessione utente.");
        }

      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    initUser();
    return () => { isMounted = false; };
  }, []);

  return { user, outsetaToken, loading, error };
}

/**
 * Componente wrapper per proteggere le pagine HD.
 */
export function ProtectedPageHd({ children, loadingComponent }) {
  const { user, outsetaToken, loading, error } = useHdUser();

  if (loading) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-slate-600">Verifica autenticazione HD...</p>
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
