import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

// Icone SVG
const Icon = ({ path, className = 'w-6 h-6' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {path}
  </svg>
);

const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
  menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  spark: <><path d="M12 3v6l4-4-4-4" /><path d="M12 21v-6l-4 4 4 4" /><path d="M3 12h6l-4-4 4-4" /><path d="M21 12h-6l4 4-4 4" /></>,
  warning: <><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  trendingUp: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>
};

export default function AnalisiReportPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  
  // Stati
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);
  
  // Ref per cleanup
  const channelRef = useRef(null);
  const timeoutRef = useRef(null);

  // Cleanup function
  const cleanup = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };
  
  // Outseta authentication
  const checkAuth = async () => {
    try {
      if (typeof window !== 'undefined' && window.Outseta) {
        const user = await window.Outseta.getUser();
        if (user?.Email) {
          setIsAuthenticated(true);
          setUserName(user.FirstName || user.Email.split('@')[0]);
          setIsLoading(false);
        } else {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      } else {
        timeoutRef.current = setTimeout(checkAuth, 3000);
      }
    } catch (err) {
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

 // Fetch session data
const fetchSessionData = async () => {
  if (!sessionId) return;
  
  try {
    // 1. Recupera i dati della sessione
    const { data: sessionResult, error: sessionError } = await supabase
      .from('checkup_sessions')
      .select('*, companies (*)')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      setError('Sessione non trovata');
      return;
    }

    setSessionData(sessionResult);
    console.log('📊 Session data:', sessionResult);

    // 2. Recupera sempre i risultati dell'analisi se la sessione è completed
    if (sessionResult.status === 'completed') {
      const { data: analysisResult, error: analysisError } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      console.log('🔍 Analysis result:', analysisResult);

      if (analysisError) {
        console.error('❌ Analysis error:', analysisError);
        setError('Risultati di analisi non trovati');
      } else {
        setAnalysisData(analysisResult);
        console.log('✅ Analysis data set:', analysisResult);
      }
    } else if (sessionResult.status === 'failed') {
      setError(sessionResult.error_message || 'Analisi fallita');
    } else {
      setupRealtime();
    }
  } catch (err) {
    setError(`Errore: ${err.message}`);
  }
};
  // Setup realtime subscription
  const setupRealtime = () => {
    cleanup();
    
    const channel = supabase
      .channel(`session_${sessionId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'checkup_sessions', filter: `id=eq.${sessionId}` },
        () => fetchSessionData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'analysis_results', filter: `session_id=eq.${sessionId}` },
        () => fetchSessionData()
      )
      .subscribe();
      
    channelRef.current = channel;
  };

  // Effects
  useEffect(() => {
    checkAuth();
    return cleanup;
  }, []);

  useEffect(() => {
    if (isAuthenticated && sessionId) {
      fetchSessionData();
    }
    return cleanup;
  }, [isAuthenticated, sessionId]);

  // Navigation
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
    { href: '/profile', text: 'Profilo', icon: icons.profile, active: false },
  ];

  // Helper functions
  const getHealthScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600'; 
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getMetricStatusColor = (status) => {
    switch(status) {
      case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
      case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'poor': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <Head>
          <title>Caricamento - PMIScout</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <script dangerouslySetInnerHTML={{ __html: "var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };" }} />
          <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
        </Head>
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <h2 className="text-xl font-bold text-blue-600">PMIScout</h2>
            <p className="text-slate-600">Caricamento...</p>
          </div>
        </div>
      </>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Head>
          <title>Login Richiesto - PMIScout</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </Head>
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Login Richiesto</h2>
            <p className="text-slate-600 mb-6">Devi effettuare il login per visualizzare questo report.</p>
            <a href="https://pmiscout.outseta.com/auth?widgetMode=login" className="inline-block w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Vai al Login
            </a>
          </div>
        </div>
      </>
    );
  }

  // Main content rendering
  const renderContent = () => {
    if (error) {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-lg">
            <div className="flex">
              <Icon path={icons.warning} className="w-8 h-8 text-red-500 mr-4" />
              <div>
                <p className="font-bold text-xl mb-2">Errore</p>
                <p className="text-md mb-4">{error}</p>
                <div className="flex space-x-4">
                  <button onClick={() => fetchSessionData()} className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg transition-colors">
                    🔄 Riprova
                  </button>
                  <Link href="/checkup">
                    <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                      🔙 Nuova Analisi
                    </a>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!sessionData) {
      return (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h3 className="text-2xl font-bold text-slate-800">Caricamento sessione...</h3>
        </div>
      );
    }

    if (!analysisData) {
      return (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-6"></div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Analisi in corso...</h3>
          <p className="text-slate-600 mb-4">L'IA sta elaborando il documento.</p>
        </div>
      );
    }

    // Show results - VERSIONE COMPLETA
    const company = sessionData.companies;
    const healthScore = analysisData.health_score || 75;
    const keyMetrics = analysisData.key_metrics || {};
    const swot = analysisData.swot || {};
    const recommendations = Array.isArray(analysisData.recommendations) 
      ? analysisData.recommendations 
      : (typeof analysisData.recommendations === 'string' 
          ? JSON.parse(analysisData.recommendations) 
          : []);

    return (
      <div className="space-y-8">
        {/* Header migliorato con Health Score prominente */}
        <div className="bg-white p-8 rounded-xl shadow-sm border">
          <div className="flex flex-col lg:flex-row justify-between items-start mb-6">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">{company?.company_name || 'Azienda'}</h2>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
                <span className="flex items-center">📍 {company?.industry_sector}</span>
                <span className="flex items-center">👥 {company?.company_size}</span>
                {company?.employee_count && (
                  <span className="flex items-center">🧑‍💼 {company.employee_count} dipendenti</span>
                )}
                <span className="flex items-center">📅 {new Date(sessionData.created_at).toLocaleDateString('it-IT')}</span>
              </div>
              {analysisData.summary && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">📋 Sintesi Esecutiva</h4>
                  <p className="text-slate-700">{analysisData.summary}</p>
                </div>
              )}
            </div>
            
            {/* Health Score grande e visibile */}
            <div className="text-center mt-6 lg:mt-0 lg:ml-8">
              <p className="text-sm font-medium text-slate-600 mb-2">Health Score</p>
              <div className={`text-6xl font-bold ${getHealthScoreColor(healthScore)}`}>
                {healthScore}
                <span className="text-2xl text-slate-400">/100</span>
              </div>
              <div className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                healthScore >= 80 ? 'bg-green-100 text-green-800' :
                healthScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                healthScore >= 40 ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {healthScore >= 80 ? 'Eccellente' :
                 healthScore >= 60 ? 'Buono' :
                 healthScore >= 40 ? 'Discreto' : 'Da migliorare'}
              </div>
            </div>
          </div>
        </div>

        {/* Metriche chiave in card eleganti */}
        {Object.keys(keyMetrics).length > 0 && (
          <div className="bg-white p-8 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center">
              <Icon path={icons.trendingUp} className="w-6 h-6 mr-3 text-blue-600" />
              Indicatori Finanziari Chiave
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(keyMetrics).map(([key, metric]) => (
                <div key={key} className="text-center">
                  <div className="bg-slate-50 rounded-lg p-6 border-2 border-transparent hover:border-blue-200 transition-all">
                    <h4 className="text-sm font-medium text-slate-600 mb-2 uppercase tracking-wide">
                      {key === 'roe' ? 'ROE (Return on Equity)' :
                       key === 'liquidity' ? 'Indice di Liquidità' :
                       key === 'debt_ratio' ? 'Rapporto di Indebitamento' :
                       key === 'profit_margin' ? 'Margine di Profitto' : key}
                    </h4>
                    <div className="text-3xl font-bold text-slate-900 mb-2">
                      {key === 'liquidity' ? 
                        metric.value?.toFixed(2) : 
                        `${metric.value}%`
                      }
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      Benchmark settore: {metric.benchmark_range}
                    </div>
                    <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getMetricStatusColor(metric.status)}`}>
                      {metric.status === 'excellent' ? '🚀 Eccellente' :
                       metric.status === 'good' ? '✅ Buono' :
                       metric.status === 'warning' ? '⚠️ Attenzione' :
                       '🔴 Critico'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analisi SWOT completa */}
        {(swot.strengths || swot.weaknesses) && (
          <div className="bg-white p-8 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center">
              <Icon path={icons.target} className="w-6 h-6 mr-3 text-blue-600" />
              Analisi SWOT
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Punti di Forza */}
              {swot.strengths && (
                <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-4 flex items-center text-lg">
                    💪 Punti di Forza
                  </h4>
                  <ul className="space-y-3">
                    {swot.strengths.map((strength, index) => (
                      <li key={index} className="text-green-800 flex items-start">
                        <span className="text-green-600 mr-3 mt-1">✓</span>
                        <span className="flex-1">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Aree di Miglioramento */}
              {swot.weaknesses && (
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-4 flex items-center text-lg">
                    ⚠️ Aree di Miglioramento
                  </h4>
                  <ul className="space-y-3">
                    {swot.weaknesses.map((weakness, index) => (
                      <li key={index} className="text-red-800 flex items-start">
                        <span className="text-red-600 mr-3 mt-1">⚡</span>
                        <span className="flex-1">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Raccomandazioni strategiche con priorità */}
        {recommendations.length > 0 && (
          <div className="bg-white p-8 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center">
              <Icon path={icons.spark} className="w-6 h-6 mr-3 text-blue-600" />
              Raccomandazioni Strategiche
            </h3>
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-all hover:border-blue-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 pr-4">
                      <p className="text-slate-800 font-medium text-lg mb-2">{rec.text}</p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${
                        rec.priority === 'alta' ? 'bg-red-50 text-red-800 border-red-200' :
                        rec.priority === 'media' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                        'bg-green-50 text-green-800 border-green-200'
                      }`}>
                        {rec.priority === 'alta' ? '🔥 Alta Priorità' :
                         rec.priority === 'media' ? '⚡ Media Priorità' :
                         '📅 Bassa Priorità'}
                      </span>
                      {rec.timeframe && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          ⏱️ Entro {rec.timeframe}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Azioni finali */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div>
              <p className="text-sm text-slate-600">
                Completata: {sessionData.completed_at ? new Date(sessionData.completed_at).toLocaleString('it-IT') : 'In corso...'}
              </p>
              <p className="text-xs text-slate-500">ID Sessione: {sessionId}</p>
            </div>
            <div className="flex space-x-3">
              <button onClick={() => window.print()} className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                <Icon path={icons.download} className="w-4 h-4" />
                <span>Stampa Report</span>
              </button>
              <Link href="/checkup">
                <a className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Icon path={icons.spark} className="w-4 h-4" />
                  <span>Nuova Analisi</span>
                </a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Report Analisi - PMIScout</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{ __html: "var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };" }} />
        <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
      </Head>

      <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
        {/* Sidebar */}
        <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b">
              <Link href="/">
                <a className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">PMIScout</a>
              </Link>
            </div>
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                {navLinks.map((link) => (
                  <Link key={link.text} href={link.href}>
                    <a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${link.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                      <Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />
                      {link.text}
                    </a>
                  </Link>
                ))}
              </nav>
              <div className="px-2 py-3 border-t border-slate-200">
                <div className="flex items-center px-2 py-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Connesso come {userName}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {isSidebarOpen && <div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
        
        {/* Main content */}
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors">
              <Icon path={icons.menu} />
            </button>
            <Link href="/"><a className="text-xl font-bold text-blue-600">PMIScout</a></Link>
            <div className="w-8" />
          </header>

          <main className="relative flex-1 overflow-y-auto focus:outline-none">
            <div className="py-6 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Icon path={icons.checkup} className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Report Analisi AI</h1>
                  <p className="text-lg text-slate-600">
                    {sessionData?.companies?.company_name ? `Analisi per ${sessionData.companies.company_name}` : 'Caricamento...'}
                  </p>
                </div>
              </div>
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
