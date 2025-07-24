// /utils/api.js
// Versione aggiornata che usa il client Supabase e FormData per l'upload.

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Importa il client Supabase

const API_FUNCTION_NAME = 'api-router';

// --- Funzioni API specifiche ---

/**
 * Sincronizza l'utente di Outseta con il database Supabase.
 * @param {object} outsetaUser - L'oggetto utente recuperato da Outseta.
 * @returns {Promise<object>}
 */
async function syncUser(outsetaUser) {
  try {
    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: JSON.stringify({
        action: 'sync-user',
        outsetaUser,
      }),
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`Errore API [sync-user]:`, err);
    throw new Error('Impossibile sincronizzare il profilo utente.');
  }
}

/**
 * Avvia il processo di checkup inviando i dati del form e il file tramite FormData.
 * @param {string} userId - L'ID dell'utente dal nostro database.
 * @param {object} formData - I dati del form dell'azienda.
 * @param {File} file - Il file PDF del bilancio.
 * @returns {Promise<object>}
 */
async function processCheckup(userId, formData, file) {
  try {
    // 1. Prepara il corpo della richiesta usando FormData.
    // Questo è il modo corretto e più efficiente per caricare file.
    const submissionData = new FormData();
    submissionData.append('action', 'process-checkup');
    submissionData.append('userId', userId);
    submissionData.append('formData', JSON.stringify(formData));
    submissionData.append('file', file);

    // 2. Chiama la Edge Function. Il client Supabase imposterà
    // automaticamente l'header 'Content-Type' corretto per FormData.
    const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
      body: submissionData,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`Errore API [process-checkup]:`, err);
    throw new Error("Si è verificato un errore durante l'avvio dell'analisi.");
  }
}

/**
 * Recupera i risultati di un'analisi completata.
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
async function getAnalysis(sessionId) {
    // Questa funzione può rimanere come l'avevi scritta, ma per coerenza
    // la adattiamo per usare il client Supabase.
    try {
        const { data, error } = await supabase.functions.invoke(API_FUNCTION_NAME, {
            body: JSON.stringify({
                action: 'get-analysis',
                sessionId,
            })
        });
        if (error) throw error;
        return data;
    } catch (err) {
        console.error(`Errore API [get-analysis]:`, err);
        throw new Error("Impossibile recuperare i risultati dell'analisi.");
    }
}


// Esporta l'oggetto api per un uso pulito in tutta l'app
export const api = {
  syncUser,
  processCheckup,
  getAnalysis,
};


// --- Hook e Componenti React (Questi rimangono identici, erano già perfetti) ---

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

  if (!user) return null;

  return typeof children === 'function' ? children(user) : children;
}
