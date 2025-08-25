// /pages/check-ai-xbrl.js
// VERSIONE 2.0 (Fix Deploy SSR)
// - FIX: Implementata la soluzione con `next/dynamic` per disabilitare il Server-Side Rendering (SSR)
//   per questo componente, risolvendo l'errore di prerendering durante il deploy.
// - AGGIUNTO: Componente di caricamento per migliorare l'esperienza utente mentre la pagina viene caricata dinamicamente.

import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';

// 🎯 SOLUZIONE: Dynamic import per evitare problemi di SSR
const CheckupXbrlPageComponent = dynamic(
  () => Promise.resolve(CheckupXbrlPage),
  { 
    ssr: false, // Disabilita il server-side rendering per questo componente
    loading: () => (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Caricamento...</p>
        </div>
      </div>
    )
  }
);

export default function CheckupXbrlPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-AI XBRL - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
      </Head>

      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script
        id="outseta-script"
        src="https://cdn.outseta.com/outseta.min.js"
        strategy="beforeInteractive"
      ></Script>
      
      <ProtectedPage>
        <CheckupXbrlPageComponent />
      </ProtectedPage>
    </>
  );
}

// Icone e resto del codice rimane identico...
const icons = {
    upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    file: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z",
    lock: "M2 8V4.222a2 2 0 0 1 1.333-1.884l8-3.111a2 2 0 0 1 1.334 0l8 3.11a2 2 0 0 1 1.333 1.885V8M2 8v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8M2 8h20"
};

const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
    </svg>
);

function CheckupXbrlPage() {
  const [file, setFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const router = useRouter();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Per favore, seleziona un file da analizzare.');
      return;
    }
    if (!companyName.trim()) {
      setError('Per favore, inserisci il nome dell\'azienda.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyName', companyName);

      const response = await api.post('/start-checkup', formData);

      if (response.data.success) {
        router.push(`/analisi/${response.data.sessionId}`);
      } else {
        throw new Error(response.data.error || 'Si è verificato un errore.');
      }
    } catch (err) {
      console.error('Errore durante l\'upload:', err);
      setError(err.response?.data?.error || err.message || 'Impossibile avviare l\'analisi. Riprova.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white shadow-sm">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <a className="text-2xl font-bold text-blue-600">PMIScout</a>
          </Link>
          <Link href="/account">
            <a className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Il Mio Account</a>
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-lg">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Check-AI XBRL</h1>
            <p className="mt-3 text-slate-600">
              Carica il bilancio in formato XBRL per un'analisi finanziaria istantanea e approfondita.
            </p>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">
                Nome Azienda
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Es: Rossi S.R.L."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                File Bilancio XBRL
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:border-blue-500 bg-slate-50 transition-colors"
              >
                <div className="space-y-1 text-center">
                  <Icon path={icons.upload} className="mx-auto h-12 w-12 text-slate-400" />
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-blue-600">Clicca per caricare</span> o trascina qui
                  </p>
                  <p className="text-xs text-slate-500">Formati accettati: .xls, .xbrl, .zip</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                accept=".xbrl,.xls,.zip,application/vnd.ms-excel,application/zip"
              />
              <div className="mt-2 text-xs text-slate-500">
                💡 <strong>Cos'è il file XBRL?</strong> È il formato standard per i bilanci digitali scaricabile dal registro delle imprese.
              </div>
            </div>

            {file && (
              <div className="flex items-center justify-between px-4 py-2 text-sm text-green-800 bg-green-100 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <Icon path={icons.file} className="w-5 h-5 mr-3 text-green-600" />
                  <span className="font-medium">{file.name}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-green-900 hover:text-green-700 font-bold"
                  aria-label="Rimuovi file"
                >×</button>
              </div>
            )}

            <div className="flex items-center text-xs text-slate-500">
              <Icon path={icons.lock} className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>I tuoi dati sono crittografati e usati solo per questa analisi.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analisi in corso...
                </>
              ) : (
                'Avvia Analisi AI'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
