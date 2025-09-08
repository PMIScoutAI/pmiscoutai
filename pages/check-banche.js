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

const MarketRatesSection = ({ selectedAnalysis, userContracts, isLoading }) => {
  const [marketRates, setMarketRates] = useState(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  
  useEffect(() => {
    if (selectedAnalysis?.ateco_code) { // Modificato per usare ateco_code
      fetchMarketRates();
    }
  }, [selectedAnalysis]);

  const fetchMarketRates = async () => {
    setIsLoadingRates(true);
    try {
      // Estrai "41" da "41.00.00"
      const division = selectedAnalysis.ateco_code.split('.')[0]; // "41"
          
      console.log("Divisione estratta:", division);
          
      const response = await fetch(
        `/api/market-rates?ateco_division=${division}&rating_class=3&loan_type=chirografario`
      );
          
      if (response.ok) {
        const data = await response.json();
        console.log("Market rates ricevuti:", data);
        setMarketRates(data);
      }
    } catch (error) {
      console.error('Errore caricamento tassi mercato:', error);
    } finally {
      setIsLoadingRates(false);
    }
  };

  const calculateUserAverage = () => {
    if (!userContracts.length) return null;
    const totalRate = userContracts.reduce((sum, contract) => sum + parseFloat(contract.rate_taeg || 0), 0);
    return (totalRate / userContracts.length).toFixed(2);
  };
  const userAvgRate = calculateUserAverage();
  if (isLoading || !selectedAnalysis) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Tassi di Mercato</h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Caricamento benchmark...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Tassi di Mercato</h2>
            {isLoadingRates ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Caricamento tassi...</p>
        </div>
      ) : marketRates ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-medium text-slate-900">Benchmark Settore {selectedAnalysis.ateco_code}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Tasso Medio Mercato:</span>
                <span className="font-medium">{marketRates.market_avg}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Range Mercato:</span>
                <span className="font-medium">{marketRates.market_range}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Range Stimato per Te:</span>
                <span className="font-medium text-blue-600">{marketRates.your_estimated_range}</span>
              </div>
            </div>
          </div>
          {userAvgRate && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-900">Il Tuo Confronto</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tuo TAEG Medio:</span>
                  <span className="font-medium">{userAvgRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">vs Mercato:</span>
                  <span className={`font-medium ${parseFloat(userAvgRate) > marketRates.market_avg ? 'text-red-600' : 'text-green-600'}`}>
                    {parseFloat(userAvgRate) > marketRates.market_avg ?
                      `+${(parseFloat(userAvgRate) - marketRates.market_avg).toFixed(2)}%` :
                      `${(parseFloat(userAvgRate) - marketRates.market_avg).toFixed(2)}%`
                    }
                  </span>
                </div>
                {parseFloat(userAvgRate) > marketRates.market_avg + 1 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      💡 I tuoi tassi sono sopra la media. Considera una rinegoziazione.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-600">
          Dati di mercato non disponibili per il settore {selectedAnalysis.ateco_code}
        </div>
      )}
    </div>
  );
};

export default function CheckBanche() {
  const [user, setUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [bankingScore, setBankingScore] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(false);
  const [isScoreLoading, setIsScoreLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [userContracts, setUserContracts] = useState([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [contractForm, setContractForm] = useState({
    bank_name: '',
    amount: '',
    rate_tan: '',
    rate_taeg: '',
    duration_months: '',
    loan_type: 'chirografario',
    monthly_payment: '',
    start_date: '',
    guarantees: ''
  });

  // Applica lo stesso pattern di autenticazione della dashboard
  const checkAuthentication = () => {
    if (typeof window !== 'undefined' && window.Outseta) {
      window.Outseta.getUser()
        .then(user => {
          if (user && user.Email) {
            setIsAuthenticated(true);
            setUser({ name: user.FirstName || user.Email.split('@')[0], email: user.Email });
            setUserEmail(user.Email);
            setIsLoading(false);
          } else {
            setIsAuthenticated(false);
            setIsLoading(false);
            window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
          }
        })
        .catch(error => {
          console.error('Errore durante la verifica dell\'autenticazione:', error);
          setIsAuthenticated(false);
          setIsLoading(false);
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login';
        });
    } else {
      setTimeout(checkAuthentication, 100); // 100ms come nella dashboard
    }
  };

  useEffect(() => {
    const waitForOutseta = () => {
      if (typeof window !== 'undefined' && window.Outseta) {
        checkAuthentication();
      } else {
        setTimeout(waitForOutseta, 100);
      }
    };
    waitForOutseta();
  }, []);

  // Carica i dati solo dopo l'autenticazione
  useEffect(() => {
    if (isAuthenticated && userEmail) {
      loadAllData();
      fetchUserContracts();
    }
  }, [isAuthenticated, userEmail]);

  const loadAllData = async () => {
    setIsLoadingAnalyses(true);
    try {
      await Promise.all([
        fetchAnalyses(userEmail),
        fetchRecentAnalyses(userEmail)
      ]);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setIsLoadingAnalyses(false);
    }
  };

  const fetchAnalyses = async (email) => {
    try {
      console.log("Chiamando API banking-analysis per:", email);
      const response = await fetch(`/api/banking-analysis?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Risposta non valida dal server');
      const data = await response.json();
      console.log("Dati ricevuti da banking-analysis:", data);
      setAnalyses(data.analyses || []);
      if (data.analyses && data.analyses.length > 0) {
        await handleAnalysisSelect(data.analyses[0], email);
      }
    } catch (error) {
      console.error('Errore caricamento analisi:', error);
    }
  };
  
  const fetchRecentAnalyses = async (email) => {
    try {
      const response = await fetch(`/api/user-analyses?email=${encodeURIComponent(email)}`);
      if(response.ok) {
        const data = await response.json();
        console.log("Analisi recenti caricate:", data.analyses?.length || 0);
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

  const resetContractForm = () => {
    setContractForm({
      bank_name: '',
      amount: '',
      rate_tan: '',
      rate_taeg: '',
      duration_months: '',
      loan_type: 'chirografario',
      monthly_payment: '',
      start_date: '',
      guarantees: ''
    });
  };

  const handleSaveContract = async () => {
    try {
      const url = selectedContract ? '/api/update-contract' : '/api/save-contract';
      const body = selectedContract 
        ? { contract_id: selectedContract.id, contract_data: contractForm }
        : { user_email: userEmail, contract_data: contractForm };

      const response = await fetch(url, {
        method: selectedContract ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowAddContractModal(false);
        setShowEditContractModal(false);
        setSelectedContract(null);
        resetContractForm();
        fetchUserContracts();
      }
    } catch (error) {
      console.error('Errore salvataggio contratto:', error);
    }
  };

  const handleEditContract = (contract) => {
    setSelectedContract(contract);
    setContractForm({
      bank_name: contract.bank_name || '',
      amount: contract.amount || '',
      rate_tan: contract.rate_tan || '',
      rate_taeg: contract.rate_taeg || '',
      duration_months: contract.duration_months || '',
      loan_type: contract.loan_type || 'chirografario',
      monthly_payment: contract.monthly_payment || '',
      start_date: contract.start_date || '',
      guarantees: contract.guarantees || ''
    });
    setShowEditContractModal(true);
  };

  const handleDeleteContract = async () => {
    if (!selectedContract) return;
    
    try {
      const response = await fetch('/api/save-contract', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: selectedContract.id })
      });

      if (response.ok) {
        setShowDeleteConfirm(false);
        setSelectedContract(null);
        fetchUserContracts();
      }
    } catch (error) {
      console.error('Errore eliminazione contratto:', error);
    }
  };

  const confirmDelete = (contract) => {
    setSelectedContract(contract);
    setShowDeleteConfirm(true);
  };

  const fetchUserContracts = async () => {
    if (!userEmail) return;
    setIsLoadingContracts(true);
    try {
      const response = await fetch(`/api/user-contracts?email=${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const data = await response.json();
        setUserContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Errore caricamento contratti:', error);
    } finally {
      setIsLoadingContracts(false);
    }
  };
  
  // Loading state come nella dashboard
  if (isLoading || isAuthenticated === null) {
    return (
      <>
        <Head>
          <title>Check Banche - PMIScout</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                var o_options = {
                  domain: 'pmiscout.outseta.com',
                  load: 'auth,customForm,emailList,leadCapture,nocode,profile,support',
                  tokenStorage: 'cookie'
                };
              `,
            }}
          />
          <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
        </Head>
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <h2 className="text-xl font-bold text-blue-600 mb-2">PMIScout</h2>
            <p className="text-slate-600">Caricamento Check Banche...</p>
          </div>
        </div>
      </>
    );
  }

  if (isAuthenticated === false) {
    return (
      <>
        <Head>
          <title>Accesso Richiesto - PMIScout</title>
        </Head>
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Accesso Richiesto</h2>
            <p className="text-slate-600 mb-6">Devi effettuare il login per accedere a Check Banche.</p>
            <a href="https://pmiscout.outseta.com/auth?widgetMode=login" className="inline-block w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Vai al Login
            </a>
          </div>
        </div>
      </>
    );
  }

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
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="m18.5 2.5 a2.12 2.12 0 0 1 3 3l-9.5 9.5-4 1 1-4z"></path></>,
    delete: <><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></>,
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var o_options = {
                domain: 'pmiscout.outseta.com',
                load: 'auth,customForm,emailList,leadCapture,nocode,profile,support',
                tokenStorage: 'cookie'
              };
            `,
          }}
        />
        <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
      </Head>

      <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
        <Sidebar 
            isOpen={isSidebarOpen} 
            user={user} 
            analyses={recentAnalyses} 
            isLoadingAnalyses={isLoadingAnalyses}
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
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mt-2">Check Banche</h1>
                    <p className="text-slate-600">Verifica la tua bancabilità e confronta le condizioni di mercato</p>
                </div>

                {isLoadingAnalyses ? (
                    <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Caricamento analisi...</p>
                    </div>
                ) : analyses.length === 0 ? (
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

                    {selectedAnalysis && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    
                    {/* Sezione Contratti con Edit/Delete */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h2 className="text-xl font-bold text-slate-900 mb-4">I Tuoi Finanziamenti</h2>
                      {isLoadingContracts ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                          <p className="mt-4 text-slate-600">Caricamento contratti...</p>
                        </div>
                      ) : userContracts.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-slate-600 mb-4">Nessun contratto caricato</p>
                          <button
                             onClick={() => setShowAddContractModal(true)}
                            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                          >
                            Aggiungi Finanziamento
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {userContracts.map((contract) => (
                            <div key={contract.id} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h3 className="font-medium text-slate-900">{contract.bank_name}</h3>
                                  <p className="text-sm text-slate-600">
                                    Importo: €{contract.amount?.toLocaleString('it-IT')} | TAN: {contract.rate_tan}% | TAEG: {contract.rate_taeg}%
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    Durata: {contract.duration_months} mesi | Rata: €{contract.monthly_payment?.toLocaleString('it-IT')}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  <button
                                    onClick={() => handleEditContract(contract)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Modifica finanziamento"
                                  >
                                    <Icon path={icons.edit} className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => confirmDelete(contract)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Elimina finanziamento"
                                  >
                                    <Icon path={icons.delete} className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                             onClick={() => setShowAddContractModal(true)}
                            className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-slate-600 hover:border-slate-400 hover:text-slate-700"
                          >
                            + Aggiungi Altro Finanziamento
                          </button>
                        </div>
                      )}
                    </div>

                    <MarketRatesSection
                      selectedAnalysis={selectedAnalysis}
                      userContracts={userContracts}
                      isLoading={isLoadingAnalyses}
                    />
                    </div>
                )}
                </div>
            </main>
        </div>

        {/* Modal Aggiungi Finanziamento */}
        {showAddContractModal && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-90vh overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Aggiungi Finanziamento</h2>
                  <button
                     onClick={() => setShowAddContractModal(false)}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>
                        
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Banca</label>
                      <input
                        type="text"
                        value={contractForm.bank_name}
                        onChange={(e) => setContractForm({...contractForm, bank_name: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. Intesa Sanpaolo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Importo (€)</label>
                      <input
                        type="number"
                        value={contractForm.amount}
                        onChange={(e) => setContractForm({...contractForm, amount: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 100000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">TAN (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={contractForm.rate_tan}
                        onChange={(e) => setContractForm({...contractForm, rate_tan: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 4.50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">TAEG (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={contractForm.rate_taeg}
                        onChange={(e) => setContractForm({...contractForm, rate_taeg: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 4.80"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Durata (mesi)</label>
                      <input
                        type="number"
                        value={contractForm.duration_months}
                        onChange={(e) => setContractForm({...contractForm, duration_months: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 60"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Rata Mensile (€)</label>
                      <input
                        type="number"
                        value={contractForm.monthly_payment}
                        onChange={(e) => setContractForm({...contractForm, monthly_payment: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 1850"
                      />
                    </div>
                     <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Data Inizio</label>
                      <input
                        type="date"
                        value={contractForm.start_date}
                        onChange={(e) => setContractForm({...contractForm, start_date: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                            
                  <div className="flex gap-4 pt-6">
                    <button
                      onClick={() => setShowAddContractModal(false)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleSaveContract}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Salva Finanziamento
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Modifica Finanziamento */}
        {showEditContractModal && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-90vh overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Modifica Finanziamento</h2>
                  <button
                     onClick={() => { setShowEditContractModal(false); setSelectedContract(null); resetContractForm(); }}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>
                        
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Banca</label>
                      <input
                        type="text"
                        value={contractForm.bank_name}
                        onChange={(e) => setContractForm({...contractForm, bank_name: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. Intesa Sanpaolo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Importo (€)</label>
                      <input
                        type="number"
                        value={contractForm.amount}
                        onChange={(e) => setContractForm({...contractForm, amount: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 100000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">TAN (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={contractForm.rate_tan}
                        onChange={(e) => setContractForm({...contractForm, rate_tan: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 4.50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">TAEG (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={contractForm.rate_taeg}
                        onChange={(e) => setContractForm({...contractForm, rate_taeg: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 4.80"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Durata (mesi)</label>
                      <input
                        type="number"
                        value={contractForm.duration_months}
                        onChange={(e) => setContractForm({...contractForm, duration_months: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 60"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Rata Mensile (€)</label>
                      <input
                        type="number"
                        value={contractForm.monthly_payment}
                        onChange={(e) => setContractForm({...contractForm, monthly_payment: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="es. 1850"
                      />
                    </div>
                     <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Data Inizio</label>
                      <input
                        type="date"
                        value={contractForm.start_date}
                        onChange={(e) => setContractForm({...contractForm, start_date: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                            
                  <div className="flex gap-4 pt-6">
                    <button
                      onClick={() => { setShowEditContractModal(false); setSelectedContract(null); resetContractForm(); }}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleSaveContract}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Salva Modifiche
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Conferma Cancellazione */}
        {showDeleteConfirm && selectedContract && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                  <Icon path={icons.delete} className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 text-center mb-2">Conferma Cancellazione</h2>
                <p className="text-slate-600 text-center mb-6">
                  Sei sicuro di voler eliminare il finanziamento con <strong>{selectedContract.bank_name}</strong>?
                  <br />
                  <span className="text-sm">Questa azione non può essere annullata.</span>
                </p>
                            
                <div className="flex gap-4">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setSelectedContract(null); }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleDeleteContract}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
