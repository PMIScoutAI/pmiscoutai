// /utils/ProtectedPageHd.js
// VERSIONE ULTRA-SEMPLIFICATA: Rimuove completamente il controllo di Outseta per sbloccare lo sviluppo.

import { useState, useEffect } from 'react';

/**
 * Hook React che simula un utente sempre loggato.
 */
function useHdUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Il token non ci serve più in questa versione semplificata, ma lo passiamo per coerenza
  const [outsetaToken, setOutsetaToken] = useState('dummy-token');

  useEffect(() => {
    // Simula un utente fittizio per far funzionare le pagine
    setUser({
      id: 'user-fittizio-supabase-id',
      uid: 'user-fittizio-outseta-id',
      email: 'test@pmiscout.eu',
      name: 'Utente Test',
    });
    setLoading(false);
  }, []);

  return { user, outsetaToken, loading, error };
}

/**
 * Componente wrapper che ora lascia passare sempre.
 */
export function ProtectedPageHd({ children, loadingComponent }) {
  const { user, outsetaToken, loading, error } = useHdUser();

  if (loading) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-slate-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-bold">Errore: {error}</p>
        </div>
      </div>
    );
  }

  // L'utente c'è sempre, quindi mostra sempre i figli
  return typeof children === 'function' ? children(user, outsetaToken) : children;
}
