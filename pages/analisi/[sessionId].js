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
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        } else if (session.status === 'failed') {
          setError(session.error_message || 'Si è verificato un errore durante l\'analisi.');
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        }
      } catch (err) {
        console.error('Data fetching error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionData();

    if (sessionData?.status !== 'completed' && sessionData?.status !== 'failed') {
      if (!channelRef.current) {
        const channel = supabase
          .channel(`session-updates-${sessionId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'checkup_sessions',
              filter: `id=eq.${sessionId}`,
            },
            () => fetchSessionData()
          )
          .subscribe();
        channelRef.current = channel;
      }
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, user.id, sessionData?.status]);

  const renderContent = () => {
    if (isLoading) return <div className="text-center p-10">Caricamento del report...</div>;
    if (error) return <div className="text-center p-10 text-red-600">Errore: {error}</div>;
    if (!sessionData) return <div className="text-center p-10">Nessun dato trovato per questa sessione.</div>;

    if (sessionData.status === 'completed' && analysisData) {
      const analysis = analysisData.raw_ai_response || {};

      return (
        <div className="space-y-8">
          {/* Indice cliccabile */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">📌 Vai direttamente a:</h2>
            <div className="space-x-4">
              <button onClick={() => scrollToId('riepilogo')} className="text-blue-600 hover:underline">Riepilogo</button>
              <button onClick={() => scrollToId('benchmark')} className="text-blue-600 hover:underline">Indici Chiave</button>
              <button onClick={() => scrollToId('settore')} className="text-blue-600 hover:underline">Settore</button>
              <button onClick={() => scrollToId('swot')} className="text-blue-600 hover:underline">SWOT</button>
              <button onClick={() => scrollToId('raccomandazioni')} className="text-blue-600 hover:underline">Raccomandazioni</button>
            </div>
          </div>

          {/* Riepilogo */}
          <div id="riepilogo" className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Riepilogo Analisi per {analysis.company_name || sessionData.companies?.company_name}</h2>
                <p className="text-gray-600 mt-2">Dati aggiornati al {analysis.analysis_date || new Date().toLocaleDateString('it-IT')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-2">Health Score</p>
                <p className="text-6xl font-bold text-green-600">{analysisData.health_score || 0}</p>
                <p className="text-gray-500">/100</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700 leading-relaxed">{analysisData.summary || 'Analisi in corso...'}</p>
            </div>
          </div>

          {/* Indici Chiave */}
          {analysis.key_metrics && (
            <div id="benchmark" className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Indici Chiave vs Benchmark</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['current_ratio', 'roe', 'debt_equity'].map((metric) => {
                  const item = analysis.key_metrics[metric];
                  if (!item) return null;
                  const titles = { current_ratio: 'Current Ratio', roe: 'ROE', debt_equity: 'Debt/Equity' };
                  return (
                    <div key={metric} className="bg-gray-50 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">{titles[metric]}</h4>
                      <p className="text-3xl font-bold text-gray-900">{item.value}</p>
                      <p className="text-sm text-green-600 mt-1">Benchmark di settore: {item.benchmark}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settore */}
          {analysis.sector_overview && (
            <div id="settore" className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Panorama del Settore: {analysis.sector || 'Settore di riferimento'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border-l-4 border-blue-500 pl-6">
                  <p className="text-sm text-gray-600 mb-1">Valore di Mercato Stimato</p>
                  <p className="text-3xl font-bold text-blue-600">{analysis.sector_overview.market_value || 'N/A'}</p>
                </div>
                <div className="border-l-4 border-green-500 pl-6">
                  <p className="text-sm text-gray-600 mb-1">Crescita Annua (CAGR)</p>
                  <p className="text-3xl font-bold text-green-600">{analysis.sector_overview.growth_rate || 'N/A'}</p>
                </div>
                <div className="border-l-4 border-purple-500 pl-6">
                  <p className="text-sm text-gray-600 mb-1">Segmento a Maggior Crescita</p>
                  <p className="text-xl font-bold text-purple-600">{analysis.sector_overview.top_segment || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {/* SWOT */}
          {analysis.swot && (
            <div id="swot" className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Analisi SWOT del Settore</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['strengths', 'weaknesses', 'opportunities', 'threats'].map((type) => (
                  <div key={type} className={`border-l-4 ${type === 'strengths' ? 'border-green-500' : type === 'weaknesses' ? 'border-red-500' : type === 'opportunities' ? 'border-blue-500' : 'border-orange-500'} pl-6`}>
                    <h4 className={`text-lg font-semibold ${type === 'strengths' ? 'text-green-700' : type === 'weaknesses' ? 'text-red-700' : type === 'opportunities' ? 'text-blue-700' : 'text-orange-700'} mb-3`}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </h4>
                    <ul className="space-y-2">
                      {(analysis.swot[type] || []).map((item, i) => (
                        <li key={i} className="text-gray-700 flex items-start"><span className="mr-2">•</span>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raccomandazioni */}
          {analysisData.recommendations && analysisData.recommendations.length > 0 && (
            <div id="raccomandazioni" className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Raccomandazioni</h3>
              <div className="space-y-4">
                {analysisData.recommendations.map((r, i) => (
                  <div key={i} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <p className="text-gray-800">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pulsante stampa */}
          <div className="text-center mt-10">
            <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-6 py-3 rounded-lg text-lg">🖨️ Stampa il Report</button>
          </div>

          {/* CTA finale */}
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 mt-12 rounded-lg">
            <h4 className="text-lg font-bold text-yellow-800 mb-2">🔐 Vuoi accedere a report più dettagliati?</h4>
            <p className="text-gray-700 mb-3">Con PMIScout Pro ottieni analisi mensili, benchmark di settore approfonditi e suggerimenti strategici personalizzati.</p>
            <a href="/pro" className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-5 py-2 rounded">Scopri PMIScout Pro</a>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center p-10 bg-white rounded-xl shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-slate-800">Analisi in corso</h2>
        <p className="text-slate-600 mt-2">
          Stiamo analizzando il tuo documento. La pagina si aggiornerà automaticamente non appena i risultati saranno pronti.
        </p>
        <p className="text-sm text-slate-500 mt-4">Stato attuale: <strong>{sessionData?.status || 'sconosciuto'}</strong></p>
      </div>
    );
  };

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Icon className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg mr-4">📊</Icon>
            <h1 className="text-4xl font-bold text-gray-900">Report Analisi AI</h1>
          </div>
          <p className="text-gray-600">Risultati per la sessione: {sessionId}</p>
          <p className="text-gray-600">Azienda: {sessionData?.companies?.company_name || '...'}</p>
        </div>
        {renderContent()}
      </div>
    </main>
  );
}
