import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// Componente Sidebar riutilizzato dalla Dashboard
const Sidebar = ({ isOpen, user, analyses, isLoadingAnalyses, navLinks, icons, Icon }) => {
    return (
        <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isOpen ? 'translate-x-0' : '-translate-x-full' }`}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b">
              <h1 className="text-2xl font-bold text-blue-600">PMIScout</h1>
            </div>
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                {navLinks.map((link) => (
                  <Link key={link.text} href={link.href}>
                    <a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ link.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}>
                      <Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />
                      {link.text}
                    </a>
                  </Link>
                ))}
              </nav>
              
              <AnalisiRecenti analyses={analyses} isLoading={isLoadingAnalyses} />

              <div className="px-2 py-3 border-t border-slate-200">
                <div className="flex items-center px-2 py-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Connesso come {user?.name}
                </div>
              </div>

              <div className="px-2 py-4 border-t">
                <a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors">
                  <Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />
                  Supporto
                </a>
              </div>
            </div>
          </div>
        </aside>
    );
};

const AnalisiRecenti = ({ analyses, isLoading }) => {
  if (isLoading) {
    return (
      <div className="px-2 py-3 border-t border-slate-200">
        <h4 className="px-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Analisi Recenti</h4>
        <div className="px-2 py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }
  if (!analyses || analyses.length === 0) {
    return null;
  }
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };
  const getScoreColor = (score) => {
    if (score >= 75) return 'bg-green-100 text-green-800';
    if (score >= 50) return 'bg-blue-100 text-blue-800';
    if (score >= 25) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };
  return (
    <div className="px-2 py-3 border-t border-slate-200">
      <h4 className="px-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Analisi Recenti</h4>
      <div className="space-y-1">
        {analyses.map((analysis, index) => (
          <Link key={index} href={`/analisi/${analysis.session_id}`}>
            <a className="block px-2 py-2 text-xs rounded-md hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-700 truncate">{analysis.company_name}</div>
              <div className="flex items-center justify-between mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(analysis.health_score)}`}>{analysis.health_score}</span>
                <span className="text-slate-500">{formatDate(analysis.created_at)}</span>
              </div>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
};


export default function CheckBanche() {
  const [user, setUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [recentAnalyses, setRecentAnalyses] = useState([]); // Per la sidebar
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [bankingScore, setBankingScore] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScoreLoading, setIsScoreLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleAuth = () => {
      window.Outseta.getUser()
        .then(userData => {
          if (userData && userData.Email) {
            setUser({ name: userData.FirstName || userData.Email.split('@')[0], email: userData.Email });
            setUserEmail(userData.Email);
            fetchAnalyses(userData.Email);
            fetchRecentAnalyses(userData.Email);
          } else {
            setIsLoading(false);
          }
        })
        .catch(err => {
            console.error("Errore recupero utente Outseta:", err);
            setIsLoading(false);
        });
    };

    if (typeof window !== 'undefined' && window.Outseta) {
      handleAuth();
    } else {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && window.Outseta) {
          handleAuth();
        } else {
          console.error("Outseta non è stato caricato in tempo.");
          setIsLoading(false);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchAnalyses = async (email) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/banking-analysis?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Risposta non valida dal server');
      const data = await response.json();
      setAnalyses(data.analyses || []);
      if (data.analyses && data.analyses.length > 0) {
        await handleAnalysisSelect(data.analyses[0], email);
      }
    } catch (error) {
      console.error('Errore caricamento analisi:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchRecentAnalyses = async (email) => {
     try {
        const response = await fetch(`/api/user-analyses?email=${encodeURIComponent(email)}`);
        if(response.ok) {
            const data = await response.json();
            setRecentAnalyses(data.analyses || []);
        }
     } catch (error) {
        console.error("Errore caricamento analisi recenti:", error);
     }
  };

  const handleAnalysisSelect = async (analysis, email) => {
    setSelectedAnalysis(analysis);
    setBankingScore(null);
    setIsScoreLoading(true);
    const emailToUse = email || userEmail;
    try {
      const response = await fetch(
        `/api/banking-analysis?email=${encodeURIComponent(emailToUse)}&session_id=${analysis.session_id}`
      );
      if (!response.ok) throw new Error('Risposta non valida dal server per lo score');
      const data = await response.json();
      setBankingScore(data.banking_score);
    } catch (error) {
      console.error('Errore caricamento score:', error);
    } finally {
      setIsScoreLoading(false);
    }
  };
  
  const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {path}
    </svg>
  );

  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>,
    marketplace: <><path d="M12 2H6.5C4.5 2 3 3.5 3 5.5V18.5C3 20.5 4.5 22 6.5 22H17.5C19.5 22 21 20.5 21 18.5V12L12 2Z" /><path d="M12 2V12H21" /><path d="M15 22V18C15 16.9 15.9 16 17 16H19" /></>,
    support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    xbrl: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="m9 15 3-3 3 3"></path></>,
    checkbanche: <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path><path d="M12 5L8 21l4-7 4 7-4-16Z"></path></>,
  };

  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/check-banche', text: 'Check Banche', icon: icons.checkbanche, active: true },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    { href: '/calcolatori', text: 'Calcolatori', icon: icons.calculator, active: false },
  ];

  return (
    <>
      <Head>
        <title>Check Banche - PMIScout</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
        <Sidebar 
            isOpen={isSidebarOpen} 
            user={user} 
            analyses={recentAnalyses} 
            isLoadingAnalyses={false} 
            navLinks={navLinks}
            icons={icons}
            Icon={Icon}
        />

        {isSidebarOpen && (
          <div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <div className="flex flex-col flex-1 w-0 overflow-hidden">
            <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors" aria-label="Apri menu">
                <Icon path={icons.menu} />
                </button>
                <h1 className="text-xl font-bold text-blue-600">PMIScout</h1>
                <div className="w-8" />
            </header>

            <main className="relative flex-1 overflow-y-auto focus:outline-none">
                <div className="py-8 mx-auto max-w-6xl px-4">
                {/* Header con breadcrumb */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mt-2">Check Banche</h1>
                    <p className="text-slate-600">Verifica la tua bancabilità e confronta le condizioni di mercato</p>
                </div>

                {isLoading ? (
                    <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Caricamento analisi...</p>
                    </div>
                ) : analyses.length === 0 ? (
                    // Nessuna analisi XBRL disponibile
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Nessuna Analisi Disponibile</h2>
                    <p className="text-slate-600 mb-6">Per utilizzare Check Banche, devi prima completare un'analisi XBRL della tua azienda.</p>
                    <Link href="/check-ai-xbrl">
                        <a className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                        Inizia Analisi XBRL
                        </a>
                    </Link>
                    </div>
                ) : (
                    <div className="space-y-8">
                    {/* Selector Analisi */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Seleziona Analisi</h2>
                        <div className="space-y-3">
                        {analyses.map((analysis) => (
                            <div
                            key={analysis.session_id}
                            className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                selectedAnalysis?.session_id === analysis.session_id
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            onClick={() => handleAnalysisSelect(analysis)}
                            >
                            <div className="flex justify-between items-start">
                                <div>
                                <h3 className="font-medium text-slate-900">{analysis.company_name}</h3>
                                <p className="text-sm text-slate-600">
                                    Analisi del {new Date(analysis.created_at).toLocaleDateString('it-IT')}
                                </p>
                                <p className="text-sm text-slate-600">
                                    Health Score: {analysis.health_score} | Settore: {analysis.ateco_code}
                                </p>
                                </div>
                                <div className="text-right">
                                <span className="text-sm font-medium text-slate-900">
                                    Fatturato: €{analysis.fatturato?.toLocaleString('it-IT') || 'N/D'}
                                </span>
                                </div>
                            </div>
                            </div>
                        ))}
                        </div>
                    </div>

                    {/* Dashboard Bancabilità */}
                    {selectedAnalysis && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Card Situazione Attuale */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Situazione Attuale</h3>
                            <div className="space-y-3">
                            <div>
                                <span className="text-sm text-slate-600">Current Ratio</span>
                                <p className={`text-xl font-bold ${selectedAnalysis.current_ratio < 1.2 ? 'text-red-600' : 'text-green-600'}`}>
                                {selectedAnalysis.current_ratio?.toFixed(2) || 'N/D'}
                                </p>
                            </div>
                            <div>
                                <span className="text-sm text-slate-600">Debiti/Patrimonio</span>
                                <p className="text-xl font-bold text-slate-900">
                                {selectedAnalysis.patrimonio_netto > 0 ? ((selectedAnalysis.debiti_totali / selectedAnalysis.patrimonio_netto)).toFixed(2) : 'N/D'}
                                </p>
                            </div>
                            </div>
                        </div>

                        {/* Card Capacità di Credito */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Capacità di Credito</h3>
                            {isScoreLoading ? (
                            <div className="space-y-3">
                                <div>
                                <span className="text-sm text-slate-600">DSCR</span>
                                <div className="h-7 bg-gray-200 rounded animate-pulse w-1/2"></div>
                                </div>
                                <div>
                                <span className="text-sm text-slate-600">Classe MCC</span>
                                <div className="h-7 bg-gray-200 rounded animate-pulse w-1/4"></div>
                                </div>
                            </div>
                            ) : bankingScore ? (
                            <div className="space-y-3">
                                <div>
                                <span className="text-sm text-slate-600">DSCR</span>
                                <p className="text-xl font-bold text-blue-600">{bankingScore.dscr_ratio?.toFixed(2)}</p>
                                </div>
                                <div>
                                <span className="text-sm text-slate-600">Classe MCC</span>
                                <p className="text-xl font-bold text-blue-600">{bankingScore.mcc_class}</p>
                                </div>
                            </div>
                            ) : (
                            <p className="text-sm text-slate-500">Dati non disponibili.</p>
                            )}
                        </div>

                        {/* Card Punti di Forza */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Punti di Forza</h3>
                            <div className="space-y-2">
                            <p className="text-sm text-green-600">✓ Health Score: {selectedAnalysis.health_score}/100</p>
                            <p className="text-sm text-green-600">✓ Settore: {selectedAnalysis.ateco_code}</p>
                            {selectedAnalysis.current_ratio > 1.5 ? (
                                <p className="text-sm text-green-600">✓ Buona liquidità</p>
                            ) : null}
                            </div>
                        </div>
                        </div>
                    )}

                    {/* Sezione Contratti */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">I Tuoi Finanziamenti</h2>
                        <div className="text-center py-8">
                        <p className="text-slate-600 mb-4">Nessun contratto caricato</p>
                        <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
                            Aggiungi Finanziamento
                        </button>
                        </div>
                    </div>

                    {/* Confronto Tassi */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Tassi di Mercato</h2>
                        <div className="text-center py-8 text-slate-600">
                        Sezione in sviluppo - Confronto con benchmark di settore
                        </div>
                    </div>
                    </div>
                )}
                </div>
            </main>
        </div>
      </div>
    </>
  );
}
