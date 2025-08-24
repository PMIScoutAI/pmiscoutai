// /pages/check-ai-xbrl.js
// VERSIONE 3.0 (Dinamica con Aggiornamenti in Tempo Reale)
// - Rimosso 'getServerSideProps' per trasformare la pagina in un componente client-side dinamico.
// - Utilizza React Hooks (useState, useEffect) per gestire lo stato di caricamento e i dati.
// - Si iscrive a Supabase Realtime per 'ascoltare' l'inserimento di nuovi risultati.
// - La pagina si aggiorna automaticamente non appena l'analisi è completa, senza bisogno di refresh manuale.

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

// --- Inizializzazione del Client Supabase (lato client) ---
// Assicurati che queste variabili d'ambiente siano esposte al browser (NEXT_PUBLIC_)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- Componenti Icone (invariati) ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  award: <><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 22 12 17 17 22 15.79 13.88"></polyline></>,
  dollarSign: <><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></>,
  globe: <><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></>,
  arrowUp: <><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></>,
  arrowDown: <><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></>
};

// --- Componente Pagina Principale (Logica Client-Side) ---
export default function CheckAiXbrlPage() {
  const router = useRouter();
  const { sessionId } = router.query;

  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      if(router.isReady) { // Esegui solo quando il router ha caricato i query params
        setIsLoading(false);
        setError("Nessun sessionId fornito nell'URL.");
      }
      return;
    }

    // 1. Controlla subito se esiste già un risultato
    const getInitialData = async () => {
      const { data, error } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setAnalysis(data);
        setIsLoading(false);
      } else if (error) {
        setError(error.message);
        setIsLoading(false);
      }
    };

    getInitialData();

    // 2. Iscriviti al canale Realtime per ricevere il risultato quando viene inserito
    const channel = supabase
      .channel(`analysis-results-check:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'analysis_results',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('✅ Nuovo risultato di analisi ricevuto via Realtime!', payload.new);
          setAnalysis(payload.new);
          setIsLoading(false);
          setError(''); // Pulisce eventuali errori precedenti
        }
      )
      .subscribe();

    // 3. Funzione di pulizia per disiscriversi quando si lascia la pagina
    return () => {
      supabase.removeChannel(channel);
    };

  }, [sessionId, router.isReady]);

  const companyName = analysis?.raw_ai_response?.company_name || 'Azienda';

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center p-10 bg-white rounded-xl shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-slate-800">Caricamento analisi...</h1>
          <p className="text-slate-600 mt-2">Sessione: <strong>{sessionId}</strong></p>
        </div>
      );
    }

    if (error) return <ErrorState message={error} />;

    if (!analysis) {
      return (
        <div className="text-center p-10 bg-white rounded-xl shadow-lg">
          <h1 className="text-2xl font-bold text-slate-800">In attesa dei risultati...</h1>
          <p className="text-slate-600 mt-2">Sessione: <strong>{sessionId}</strong></p>
          <p className="mt-4">Questa pagina si aggiornerà automaticamente non appena l'analisi sarà completata.</p>
        </div>
      );
    }

    // Se l'analisi è presente, mostra il report completo
    const strategicAnalysis = analysis.raw_ai_response || {};
    const metrics = analysis.raw_parsed_data?.metrics || {};
    
    return (
      <div className="space-y-8">
        <ReportHeader 
            companyName={companyName} 
            summary={analysis.summary}
            healthScore={analysis.health_score}
        />
        <KeyIndicatorsGrid metrics={metrics} />
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi Strategica</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnalysisCard title="Analisi Fatturato" text={strategicAnalysis.revenueAnalysis} icon={icons.dollarSign} />
                <AnalysisCard title="Analisi Utili" text={strategicAnalysis.profitAnalysis} icon={icons.award} />
                <AnalysisCard title="Analisi Debiti" text={strategicAnalysis.debtAnalysis} icon={icons.shield} />
                <AnalysisCard title="Contesto di Mercato" text={strategicAnalysis.marketOutlook} icon={icons.globe} />
            </div>
        </section>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Report di Analisi per {companyName}</title>
        <meta name="robots" content="noindex" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <style>{` body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; } `}</style>
      </Head>
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {renderContent()}
      </main>
    </>
  );
}

// --- Componenti UI (invariati, ma ora usati da un componente client-side) ---
// (Il codice per ErrorState, HealthScoreGauge, ReportHeader, KeyIndicatorCard, etc. rimane identico)

const ErrorState = ({ message }) => (
    <div className="p-10 bg-white rounded-xl shadow-lg border-l-4 border-red-500 text-center">
        <Icon path={icons.alertTriangle} className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-700">Si è verificato un errore</h2>
        <p className="text-slate-600 mt-2">{message}</p>
    </div>
);

const HealthScoreGauge = ({ score }) => {
    if (score === null || score === undefined) {
        return (
            <div className="flex flex-col items-center justify-center w-40 h-40 bg-slate-100 rounded-full border">
                <Icon path={icons.alertTriangle} className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 text-center px-2">Dati insufficienti</p>
            </div>
        );
    }
    const getScoreColor = (s) => {
        if (s >= 75) return 'text-green-500';
        if (s >= 40) return 'text-yellow-500';
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

const ReportHeader = ({ companyName, summary, healthScore }) => (
  <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 text-center md:text-left">
            <p className="text-sm font-medium text-blue-600">Report di Analisi Strategica</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">{companyName}</h1>
            <p className="mt-4 text-slate-600 leading-relaxed max-w-prose mx-auto md:mx-0">{summary || 'Nessun sommario disponibile.'}</p>
        </div>
        <div className="flex-shrink-0">
            <HealthScoreGauge score={healthScore} />
        </div>
    </div>
  </div>
);

const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'N/D';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
};

const KeyIndicatorCard = ({ title, currentValue, previousValue, icon }) => {
    const isCurrentValid = typeof currentValue === 'number';
    const isPreviousValid = typeof previousValue === 'number';

    if (!isCurrentValid || !isPreviousValid) {
        return (
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500 flex items-center"><Icon path={icon} className="w-4 h-4 mr-2" />{title}</p>
                <p className="text-3xl font-bold text-slate-400 mt-2">{isCurrentValid ? formatCurrency(currentValue) : 'N/D'}</p>
                <p className="text-xs text-slate-400 mt-1">Dati insufficienti per confronto</p>
            </div>
        );
    }
    const change = previousValue !== 0 ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100 : 0;
    const isPositive = title === 'Debiti Totali' ? change < 0 : change > 0;
    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <p className="text-sm font-medium text-slate-500 flex items-center"><Icon path={icon} className="w-4 h-4 mr-2" />{title}</p>
            <div className="flex items-baseline gap-4 mt-2">
                <p className="text-3xl font-bold text-slate-900">{formatCurrency(currentValue)}</p>
                <div className={`flex items-center text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    <Icon path={isPositive ? icons.arrowUp : icons.arrowDown} className="w-4 h-4" />
                    <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">Anno precedente: {formatCurrency(previousValue)}</p>
        </div>
    );
};

const KeyIndicatorsGrid = ({ metrics }) => {
    if (!metrics || Object.keys(metrics).length === 0) return null;
    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Cruscotto Aziendale</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KeyIndicatorCard title="Fatturato" currentValue={metrics.fatturato?.currentYear} previousValue={metrics.fatturato?.previousYear} icon={icons.dollarSign} />
                <KeyIndicatorCard title="Utile Netto" currentValue={metrics.utilePerdita?.currentYear} previousValue={metrics.utilePerdita?.previousYear} icon={icons.award} />
                <KeyIndicatorCard title="Debiti Totali" currentValue={metrics.debitiTotali?.currentYear} previousValue={metrics.debitiTotali?.previousYear} icon={icons.shield} />
            </div>
        </section>
    );
};

const AnalysisCard = ({ title, text, icon }) => (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center text-lg font-bold text-slate-800">
            <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-slate-100">
                <Icon path={icon} className="w-5 h-5 text-slate-600" />
            </div>
            {title}
        </div>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{text || "Analisi non disponibile."}</p>
    </div>
);

// NIENTE PIÙ getServerSideProps. La pagina ora è renderizzata lato client.
