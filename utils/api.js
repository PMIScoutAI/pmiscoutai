// utils/api.js - Utility aggiornata per la nuova architettura
import { useState, useEffect } from 'react';

// Non servono più le variabili Supabase!
// Tutto passa attraverso le nostre API su Vercel

// Hook per gestione utente con Outseta
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function initUser() {
      try {
        // Attendi che Outseta sia caricato
        let attempts = 0;
        while (!window.Outseta && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.Outseta) {
          throw new Error('Outseta non caricato');
        }

        // Ottieni utente da Outseta
        const outsetaUser = await window.Outseta.getUser();
        
        if (!outsetaUser || !outsetaUser.Email) {
          // Non loggato - redirect al login
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
          return;
        }

        // Ottieni anche il token per le API
        const token = await window.Outseta.getAccessToken();

        if (mounted) {
          setUser({
            email: outsetaUser.Email,
            name: outsetaUser.FirstName || outsetaUser.Email.split('@')[0],
            outseta: outsetaUser,
            token: token // Importante per autenticare le chiamate API
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

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading, error };
}

// Componente wrapper per proteggere le pagine
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
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Ricarica
          </button>
        </div>
      </div>
    );
  }

  // Se non c'è utente, verrà fatto redirect automaticamente
  if (!user) return null;

  // Passa l'utente come prop ai children
  return typeof children === 'function' ? children(user) : children;
}

// API client per le nostre funzioni
export const api = {
  // Avvia un nuovo checkup
  startCheckup: async (formData, file, outsetaToken) => {
    // Crea FormData per inviare tutto insieme
    const data = new FormData();
    data.append('formData', JSON.stringify(formData));
    data.append('file', file);
    data.append('outsetaToken', outsetaToken);

    try {
      const response = await fetch('/api/start-checkup', {
        method: 'POST',
        body: data
        // NON impostare Content-Type - il browser lo fa automaticamente per FormData
      });

      const result = await response.json();

      if (!response.ok) {
        // Gestione speciale per limite raggiunto
        if (response.status === 429) {
          throw new Error('LIMIT_REACHED');
        }
        throw new Error(result.error || 'Errore nella richiesta');
      }

      return result;
    } catch (error) {
      console.error('Errore startCheckup:', error);
      throw error;
    }
  },

  // Recupera lo stato di una sessione (per la pagina analisi)
  getSessionStatus: async (sessionId) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nel recupero sessione');
      }

      return response.json();
    } catch (error) {
      console.error('Errore getSessionStatus:', error);
      throw error;
    }
  }
};

// Componente per mostrare il limite raggiunto
export function LimitReachedModal({ sessionsUsed, limit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Limite di Analisi Raggiunto
          </h3>
          <p className="text-gray-600 mb-4">
            Hai utilizzato tutte le <span className="font-bold">{limit}</span> analisi gratuite disponibili.
          </p>
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              Analisi utilizzate: <span className="font-bold">{sessionsUsed}/{limit}</span>
            </p>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Per continuare ad utilizzare PMIScout, contattaci per passare a un piano premium.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Chiudi
          </button>
          <a
            href="mailto:support@pmiscout.com?subject=Richiesta%20Piano%20Premium"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            Contatta Supporto
          </a>
        </div>
      </div>
    </div>
  );
}
