// /pages/analisi/[sessionId].js
// VERSIONE 2.1: Corretto un errore di timing (race condition) sul caricamento dei dati dell'utente.
// - Aggiunge grafici per visualizzare i trend degli indici.
// - Mostra la nuova analisi SWOT dettagliata e l'analisi dei rischi.
// - Integra i "teaser" per le funzionalità Pro.
// - Mantiene la retrocompatibilità con le analisi V1.

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { ProtectedPage } from '../../utils/ProtectedPage';

// --- Componente Wrapper (con aggiunta di Recharts per i grafici) ---
export default function AnalisiReportPageWrapper() {
  return (
    <>
      <Head>
        <title>Report Analisi AI V2 - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        {/* Libreria per i grafici */}
        <script src="https://unpkg.com/recharts/umd/Recharts.min.js"></script>
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      <ProtectedPage>
        {(user) => <ReportPageLayout user={user} />}
      </ProtectedPage>
    </>
  );
}

// --- Componenti UI e Icone (invariati) ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
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
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></>,
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></>,
};

// --- Layout della Pagina Report (invariato) ---
function ReportPageLayout({ user }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
  ];
  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
      <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
        {/* ... contenuto sidebar ... */}
      </aside>
      {isSidebarOpen && (<div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />)}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
          {/* ... contenuto header mobile ... */}
        </header>
        <AnalisiReportPage user={user} />
      </div>
    </div>
  );
}

// --- Componente Pagina Analisi (Logica di fetch CORRETTA) ---
function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [sessionData, setSessionData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSessionData = async () => {
      // FIX: Controlliamo che sia `sessionId` che `user` esistano prima di procedere.
      // Questo previene l'errore se il componente renderizza prima che `user` sia pronto.
      if (!sessionId || !user) {
        return;
      }

      try {
        const { data: session, error: sessionError } = await supabase.from('checkup_sessions').select('*, companies(*)').eq('id', sessionId).single();
        if (sessionError) throw new Error('Sessione non trovata o accesso negato.');
        
        // Ora è sicuro accedere a user.id
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
  }, [sessionId, user]); // FIX: La dipendenza è l'intero oggetto `user`, non solo `user.id`.

  const renderContent = () => {
    // Stati di caricamento, errore e attesa (invariati)
    if (isLoading) return <LoadingState text="Caricamento del report in corso..." />;
    if (error) return <ErrorState message={error} />;
    if (!sessionData) return <ErrorState message="Nessun dato trovato per questa sessione." />;
    if (sessionData.status !== 'completed') return <LoadingState text="L'analisi è in coda di elaborazione..." status={sessionData.status} />;
    if (!analysisData) return <LoadingState text="Recupero dei risultati finali..." />;

    const companyName = analysisData.raw_ai_response?.company_name || sessionData.companies?.company_name;
    const healthScore = analysisData.health_score || 0;

    return (
      <div className="space-y-8">
        <ReportHeader companyName={companyName} healthScore={healthScore} summary={analysisData.summary} />
        
        {/* Sezione Indici e Grafici */}
        <KeyMetricsAndChartsSection metrics={analysisData.key_metrics} chartsData={analysisData.charts_data} />

        {/* Logica per mostrare SWOT nuovo o vecchio */}
        {analysisData.detailed_swot ? 
            <DetailedSwotSection swot={analysisData.detailed_swot} /> : 
            (analysisData.raw_ai_response?.swot && <SwotSection swot={analysisData.raw_ai_response.swot} />)
        }
        
        {/* Nuova Sezione Analisi Rischi */}
        {analysisData.risk_analysis && analysisData.risk_analysis.length > 0 && <RiskAnalysisSection risks={analysisData.risk_analysis} />}

        {/* Sezione Raccomandazioni (invariata) */}
        {analysisData.recommendations?.length > 0 && <RecommendationsSection recommendations={analysisData.recommendations} />}
        
        <div className="flex justify-center items-center space-x-4 mt-10">
            <button onClick={() => window.print()} className="flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                <Icon path={icons.print} className="w-5 h-5 mr-2" />
                Stampa Report
            </button>
        </div>

        {/* Nuovo Teaser per Funzionalità Pro */}
        {analysisData.pro_features_teaser && <ProTeaserSection teaser={analysisData.pro_features_teaser} />}
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

// --- NUOVI e AGGIORNATI Componenti UI per il Report V2 ---

// Componente Header e Gauge (invariati)
const HealthScoreGauge = ({ score }) => { /* ... codice invariato ... */ };
const ReportHeader = ({ companyName, healthScore, summary }) => { /* ... codice invariato ... */ };

// NUOVO: Componente Grafico
const TrendChart = ({ data, dataKey, name, color }) => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = window.Recharts;
    const chartData = [
        { name: 'Anno Prec.', [dataKey]: data.previous_year },
        { name: 'Anno Corr.', [dataKey]: data.current_year },
    ];
    return (
        <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// AGGIORNATO: Sezione Indici e Grafici
const KeyMetricsAndChartsSection = ({ metrics, chartsData }) => {
    // ... (codice per metricDetails invariato) ...
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Panoramica Finanziaria</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Card Indici */}
                {Object.keys(metrics).map(key => { /* ... codice card invariato ... */ })}
                
                {/* NUOVO: Card Grafici */}
                {chartsData?.roe_trend?.current_year && (
                    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                        <h3 className="text-base font-semibold text-slate-800">Andamento ROE (%)</h3>
                        <TrendChart data={chartsData.roe_trend} dataKey="current_year" name="ROE" color="#22c55e" />
                    </div>
                )}
            </div>
        </section>
    );
};

// NUOVO: Sezione SWOT Dettagliato
const DetailedSwotSection = ({ swot }) => {
    const swotDetails = {
        strengths: { label: 'Punti di Forza', icon: icons.thumbsUp, color: 'green' },
        weaknesses: { label: 'Punti di Debolezza', icon: icons.thumbsDown, color: 'red' },
        opportunities: { label: 'Opportunità', icon: icons.target, color: 'blue' },
        threats: { label: 'Minacce', icon: icons.alertTriangle, color: 'orange' },
    };
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi SWOT Dettagliata</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(swot).map(key => {
                    const detail = swotDetails[key];
                    const items = swot[key] || [];
                    return (
                        <div key={key} className={`p-6 bg-white rounded-xl shadow-sm border-t-4 border-${detail.color}-500`}>
                            <div className={`flex items-center text-lg font-bold text-slate-800`}>
                                <div className={`w-8 h-8 rounded-full bg-${detail.color}-100 flex items-center justify-center mr-3`}>
                                    <Icon path={detail.icon} className={`w-5 h-5 text-${detail.color}-600`} />
                                </div>
                                {detail.label}
                            </div>
                            <div className="mt-4 space-y-3 text-sm">
                                {items.length > 0 ? items.map((item, idx) => (
                                    <div key={idx}>
                                        <p className="font-semibold text-slate-700">{item.point}</p>
                                        <p className="text-slate-500">{item.explanation}</p>
                                    </div>
                                )) : <p className="text-slate-500">Nessun dato disponibile.</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

// NUOVO: Sezione Analisi Rischi
const RiskAnalysisSection = ({ risks }) => (
    <section>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi dei Rischi Principali</h2>
        <div className="space-y-4">
            {risks.map((item, i) => (
                <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center font-semibold text-slate-700">
                        <Icon path={icons.shield} className="w-5 h-5 mr-3 text-red-500" />
                        {item.risk}
                    </div>
                    <p className="mt-2 pl-8 text-sm text-slate-600">{item.mitigation}</p>
                </div>
            ))}
        </div>
    </section>
);

// NUOVO: Sezione Teaser Pro
const ProTeaserSection = ({ teaser }) => (
    <section>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Sblocca il Tuo Potenziale con Pro</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 text-slate-800 rounded-xl shadow-sm text-center">
                <Icon path={icons.zap} className="w-10 h-10 mx-auto text-blue-500" />
                <h3 className="mt-2 font-bold">Analisi Competitor</h3>
                <p className="mt-1 text-sm text-slate-600">{teaser.competitor_analysis}</p>
            </div>
             <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-100 text-slate-800 rounded-xl shadow-sm text-center">
                <Icon path={icons.trendingUp} className="w-10 h-10 mx-auto text-green-500" />
                <h3 className="mt-2 font-bold">Previsione Cash Flow</h3>
                <p className="mt-1 text-sm text-slate-600">{teaser.cash_flow_forecast}</p>
            </div>
        </div>
        <div className="text-center mt-6">
            <a href="/pro" className="inline-block px-6 py-2 font-semibold bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors">
                Scopri PMIScout Pro
            </a>
        </div>
    </section>
);


// Componenti di fallback (Loading, Error, SWOT vecchio)
const LoadingState = ({ text, status }) => { /* ... codice invariato ... */ };
const ErrorState = ({ message }) => { /* ... codice invariato ... */ };
const RecommendationsSection = ({ recommendations }) => { /* ... codice invariato ... */ };
const SwotSection = ({ swot }) => { /* ... codice fallback SWOT V1 ... */ };
