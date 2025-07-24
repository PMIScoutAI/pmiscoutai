// /pages/checkup.js
// Versione ultra-semplificata per testare la sincronizzazione dell'utente.

import { useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';

// --- Componente Wrapper ---
export default function CheckupPageWrapper() {
  return (
    <>
      <Head>
        <title>Verifica Account - PMIScout</title>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script
        id="outseta-script"
        src="https://cdn.outseta.com/outseta.min.js"
        strategy="beforeInteractive"
      />
      <ProtectedPage>
        {(user) => <CheckupForm user={user} />}
      </ProtectedPage>
    </>
  );
}

// --- Componente Principale del Form ---
function CheckupForm({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSyncUser = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      // Chiama la nostra API super-semplice per sincronizzare l'utente.
      const result = await api.syncUserOnly();
      setSuccessMessage(`${result.message} ID Utente: ${result.userId}`);
    } catch (err) {
      console.error('Errore durante la sincronizzazione:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex justify-center items-center min-h-screen bg-slate-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg text-center">
        <h1 className="text-2xl font-bold text-slate-900">Verifica Connessione</h1>
        <p className="text-slate-600">
          Ciao, {user.name}. Clicca il pulsante qui sotto per testare la registrazione del tuo profilo sul nostro database.
        </p>
        
        {/* Area per i messaggi di stato */}
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        {successMessage && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{successMessage}</p>}

        <button
          onClick={handleSyncUser}
          disabled={loading}
          className="w-full px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
        >
          {loading ? 'Sincronizzazione in corso...' : 'Avvia Test di Sincronizzazione'}
        </button>
      </div>
    </main>
  );
}
