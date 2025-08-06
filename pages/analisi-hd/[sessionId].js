// /pages/analisi-hd/[sessionId].js
// VERSIONE SEMPLIFICATA: Mostra solo i 2 dati chiave estratti per la verifica.

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { ProtectedPageHd } from '../../utils/ProtectedPageHd';

// --- Componente Wrapper ---
export default function AnalisiHdReportPageWrapper() {
  return (
    <>
      <Head>
        <title>Report Dati Estratti (Beta) - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">{`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}</Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      <ProtectedPageHd>
        {(user, token) => <ReportHdPageLayout user={user} token={token} />}
      </ProtectedPageHd>
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
              <div className="flex items-center justify-center h-16 border-b"><img src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" alt="Logo PMIScout" className="h-8 w-auto" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x40/007BFF/FFFFFF?text=PMIScout'; }} /></div>
              <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
                  <nav className="flex-1 px-2 pb-4 space-y-1">{navLinks.map((link) => (<Link key={link.text} href={link.href}><a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ link.active ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}><Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />{link.text}</a></Link>))}</nav>
                  <div className="px-2 py-4 border-t"><a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group"><Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />Supporto</a></div>
              </div>
          </div>
        </aside>
        <div className="flex flex-col flex-1 w-0 overflow-hidden"><AnalisiHdReportPage user={user} token={token} /></div>
      </div>
    );
}

// --- Componente Principale della Pagina ---
function AnalisiHdReportPage({ user, token }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState('');
  const pollingIntervalRef = useRef(null);

  const statusMessages = {
    indexing: 'Fase 1: Indicizzazione del documento...',
    processing: 'Fase 2: Estrazione dei dati in corso...',
    completed: 'Estrazione completata!',
    failed: 'Si è verificato un errore durante l\'estrazione.'
  };

  useEffect(() => {
    const fetchSessionStatus = async () => {
      if (!sessionId) return;
      try {
        const response = await fetch(`/api/get-session-hd?sessionId=${sessionId}`);
        if (!response.ok) throw new Error('Errore nel recupero dello stato della sessione.');
        const data = await response.json();
        setSessionData(data);
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          if (data.status === 'failed') setError(data.error_message || 'L\'analisi non è andata a buon fine.');
        }
      } catch (err) {
        setError(err.message);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      }
    };
    if (sessionId) { fetchSessionStatus(); pollingIntervalRef.current = setInterval(fetchSessionStatus, 5000); }
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [sessionId]); 

  const renderContent = () => {
    if (error) return <ErrorState message={error} />;
    if (!sessionData) return <LoadingState text="Caricamento sessione in corso..." />;
    const { status, analysis_results, companies } = sessionData;
    if (status !== 'completed' && status !== 'failed') { return <LoadingState text={statusMessages[status] || `Stato: ${status}`} status={status} />; }
    if (status === 'completed' && analysis_results) { return <ReportView result={analysis_results} companyName={companies?.company_name} />; }
    return <ErrorState message={sessionData.error_message || "Non è stato possibile caricare i risultati dell'estrazione."} />;
  };

  return (<main className="relative flex-1 overflow-y-auto focus:outline-none"><div className="py-8 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">{renderContent()}</div></main>);
}

// --- Componenti di Visualizzazione ---
const LoadingState = ({ text, status }) => (<div className="flex items-center justify-center h-full p-10"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div><h2 className="text-2xl font-bold text-slate-800">{text}</h2>{status && <p className="text-sm text-slate-500 mt-4">Stato attuale: <strong className="uppercase font-semibold text-purple-700">{status}</strong></p>}</div></div>);
const ErrorState = ({ message }) => (<div className="text-center p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500"><Icon path={icons.alertTriangle} className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2><p className="text-slate-600 mt-2">{message}</p></div>);

// ✅ NUOVO: Componente ReportView ultra-semplificato.
const ReportView = ({ result, companyName }) => {
    const { raw_parsed_data } = result;

    const dataLabels = {
        revenue_current: "Fatturato (Valore della Produzione)",
        net_income_current: "Utile Netto d'Esercizio",
    };

    return (
        <div className="space-y-8">
            <div className="p-8 bg-white rounded-xl shadow-md border border-slate-200">
                <p className="text-sm font-medium text-purple-600">Report Dati Estratti (Beta Semplificato)</p>
                <h1 className="text-3xl font-bold text-slate-900 mt-1">{companyName || 'Azienda'}</h1>
                <p className="mt-4 text-slate-600">Di seguito i due dati chiave estratti per la verifica. L'obiettivo è ottenere questi valori in modo perfetto prima di procedere.</p>
            </div>

            <div className="p-8 bg-white rounded-xl shadow-md border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Dati Chiave Estratti</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Voce di Bilancio</th>
                                <th scope="col" className="px-6 py-3 text-right">Valore</th>
                            </tr>
                        </thead>
                        <tbody>
                            {raw_parsed_data && Object.entries(dataLabels).map(([key, label]) => (
                                <tr key={key} className="bg-white border-b hover:bg-slate-50">
                                    <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                        {label}
                                    </th>
                                    <td className="px-6 py-4 text-right font-mono text-lg">
                                        {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(raw_parsed_data[key] || 0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
