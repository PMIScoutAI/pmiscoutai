// /utils/ProtectedPage.js
// Versione che implementa i suggerimenti della code review:
// - Usa l'event listener di Outseta invece del polling.
// - Usa variabili d'ambiente per gli URL.
// - Usa window.location.replace() per i redirect.

import { useState, useEffect } from 'react';
import { api } from './api';

// Recupera l'URL di login di Outseta dalle variabili d'ambiente per flessibilità.
const OUTSETA_LOGIN_URL = process.env.NEXT_PUBLIC_OUTSETA_LOGIN_URL || 'https://pmiscout.outseta.com/auth?widgetMode=login';

/**
 * Hook React per la gestione dell'utente autenticato con Outseta.
 */
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const handleUser = async (outsetaUser) => {
      try {
        if (!outsetaUser?.Email) {
          // Se l'utente non è loggato, reindirizza usando replace.
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.replace(`${OUTSETA_LOGIN_URL}&returnUrl=${returnUrl}`);
          return;
        }

        // Sincronizza l'utente con il nostro backend solo se necessario.
        // Questa chiamata è ora sicura grazie alla nostra architettura BFF.
        const result = await api.syncUser(outsetaUser);
        
        if (isMounted) {
          setUser({
            uid: outsetaUser.Uid,
            id: result.userId, // ID dal nostro DB
            email: outsetaUser.Email,
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
          });
        }
      } catch (err) {
        console.error('Errore durante la sincronizzazione dell\'utente:', err);
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    // Controlla se Outseta è già carico, altrimenti attende l'evento 'user'
    if (window.Outseta?.getUser) {
        window.Outseta.getUser().then(handleUser);
    } else {
        // Usa l'event listener ufficiale di Outseta.
        // Questo è più efficiente e affidabile del polling.
        window.Outseta.on('user', handleUser);
    }

    return () => {
      isMounted = false;
      // Potenziale cleanup dell'event listener se necessario,
      // ma Outseta gestisce bene questo aspetto.
    };
  }, []); // L'array vuoto assicura che questo effetto venga eseguito solo una volta

  return { user, loading, error };
}

/**
 * Componente wrapper per proteggere le pagine.
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

  if (!user) return null;

  return typeof children === 'function' ? children(user) : children;
}
