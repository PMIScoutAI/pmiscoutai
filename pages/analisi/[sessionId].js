// ...inizio identico...
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { ProtectedPage } from '../../utils/ProtectedPage';

export default function AnalisiReportPageWrapper() {
  return (
    <>
      <Head>
        <title>Report Analisi - PMIScout</title>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script
        id="outseta-script"
        src="https://cdn.outseta.com/outseta.min.js"
        strategy="beforeInteractive"
      />
      <ProtectedPage>
        {(user) => <AnalisiReportPage user={user} />}
      </ProtectedPage>
    </>
  );
}

const Icon = ({ children, className = "w-6 h-6" }) => (
  <div className={`${className} flex items-center justify-center`}>
    {children}
  </div>
);

function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [sessionData, setSessionData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef(null);

  useEffect(() => {
    const fetchSessionData = async () => {
      if (!sessionId || !user.id) return;
      try {
        const { data: session, error: sessionError } = await supabase
          .from('checkup_sessions')
          .select('*, companies(*)')
          .eq('id', sessionId)
          .single();
        if (sessionError) throw new Error('Sessione non trovata o accesso negato.');
        if (session.user_id !== user.id) throw new Error('Non sei autorizzato a visualizzare questa analisi.');
        setSessionData(session);

        if (session.status === 'completed') {
          const { data: results, error: resultsError } = await supabase
            .from('analysis_results')
            .select('*')
            .eq('session_id', sessionId)
            .single();
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
  }, [sessionId, user.id]);

  const renderContent = () => {
    if (isLoading) return <div className="text-center p-10">Caricamento del report...</div>;
    if (error) return <div className="text-center p-10 text-red-600">Errore: {error}</div>;
    if (!sessionData) return <div className="text-center p-10">Nessun dato trovato per questa sessione.</div>;

    if (sessionData.status === 'completed' && analysisData) {
      const analysis = analysisData.raw_ai_response || {};

      return (
        <div className="space-y-10">
          {/* Header */}
          <section className="bg-white rounded-2xl shadow-md p-10">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-semibold text-gray-900">Analisi: {analysis.company_name || sessionData.companies?.company_name}</h2>
                <p className="text-gray-500 mt-1">Dati aggiornati al {analysis.analysis_date || new Date().toLocaleDateString('it-IT')}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Health Score</p>
                <p className="text-5xl font-bold text-green-600">{analysisData.health_score || 0}</p>
                <p className="text-sm text-gray-400">/100</p>
              </div>
            </div>
            <p className="mt-6 text-gray-700">{analysisData.summary || 'Analisi in corso...'}</p>
          </section>

          {/* Indici Chiave */}
          {analysis.key_metrics && (
            <section className="bg-white rounded-2xl shadow-md p-10">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Indici Finanziari</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {['current_ratio', 'roe', 'debt_equity'].map((key) => {
                  const item = analysis.key_metrics[key];
                  if (!item) return null;
                  const labels = { current_ratio: 'Current Ratio', roe: 'ROE', debt_equity: 'Debt/Equity' };
                  return (
                    <div key={key} className="bg-gray-50 p-6 rounded-xl shadow-sm">
                      <h4 className="text-lg font-semibold text-gray-800 mb-1">{labels[key]}</h4>
                      <p className="text-3xl font-bold text-gray-900">{item.value}</p>
                      <p className="text-sm text-gray-500 mt-1">Benchmark: {item.benchmark}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Settore */}
          {analysis.sector_overview && (
            <section className="bg-white rounded-2xl shadow-md p-10">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Panorama Settore</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <p className="text-gray-500 text-sm">Valore Mercato Stimato</p>
                  <p className="text-2xl font-bold text-blue-600">{analysis.sector_overview.market_value}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Crescita Annua (CAGR)</p>
                  <p className="text-2xl font-bold text-green-600">{analysis.sector_overview.growth_rate}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Top Segmento</p>
                  <p className="text-xl font-semibold text-purple-600">{analysis.sector_overview.top_segment}</p>
                </div>
              </div>
            </section>
          )}

          {/* SWOT */}
          {analysis.swot && (
            <section className="bg-white rounded-2xl shadow-md p-10">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Analisi SWOT</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {['strengths', 'weaknesses', 'opportunities', 'threats'].map((type) => (
                  <div key={type}>
                    <h4 className="text-lg font-semibold mb-3 text-gray-700 capitalize">{type}</h4>
                    <ul className="space-y-2 list-disc list-inside text-gray-700">
                      {(analysis.swot[type] || []).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Raccomandazioni */}
          {analysisData.recommendations?.length > 0 && (
            <section className="bg-white rounded-2xl shadow-md p-10">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Raccomandazioni</h3>
              <ul className="space-y-4">
                {analysisData.recommendations.map((r, i) => (
                  <li key={i} className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-md text-gray-800">{r}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Pulsante stampa */}
          <div className="text-center">
            <button onClick={() => window.print()} className="mt-10 bg-gray-800 hover:bg-black text-white font-semibold py-3 px-6 rounded-xl shadow-md transition">
              🖨️ Stampa il Report
            </button>
          </div>

          {/* CTA finale */}
          <div className="mt-14 bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-xl shadow-md">
            <h4 className="text-lg font-bold text-yellow-800 mb-2">🔐 Vuoi accedere ai report completi?</h4>
            <p className="text-gray-700 mb-3">Attiva PMIScout Pro per analisi settoriali, suggerimenti strategici personalizzati e accesso premium.</p>
            <a href="/pro" className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-5 py-2 rounded-md">Scopri PMIScout Pro</a>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center p-10 bg-white rounded-xl shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-slate-800">Analisi in corso</h2>
        <p className="text-slate-600 mt-2">Stiamo elaborando i dati. Questa pagina si aggiornerà automaticamente.</p>
        <p className="text-sm text-slate-500 mt-4">Stato: <strong>{sessionData?.status || 'sconosciuto'}</strong></p>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center">
            <Icon className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg mr-4">📊</Icon>
            <h1 className="text-4xl font-bold text-gray-900">Report Analisi AI</h1>
          </div>
          <p className="text-gray-500 mt-2">Sessione: {sessionId} — Azienda: {sessionData?.companies?.company_name || '...'}</p>
        </header>
        {renderContent()}
      </div>
    </main>
  );
}
