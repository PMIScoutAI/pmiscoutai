// /pages/check-ai-xbrl.js
// VERSIONE 3.0 (UI Uniforme con Sidebar)
// - AGGIUNTO: Layout principale con Sidebar per coerenza con la Dashboard.
// - AGGIUNTO: Logica di autenticazione e recupero dati utente/analisi recenti.

import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';

// Dynamic import per evitare problemi di SSR
const CheckupXbrlPageComponent = dynamic(
  () => Promise.resolve(CheckupXbrlPage),
  { 
    ssr: false,
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

// Componenti UI riutilizzati
const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
    </svg>
);

const Sidebar = ({ isOpen, user, analyses, isLoadingAnalyses, navLinks, icons, Icon }) => {
    return (
        <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isOpen ? 'translate-x-0' : '-translate-x-full' }`}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b">
              <h1 className="text-2xl font-bold text-blue-600">PMIScout</h1>
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
              
              <AnalisiRecenti analyses={analyses} isLoading={isLoadingAnalyses} />

              <div className="px-2 py-3 border-t border-slate-200">
                <div className="flex items-center px-2 py-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Connesso come {user?.name}
                </div>
              </div>

              <div className="px-2 py-4 border-t">
                <a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors">
                  <Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />
                  Supporto
                </a>
              </div>
            </div>
          </div>
        </aside>
    );
};

const AnalisiRecenti = ({ analyses, isLoading }) => {
  if (isLoading) { return <div className="p-4"><div className="animate-pulse h-4 bg-gray-200 rounded w-3/4"></div></div>; }
  if (!analyses || analyses.length === 0) { return null; }
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const getScoreColor = (score) => {
    if (score >= 75) return 'bg-green-100 text-green-800';
    if (score >= 50) return 'bg-blue-100 text-blue-800';
    if (score >= 25) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };
  return (
    <div className="px-2 py-3 border-t border-slate-200">
      <h4 className="px-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Analisi Recenti</h4>
      <div className="space-y-1">
        {analyses.map((analysis) => (
          <Link key={analysis.session_id} href={`/analisi/${analysis.session_id}`}>
            <a className="block px-2 py-2 text-xs rounded-md hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-700 truncate">{analysis.company_name}</div>
              <div className="flex items-center justify-between mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(analysis.health_score)}`}>{analysis.health_score}</span>
                <span className="text-slate-500">{formatDate(analysis.created_at)}</span>
              </div>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
};

// Componente Pagina Principale
function CheckupXbrlPage() {
  const [file, setFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const router = useRouter();

  // Stati per la UI unificata
  const [user, setUser] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleAuth = () => {
      window.Outseta.getUser()
        .then(userData => {
          if (userData && userData.Email) {
            setUser({ name: userData.FirstName || userData.Email.split('@')[0], email: userData.Email });
            fetchRecentAnalyses(userData.Email);
          }
        });
    };
    if (typeof window !== 'undefined' && window.Outseta) handleAuth();
  }, []);

  const fetchRecentAnalyses = async (email) => {
     try {
        const response = await fetch(`/api/user-analyses?email=${encodeURIComponent(email)}`);
        if(response.ok) {
            const data = await response.json();
            setRecentAnalyses(data.analyses || []);
        }
     } catch (err) { console.error("Errore analisi recenti:", err); }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !companyName.trim()) {
      setError('Per favore, compila tutti i campi.');
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
      setError(err.response?.data?.error || err.message || 'Impossibile avviare l\'analisi.');
      setLoading(false);
    }
  };
  
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>,
    support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    xbrl: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="m9 15 3-3 3 3"></path></>,
    checkbanche: <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path><path d="M12 5L8 21l4-7 4 7-4-16Z"></path></>,
    upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    file: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z",
    lock: "M2 8V4.222a2 2 0 0 1 1.333-1.884l8-3.111a2 2 0 0 1 1.334 0l8 3.11a2 2 0 0 1 1.333 1.885V8M2 8v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8M2 8h20"
  };

  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/check-ai-xbrl', text: 'Check-AI XBRL', icon: icons.xbrl, active: true },
    { href: '/check-banche', text: 'Check Banche', icon: icons.checkbanche, active: false },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    { href: '/calcolatori', text: 'Calcolatori', icon: icons.calculator, active: false },
  ];

  return (
    <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
        <Sidebar 
            isOpen={isSidebarOpen} 
            user={user} 
            analyses={recentAnalyses} 
            isLoadingAnalyses={false} 
            navLinks={navLinks}
            icons={icons}
            Icon={Icon}
        />

        {isSidebarOpen && (
          <div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors" aria-label="Apri menu">
            <Icon path={icons.menu} />
            </button>
            <h1 className="text-xl font-bold text-blue-600">PMIScout</h1>
            <div className="w-8" />
        </header>

        <main className="relative flex-1 overflow-y-auto focus:outline-none">
            <div className="py-8 mx-auto max-w-2xl px-4">
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

            <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md">
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
    </div>
  );
}
