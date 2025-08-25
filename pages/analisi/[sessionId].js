// /pages/analisi/[sessionId].js
// VERSIONE PUBBLICA E ROBUSTA + PARSING AUTOMATICO DEI DATI

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

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
      <ReportPageLayout />
    </>
  );
}

const safeParse = (str) => {
  if (!str || typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
};

function ReportPageLayout() {
  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <AnalisiReportPage />
      </div>
    </div>
  );
}

function AnalisiReportPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [analysisData, setAnalysisData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    if (!sessionId) return;

    const fetchFinalData = async () => {
      const { data, error } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error || !data) {
        setError("Impossibile caricare i risultati dell'analisi.");
        return;
      }

      const parsedData = {
        ...data,
        raw_ai_response: safeParse(data.raw_ai_response),
        charts_data: safeParse(data.charts_data),
        key_metrics: safeParse(data.key_metrics),
        raw_parsed_data: safeParse(data.raw_parsed_data),
        swot: safeParse(data.swot),
        detailed_swot: safeParse(data.detailed_swot),
        recommendations: safeParse(data.recommendations),
        risk_analysis: safeParse(data.risk_analysis),
        pro_features_teaser: safeParse(data.pro_features_teaser),
      };

      setAnalysisData(parsedData);
    };

    let channel;
    const checkInitialStatusAndSubscribe = async () => {
      const { data: initialSession, error: initialError } = await supabase
        .from('checkup_sessions')
        .select('status, error_message, session_name')
        .eq('id', sessionId)
        .single();

      console.log("📥 Stato iniziale recuperato:", initialSession);

      if (initialError) {
        setError("Impossibile recuperare lo stato dell'analisi.");
        setStatus('failed');
        return;
      }

      setSessionData(initialSession);
      const initialStatus = initialSession.status;

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

      setStatus(initialStatus);
      channel = supabase
        .channel(`session-updates:${sessionId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkup_sessions', filter: `id=eq.${sessionId}` },
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
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [sessionId]);

  const renderContent = () => {
    if (status !== 'completed' && !error) return <LoadingState text="Elaborazione del report in corso..." status={status} />;
    if (error) return <ErrorState message={error} />;
    if (!analysisData) return <LoadingState text="Caricamento dei risultati..." status={status} />;

    const companyName = analysisData.raw_ai_response?.company_name || sessionData?.session_name || 'Azienda Analizzata';

    return (
      <div className="space-y-8">
        <ReportHeader companyName={companyName} summary={analysisData.summary} />
        <ComparisonSection chartsData={analysisData.charts_data} />
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

const LoadingState = ({ text, status }) => ( <div className="flex items-center justify-center h-full p-10"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><h2 className="text-2xl font-bold text-slate-800">{text}</h2>{status && <p className="mt-4 text-sm text-slate-500">Stato: <strong className="uppercase">{status}</strong></p>}</div></div> );
const ErrorState = ({ message }) => ( <div className="flex items-center justify-center h-full p-10"><div className="text-center p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500"><h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2><p className="text-slate-600 mt-2">{message}</p></div></div> );
const ReportHeader = ({ companyName, summary }) => ( <div className="p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center"><p className="text-sm font-medium text-blue-600">Report di Analisi Strategica</p><h1 className="text-3xl font-bold text-slate-900 mt-1">{companyName}</h1><p className="mt-4 text-slate-600 leading-relaxed max-w-3xl mx-auto">{summary || 'Nessun sommario disponibile.'}</p></div> );

const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'N/D';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
};

const ComparisonCard = ({ title, data, dataKey, icon, color }) => {
  if (!data || data.current_year === null || data.previous_year === null) {
    return <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center"><h3 className="text-base font-semibold text-slate-800">{title}</h3><p className="mt-4 text-slate-500">Dati non disponibili per il confronto.</p></div>;
  }
  const { current_year, previous_year } = data;
  let percentageChange = previous_year !== 0 ? ((current_year - previous_year) / Math.abs(previous_year)) * 100 : 0;
  const isPositive = percentageChange >= 0;
  if (typeof window === 'undefined' || !window.Recharts) return <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200"><div className="flex items-center justify-center h-64 text-sm text-slate-500">Caricamento grafico...</div></div>;
  const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } = window.Recharts;
  const chartData = [ { name: 'Anno Prec.', [dataKey]: previous_year }, { name: 'Anno Corr.', [dataKey]: current_year } ];
  const formatYAxis = (tick) => tick >= 1000000 ? `${(tick/1000000).toFixed(1)}M` : tick >= 1000 ? `${(tick/1000).toFixed(0)}K` : tick;
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center">{title}</h3>
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
        <ComparisonCard title="Fatturato" data={chartsData.revenue_trend} dataKey="fatturato" icon={null} color="#3b82f6" />
        <ComparisonCard title="Utile Netto" data={chartsData.profit_trend} dataKey="utile" icon={null} color="#10b981" />
      </div>
    </section>
  );
};
