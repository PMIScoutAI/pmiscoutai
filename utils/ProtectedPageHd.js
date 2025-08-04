// /utils/ProtectedPageHd.js
// VERSIONE FINALE: Usa un ID fittizio in formato UUID valido.

import { useState, useEffect } from 'react';

function useHdUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [outsetaToken, setOutsetaToken] = useState('dummy-token-for-beta');

  useEffect(() => {
    // Simula un utente fittizio per far funzionare le pagine
    setUser({
      // ✅ FIX: Usiamo un UUID valido per l'ID fittizio
      id: '11111111-1111-1111-1111-111111111111',
      uid: 'user-fittizio-outseta-id',
      email: 'beta-tester@pmiscout.eu',
      name: 'Beta Tester',
    });
    setLoading(false);
  }, []);

  return { user, outsetaToken, loading, error };
}

export function ProtectedPageHd({ children, loadingComponent }) {
  const { user, outsetaToken, loading, error } = useHdUser();

  if (loading) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-slate-600">Caricamento ambiente beta...</p>
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

  return typeof children === 'function' ? children(user, outsetaToken) : children;
}
