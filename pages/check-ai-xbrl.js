// /pages/check-ai-xbrl.js
// VERSIONE FINALE CON FIX
// - Aggiunto campo per inserire il nome dell'azienda.
// - Aggiornato il form per accettare anche file .xls.
// - Reso il saluto all'utente generico e non personalizzato.
// - Corretto il salvataggio del nome azienda nella colonna 'session_name' come da schema DB.

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// --- Inizializzazione del Client Supabase (lato client) ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- Componente Wrapper (Punto di ingresso della pagina) ---
export default function CheckAiXbrlPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">{`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}</Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      
      {/* Sostituisci questo con il tuo vero componente 'ProtectedPage' da Outseta */}
      <ProtectedPage>
        {(user) => <CheckAiXbrlPageLayout user={user} />}
      </ProtectedPage>
    </>
  );
}

// --- Placeholder per ProtectedPage ---
// Questo componente simula la protezione della pagina e fornisce un oggetto utente.
const ProtectedPage = ({ children }) => {
    const [user, setUser] = useState(null);
    useEffect(() => {
        // In un'app reale, qui contatteresti Outseta per ottenere i dati dell'utente.
        // Per ora, creiamo un utente generico per far funzionare la UI.
        setUser({ id: 'user-placeholder-id', name: 'Utente', email: 'utente@pmiscout.eu' });
    }, []);

    if (!user) {
        return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
    }
    return children(user);
};


// --- Componenti UI (Icone) ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  uploadCloud: <><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /><path d="M12 15v-6" /><path d="M9 12l3-3 3 3" /></>,
  file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
};

// --- Layout della Pagina con Dashboard ---
function CheckAiXbrlPageLayout({ user }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/check-ai-xbrl', text: 'Check-UP AI', icon: icons.checkup, active: true },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
  ];
  return (
    <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
      <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 border-b">
            <img src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" alt="Logo PMIScout" className="h-8 w-auto" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x40/007BFF/FFFFFF?text=PMIScout'; }}/>
          </div>
          <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.text} href={link.href}><a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ link.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}><Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />{link.text}</a></Link>
              ))}
            </nav>
            <div className="px-2 py-4 border-t"><a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group"><Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />Supporto</a></div>
          </div>
        </div>
      </aside>
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="relative flex-1 overflow-y-auto focus:outline-none">
          <div className="py-8 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="pb-6 border-b border-slate-200">
              <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate flex items-center"><Icon path={icons.checkup} className="w-8 h-8 mr-3 text-blue-600" />Check-UP AI</h1>
              <p className="mt-2 text-base text-slate-600">Carica il bilancio per avviare una nuova analisi.</p>
            </div>
            <div className="mt-8"><CheckAiXbrlForm user={user} /></div>
          </div>
        </main>
      </div>
    </div>
  );
}

// --- Componente del Form di Upload ---
function CheckAiXbrlForm({ user }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim() || !selectedFile) {
      setError('Nome azienda e file sono obbligatori.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const sessionId = uuidv4();
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `public/${sessionId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('checkup-documents')
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { error: sessionError } = await supabase
        .from('checkup_sessions')
        .insert({
          id: sessionId,
          // ✅ CORREZIONE: Salva il nome dell'azienda nella colonna 'session_name'
          session_name: companyName, 
          file_path: filePath,
          status: 'pending',
          user_id: user.id,
        });
      if (sessionError) throw sessionError;

      const response = await fetch('/api/analyze-xbrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Errore durante l\'avvio dell\'analisi.');
      }

      router.push(`/analisi/${sessionId}`);

    } catch (err) {
      console.error('Errore nel processo di upload e analisi:', err);
      setError(`Si è verificato un errore: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="company-name" className="block text-sm font-medium text-slate-700 mb-1">Nome Azienda *</label>
          <input
            type="text"
            id="company-name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            placeholder="Es. Mario Rossi S.r.l."
            required
          />
        </div>

        <label 
          htmlFor="file-upload" 
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragActive ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            <Icon path={icons.uploadCloud} className="w-10 h-10 mb-4 text-slate-500" />
            <p className="mb-2 text-sm text-slate-500"><span className="font-semibold text-blue-600">Clicca per caricare</span> o trascina il file</p>
            <p className="text-xs text-slate-500">File XBRL in formato .xls o .xlsx</p>
          </div>
          <input id="file-upload" type="file" className="hidden" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel" onChange={handleFileChange} />
        </label>

        {selectedFile && (
          <div className="flex items-center justify-center p-3 text-sm text-slate-700 bg-slate-100 rounded-lg">
            <Icon path={icons.file} className="w-5 h-5 mr-2 text-slate-500" />
            File selezionato: <span className="font-medium ml-1">{selectedFile.name}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center p-3 text-sm text-red-700 bg-red-100 rounded-lg">
            <Icon path={icons.alertTriangle} className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isLoading || !selectedFile || !companyName}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
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
  );
}
