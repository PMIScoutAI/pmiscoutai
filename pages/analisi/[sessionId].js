// /pages/analisi/[sessionId].js
// AGGIORNATO: Layout completo per visualizzare tutti i dati AI strutturati

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { ProtectedPage } from '../../utils/ProtectedPage';

// --- Componente Wrapper ---
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

// --- Componente Icona (utility) ---
const Icon = ({ children, className = "w-6 h-6" }) => (
  <div className={`${className} flex items-center justify-center`}>
    {children}
  </div>
);

// --- Componente Principale della Pagina ---
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
        // 1. Recupera i dati della sessione
        const { data: session, error: sessionError } = await supabase
          .from('checkup_sessions')
          .select('*, companies(*)')
          .eq('id', sessionId)
          .single();

        if (sessionError) throw new Error('Sessione non trovata o accesso negato.');
        
        // 2. Controllo sicurezza
        if (session.user_id !== user.id) {
          throw new Error('Non sei autorizzato a visualizzare questa analisi.');
        }

        setSessionData(session);

        // 3. Se completata, recupera i risultati
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

    // Setup Realtime listener
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

  // --- Helper per status indicatori ---
  const getStatusColor = (status) => {
    switch(status) {
      case 'sopra': return 'text-green-600';
      case 'sotto': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // --- Render del Contenuto ---
  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center p-10">Caricamento del report...</div>;
    }

    if (error) {
      return <div className="text-center p-10 text-red-600">Errore: {error}</div>;
    }
    
    if (!sessionData) {
        return <div className="text-center p-10">Nessun dato trovato per questa sessione.</div>;
    }

    // Se l'analisi è completata, mostra i risultati completi
    if (sessionData.status === 'completed' && analysisData) {
      const analysis = analysisData.raw_ai_response || {};
      
      return (
        <div className="space-y-8">
          {/* Header con Health Score */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Riepilogo Analisi per {analysis.company_name || sessionData.companies?.company_name}
                </h2>
                <p className="text-gray-600 mt-2">
                  Dati aggiornati al {analysis.analysis_date || new Date().toLocaleDateString('it-IT')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-2">Health Score</p>
                <p className="text-6xl font-bold text-green-600">{analysisData.health_score || 0}</p>
                <p className="text-gray-500">/100</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700 leading-relaxed">
                {analysisData.summary || 'Analisi in corso...'}
              </p>
            </div>
          </div>

          {/* Indici Chiave vs Benchmark */}
          {analysis.key_metrics && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Indici Chiave vs Benchmark</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Current Ratio */}
                {analysis.key_metrics.current_ratio && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Current Ratio</h4>
                    <p className="text-3xl font-bold text-gray-900">{analysis.key_metrics.current_ratio.value}</p>
                    <p className="text-sm text-green-600 mt-1">
                      Benchmark di settore: {analysis.key_metrics.current_ratio.benchmark}
                    </p>
                  </div>
                )}

                {/* ROE */}
                {analysis.key_metrics.roe && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">ROE</h4>
                    <p className="text-3xl font-bold text-gray-900">{analysis.key_metrics.roe.value}</p>
                    <p className="text-sm text-green-600 mt-1">
                      Benchmark di settore: {analysis.key_metrics.roe.benchmark}
                    </p>
                  </div>
                )}

                {/* Debt/Equity */}
                {analysis.key_metrics.debt_equity && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Debt/Equity</h4>
                    <p className="text-3xl font-bold text-gray-900">{analysis.key_metrics.debt_equity.value}</p>
                    <p className="text-sm text-orange-600 mt-1">
                      Benchmark di settore: {analysis.key_metrics.debt_equity.benchmark}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Panorama del Settore */}
          {analysis.sector_overview && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Panorama del Settore: {analysis.sector || 'Settore di riferimento'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="border-l-4 border-blue-500 pl-6">
                  <p className="text-sm text-gray-600 mb-1">Valore di Mercato Stimato</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {analysis.sector_overview.market_value || 'N/A'}
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-6">
                  <p className="text-sm text-gray-600 mb-1">Crescita Annua (CAGR)</p>
                  <p className="text-3xl font-bold text-green-600">
                    {analysis.sector_overview.growth_rate || 'N/A'}
                  </p>
                </div>

                <div className="border-l-4 border-purple-500 pl-6">
                  <p className="text-sm text-gray-600 mb-1">Segmento a Maggior Crescita</p>
                  <p className="text-xl font-bold text-purple-600">
                    {analysis.sector_overview.top_segment || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Analisi SWOT */}
          {analysis.swot && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Analisi SWOT del Settore</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Punti di Forza */}
                <div className="border-l-4 border-green-500 pl-6">
                  <h4 className="text-lg font-semibold text-green-700 mb-3">Punti di Forza</h4>
                  <ul className="space-y-2">
                    {(analysis.swot.strengths || []).map((item, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Punti di Debolezza */}
                <div className="border-l-4 border-red-500 pl-6">
                  <h4 className="text-lg font-semibold text-red-700 mb-3">Punti di Debolezza</h4>
                  <ul className="space-y-2">
                    {(analysis.swot.weaknesses || []).map((item, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Opportunità */}
                <div className="border-l-4 border-blue-500 pl-6">
                  <h4 className="text-lg font-semibold text-blue-700 mb-3">Opportunità</h4>
                  <ul className="space-y-2">
                    {(analysis.swot.opportunities || []).map((item, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Minacce */}
                <div className="border-l-4 border-orange-500 pl-6">
                  <h4 className="text-lg font-semibold text-orange-700 mb-3">Minacce</h4>
                  <ul className="space-y-2">
                    {(analysis.swot.threats || []).map((item, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="text-orange-500 mr-2">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Raccomandazioni */}
          {analysisData.recommendations && analysisData.recommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Raccomandazioni</h3>
              <div className="space-y-4">
                {analysisData.recommendations.map((recommendation, index) => (
                  <div key={index} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <p className="text-gray-800">{recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Stato di attesa
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

  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Icon className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg mr-4">
              📊
            </Icon>
            <h1 className="text-4xl font-bold text-gray-900">Report Analisi AI</h1>
          </div>
          <p className="text-gray-600">
            Risultati per la sessione: {sessionId}
          </p>
          <p className="text-gray-600">
            Azienda: {sessionData?.companies?.company_name || '...'}
          </p>
        </div>
        {renderContent()}
      </div>
    </main>
  );
}
