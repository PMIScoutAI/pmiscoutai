// /pages/analisi/[sessionId].js
// CODICE COMPLETAMENTE RIVISTO NELLA UI/UX
// - Mantiene la stessa logica tecnica (fetch dati, autenticazione).
// - Integra il layout della dashboard per un'esperienza coerente.
// - Ridisegna completamente la presentazione del report con componenti visivi avanzati.
// - Utilizza card, icone e colori per migliorare la leggibilità e l'impatto visivo.

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { ProtectedPage } from '../../utils/ProtectedPage';

// --- Componente Wrapper (con aggiunta di Tailwind e Font) ---
export default function AnalisiReportPageWrapper() {
  return (
    <>
      <Head>
        <title>Report Analisi AI - PMIScout</title>
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
        {(user) => <ReportPageLayout user={user} />}
      </ProtectedPage>
    </>
  );
}

// --- Componenti UI e Icone ---
const Icon = ({ path, className = 'w-6 h-6' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {path}
  </svg>
);

const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  print: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  lightbulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 0 0-7-7z" /></>,
  thumbsUp: <><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a2 2 0 0 1 3 1.88z" /></>,
  thumbsDown: <><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a2 2 0 0 1-3-1.88z" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  award: <><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 22 12 17 17 22 15.79 13.88"></polyline></>,
  trendingUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  dollarSign: <><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>,
};

// --- Layout della Pagina Report ---
function ReportPageLayout({ user }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true }, // Mantiene Checkup attivo
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
  ];

  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
      {/* Sidebar */}
      <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 border-b">
            <img src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" alt="Logo PMIScout" className="h-8 w-auto" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x40/007BFF/FFFFFF?text=PMIScout'; }} />
          </div>
          <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.text} href={link.href}><a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ link.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}><Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />{link.text}</a></Link>
              ))}
            </nav>
            <div className="px-2 py-4 border-t"><a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors"><Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />Supporto</a></div>
          </div>
        </div>
      </aside>
      {/* Overlay mobile */}
      {isSidebarOpen && (<div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />)}
      {/* Contenuto Principale */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors" aria-label="Apri menu"><Icon path={icons.menu} /></button>
          <img src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" alt="Logo PMIScout" className="h-7 w-auto" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/120x30/007BFF/FFFFFF?text=PMIScout'; }} />
          <div className="w-8" />
        </header>
        <AnalisiReportPage user={user} />
      </div>
    </div>
  );
}

// --- Componente Pagina Analisi (Logica invariata, UI nel render) ---
function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [sessionData, setSessionData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ... LA LOGICA DI FETCHING DEI DATI DA SUPABASE RIMANE IDENTICA ...
    const fetchSessionData = async () => {
      if (!sessionId || !user.id) return;
      try {
        const { data: session, error: sessionError } = await supabase.from('checkup_sessions').select('*, companies(*)').eq('id', sessionId).single();
        if (sessionError) throw new Error('Sessione non trovata o accesso negato.');
        if (session.user_id !== user.id) throw new Error('Non sei autorizzato a visualizzare questa analisi.');
        setSessionData(session);

        if (session.status === 'completed') {
          const { data: results, error: resultsError } = await supabase.from('analysis_results').select('*').eq('session_id', sessionId).single();
          if (resultsError) throw new Error('Impossibile caricare i risultati dell\'analisi.');
          setAnalysisData(results);
        } else if (session.status === 'failed') {
          setError(session.error_message || 'Errore durante l\'analisi.');
        }
      } catch (err) {
        console.error('Data fetching error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSessionData();
  }, [sessionId, user.id]);

  const renderContent = () => {
    // Stati di caricamento, errore e attesa (UI migliorata)
    if (isLoading) return <LoadingState text="Caricamento del report in corso..." />;
    if (error) return <ErrorState message={error} />;
    if (!sessionData) return <ErrorState message="Nessun dato trovato per questa sessione." />;
    if (sessionData.status !== 'completed') return <LoadingState text="L'analisi è in coda di elaborazione..." status={sessionData.status} />;
    if (!analysisData) return <LoadingState text="Recupero dei risultati finali..." />;

    const analysis = analysisData.raw_ai_response || {};
    const companyName = analysis.company_name || sessionData.companies?.company_name;
    const healthScore = analysisData.health_score || 0;

    return (
      <div className="space-y-8">
        <ReportHeader companyName={companyName} healthScore={healthScore} summary={analysisData.summary} />
        
        {analysis.key_metrics && <KeyMetricsSection metrics={analysis.key_metrics} />}
        {analysis.swot && <SwotSection swot={analysis.swot} />}
        {analysisData.recommendations?.length > 0 && <RecommendationsSection recommendations={analysisData.recommendations} />}
        
        <div className="flex justify-center items-center space-x-4 mt-10">
            <button onClick={() => window.print()} className="flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                <Icon path={icons.print} className="w-5 h-5 mr-2" />
                Stampa Report
            </button>
        </div>

        <CtaPro />
      </div>
    );
  };

  return (
    <main className="relative flex-1 overflow-y-auto focus:outline-none">
      <div className="py-8 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </div>
    </main>
  );
}

// --- Componenti UI Specifici per il Report ---

const HealthScoreGauge = ({ score }) => {
    const getScoreColor = (s) => {
        if (s >= 75) return 'text-green-500';
        if (s >= 50) return 'text-yellow-500';
        return 'text-red-500';
    };
    const circumference = 2 * Math.PI * 52; // 2 * pi * r
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative w-40 h-40">
            <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle className="text-slate-200" strokeWidth="10" stroke="currentColor" fill="transparent" r="52" cx="60" cy="60" />
                <circle
                    className={`${getScoreColor(score)} transition-all duration-1000 ease-out`}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="52"
                    cx="60"
                    cy="60"
                    transform="rotate(-90 60 60)"
                />
            </svg>
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${getScoreColor(score)}`}>
                <span className="text-4xl font-bold">{score}</span>
                <span className="text-xs font-medium text-slate-500">/ 100</span>
            </div>
        </div>
    );
};

const ReportHeader = ({ companyName, healthScore, summary }) => (
    <div className="p-8 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1">
                <p className="text-sm font-medium text-blue-600">Report di Analisi AI</p>
                <h1 className="text-3xl font-bold text-slate-900 mt-1">{companyName}</h1>
                <p className="mt-4 text-slate-600 leading-relaxed">{summary || 'Nessun sommario disponibile.'}</p>
            </div>
            <div className="flex-shrink-0">
                <HealthScoreGauge score={healthScore} />
            </div>
        </div>
    </div>
);

const KeyMetricsSection = ({ metrics }) => {
    const metricDetails = {
        current_ratio: { label: 'Current Ratio', icon: icons.dollarSign, color: 'text-blue-600', bgColor: 'bg-blue-50' },
        roe: { label: 'ROE', icon: icons.trendingUp, color: 'text-green-600', bgColor: 'bg-green-50' },
        debt_equity: { label: 'Debt/Equity', icon: icons.alertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    };
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Indici Finanziari Chiave</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.keys(metrics).map(key => {
                    const detail = metricDetails[key];
                    if (!detail) return null;
                    return (
                        <div key={key} className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${detail.bgColor}`}>
                                <Icon path={detail.icon} className={`w-6 h-6 ${detail.color}`} />
                            </div>
                            <p className="text-sm text-slate-500 mt-4">{detail.label}</p>
                            <p className="text-3xl font-bold text-slate-900">{metrics[key].value}</p>
                            <p className="text-xs text-slate-400 mt-1">Benchmark: {metrics[key].benchmark}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const SwotSection = ({ swot }) => {
    const swotDetails = {
        strengths: { label: 'Punti di Forza', icon: icons.thumbsUp, color: 'green' },
        weaknesses: { label: 'Punti di Debolezza', icon: icons.thumbsDown, color: 'red' },
        opportunities: { label: 'Opportunità', icon: icons.target, color: 'blue' },
        threats: { label: 'Minacce', icon: icons.alertTriangle, color: 'orange' },
    };
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi SWOT</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(swotDetails).map(key => {
                    const detail = swotDetails[key];
                    const items = swot[key] || [];
                    return (
                        <div key={key} className={`p-6 bg-white rounded-xl shadow-sm border-l-4 border-${detail.color}-500`}>
                            <div className={`flex items-center text-lg font-bold text-${detail.color}-600`}>
                                <Icon path={detail.icon} className="w-6 h-6 mr-3" />
                                {detail.label}
                            </div>
                            <ul className="mt-4 space-y-2 list-disc list-inside text-slate-600 text-sm">
                                {items.length > 0 ? items.map((item, idx) => <li key={idx}>{item}</li>) : <li>Nessun dato disponibile.</li>}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const RecommendationsSection = ({ recommendations }) => (
    <section>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Raccomandazioni Strategiche</h2>
        <div className="space-y-4">
            {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                        <Icon path={icons.lightbulb} className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-slate-700 text-sm">{rec}</p>
                </div>
            ))}
        </div>
    </section>
);

const CtaPro = () => (
    <div className="mt-12 p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg text-center">
        <Icon path={icons.award} className="w-10 h-10 mx-auto mb-2" />
        <h3 className="text-xl font-bold">Porta la tua analisi al livello successivo</h3>
        <p className="mt-2 text-blue-100 max-w-2xl mx-auto">Attiva PMIScout Pro per sbloccare report dettagliati, analisi comparative e suggerimenti strategici personalizzati.</p>
        <a href="/pro" className="inline-block mt-4 px-6 py-2 font-semibold bg-white text-blue-600 rounded-lg shadow-md hover:bg-slate-50 transition-colors">
            Scopri i vantaggi di Pro
        </a>
    </div>
);

const LoadingState = ({ text, status }) => (
    <div className="text-center p-10 bg-white rounded-xl shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-slate-800">{text}</h2>
        {status && <p className="text-sm text-slate-500 mt-4">Stato attuale: <strong className="uppercase">{status}</strong></p>}
    </div>
);

const ErrorState = ({ message }) => (
     <div className="text-center p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500">
        <Icon path={icons.alertTriangle} className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2>
        <p className="text-slate-600 mt-2">{message}</p>
    </div>
);
