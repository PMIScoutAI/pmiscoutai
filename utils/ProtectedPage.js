// /utils/ProtectedPage.js
// Versione semplificata secondo l'architettura BFF.
// Ora si occupa solo di verificare l'autenticazione Outseta sul client.

import { useState, useEffect } from 'react';
// L'import di 'api' non è più necessario qui, perché la sincronizzazione
// avverrà sul backend.
// import { api } from './api'; 

/**
 * Hook React per la gestione dell'utente autenticato con Outseta.
 * Non sincronizza più l'utente, ma si limita a verificare la sessione Outseta.
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
        while (!window.Outseta && attempts < 50) { // Timeout leggermente aumentato
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!window.Outseta) {
          throw new Error('Outseta non è stato caricato in tempo.');
        }

        const outsetaUser = await window.Outseta.getUser();
        if (!outsetaUser?.Email) {
          // Se non c'è utente, reindirizza alla pagina di login
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
          return;
        }

        // MODIFICA CHIAVE:
        // Non chiamiamo più api.syncUser(). Il nostro "utente" è semplicemente
        // l'utente restituito da Outseta. La sincronizzazione avverrà sul server.
        if (mounted) {
          setUser({
            // Usiamo i dati direttamente da Outseta
            uid: outsetaUser.Uid, // ID univoco di Outseta
            email: outsetaUser.Email,
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
          });
        }
      } catch (err) {
        console.error('Errore durante l\'inizializzazione dell\'utente:', err);
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
