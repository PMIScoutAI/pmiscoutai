// /pages/analisi-hd/[sessionId].js
// VERSIONE POTENZIATA: Mostra i nuovi dati, inclusi indici e grafici.

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
        <title>Report Analisi HD - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        {/* ✅ NUOVO: Aggiunta la libreria per i grafici */}
        <script src="https://unpkg.com/recharts/umd/Recharts.min.js"></script>
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
  thumbsUp: <><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a2 2 0 0 1 3 1.88z" /></>,
  thumbsDown: <><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a2 2 0 0 1-3-1.88z" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  lightbulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 0 0-7-7z" /></>,
  trendingUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  award: <><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 22 12 17 17 22 15.79 13.88"></polyline></>,
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
    indexing: 'Fase 1: Indicizzazione del documento in corso... Questa operazione potrebbe richiedere qualche minuto.',
    processing: 'Fase 2: Estrazione e analisi dei dati in corso... Siamo quasi alla fine.',
    completed: 'Analisi completata con successo!',
    failed: 'Si è verificato un errore durante l\'analisi.'
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
    return <ErrorState message={sessionData.error_message || "Non è stato possibile caricare i risultati dell'analisi."} />;
  };

  return (<main className="relative flex-1 overflow-y-auto focus:outline-none"><div className="py-8 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">{renderContent()}</div></main>);
}

// --- Componenti di Visualizzazione ---
const LoadingState = ({ text, status }) => (<div className="flex items-center justify-center h-full p-10"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div><h2 className="text-2xl font-bold text-slate-800">{text}</h2>{status && <p className="text-sm text-slate-500 mt-4">Stato attuale: <strong className="uppercase font-semibold text-purple-700">{status}</strong></p>}</div></div>);
const ErrorState = ({ message }) => (<div className="text-center p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500"><Icon path={icons.alertTriangle} className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2><p className="text-slate-600 mt-2">{message}</p></div>);

const ReportView = ({ result, companyName }) => {
    const { health_score, summary, recommendations, detailed_swot, key_metrics, charts_data } = result;
    return (
        <div className="space-y-8">
            <ReportHeader companyName={companyName} healthScore={health_score} summary={summary} />
            {key_metrics && <KeyMetricsSection metrics={key_metrics} />}
            {charts_data && <ChartsSection chartsData={charts_data} />}
            {detailed_swot && <SwotSection swot={detailed_swot} />}
            {recommendations && <RecommendationsSection recommendations={recommendations} />}
        </div>
    );
};

const ReportHeader = ({ companyName, healthScore, summary }) => (
    <div className="p-8 bg-white rounded-xl shadow-md border border-slate-200">
        <p className="text-sm font-medium text-purple-600">Report di Analisi AI HD</p>
        <h1 className="text-3xl font-bold text-slate-900 mt-1">{companyName || 'Azienda'}</h1>
        <p className="mt-4 text-slate-600 leading-relaxed">{summary || 'Nessun sommario disponibile.'}</p>
        <div className="mt-6 p-4 bg-purple-50 rounded-lg">
            <span className="text-lg font-bold text-slate-800">Health Score: </span>
            <span className="text-2xl font-bold text-purple-700">{healthScore ?? 'N/A'} / 100</span>
        </div>
    </div>
);

const KeyMetricsSection = ({ metrics }) => {
    const metricIcons = {
        crescita_fatturato_perc: { icon: icons.trendingUp, color: 'green' },
        roe: { icon: icons.award, color: 'blue' },
    };
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Indicatori Chiave</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(metrics).map(([key, metric]) => {
                    const iconInfo = metricIcons[key] || { icon: icons.zap, color: 'gray' };
                    return (
                        <div key={key} className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${iconInfo.color}-100`}>
                                <Icon path={iconInfo.icon} className={`w-6 h-6 text-${iconInfo.color}-600`} />
                            </div>
                            <p className="text-sm text-slate-500 mt-4">{metric.label}</p>
                            <p className="text-3xl font-bold text-slate-900">{metric.value !== null ? `${metric.value.toFixed(2)}%` : 'N/A'}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const ChartsSection = ({ chartsData }) => {
    if (!chartsData?.revenue_trend) return null;
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Andamento del Fatturato</h2>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                <TrendChart data={chartsData.revenue_trend} />
            </div>
        </section>
    );
};

const TrendChart = ({ data }) => {
    if (typeof window === 'undefined' || !window.Recharts) {
        return <div className="flex items-center justify-center h-64 text-sm text-slate-500">Caricamento grafico...</div>;
    }
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = window.Recharts;
    
    const chartData = [
        { name: 'Anno Prec.', Fatturato: data.previous_year || 0 },
        { name: 'Anno Corr.', Fatturato: data.current_year || 0 },
    ];

    const formatYAxis = (tick) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(tick);

    return (
        <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} />
                    <Tooltip 
                        cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                        formatter={(value) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)}
                        contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0' }} 
                    />
                    <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
                    <Bar dataKey="Fatturato" fill="#8b5cf6" barSize={50} radius={[8, 8, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
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
            <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi SWOT Dettagliata</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(swotDetails).map(([key, detail]) => (
                    <div key={key} className={`p-6 bg-white rounded-xl shadow-sm border-l-4 border-${detail.color}-500`}>
                        <div className={`flex items-center text-lg font-bold text-${detail.color}-600`}><Icon path={detail.icon} className="w-6 h-6 mr-3" />{detail.label}</div>
                        <ul className="mt-4 space-y-2 list-disc list-inside text-slate-600 text-sm">{swot[key]?.length > 0 ? swot[key].map((item, idx) => <li key={idx}>{item}</li>) : <li>Nessun dato disponibile.</li>}</ul>
                    </div>
                ))}
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
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-4"><Icon path={icons.lightbulb} className="w-5 h-5 text-purple-600" /></div>
                    <p className="text-slate-700 text-sm">{rec}</p>
                </div>
            ))}
        </div>
    </section>
);
