// /pages/analisi/[sessionId].js
// VERSIONE PUBBLICA E ROBUSTA
// - Rimossa tutta la logica di autenticazione (ProtectedPage, user, token, Outseta).
// - Risolto il problema della pagina bloccata su "pending" controllando lo stato all'avvio.
// - La pagina ora funziona in modo autonomo e pubblico.

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

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
      {/* Rimosso ProtectedPage per rendere la pagina pubblica */}
      <ReportPageLayout />
    </>
  );
}

// --- Icone ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  print: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  award: <><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 22 12 17 17 22 15.79 13.88"></polyline></>,
  dollarSign: <><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>,
};

// --- Layout della Pagina ---
function ReportPageLayout() {
  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
      {/* Sidebar Semplificata o rimossa per la versione pubblica */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <AnalisiReportPage />
      </div>
    </div>
  );
}

// --- Componente Principale della Pagina di Analisi ---
function AnalisiReportPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [analysisData, setAnalysisData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    // La logica parte solo quando il sessionId è disponibile nell'URL
    if (!sessionId) return;

    const fetchFinalData = async () => {
      // Questa chiamata non richiede più autenticazione
      const { data, error } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        setError("Impossibile caricare i risultati dell'analisi.");
      } else if (data) {
        // ... (logica di parsing JSON invariata) ...
        setAnalysisData(data);
      }
    };

    let channel;
    const checkInitialStatusAndSubscribe = async () => {
      // 1. Controlla lo stato iniziale
      const { data: initialSession, error: initialError } = await supabase
        .from('checkup_sessions')
        .select('status, error_message, session_name')
        .eq('id', sessionId)
        .single();

      if (initialError) {
        setError("Impossibile recuperare lo stato dell'analisi.");
        setStatus('failed');
        return;
      }
      
      setSessionData(initialSession);
      const initialStatus = initialSession.status;

      // 2. Se è già completato o fallito, agisci subito
      if (initialStatus === 'completed') {
        setStatus('completed');
        fetchFinalData();
        return;
      }
      if (initialStatus === 'failed') {
        setStatus('failed');
        setError(initialSession.error_message || 'Si è verificato un errore.');
        return;
      }

      // 3. Altrimenti, iscriviti per aggiornamenti futuri
      setStatus(initialStatus);
      channel = supabase
        .channel(`session-updates:${sessionId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkup_sessions', filter: `id=eq.${sessionId}`},
          (payload) => {
            const newStatus = payload.new.status;
            setStatus(newStatus);
            if (newStatus === 'completed') {
              fetchFinalData();
              if (channel) channel.unsubscribe();
            } else if (newStatus === 'failed') {
              setError(payload.new.error_message || 'Si è verificato un errore.');
              if (channel) channel.unsubscribe();
            }
          }
        ).subscribe();
    };

    checkInitialStatusAndSubscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId]); // Rimosso 'user' dalle dipendenze

  const renderContent = () => {
    if (status !== 'completed' && !error) return <LoadingState text="Elaborazione del report in corso..." status={status} />;
    if (error) return <ErrorState message={error} />;
    if (!analysisData) return <LoadingState text="Caricamento dei risultati..." status={status} />;

    const companyName = analysisData.raw_ai_response?.company_name || sessionData?.session_name || 'Azienda Analizzata';

    return (
      <div className="space-y-8">
        <ReportHeader companyName={companyName} summary={analysisData.summary} />
        <ComparisonSection chartsData={analysisData.charts_data} />
        {/* Puoi aggiungere qui le altre sezioni (KPI, SWOT, etc.) se necessario */}
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

// --- Sezione Grafici ---
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
