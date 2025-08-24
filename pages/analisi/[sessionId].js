// /pages/analisi/[sessionId].js
// VERSIONE 8.0: Implementazione della nuova Dashboard Finanziaria
// - Riorganizzazione della UI secondo la proposta "financial-dashboard-proposal".
// - Aggiunta card "Crescita Fatturato" in primo piano.
// - Creazione di una griglia dinamica per i KPI.
// - Aggiunta sezione "Avvisi e Qualità Dati".
// - Miglioramenti grafici e di leggibilità.

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { ProtectedPage } from '../../utils/ProtectedPage';

// --- Componente Wrapper (invariato) ---
export default function AnalisiReportPageWrapper() {
  return (
    <>
      <Head>
        <title>Report Analisi AI - PMIScout</title>
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
  checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></>
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
      {isSidebarOpen && (<div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />)}
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

// --- Componente Pagina Analisi (Logica di fetch invariata, rendering AGGIORNATO) ---
function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [sessionData, setSessionData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    const fetchAndCheckStatus = async () => {
      if (!sessionId || !user) return;
      try {
        console.log('🔄 Polling: controllo stato sessione...');
        const response = await fetch(`/api/get-session-complete?sessionId=${sessionId}&userId=${user.id}`);
        if (!response.ok) throw new Error('Errore nel recupero dello stato dell\'analisi.');
        const data = await response.json();
        setSessionData(data);

        if (data.status === 'completed' || data.status === 'failed') {
          console.log(`✅ Polling terminato. Stato finale: ${data.status}`);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          
          if (data.status === 'completed' && data.analysisData) {
            // Parse JSON strings into objects
            const parsedData = {
              ...data.analysisData,
              key_metrics: typeof data.analysisData.key_metrics === 'string' ? JSON.parse(data.analysisData.key_metrics) : data.analysisData.key_metrics,
              charts_data: typeof data.analysisData.charts_data === 'string' ? JSON.parse(data.analysisData.charts_data) : data.analysisData.charts_data,
              detailed_swot: typeof data.analysisData.detailed_swot === 'string' ? JSON.parse(data.analysisData.detailed_swot) : data.analysisData.detailed_swot,
              recommendations: typeof data.analysisData.recommendations === 'string' ? JSON.parse(data.analysisData.recommendations) : data.analysisData.recommendations,
              risk_analysis: typeof data.analysisData.risk_analysis === 'string' ? JSON.parse(data.analysisData.risk_analysis) : data.analysisData.risk_analysis,
              pro_features_teaser: typeof data.analysisData.pro_features_teaser === 'string' ? JSON.parse(data.analysisData.pro_features_teaser) : data.analysisData.pro_features_teaser,
              raw_ai_response: typeof data.analysisData.raw_ai_response === 'string' ? JSON.parse(data.analysisData.raw_ai_response) : data.analysisData.raw_ai_response,
            };
            setAnalysisData(parsedData);
          } else if (data.status === 'failed') {
            setError(data.error_message || 'Si è verificato un errore durante l\'analisi.');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('❌ Errore durante il polling:', err);
        setError(err.message);
        setIsLoading(false);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      }
    };

    if (sessionId && user) {
      fetchAndCheckStatus();
      pollingIntervalRef.current = setInterval(fetchAndCheckStatus, 3000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [sessionId, user]);  

  const renderContent = () => {
    if (isLoading) return <LoadingState text="Caricamento del report in corso..." />;
    if (error) return <ErrorState message={error} />;
    if (!sessionData) return <ErrorState message="Nessun dato trovato per questa sessione." />;
    
    if (sessionData.status !== 'completed' && sessionData.status !== 'failed') {
        return <LoadingState text="L'analisi è in coda di elaborazione..." status={sessionData.status} />;
    }
    
    if (!analysisData) return <ErrorState message="Analisi completata, ma non è stato possibile recuperare i risultati." />;

    const companyName = analysisData.raw_ai_response?.company_name || sessionData.companies?.company_name;
    
    // Estrai avvisi e dati mancanti
    const warnings = analysisData.raw_ai_response?.warnings || [];
    const missingDataReasons = Object.values(analysisData.key_metrics || {})
      .map(metric => metric.reason_if_null)
      .filter(Boolean); // Filtra i valori null/undefined
    const allWarnings = [...new Set([...warnings, ...missingDataReasons])]; // Unisci e rimuovi duplicati

    return (
      <div className="space-y-8">
        <ReportHeader 
            companyName={companyName} 
            healthScore={analysisData.health_score} 
            summary={analysisData.summary}
            chartsData={analysisData.charts_data}
        />
        
        {allWarnings.length > 0 && <DataQualitySection warnings={allWarnings} />}
        
        <KeyMetricsSection metrics={analysisData.key_metrics} />

        <TrendChartsSection chartsData={analysisData.charts_data} />
        
        {analysisData.detailed_swot && <DetailedSwotSection swot={analysisData.detailed_swot} />}
        
        {analysisData.risk_analysis && analysisData.risk_analysis.length > 0 && <RiskAnalysisSection risks={analysisData.risk_analysis} />}

        {analysisData.recommendations?.length > 0 && <RecommendationsSection recommendations={analysisData.recommendations} />}
        
        <div className="flex justify-center items-center space-x-4 mt-10">
            <button onClick={() => window.print()} className="flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                <Icon path={icons.print} className="w-5 h-5 mr-2" />
                Stampa Report
            </button>
        </div>

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

// --- Componenti di Stato (invariati) ---
const LoadingState = ({ text, status }) => (
    <div className="flex items-center justify-center h-full p-10"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><h2 className="text-2xl font-bold text-slate-800">{text}</h2>{status && <p className="text-sm text-slate-500 mt-4">Stato attuale: <strong className="uppercase">{status}</strong></p>}</div></div>
);
const ErrorState = ({ message }) => (
    <div className="flex items-center justify-center h-full p-10"><div className="text-center p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500"><Icon path={icons.alertTriangle} className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2><p className="text-slate-600 mt-2">{message}</p></div></div>
);

// --- NUOVI Componenti della Dashboard ---

const HealthScoreGauge = ({ score }) => {
    if (score === null || score === undefined) {
        return (
            <div className="flex flex-col items-center justify-center w-40 h-40 bg-slate-50 rounded-full border">
                <Icon path={icons.alertTriangle} className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 text-center">Dati non sufficienti</p>
            </div>
        );
    }
    const getScoreColor = (s) => {
        if (s >= 75) return 'text-green-500';
        if (s >= 50) return 'text-yellow-500';
        return 'text-red-500';
    };
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (score / 100) * circumference;
    return (
        <div className="relative w-40 h-40">
            <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle className="text-slate-200" strokeWidth="10" stroke="currentColor" fill="transparent" r="52" cx="60" cy="60" />
                <circle className={`${getScoreColor(score)} transition-all duration-1000 ease-out`} strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r="52" cx="60" cy="60" transform="rotate(-90 60 60)" />
            </svg>
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${getScoreColor(score)}`}>
                <span className="text-4xl font-bold">{score}</span>
                <span className="text-xs font-medium text-slate-500">/ 100</span>
            </div>
        </div>
    );
};

const RevenueGrowthCard = ({ chartsData }) => {
    const { current_year: current, previous_year: previous } = chartsData?.revenue_trend || {};
    if (current === null || previous === null || previous === 0) {
        return null; // Non mostrare la card se i dati non sono validi
    }
    const growth = ((current - previous) / Math.abs(previous)) * 100;
    const isPositive = growth >= 0;
    const colorClasses = isPositive ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';

    return (
        <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex-1">
            <p className="text-sm font-medium text-slate-500">Crescita Fatturato</p>
            <div className={`flex items-center gap-2 mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <Icon path={icons.trendingUp} className="w-7 h-7" />
                <p className="text-3xl font-bold">{growth.toFixed(1)}%</p>
            </div>
        </div>
    );
};

const ReportHeader = ({ companyName, healthScore, summary, chartsData }) => (
  <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
    <div className="flex flex-col md:flex-row items-start justify-between gap-6">
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-600">Report di Analisi AI</p>
        <h1 className="text-3xl font-bold text-slate-900 mt-1">{companyName}</h1>
        <p className="mt-4 text-slate-600 leading-relaxed max-w-prose">{summary || 'Nessun sommario disponibile.'}</p>
      </div>
      <div className="flex flex-col sm:flex-row md:flex-col gap-4 w-full md:w-auto">
        <div className="flex-shrink-0 mx-auto md:mx-0">
          <HealthScoreGauge score={healthScore} />
        </div>
        <RevenueGrowthCard chartsData={chartsData} />
      </div>
    </div>
  </div>
);

const DataQualitySection = ({ warnings }) => (
    <section className="p-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
        <div className="flex">
            <div className="flex-shrink-0">
                <Icon path={icons.alertTriangle} className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Avvisi sulla qualità dei dati</h3>
                <div className="mt-2 text-sm text-yellow-700">
                    <ul className="list-disc space-y-1 pl-5">
                        {warnings.map((warning, i) => <li key={i}>{warning}</li>)}
                    </ul>
                </div>
            </div>
        </div>
    </section>
);

const KeyMetricsSection = ({ metrics }) => {
    const metricDetails = {
        roe: { label: 'ROE', icon: icons.award },
        roi: { label: 'ROI', icon: icons.target },
        debt_equity: { label: 'Debt/Equity', icon: icons.shield },
        current_ratio: { label: 'Current Ratio', icon: icons.dollarSign },
        ebitda_margin: { label: 'EBITDA Margin', icon: icons.zap },
    };

    if (!metrics || Object.keys(metrics).length === 0) return null;

    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Indicatori Chiave (KPIs)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(metrics).map(([key, metric]) => {
                    const detail = metricDetails[key];
                    if (!detail) return null;

                    const isOk = metric.value !== null;
                    const valueDisplay = isOk ? (key === 'roe' || key === 'roi' || key === 'ebitda_margin' ? `${metric.value.toFixed(2)}%` : metric.value.toFixed(2)) : 'N/D';
                    
                    return (
                        <div key={key} className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                            <div className="flex items-center text-sm font-medium text-slate-500">
                                <Icon path={detail.icon} className="w-4 h-4 mr-2" />
                                {detail.label}
                            </div>
                            <p className={`text-3xl font-bold mt-2 ${isOk ? 'text-slate-900' : 'text-slate-400'}`}>{valueDisplay}</p>
                            <p className="text-xs text-slate-400 mt-1 truncate" title={metric.benchmark}>{metric.benchmark}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const TrendChartsSection = ({ chartsData }) => {
    if (!chartsData) return null;
    const { revenue_trend, profit_trend } = chartsData;

    return (
        <section>
             <h2 className="text-xl font-bold text-slate-800 mb-4">Andamento Economico</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {revenue_trend && <TrendChart data={revenue_trend} dataKey="val" name="Fatturato" color="#3b82f6" title="Andamento Fatturato (€)" />}
                {profit_trend && <TrendChart data={profit_trend} dataKey="val" name="Utile" color="#10b981" title="Andamento Utile (€)" />}
             </div>
        </section>
    );
};

const TrendChart = ({ data, dataKey, name, color, title }) => {
    if (typeof window === 'undefined' || !window.Recharts) {
        return <div className="flex items-center justify-center h-64 text-sm text-slate-500">Caricamento grafico...</div>;
    }
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = window.Recharts;
    const chartData = [
        { name: 'Anno Prec.', [dataKey]: data.previous_year || 0 },
        { name: 'Anno Corr.', [dataKey]: data.current_year || 0 },
    ];
    const formatYAxis = (tick) => tick >= 1000000 ? `${(tick/1000000).toFixed(1)}M` : (tick >= 1000 ? `${(tick/1000).toFixed(0)}K` : tick);
    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} contentStyle={{ fontSize: 12, borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', border: '1px solid #e2e8f0', padding: '8px 12px' }} formatter={(value) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value)} />
                        <Bar dataKey={dataKey} name={name} fill={color} barSize={40} radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// --- Sezioni Esistenti (Stile Aggiornato) ---
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

const DetailedSwotSection = ({ swot }) => {
    const swotDetails = {
        strengths: { label: 'Punti di Forza', icon: icons.thumbsUp, classes: 'border-green-500 bg-green-50 text-green-700' },
        weaknesses: { label: 'Punti di Debolezza', icon: icons.thumbsDown, classes: 'border-red-500 bg-red-50 text-red-700' },
        opportunities: { label: 'Opportunità', icon: icons.target, classes: 'border-blue-500 bg-blue-50 text-blue-700' },
        threats: { label: 'Minacce', icon: icons.alertTriangle, classes: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
    };
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi SWOT Dettagliata</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {swot && Object.keys(swot).map(key => {
                    const detail = swotDetails[key];
                    if (!detail || !swot[key] || swot[key].length === 0) return null;
                    return (
                        <div key={key} className={`p-6 bg-white rounded-xl shadow-sm border-t-4 ${detail.classes.split(' ')[0]}`}>
                            <div className="flex items-center text-lg font-bold text-slate-800">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${detail.classes.split(' ')[1]}`}>
                                    <Icon path={detail.icon} className={`w-5 h-5 ${detail.classes.split(' ')[2]}`} />
                                </div>
                                {detail.label}
                            </div>
                            <div className="mt-4 space-y-3 text-sm">
                                {swot[key].map((item, idx) => (
                                    <div key={idx}>
                                        <p className="font-semibold text-slate-700">{item.point}</p>
                                        <p className="text-slate-500">{item.explanation}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

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

const ProTeaserSection = ({ teaser }) => (
    <section className="mt-12">
        <div className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-lg text-center">
             <Icon path={icons.zap} className="w-10 h-10 mx-auto text-white opacity-80" />
             <h2 className="text-2xl font-bold mt-4">Sblocca il Tuo Potenziale con Pro</h2>
             <p className="mt-2 max-w-2xl mx-auto opacity-90">Ottieni analisi dei competitor, previsioni di cash flow e scenari futuri per prendere decisioni ancora più strategiche.</p>
             <div className="text-center mt-6">
                <a href="/pro" className="inline-block px-8 py-3 font-semibold bg-white text-blue-600 rounded-lg shadow-md hover:bg-slate-100 transition-transform transform hover:scale-105">
                    Scopri PMIScout Pro
                </a>
            </div>
        </div>
    </section>
);
