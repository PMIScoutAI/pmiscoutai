// /utils/ProtectedPage.js
// Contiene la logica React per la protezione delle pagine e la gestione dell'utente.

import { useState, useEffect } from 'react';
import { api } from './api'; // Importa il nostro API layer

/**
 * Hook React per la gestione dell'utente autenticato.
 * Sincronizza l'utente Outseta con il backend e fornisce i dati all'app.
 */
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function initUser() {
      try {
        let attempts = 0;
        while (!window.Outseta && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!window.Outseta) throw new Error('Outseta non caricato');

        const outsetaUser = await window.Outseta.getUser();
        if (!outsetaUser?.Email) {
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
          return;
        }

        const result = await api.syncUser(outsetaUser);
        
        if (mounted) {
          setUser({
            id: result.userId,
            email: outsetaUser.Email,
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
            outseta: outsetaUser
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Errore inizializzazione utente:', err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    initUser();
    return () => { mounted = false; };
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
          <p>Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p>Errore: {error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Ricarica
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null; // Redirect gestito da useUser

  // Passa l'utente come prop ai children se è una funzione (render prop pattern)
  return typeof children === 'function' ? children(user) : children;
}
