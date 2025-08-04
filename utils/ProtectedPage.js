// /utils/ProtectedPage.js
// RIPRISTINATO ALLA VERSIONE FUNZIONANTE FORNITA DALL'UTENTE

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const OUTSETA_LOGIN_URL = process.env.NEXT_PUBLIC_OUTSETA_LOGIN_URL || 'https://pmiscout.outseta.com/auth?widgetMode=login';

/**
 * Hook React per la gestione dell'utente autenticato con Outseta + Supabase sync.
 */
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // ✅ Manteniamo il token per passarlo alle API
  const [outsetaToken, setOutsetaToken] = useState(null);

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

        if (!window.Outseta) {
          throw new Error('Outseta non è stato caricato in tempo.');
        }

        // 2. Ottieni utente da Outseta
        const outsetaUser = await window.Outseta.getUser();
        if (!outsetaUser?.Email) {
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.replace(`${OUTSETA_LOGIN_URL}&returnUrl=${returnUrl}`);
          return;
        }
        
        // ✅ Salva il token di Outseta
        const token = window.Outseta.getAuthToken();
        if (isMounted) {
            setOutsetaToken(token);
        }

        // 3. Usa get_or_create_user per la sincronizzazione
        console.log('🔄 Sincronizzazione con Supabase...');
        const { data: supabaseUserId, error: supabaseError } = await supabase.rpc('get_or_create_user', {
          p_outseta_id: outsetaUser.Uid,
          p_email: outsetaUser.Email,
          p_first_name: outsetaUser.FirstName,
          p_last_name: outsetaUser.LastName,
        });

        if (supabaseError || !supabaseUserId) {
          console.error('Errore sincronizzazione Supabase:', supabaseError);
          throw new Error('Errore sincronizzazione utente. Riprova o contatta il supporto.');
        }

        console.log('✅ Utente sincronizzato con ID:', supabaseUserId);

        // 4. Crea oggetto user completo con entrambi gli ID
        if (isMounted) {
          setUser({
            id: supabaseUserId,           // UUID Supabase (per query DB)
            uid: outsetaUser.Uid,             // ID Outseta (per auth)
            email: outsetaUser.Email,
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
          });
        }

      } catch (err) {
        console.error('Errore durante l\'inizializzazione dell\'utente:', err);
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initUser();
    return () => { isMounted = false; };
  }, []);

  return { user, outsetaToken, loading, error };
}

/**
 * Componente wrapper per proteggere le pagine.
 */
export function ProtectedPage({ children, loadingComponent }) {
  const { user, outsetaToken, loading, error } = useUser();

  if (loading) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p>Verifica autenticazione...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-bold">Errore: {error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Ricarica
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Passa l'utente e il token Outseta ai componenti figli
  return typeof children === 'function' ? children(user, outsetaToken) : children;
}
