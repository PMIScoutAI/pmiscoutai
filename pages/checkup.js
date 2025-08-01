// /pages/checkup.js
// CODICE ORIGINALE DELL'UTENTE CON MODIFICHE MIRATE
// - Mantiene tutta la struttura e la logica esistente.
// - FIX v4: Modificata la funzione handleSubmit per aggiungere la chiamata all'API /api/analyze-pdf.

import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router'; // ✅ 1. Importa useRouter
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';

// --- Componente Wrapper (INVARIATO) ---
export default function CheckupPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI Azienda - PMIScout</title>
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
      />

      <ProtectedPage>
        {/* Passa il token al layout */}
        {(user, token) => <CheckupPageLayout user={user} token={token} />}
      </ProtectedPage>
    </>
  );
}

// --- Componenti UI Riutilizzabili (INVARIATO) ---
const Icon = ({ path, className = 'w-6 h-6' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {path}
  </svg>
);
const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></>,
};

// --- Layout Principale della Pagina (INVARIATO) ---
function CheckupPageLayout({ user, token }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
  ];

  return (
    <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
      <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 border-b">
            <img 
              src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" 
              alt="Logo PMIScout" 
              className="h-8 w-auto"
              onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x40/007BFF/FFFFFF?text=PMIScout'; }}
            />
          </div>
          <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.text} href={link.href}>
                  <a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ link.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}>
                    <Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />
                    {link.text}
                  </a>
                </Link>
              ))}
            </nav>
            <div className="px-2 py-4 border-t">
              <a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors">
                <Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />
                Supporto
              </a>
            </div>
          </div>
        </div>
      </aside>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Apri menu"
          >
            <Icon path={icons.menu} />
          </button>
          <img 
            src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" 
            alt="Logo PMIScout" 
            className="h-7 w-auto"
            onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/120x30/007BFF/FFFFFF?text=PMIScout'; }}
          />
          <div className="w-8" />
        </header>

        <main className="relative flex-1 overflow-y-auto focus:outline-none">
          <div className="py-8 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="pb-6 border-b border-slate-200">
              <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
                Check-UP AI Azienda
              </h1>
              <p className="mt-2 text-base text-slate-600">
                Ciao, <span className="font-semibold">{user.FirstName || user.Email}</span>. Compila i dati e carica il bilancio per avviare l'analisi.
              </p>
            </div>
            
            <div className="mt-8">
              <CheckupForm token={token} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// --- Componente del Form (Logica di submit CORRETTA) ---
function CheckupForm({ token }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [pdfFile, setPdfFile] = useState(null);

  const fileInputRef = useRef(null);
  const router = useRouter(); // ✅ Inizializza il router

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      setError('Il file deve essere in formato PDF.');
      setPdfFile(null);
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB
      setError('Il file PDF non deve superare i 5MB.');
      setPdfFile(null);
      return;
    }
    
    setError('');
    setPdfFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // ✅ --- FUNZIONE MODIFICATA --- ✅
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      setError('Il nome azienda è obbligatorio.');
      return;
    }
    if (!pdfFile) {
      setError('È necessario caricare un file PDF.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('companyName', companyName);
      formData.append('vatNumber', vatNumber);
      formData.append('pdfFile', pdfFile);

      // PASSO 1: Chiama start-checkup per creare la sessione
      const result = await api.startCheckup(formData, token);
      const { sessionId } = result;
      
      // PASSO 2: Avvia l'analisi in background (chiamata "lancia e dimentica")
      console.log(`Sessione ${sessionId} creata. Avvio dell'analisi in background...`);
      fetch('/api/analyze-pdf', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_INTERNAL_SECRET}` 
          },
          body: JSON.stringify({ session_id: sessionId })
      });

      // PASSO 3: Reindirizza immediatamente l'utente alla pagina dei risultati
      router.push(`/analisi/${sessionId}`);
      
    } catch (err) {
      console.error('Errore durante l\'avvio del checkup:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Si è verificato un errore imprevisto.';
      setError(errorMessage);
      setLoading(false); // Riabilita il bottone solo in caso di errore
    }
    // Rimosso il blocco 'finally' per evitare di impostare loading a false dopo un redirect di successo
  };

  return (
    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {error && (
          <div className="flex items-start p-4 text-sm text-red-700 bg-red-50 rounded-lg">
            <Icon path={icons.alert} className="w-5 h-5 mr-3 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">
            Nome Azienda *
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            placeholder="Es. Mario Rossi S.r.l."
            required
          />
        </div>

        <div>
          <label htmlFor="vatNumber" className="block text-sm font-medium text-slate-700 mb-1">
            Partita IVA (Opzionale)
          </label>
          <input
            id="vatNumber"
            type="text"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            placeholder="Es. 12345678901"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Bilancio PDF (max 5MB) *
          </label>
          <div
            className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:border-blue-500 hover:bg-slate-50 transition-colors"
            onClick={() => fileInputRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Icon path={icons.upload} className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-semibold text-blue-600">Carica un file</span> o trascinalo qui
              </p>
              <p className="text-xs text-slate-500">Formato PDF, dimensione massima 5MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => handleFileChange(e.target.files[0])}
            className="hidden"
            required={!pdfFile}
          />
          {pdfFile && (
            <div className="mt-3 flex items-center justify-between text-sm bg-green-50 p-3 rounded-lg text-green-800 border border-green-200">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span className="font-medium">{pdfFile.name}</span>
              </div>
              <button 
                type="button"
                onClick={() => setPdfFile(null)}
                className="text-green-900 hover:text-green-700 font-bold"
                aria-label="Rimuovi file"
              >&times;</button>
            </div>
          )}
        </div>

        <div className="flex items-center text-xs text-slate-500">
          <Icon path={icons.lock} className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>I tuoi dati sono crittografati e usati solo per l'analisi.</span>
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
            'Avvia Check-UP AI'
          )}
        </button>
      </form>
    </div>
  );
}
