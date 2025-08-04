// /pages/analisi-hd/[sessionId].js
// Pagina di report per il nuovo flusso "High Definition"

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { ProtectedPage } from '../../utils/ProtectedPage'; // Assicurati che il percorso sia corretto

// --- Componente Wrapper ---
export default function AnalisiHdReportPageWrapper() {
  return (
    <>
      <Head>
        <title>Report Analisi HD - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      <ProtectedPage>
        {(user, token) => <ReportHdPageLayout user={user} token={token} />}
      </ProtectedPage>
    </>
  );
}

// --- Icone ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  print: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></>,
};

// --- Layout della Pagina ---
function ReportHdPageLayout({ user, token }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/checkup-hd', text: 'Check-UP AI HD', icon: icons.zap, active: true },
    { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: false },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
  ];
  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
      <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b">
                <img src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" alt="Logo PMIScout" className="h-8 w-auto" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x40/007BFF/FFFFFF?text=PMIScout'; }} />
            </div>
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
                <nav className="flex-1 px-2 pb-4 space-y-1">
                {navLinks.map((link) => (
                    <Link key={link.text} href={link.href}><a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ link.active ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}><Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />{link.text}</a></Link>
                ))}
                </nav>
                <div className="px-2 py-4 border-t"><a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors"><Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />Supporto</a></div>
            </div>
        </div>
      </aside>
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <AnalisiHdReportPage user={user} token={token} />
      </div>
    </div>
  );
}

// --- Componente Pagina Analisi HD (Logica di Polling) ---
function AnalisiHdReportPage({ user, token }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [sessionData, setSessionData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('Avvio del processo di analisi HD...');
  
  const pollingIntervalRef = useRef(null);

  const statusMessages = {
    indexing: 'Fase 1: Indicizzazione del documento in corso... Questa operazione potrebbe richiedere qualche minuto.',
    processing: 'Fase 2: Estrazione e analisi dei dati in corso... Siamo quasi alla fine.',
    completed: 'Analisi completata con successo!',
    failed: 'Si è verificato un errore durante l\'analisi.'
  };

  useEffect(() => {
    const fetchSessionStatus = async () => {
      if (!sessionId || !token) return;

      try {
        const response = await fetch(`/api/get-session-hd?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Errore nel recupero dello stato della sessione.');
        }

        const data = await response.json();
        setSessionData(data);
        setStatusMessage(statusMessages[data.status] || `Stato sconosciuto: ${data.status}`);

        if (data.status === 'completed' || data.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          if (data.status === 'completed') {
            // TODO: Chiamare l'API finale per ottenere i dati dell'analisi
            // Per ora, mostriamo un placeholder
            setAnalysisData({ summary: "Analisi HD completata. I dati dettagliati verranno mostrati qui." });
          } else {
            setError(data.error_message || 'L\'analisi non è andata a buon fine.');
          }
        }
      } catch (err) {
        console.error('Errore durante il polling:', err);
        setError(err.message);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      }
    };

    if (sessionId && token) {
        fetchSessionStatus(); // Prima chiamata immediata
        pollingIntervalRef.current = setInterval(fetchSessionStatus, 5000); // Polling ogni 5 secondi
    }

    return () => { // Funzione di pulizia
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [sessionId, token]); 

  const renderContent = () => {
    if (error) return <ErrorState message={error} />;
    if (!sessionData) return <LoadingState text="Caricamento sessione in corso..." />;
    
    if (sessionData.status !== 'completed' && sessionData.status !== 'failed') {
        return <LoadingState text={statusMessage} status={sessionData.status} />;
    }
    
    if (sessionData.status === 'completed' && analysisData) {
        // TODO: Rendere il componente del report finale
        return <div className="p-8 bg-white rounded-xl shadow-md">
            <h1 className="text-2xl font-bold text-purple-700">Report Analisi HD</h1>
            <p className="mt-4 text-slate-600">{analysisData.summary}</p>
            <p className="mt-4 text-sm text-slate-500">Azienda: {sessionData.companies?.company_name}</p>
        </div>;
    }

    return <ErrorState message="Non è stato possibile caricare i risultati dell'analisi." />;
  };

  return (
    <main className="relative flex-1 overflow-y-auto focus:outline-none">
      <div className="py-8 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </div>
    </main>
  );
}

// --- Componenti di Stato ---
const LoadingState = ({ text, status }) => (
    <div className="flex items-center justify-center h-full p-10">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-slate-800">{text}</h2>
            {status && <p className="text-sm text-slate-500 mt-4">Stato attuale: <strong className="uppercase font-semibold text-purple-700">{status}</strong></p>}
        </div>
    </div>
);

const ErrorState = ({ message }) => (
    <div className="flex items-center justify-center h-full p-10">
        <div className="text-center p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500">
            <Icon path={icons.alertTriangle} className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2>
            <p className="text-slate-600 mt-2">{message}</p>
        </div>
    </div>
);
