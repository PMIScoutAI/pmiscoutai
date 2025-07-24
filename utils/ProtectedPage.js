// /utils/ProtectedPage.js
// Questo file non contiene errori ma viene aggiornato per coerenza.

import { useState, useEffect } from 'react';
import { api } from './api';

/**
 * Hook React per la gestione dell'utente autenticato.
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
        while (!window.Outseta && attempts < 50) { // Aumentato leggermente il timeout
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!window.Outseta) {
          throw new Error('Outseta non caricato in tempo.');
        }

        const outsetaUser = await window.Outseta.getUser();
        if (!outsetaUser?.Email) {
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
          return;
        }

        // Questa chiamata ora dovrebbe funzionare grazie alla correzione in api.js
        const result = await api.syncUser(outsetaUser);
        
        if (mounted) {
          setUser({
            id: result.userId,
            email: outsetaUser.Email,
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
            outseta: outsetaUser
          });
        }
      } catch (err) {
        console.error('Errore inizializzazione utente:', err);
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
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
 */
export function ProtectedPage({ children, loadingComponent }) {
  const { user, loading, error } = useUser();

  if (loading) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p>Caricamento utente...</p>
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
