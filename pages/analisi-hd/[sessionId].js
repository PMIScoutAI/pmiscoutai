// /pages/analisi-hd/[sessionId].js
// Pagina dinamica per visualizzare lo stato e i risultati dell'analisi.
// VERSIONE FINALE con una dashboard di risultati leggibile.

import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

// --- Componenti UI (Icone, etc.) ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></>,
  check: <><polyline points="20 6 9 17 4 12"></polyline></>,
  clock: <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></>,
  trendingUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></>,
  target: <><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></>,
  thumbsUp: <><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a2 2 0 0 1 3 3.88z"></path></>,
  thumbsDown: <><path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a2 2 0 0 1-3-3.88z"></path></>,
  lightbulb: <><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.09 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></>,
  flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></>
};

// --- Componente Principale della Pagina ---
export default function AnalisiHdPage({ sessionData, error }) {
  const router = useRouter();

  useEffect(() => {
    if (sessionData && (sessionData.status === 'indexing' || sessionData.status === 'processing')) {
      const interval = setInterval(() => { router.replace(router.asPath); }, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionData, router]);

  if (error) return <StatusDisplay icon={icons.alert} title="Errore" message={error} color="red" />;

  switch (sessionData?.status) {
    case 'indexing':
    case 'processing':
      return <StatusDisplay icon={icons.clock} title="Analisi in corso..." message="Il tuo documento è in fase di analisi. La pagina si aggiornerà automaticamente non appena i risultati saranno pronti." color="blue" />;
    case 'completed':
      return <ResultsDisplay session={sessionData} />;
    case 'failed':
      return <StatusDisplay icon={icons.alert} title="Analisi Fallita" message={sessionData.error_message || "Si è verificato un errore sconosciuto."} color="red" />;
    default:
      return <StatusDisplay icon={icons.alert} title="Stato Sconosciuto" message="Lo stato della sessione di analisi non è riconoscibile." color="yellow" />;
  }
}

// --- Componenti di Visualizzazione ---
const StatusDisplay = ({ icon, title, message, color }) => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
      <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-${color}-100`}><Icon path={icon} className={`h-6 w-6 text-${color}-600`} /></div>
      <h2 className="mt-4 text-2xl font-bold text-slate-800">{title}</h2>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link href="/checkup-hd"><a className="mt-6 inline-block px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">Torna indietro</a></Link>
    </div>
  </div>
);

// NUOVO: Componente Dashboard per i Risultati
const ResultsDisplay = ({ session }) => {
  const analysis = session.final_analysis;

  if (!analysis) {
    return <StatusDisplay icon={icons.alert} title="Dati non disponibili" message="L'analisi è completata ma non è stato possibile recuperare il report finale." color="yellow" />;
  }

  const { health_score, summary, key_metrics, detailed_swot, recommendations } = analysis;
  const { crescita_fatturato_perc, roe } = key_metrics;
  const { strengths, weaknesses, opportunities, threats } = detailed_swot;

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Report Analisi Finanziaria</h1>
                <p className="mt-1 text-slate-600">Sessione: {session.id}</p>
            </div>
            <Link href="/checkup-hd"><a className="mt-4 sm:mt-0 inline-block px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">Esegui un'altra analisi</a></Link>
        </div>

        {/* Grid Principale */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonna Sinistra */}
            <div className="lg:col-span-2 space-y-6">
                <SummaryCard summary={summary} />
                <SwotCard strengths={strengths} weaknesses={weaknesses} opportunities={opportunities} threats={threats} />
                <RecommendationsCard recommendations={recommendations} />
            </div>
            {/* Colonna Destra (Sidebar) */}
            <div className="space-y-6">
                <MetricCard title="Health Score" value={health_score} unit="/ 100" icon={icons.zap} />
                <MetricCard title={crescita_fatturato_perc.label} value={crescita_fatturato_perc.value} unit="%" icon={icons.trendingUp} />
                <MetricCard title={roe.label} value={roe.value} unit="%" icon={icons.target} />
            </div>
        </div>
      </div>
    </div>
  );
};

// --- Componenti Helper per la Dashboard ---
const Card = ({ children, className }) => <div className={`bg-white p-6 rounded-lg shadow-sm ${className}`}>{children}</div>;

const SummaryCard = ({ summary }) => (
    <Card>
        <h2 className="text-xl font-semibold text-slate-800 mb-3">Riepilogo Esecutivo</h2>
        <p className="text-slate-600 leading-relaxed">{summary}</p>
    </Card>
);

const MetricCard = ({ title, value, unit, icon }) => (
    <Card>
        <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full mr-4">
                <Icon path={icon} className="w-6 h-6 text-purple-600" />
            </div>
            <div>
                <p className="text-sm text-slate-500">{title}</p>
                <p className="text-3xl font-bold text-slate-900">
                    {value !== null ? value.toLocaleString('it-IT') : 'N/D'}
                    <span className="text-xl font-medium text-slate-500 ml-1">{unit}</span>
                </p>
            </div>
        </div>
    </Card>
);

const SwotCard = ({ strengths, weaknesses, opportunities, threats }) => (
    <Card>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Analisi SWOT</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <SwotList title="Punti di Forza" items={strengths} icon={icons.thumbsUp} color="green" />
            <SwotList title="Punti di Debolezza" items={weaknesses} icon={icons.thumbsDown} color="red" />
            <SwotList title="Opportunità" items={opportunities} icon={icons.lightbulb} color="blue" />
            <SwotList title="Minacce" items={threats} icon={icons.flag} color="yellow" />
        </div>
    </Card>
);

const SwotList = ({ title, items, icon, color }) => (
    <div>
        <div className={`flex items-center text-${color}-600 mb-2`}>
            <Icon path={icon} className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">{title}</h3>
        </div>
        <ul className="space-y-1 list-disc list-inside text-slate-600 text-sm">
            {items.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
    </div>
);

const RecommendationsCard = ({ recommendations }) => (
    <Card>
        <h2 className="text-xl font-semibold text-slate-800 mb-3">Raccomandazioni</h2>
        <ul className="space-y-2 list-disc list-inside text-slate-600">
            {recommendations.map((rec, index) => <li key={index}>{rec}</li>)}
        </ul>
    </Card>
);


// --- FUNZIONE SERVER-SIDE (Aggiornata per prendere final_analysis) ---
export async function getServerSideProps(context) {
  const { sessionId } = context.params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: sessionData, error } = await supabase
      .from('checkup_sessions_hd')
      .select(`
        *,
        analysis_results_hd ( final_analysis )
      `)
      .eq('id', sessionId)
      .single();

    if (error) throw new Error(`Sessione non trovata: ${error.message}`);
    
    // Estrai il report JSON dalla relazione
    const finalData = {
        ...sessionData,
        final_analysis: sessionData.analysis_results_hd[0]?.final_analysis || null
    };
    delete finalData.analysis_results_hd;

    return { props: { sessionData: finalData } };
  } catch (error) {
    console.error("Errore in getServerSideProps:", error.message);
    return { props: { error: error.message } };
  }
}
