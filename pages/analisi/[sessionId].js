// /pages/analisi/[sessionId].js
// VERSIONE 11.2 (FIX FINALE)
// - Corregge errori di sintassi che bloccavano il build di Vercel.
// - UI allineata per visualizzare i dati SWOT e le raccomandazioni.

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
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  award: <><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 22 12 17 17 22 15.79 13.88"></polyline></>,
  dollarSign: <><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></>,
  globe: <><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></>
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

// --- Componente Pagina Analisi ---
function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    const fetchAndCheckStatus = async () => {
      if (!sessionId || !user) return;
      try {
        const response = await fetch(`/api/get-session-complete?sessionId=${sessionId}&userId=${user.id}`);
        if (!response.ok) throw new Error('Errore nel recupero dello stato dell\'analisi.');
        const data = await response.json();

        if (data.status === 'completed' || data.status === 'failed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          
          if (data.status === 'completed' && data.analysisData) {
            const parsedData = Object.keys(data.analysisData).reduce((acc, key) => {
              try {
                acc[key] = typeof data.analysisData[key] === 'string' ? JSON.parse(data.analysisData[key]) : data.analysisData[key];
              } catch (e) { acc[key] = data.analysisData[key]; }
              return acc;
            }, {});
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

  const formatSwotPoints = (pointsArray) => {
      if (!pointsArray || pointsArray.length === 0) return "Nessuna informazione disponibile.";
      return (
          <ul className="list-disc pl-4 space-y-1 text-sm text-slate-600 leading-relaxed">
              {pointsArray.map((item, index) => <li key={index}><strong>{item.point}:</strong> {item.explanation}</li>)}
          </ul>
      );
  };

  const renderContent = () => {
    if (isLoading) return <LoadingState text="Elaborazione del report in corso..." />;
    if (error) return <ErrorState message={error} />;
    if (!analysisData) return <ErrorState message="Nessun dato di analisi trovato." />;
    
    const companyName = analysisData.raw_parsed_data?.companyName || 'Azienda Analizzata';
    const swot = analysisData.detailed_swot || {};
    const recommendations = analysisData.recommendations || [];

    return (
      <div className="space-y-8">
        <ReportHeader 
            companyName={companyName} 
            summary={analysisData.summary}
        />
        <ComparisonSection chartsData={analysisData.charts_data} />
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi Strategica SWOT</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnalysisCard title="Punti di Forza" content={formatSwotPoints(swot.strengths)} icon={icons.award} />
                <AnalysisCard title="Punti di Debolezza" content={formatSwotPoints(swot.weaknesses)} icon={icons.alertTriangle} />
                <AnalysisCard title="Opportunità" content={formatSwotPoints(swot.opportunities)} icon={icons.globe} />
                <AnalysisCard title="Minacce" content={formatSwotPoints(swot.threats)} icon={icons.shield} />
            </div>
        </section>
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Raccomandazioni dell'AI</h2>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                {recommendations.length > 0 ? (
                    <ul className="list-decimal pl-5 space-y-2 text-slate-700">
                        {recommendations.map((rec, index) => <li key={index} className="leading-relaxed">{rec}</li>)}
                    </ul>
                ) : (
                    <p className="text-slate-500">Nessuna raccomandazione specifica disponibile.</p>
                )}
            </div>
        </section>
        <div className="flex justify-center items-center space-x-4 mt-10">
            <button onClick={() => window.print()} className="flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                <Icon path={icons.print} className="w-5 h-5 mr-2" />
                Stampa Report
            </button>
        </div>
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

// --- Componenti di Stato ---
const LoadingState = ({ text }) => (
    <div className="flex items-center justify-center h-full p-10"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><h2 className="text-2xl font-bold text-slate-800">{text}</h2></div></div>
);
const ErrorState = ({ message }) => (
    <div className="flex items-center justify-center h-full p-10"><div className="text-center p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500"><Icon path={icons.alertTriangle} className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2><p className="text-slate-600 mt-2">{message}</p></div></div>
);

// --- Componenti della Dashboard ---
const ReportHeader = ({ companyName, summary }) => (
  <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
    <p className="text-sm font-medium text-blue-600">Report di Analisi Strategica</p>
    <h1 className="text-3xl font-bold text-slate-900 mt-1">{companyName}</h1>
    <p className="mt-4 text-slate-600 leading-relaxed max-w-2xl mx-auto">{summary || 'Nessun sommario disponibile.'}</p>
  </div>
);

const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'N/D';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
};

const ComparisonCard = ({ title, data, dataKey, icon, color }) => {
    if (!data || data.current_year === null || data.previous_year === null) {
        return (
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
                <h3 className="text-base font-semibold text-slate-800">{title}</h3>
                <p className="mt-4 text-slate-500">Dati non disponibili per il confronto.</p>
            </div>
        );
    }
    
    const { current_year, previous_year } = data;
    let percentageChange = 0;
    if (previous_year !== 0) {
        percentageChange = ((current_year - previous_year) / Math.abs(previous_year)) * 100;
    }
    const isPositive = percentageChange >= 0;

    if (typeof window === 'undefined' || !window.Recharts) {
        return <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200"><div className="flex items-center justify-center h-64 text-sm text-slate-500">Caricamento grafico...</div></div>;
    }
    const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } = window.Recharts;
    const chartData = [ { name: 'Anno Prec.', [dataKey]: previous_year }, { name: 'Anno Corr.', [dataKey]: current_year } ];
    const formatYAxis = (tick) => tick >= 1000000 ? `${(tick/1000000).toFixed(1)}M` : (tick >= 1000 ? `${(tick/1000).toFixed(0)}K` : tick);

    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-base font-semibold text-slate-800 flex items-center"><Icon path={icon} className="w-5 h-5 mr-2 text-slate-500" />{title}</h3>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(current_year)}</p>
                </div>
                <div className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    <p className="font-semibold text-lg">{isPositive ? '+' : ''}{percentageChange.toFixed(1)}%</p>
                    <p className="text-xs">vs anno precedente</p>
                </div>
            </div>
            <div className="h-40 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} contentStyle={{ fontSize: 12, borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '8px 12px' }} formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey={dataKey} fill={color} barSize={40} radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const ComparisonSection = ({ chartsData }) => {
    if (!chartsData) return null;
    return (
        <section>
             <h2 className="text-xl font-bold text-slate-800 mb-4">Dati a Confronto</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ComparisonCard title="Fatturato" data={chartsData.revenue_trend} dataKey="fatturato" icon={icons.dollarSign} color="#3b82f6" />
                <ComparisonCard title="Utile Netto" data={chartsData.profit_trend} dataKey="utile" icon={icons.award} color="#10b981" />
             </div>
        </section>
    );
};

const AnalysisCard = ({ title, content, icon }) => (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center text-lg font-bold text-slate-800">
            <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-slate-100">
                <Icon path={icon} className="w-5 h-5 text-slate-600" />
            </div>
            {title}
        </div>
        <div className="mt-3">{content || "Analisi non disponibile."}</div>
    </div>
);
