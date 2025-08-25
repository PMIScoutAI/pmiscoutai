// /pages/analisi/[sessionId].js
// VERSIONE 12.0: UI Strategica con Dati Strutturati
// - UI completamente ridisegnata per visualizzare il nuovo output JSON ricco di dati.
// - Cruscotto KPI con card dinamiche per ogni metrica.
// - Sezioni dedicate per Analisi SWOT, Raccomandazioni e Rischi.
// - Logica di aggiornamento in tempo reale con Supabase Realtime.

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { ProtectedPage } from '../../utils/ProtectedPage';

// --- Componente Wrapper (Punto di ingresso) ---
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
        <style>{` body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; } `}</style>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">{`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}</Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      <ProtectedPage>
        {(user) => <ReportPageLayout user={user} />}
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
  print: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  award: <><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 22 12 17 17 22 15.79 13.88"></polyline></>,
  dollarSign: <><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>,
  thumbsUp: <><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a2 2 0 0 1 3 1.88z" /></>,
  thumbsDown: <><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a2 2 0 0 1-3-1.88z" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  lightbulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 0 0-7-7z" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></>,
};

// --- Layout della Pagina ---
function ReportPageLayout({ user }) {
  // ... (Il tuo codice del layout con la sidebar rimane invariato)
  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
      {/* ... Sidebar ... */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <AnalisiReportPage user={user} />
      </div>
    </div>
  );
}

// --- Componente Principale della Pagina di Analisi ---
function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    if (!sessionId || !user) return;

    const fetchFinalData = async () => {
      const { data, error } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        setError("Impossibile caricare i risultati dell'analisi.");
      } else if (data) {
        // Il nuovo JSON ha campi che sono stringhe JSON, quindi li parsifichiamo
        const parsedData = {
          ...data,
          key_metrics: JSON.parse(data.key_metrics || '{}'),
          detailed_swot: JSON.parse(data.detailed_swot || '{}'),
          recommendations: JSON.parse(data.recommendations || '[]'),
          risk_analysis: JSON.parse(data.risk_analysis || '[]'),
          charts_data: JSON.parse(data.charts_data || '{}'),
        };
        setAnalysisData(parsedData);
      }
    };

    const channel = supabase
      .channel(`session-updates:${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkup_sessions', filter: `id=eq.${sessionId}`},
        (payload) => {
          const newStatus = payload.new.status;
          setStatus(newStatus);
          if (newStatus === 'completed') {
            fetchFinalData();
            channel.unsubscribe();
          } else if (newStatus === 'failed') {
            setError(payload.new.error_message || 'Si è verificato un errore durante l\'analisi.');
            channel.unsubscribe();
          }
        }
      ).subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessionId, user]);

  const renderContent = () => {
    if (status !== 'completed' && !error) return <LoadingState text="Elaborazione del report in corso..." status={status} />;
    if (error) return <ErrorState message={error} />;
    if (!analysisData) return <ErrorState message="Nessun dato di analisi trovato." />;

    const companyName = analysisData.raw_ai_response?.company_name || 'Azienda Analizzata';

    return (
      <div className="space-y-8">
        <ReportHeader companyName={companyName} summary={analysisData.summary} />
        <KeyMetricsSection metrics={analysisData.key_metrics} />
        <ComparisonSection chartsData={analysisData.charts_data} />
        <DetailedSwotSection swot={analysisData.detailed_swot} />
        <RecommendationsSection recommendations={analysisData.recommendations} />
        <RiskAnalysisSection risks={analysisData.risk_analysis} />
        <div className="flex justify-center"><button onClick={() => window.print()} className="flex items-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50"><Icon path={icons.print} className="w-5 h-5 mr-2" />Stampa Report</button></div>
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

// --- Componenti di Stato e UI ---
const LoadingState = ({ text, status }) => ( <div className="flex items-center justify-center h-full p-10"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><h2 className="text-2xl font-bold text-slate-800">{text}</h2>{status && <p className="mt-4 text-sm text-slate-500">Stato: <strong className="uppercase">{status}</strong></p>}</div></div> );
const ErrorState = ({ message }) => ( <div className="flex items-center justify-center h-full p-10"><div className="text-center p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500"><Icon path={icons.alertTriangle} className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2><p className="text-slate-600 mt-2">{message}</p></div></div> );
const ReportHeader = ({ companyName, summary }) => ( <div className="p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center"><p className="text-sm font-medium text-blue-600">Report di Analisi Strategica</p><h1 className="text-3xl font-bold text-slate-900 mt-1">{companyName}</h1><p className="mt-4 text-slate-600 leading-relaxed max-w-3xl mx-auto">{summary || 'Nessun sommario disponibile.'}</p></div> );

// --- Sezione KPI ---
const KeyMetricsSection = ({ metrics }) => {
  const metricDisplay = {
    roe: { label: "ROE (Return on Equity)", unit: "%" },
    roi: { label: "ROI (Return on Investment)", unit: "%" },
    debt_equity: { label: "Debt/Equity Ratio", unit: "" },
    current_ratio: { label: "Current Ratio", unit: "" },
    ebitda_margin: { label: "EBITDA Margin", unit: "%" },
  };

  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Cruscotto Indicatori Chiave (KPI)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(metrics).map(([key, data]) => {
          if (!metricDisplay[key]) return null;
          return (
            <div key={key} className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500">{metricDisplay[key].label}</p>
              {data.value !== null ? (
                <p className="text-3xl font-bold text-slate-900 mt-2">{data.value.toFixed(2)}{metricDisplay[key].unit}</p>
              ) : (
                <p className="text-3xl font-bold text-slate-400 mt-2">N/D</p>
              )}
              <p className="text-xs text-slate-500 mt-1">{data.benchmark || data.reason_if_null}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// --- Sezione Grafici ---
const ComparisonSection = ({ chartsData }) => { /* ... (Invariato dalla versione precedente) ... */ };

// --- Sezione SWOT ---
const DetailedSwotSection = ({ swot }) => {
  const swotDetails = {
    strengths: { label: 'Punti di Forza', icon: icons.thumbsUp, classes: 'border-green-500 bg-green-50 text-green-700' },
    weaknesses: { label: 'Punti di Debolezza', icon: icons.thumbsDown, classes: 'border-red-500 bg-red-50 text-red-700' },
    opportunities: { label: 'Opportunità', icon: icons.target, classes: 'border-blue-500 bg-blue-50 text-blue-700' },
    threats: { label: 'Minacce', icon: icons.alertTriangle, classes: 'border-orange-500 bg-orange-50 text-orange-700' },
  };
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi SWOT Dettagliata</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(swot).map(([key, items]) => {
          const detail = swotDetails[key];
          if (!detail || !items) return null;
          return (
            <div key={key} className={`p-6 bg-white rounded-xl shadow-sm border-l-4 ${detail.classes.split(' ')[0]}`}>
              <h3 className={`flex items-center text-lg font-bold ${detail.classes.split(' ')[2]}`}><Icon path={detail.icon} className="w-6 h-6 mr-3" />{detail.label}</h3>
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

// --- Sezione Raccomandazioni e Rischi ---
const RecommendationsSection = ({ recommendations }) => (
  <section>
    <h2 className="text-xl font-bold text-slate-800 mb-4">Raccomandazioni Strategiche</h2>
    <div className="space-y-4">
      {recommendations.map((rec, i) => (
        <div key={i} className="flex items-start p-4 bg-white rounded-xl shadow-sm border border-slate-200">
          <Icon path={icons.lightbulb} className="w-8 h-8 mr-4 text-blue-500 flex-shrink-0" />
          <p className="text-slate-700 text-sm">{rec}</p>
        </div>
      ))}
    </div>
  </section>
);

const RiskAnalysisSection = ({ risks }) => (
  <section>
    <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi dei Rischi Principali</h2>
    <div className="space-y-4">
      {risks.map((item, i) => (
        <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
          <h4 className="flex items-center font-semibold text-slate-700"><Icon path={icons.shield} className="w-5 h-5 mr-3 text-red-500" />{item.risk}</h4>
          <p className="mt-2 pl-8 text-sm text-slate-600">{item.mitigation}</p>
        </div>
      ))}
    </div>
  </section>
);
