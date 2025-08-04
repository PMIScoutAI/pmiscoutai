// /utils/ProtectedPage.js
// VERSIONE POTENZIATA: Usa la Edge Function per un'autenticazione sicura e robusta,
// mantenendo la struttura esistente per la massima compatibilità.

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
  const [outsetaToken, setOutsetaToken] = useState(null); // Lo manteniamo per passarlo alle API se necessario

  useEffect(() => {
    let isMounted = true;

    async function initUser() {
      try {
        // 1. Aspetta che Outseta sia caricato
        let attempts = 0;
        while (!window.Outseta && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!window.Outseta) throw new Error('Outseta non è stato caricato in tempo.');

        // 2. Ottieni il token di login da Outseta
        const token = window.Outseta.getAuthToken();
        if (!token) {
          // Se non c'è token, l'utente non è loggato. Reindirizza.
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.replace(`${OUTSETA_LOGIN_URL}&returnUrl=${returnUrl}`);
          return;
        }
        if (isMounted) setOutsetaToken(token);

        // 3. ✅ NUOVA LOGICA: Chiama la Edge Function per scambiare il token Outseta con un JWT Supabase
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

        // 4. ✅ NUOVA LOGICA: Usa il JWT per fare il login sicuro in Supabase
        const { error: signInError } = await supabase.auth.signInWithJwt(data.custom_jwt);
        if (signInError) throw signInError;

        // 5. Recupera la sessione utente completa da Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          // L'oggetto 'user' di Supabase contiene già 'id' e 'email'.
          // Per coerenza con il tuo codice precedente, aggiungiamo 'name' e 'uid'.
          const outsetaUser = await window.Outseta.getUser(); // Lo richiamiamo per avere i dati completi
          setUser({
            ...session.user, // Mantiene tutti i dati di Supabase (id, email, etc.)
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
            uid: outsetaUser.Uid, // ID Outseta
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
    }

    initUser();
    return () => { isMounted = false; };
  }, []);

  // Restituisce l'utente e il token Outseta originale
  return { user, outsetaToken, loading, error };
}

/**
 * Componente wrapper per proteggere le pagine.
 * Questa parte è rimasta quasi identica per non rompere nulla.
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

  if (!user) return null; // L'utente non è autenticato, verrà reindirizzato dal hook

  // Passa sia l'utente (ora potenziato) che il token Outseta ai componenti figli
  return typeof children === 'function' ? children(user, outsetaToken) : children;
}
