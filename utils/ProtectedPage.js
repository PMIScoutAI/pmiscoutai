// /utils/ProtectedPage.js
// Versione definitiva che usa la logica di polling (che funziona)
// e integra i miglioramenti di robustezza e best practice.

import { useState, useEffect } from 'react';

// Recupera l'URL di login di Outseta dalle variabili d'ambiente per flessibilità.
const OUTSETA_LOGIN_URL = process.env.NEXT_PUBLIC_OUTSETA_LOGIN_URL || 'https://pmiscout.outseta.com/auth?widgetMode=login';

/**
 * Hook React per la gestione dell'utente autenticato con Outseta.
 * Si limita a verificare la sessione Outseta sul client.
 */
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function initUser() {
      try {
        // Usiamo il sistema di polling che hai confermato essere affidabile.
        let attempts = 0;
        while (!window.Outseta && attempts < 50) { // Timeout di 5 secondi
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!window.Outseta) {
          throw new Error('Outseta non è stato caricato in tempo.');
        }

        const outsetaUser = await window.Outseta.getUser();
        if (!outsetaUser?.Email) {
          // Se non c'è utente, reindirizza usando 'replace' per una migliore UX.
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.replace(`${OUTSETA_LOGIN_URL}&returnUrl=${returnUrl}`);
          return;
        }

        // Il nostro "utente" è semplicemente l'utente restituito da Outseta.
        // La sincronizzazione avverrà sul server quando necessario.
        if (isMounted) {
          setUser({
            uid: outsetaUser.Uid, // ID univoco di Outseta
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

  return { user, loading, error };
}

/**
 * Componente wrapper per proteggere le pagine.
 * Usa l'hook useUser per verificare l'autenticazione prima di renderizzare i children.
 */
export function ProtectedPage({ children, loadingComponent }) {
  const { user, loading, error } = useUser();

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

  if (!user) return null; // Il redirect viene gestito da useUser

  // Passa l'utente come prop ai children se è una funzione (render prop pattern)
  return typeof children === 'function' ? children(user) : children;
}
