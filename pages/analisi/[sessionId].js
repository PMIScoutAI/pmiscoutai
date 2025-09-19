// /pages/analisi/[sessionId].js
// VERSIONE 13.0 (UI Report Avanzata)
// - NUOVO: Componente `RecommendationsSection` potenziato per visualizzare raccomandazioni strutturate con priorità (Urgente, Importante, etc.) e stili dinamici.
// - NUOVO: Aggiunto il componente `HowToReadReport` con una guida rapida e benchmark per commercialisti e imprenditori.
// - AGGIORNAMENTO: Migliorata la retrocompatibilità per gestire sia il vecchio che il nuovo formato delle raccomandazioni.

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
        <style>{` body { font-family: 'Inter', sans-serif; } .printable-area { print-color-adjust: exact; -webkit-print-color-adjust: exact; } @media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
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
};

// --- Layout della Pagina Report (invariato) ---
function ReportPageLayout({ user }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
      <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out no-print ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b">
                <img src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" alt="Logo PMIScout" className="h-8 w-auto" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x40/007BFF/FFFFFF?text=PMIScout'; }} />
            </div>
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
                <nav className="flex-1 px-2 pb-4 space-y-1">
                    <Link href="/"><a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors text-slate-600 hover:bg-slate-100 hover:text-slate-900`}><Icon path={icons.dashboard} className={`w-6 h-6 mr-3 text-slate-500`} />Dashboard</a></Link>
                    <Link href="/check-ai-xbrl"><a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors bg-blue-600 text-white`}><Icon path={icons.checkup} className={`w-6 h-6 mr-3 text-white`} />Check-UP AI</a></Link>
                    <Link href="/profilo"><a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors text-slate-600 hover:bg-slate-100 hover:text-slate-900`}><Icon path={icons.profile} className={`w-6 h-6 mr-3 text-slate-500`} />Profilo</a></Link>
                </nav>
                <div className="px-2 py-4 border-t"><a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors"><Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />Supporto</a></div>
            </div>
        </div>
      </aside>
      {isSidebarOpen && (<div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />)}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden no-print">
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

  const renderContent = () => {
    if (isLoading) return <LoadingState text="Elaborazione del report in corso..." />;
    if (error) return <ErrorState message={error} />;
    if (!analysisData) return <ErrorState message="Nessun dato di analisi trovato." />;
    
    const companyName = 
      analysisData.raw_parsed_data?.companyName || 
      analysisData.raw_ai_response?.company_name || 
      'Azienda Analizzata';

    return (
      <div className="space-y-8 printable-area">
        <ReportHeader 
            companyName={companyName} 
            summary={analysisData.summary}
        />
        
        <ScoreSection
          healthScore={analysisData.raw_ai_response?.health_score}
          healthRating={analysisData.raw_ai_response?.health_score_rating}
          zScore={analysisData.raw_ai_response?.z_score}
          bancabilitaScore={analysisData.raw_ai_response?.bancabilita_score}
        />
        
        <ComparisonSectionWithBars chartsData={analysisData.charts_data} />
        
        <KeyMetricsSection keyMetrics={analysisData.key_metrics} />
        <SwotAnalysisSection swotData={analysisData.detailed_swot} />

        <RecommendationsSection 
          recommendations={analysisData.recommendations}
          rawAiResponse={analysisData.raw_ai_response}
        />

        <HowToReadReport />

        <div className="flex justify-center items-center space-x-4 mt-10 no-print">
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

// --- Componenti di Stato (invariati) ---
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

const ScoreGauge = ({ score, colorClass }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        <circle
          className="text-slate-200"
          strokeWidth="10"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="60"
          cy="60"
        />
        <circle
          className={`${colorClass} transition-all duration-1000 ease-out`}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="60"
          cy="60"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-3xl font-bold ${colorClass}`}>{score}</span>
      </div>
    </div>
  );
};

const ScoreSection = ({ healthScore, healthRating, zScore, bancabilitaScore }) => {
  const getHealthScoreColor = (score) => {
    if (score >= 80) return { text: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 60) return { text: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 40) return { text: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: 'text-red-600', bg: 'bg-red-100' };
  };

  const getDynamicScoreColor = (scoreObj) => {
    if (scoreObj?.color === 'green') return { text: 'text-green-600', bg: 'bg-green-100' };
    if (scoreObj?.color === 'yellow') return { text: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: 'text-red-600', bg: 'bg-red-100' };
  };

  const healthColor = getHealthScoreColor(healthScore);
  const zScoreColor = getDynamicScoreColor(zScore);
  const bancabilitaColor = getDynamicScoreColor(bancabilitaScore);

  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Score di Valutazione</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Score */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
          <h3 className="font-bold text-slate-800">Health Score</h3>
          <p className="text-sm text-slate-500 mb-4">Salute Generale</p>
          {healthScore !== null && healthScore !== undefined ? (
            <>
              <ScoreGauge score={healthScore} colorClass={healthColor.text} />
              <p className={`mt-4 text-sm font-semibold px-3 py-1 inline-block rounded-full ${healthColor.bg} ${healthColor.text}`}>
                {healthRating || 'N/D'}
              </p>
            </>
          ) : <p className="text-slate-500 pt-10">Dato non disponibile</p>}
        </div>

        {/* Z-Score */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
          <h3 className="font-bold text-slate-800">Z-Score</h3>
          <p className="text-sm text-slate-500 mb-4">Rischio di Default</p>
          {zScore?.value !== null && zScore?.value !== undefined ? (
            <>
              <div className="py-8">
                <p className={`text-5xl font-bold ${zScoreColor.text}`}>{zScore.value.toFixed(2)}</p>
              </div>
              <p className={`mt-4 text-sm font-semibold px-3 py-1 inline-block rounded-full ${zScoreColor.bg} ${zScoreColor.text}`}>
                {zScore.rating || 'N/D'}
              </p>
            </>
          ) : <p className="text-slate-500 pt-10">Dato non disponibile</p>}
        </div>

        {/* Bancabilità */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
          <h3 className="font-bold text-slate-800">Bancabilità</h3>
          <p className="text-sm text-slate-500 mb-4">Accesso al Credito</p>
           {bancabilitaScore?.value !== null && bancabilitaScore?.value !== undefined ? (
            <>
              <div className="py-8">
                 <p className={`text-5xl font-bold ${bancabilitaColor.text}`}>{bancabilitaScore.value}</p>
              </div>
              <p className={`mt-4 text-sm font-semibold px-3 py-1 inline-block rounded-full ${bancabilitaColor.bg} ${bancabilitaColor.text}`}>
                {bancabilitaScore.rating || 'N/D'}
              </p>
            </>
          ) : <p className="text-slate-500 pt-10">Dato non disponibile</p>}
        </div>
      </div>
    </section>
  );
};


const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'N/D';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
};

const ComparisonSectionWithBars = ({ chartsData }) => {
    if (!chartsData) return null;
    
    const { revenue_trend, profit_trend } = chartsData;
    
    const ProgressBar = ({ current, previous, title, color = "bg-blue-500" }) => {
        if (current === null || current === undefined || previous === null || previous === undefined) {
             return (
                <div className="space-y-3">
                    <h4 className="font-semibold text-slate-800">{title}</h4>
                    <p className="text-sm text-slate-500">Dati non sufficienti per il confronto.</p>
                </div>
             );
        }
        
        const maxValue = Math.max(Math.abs(current), Math.abs(previous));
        const currentPercent = maxValue > 0 ? (Math.abs(current) / maxValue) * 100 : 0;
        const previousPercent = maxValue > 0 ? (Math.abs(previous) / maxValue) * 100 : 0;
        
        return (
            <div className="space-y-3">
                <h4 className="font-semibold text-slate-800">{title}</h4>
                
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Anno Corrente</span>
                        <span className="font-semibold">{formatCurrency(current)}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                        <div 
                            className={`h-3 rounded-full transition-all duration-1000 ${current < 0 ? 'bg-red-500' : color}`}
                            style={{ width: `${currentPercent}%` }}
                        ></div>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Anno Precedente</span>
                        <span className="font-semibold">{formatCurrency(previous)}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                        <div 
                            className={`h-3 rounded-full transition-all duration-1000 ${previous < 0 ? 'bg-red-400' : 'bg-slate-400'}`}
                            style={{ width: `${previousPercent}%` }}
                        ></div>
                    </div>
                </div>
                
                <div className="text-center pt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        current >= previous ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                        {current >= previous ? '↗️' : '↘️'} 
                        {previous !== 0 ? `${((current - previous) / Math.abs(previous) * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                </div>
            </div>
        );
    };
    
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Dati a Confronto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                    <ProgressBar 
                        current={revenue_trend?.current_year} 
                        previous={revenue_trend?.previous_year}
                        title="Fatturato"
                        color="bg-blue-500"
                    />
                </div>
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                    <ProgressBar 
                        current={profit_trend?.current_year} 
                        previous={profit_trend?.previous_year}
                        title="Utile Netto"
                        color="bg-green-500"
                    />
                </div>
            </div>
        </section>
    );
};

const KeyMetricsSection = ({ keyMetrics }) => {
  if (!keyMetrics) return null;
  const metrics = typeof keyMetrics === 'string' ? JSON.parse(keyMetrics) : keyMetrics;
  
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Indicatori Chiave</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(metrics).map(([key, metric]) => (
          <div key={key} className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <h4 className="font-semibold text-slate-700 capitalize">
              {key.replace(/_/g, ' ')}
            </h4>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {metric.value !== null && metric.value !== undefined ? (typeof metric.value === 'number' ? metric.value.toFixed(2) : metric.value) : 'N/D'}
              <span className="text-lg font-medium text-slate-500 ml-1">{key.includes('ratio') || typeof metric.value !== 'number' ? '' : '%'}</span>
            </p>
            <p className="text-xs text-slate-500 mt-2">{metric.benchmark}</p>
            {metric.reason_if_null && (
              <p className="text-xs text-amber-600 mt-1">{metric.reason_if_null}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

const SwotAnalysisSection = ({ swotData }) => {
  if (!swotData) return null;
  const swot = typeof swotData === 'string' ? JSON.parse(swotData) : swotData;
  
  const swotCards = [
    { title: 'Punti di Forza', data: swot.strengths, color: 'bg-green-50 border-green-200', icon: '💪' },
    { title: 'Punti di Debolezza', data: swot.weaknesses, color: 'bg-red-50 border-red-200', icon: '⚠️' },
    { title: 'Opportunità', data: swot.opportunities, color: 'bg-blue-50 border-blue-200', icon: '🚀' },
    { title: 'Minacce', data: swot.threats, color: 'bg-yellow-50 border-yellow-200', icon: '⚡' }
  ];
  
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi SWOT</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {swotCards.map(({ title, data, color, icon }) => (
          <div key={title} className={`p-6 rounded-xl shadow-sm border ${color}`}>
            <h3 className="text-lg font-bold text-slate-800 flex items-center mb-3">
              <span className="mr-3 text-xl">{icon}</span>
              {title}
            </h3>
            <div className="space-y-3">
              {data?.length > 0 ? data.map((item, index) => (
                <div key={index}>
                  <p className="font-semibold text-slate-800">{item.point}</p>
                  <p className="text-sm text-slate-600 mt-1">{item.explanation}</p>
                </div>
              )) : <p className="text-sm text-slate-500">Nessun dato disponibile.</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const RecommendationsSection = ({ recommendations, rawAiResponse }) => {
  // Priorità alle strategic_recommendations se disponibili
  const strategicRecs = rawAiResponse?.strategic_recommendations || [];
  const displayRecs = strategicRecs.length > 0 ? strategicRecs : recommendations;

  if (!displayRecs || displayRecs.length === 0) return null;

  // Funzione per ottenere gli stili in base alla priorità
  const getPriorityStyle = (priority) => {
    const styles = {
      'URGENTE': {
        border: 'border-red-500 bg-red-50',
        badge: 'bg-red-100 text-red-800',
        dot: 'bg-red-500'
      },
      'IMPORTANTE': {
        border: 'border-yellow-500 bg-yellow-50',
        badge: 'bg-yellow-100 text-yellow-800',
        dot: 'bg-yellow-500'
      },
      'OPPORTUNITÀ': {
        border: 'border-green-500 bg-green-50',
        badge: 'bg-green-100 text-green-800',
        dot: 'bg-green-500'
      },
      'MONITORAGGIO': {
        border: 'border-blue-500 bg-blue-50',
        badge: 'bg-blue-100 text-blue-800',
        dot: 'bg-blue-500'
      }
    };
    return styles[priority] || styles['IMPORTANTE'];
  };

  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Raccomandazioni Strategiche</h2>
      
      <div className="space-y-4">
        {displayRecs.map((rec, index) => {
          // Gestione retrocompatibilità: se è una stringa (vecchio formato)
          if (typeof rec === 'string') {
            return (
              <div key={index} className="flex items-start bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                <p className="text-slate-700">{rec}</p>
              </div>
            );
          }
          
          // Nuovo formato strutturato
          const style = getPriorityStyle(rec.priority);
          
          return (
            <div key={index} className={`p-5 rounded-xl shadow-sm border-l-4 ${style.border}`}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-slate-800 flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${style.dot}`}></span>
                  {rec.title}
                  {rec.indicator && (
                    <span className="ml-2 text-sm font-normal text-slate-600">({rec.indicator})</span>
                  )}
                </h3>
                <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${style.badge}`}>
                  {rec.priority}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <p className="text-slate-600">
                  <strong className="text-slate-700">Situazione:</strong> {rec.situation}
                </p>
                {rec.action && (
                  <p className="text-slate-600">
                    <strong className="text-slate-700">Azione:</strong> {rec.action}
                  </p>
                )}
                {rec.target && (
                  <p className="text-slate-600">
                    <strong className="text-blue-700">Obiettivo:</strong> {rec.target}
                  </p>
                )}
                {rec.impact && (
                  <p className="text-slate-600">
                    <strong className="text-green-700">Impatto:</strong> {rec.impact}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const HowToReadReport = () => (
  <section className="mt-8 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
    <div className="flex items-center mb-4">
      <svg className="w-5 h-5 text-slate-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <h2 className="text-lg font-bold text-slate-800">Come Leggere Questo Report</h2>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
      {/* COLONNA SINISTRA */}
      <div className="space-y-4">
        <div className="bg-white p-3 rounded-lg">
          <h3 className="font-semibold text-slate-700 mb-2 flex items-center">
            <span className="text-lg mr-2">🎯</span>
            Score di Valutazione
          </h3>
          <ul className="space-y-1 text-slate-600 text-xs leading-relaxed">
            <li><strong>Health Score:</strong> 80+ Eccellente | 60-79 Buono | 40-59 Sufficiente | &lt;40 Critico</li>
            <li><strong>Z-Score:</strong> &gt;2.99 Sicuro | 1.8-2.99 Attenzione | &lt;1.8 Rischio</li>
            <li><strong>Bancabilità:</strong> &gt;80 Alta | 60-80 Media | &lt;60 Bassa</li>
          </ul>
        </div>
        
        <div className="bg-white p-3 rounded-lg">
          <h3 className="font-semibold text-slate-700 mb-2 flex items-center">
            <span className="text-lg mr-2">📊</span>
            Indicatori Principali
          </h3>
          <ul className="space-y-1 text-slate-600 text-xs leading-relaxed">
            <li><strong>ROE:</strong> &gt;15% ottimo | <strong>ROI:</strong> &gt;10% efficiente</li>
            <li><strong>EBITDA Margin:</strong> &gt;20% alta marginalità</li>
            <li><strong>Current Ratio:</strong> &gt;1.5 liquidità solida</li>
            <li><strong>Debt/Equity:</strong> &lt;1.5 equilibrato</li>
          </ul>
        </div>
      </div>
      
      {/* COLONNA DESTRA */}
      <div className="space-y-4">
        <div className="bg-white p-3 rounded-lg">
          <h3 className="font-semibold text-slate-700 mb-2 flex items-center">
            <span className="text-lg mr-2">💼</span>
            Per il Commercialista
          </h3>
          <ul className="space-y-1 text-slate-600 text-xs leading-relaxed">
            <li>• Concentrati sulle raccomandazioni <strong className="text-red-600">URGENTI</strong></li>
            <li>• Usa gli score per prioritizzare gli interventi</li>
            <li>• Condividi le sezioni critiche con il cliente</li>
          </ul>
        </div>
        
        <div className="bg-white p-3 rounded-lg">
          <h3 className="font-semibold text-slate-700 mb-2 flex items-center">
            <span className="text-lg mr-2">🏢</span>
            Per l'Imprenditore
          </h3>
          <ul className="space-y-1 text-slate-600 text-xs leading-relaxed">
            <li>• Focus sui trend (↗️↘️) e sezioni colorate</li>
            <li>• Le azioni <strong>URGENTI</strong> vanno fatte subito</li>
            <li>• Confronta i tuoi numeri con i benchmark</li>
          </ul>
        </div>
        
        <div className="bg-slate-100 p-3 rounded-lg border border-slate-300">
          <p className="text-xs text-slate-600 italic">
            <strong>Disclaimer:</strong> Questo report è uno strumento di analisi. Per decisioni strategiche importanti, consulta sempre il tuo commercialista di fiducia.
          </p>
        </div>
      </div>
    </div>
  </section>
);
