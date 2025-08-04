// /utils/ProtectedPage.js
// VERSIONE FINALE E STABILE: Risolve il blocco in "verifica autorizzazione".

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const OUTSETA_LOGIN_URL = process.env.NEXT_PUBLIC_OUTSETA_LOGIN_URL || 'https://pmiscout.outseta.com/auth?widgetMode=login';

/**
 * Hook React per la gestione dell'utente autenticato.
 * Usa la Edge Function per un login sicuro e un'attesa robusta per Outseta.
 */
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [outsetaToken, setOutsetaToken] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function initUser() {
      try {
        // ✅ FIX: Ciclo di attesa più robusto per Outseta, con un timeout di sicurezza.
        let attempts = 0;
        while (typeof window.Outseta?.getAuthToken !== 'function' && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (typeof window.Outseta?.getAuthToken !== 'function') {
          throw new Error('Outseta non è stato caricato correttamente. Ricarica la pagina.');
        }

        // Da qui in poi, la logica è la stessa, ma ora siamo sicuri che Outseta è pronto.
        const token = window.Outseta.getAuthToken();
        if (!token) {
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.replace(`${OUTSETA_LOGIN_URL}&returnUrl=${returnUrl}`);
          return;
        }
        if (isMounted) setOutsetaToken(token);

        // Chiama la Edge Function per scambiare il token Outseta con un JWT Supabase
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-supabase-jwt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        if (data.error) throw new Error(`Errore dalla Edge Function: ${data.error}`);

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
    
    initUser();

    return () => {
      isMounted = false;
    };
  }, []);

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
