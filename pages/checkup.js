// /pages/checkup.js
// Versione semplificata che usa la nuova architettura BFF.

import { useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';
// Assicurati di importare le tue icone e altri componenti se necessario

export default function CheckupPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI - PMIScout</title>
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
        {(user) => <CheckupPage user={user} />}
      </ProtectedPage>
    </>
  );
}

function CheckupPage({ user }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ company_name: '', industry_sector: '' });
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Per favore, seleziona un file PDF.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Chiama la singola funzione che orchestra tutto
      const sessionId = await api.startCheckupProcess(formData, file);
      // Se ha successo, reindirizza alla pagina di analisi
      router.push(`/analisi/${sessionId}`);
    } catch (err) {
      console.error('Checkup failed:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main className="flex justify-center items-center min-h-screen bg-slate-100">
      <div className="w-full max-w-2xl p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Inizia il tuo Check-UP AI</h1>
          <p className="text-slate-600">Compila i dati e carica il tuo bilancio in formato PDF.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-slate-700">Nome Azienda</label>
            <input
              type="text"
              id="company_name"
              required
              className="w-full p-3 mt-1 border rounded-lg"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="industry_sector" className="block text-sm font-medium text-slate-700">Settore</label>
            <input
              type="text"
              id="industry_sector"
              required
              className="w-full p-3 mt-1 border rounded-lg"
              value={formData.industry_sector}
              onChange={(e) => setFormData({ ...formData, industry_sector: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700">Bilancio (PDF, max 5MB)</label>
            <input
              type="file"
              id="file-upload"
              required
              accept=".pdf"
              className="w-full p-3 mt-1 text-sm border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
          >
            {loading ? 'Elaborazione in corso...' : 'Avvia Analisi'}
          </button>
        </form>
      </div>
    </main>
  );
}
