// /pages/index.js (o il file della tua dashboard principale)
// VERSIONE AGGIORNATA CON PASSAGGIO DELL'EMAIL UTENTE ALLE API

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const AnalisiRecenti = ({ analyses, isLoading }) => {
  console.log('AnalisiRecenti render:', { analyses: analyses?.length, isLoading });

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
    // Non mostrare nulla se non ci sono analisi, per un'interfaccia più pulita.
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
          <Link key={analysis.session_id || index} href={`/analisi/${analysis.session_id}`}>
            <a className="block px-2 py-2 text-xs rounded-md hover:bg-slate-50 transition-colors">
              <div className="font-medium text-slate-700 truncate">
                {analysis.company_name}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(analysis.health_score)}`}>
                  {analysis.health_score}
                </span>
                <span className="text-slate-500">{formatDate(analysis.created_at)}</span>
              </div>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
};

// Componente UI “Sub-Hero Alert”
const SubHeroAlerts = ({ Icon, icons, userEmail }) => {
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        const fetchAlerts = async () => {
            // Non fare la chiamata se l'email non è ancora pronta
            if (!userEmail) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                // L'email viene già passata correttamente qui
                const response = await fetch(`/api/generate-alerts?email=${encodeURIComponent(userEmail)}`);
                if (!response.ok) {
                    throw new Error('Errore di rete o del server');
                }
                const data = await response.json();
                setAlerts(data);
            } catch (err) {
                setError('Impossibile caricare gli alert');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAlerts();
    }, [userEmail]); // Dipendenza corretta: riesegue il fetch quando userEmail cambia

    const stopRotation = () => clearInterval(intervalRef.current);
    
    const startRotation = () => {
        stopRotation(); // Previene intervalli multipli
        if (alerts.length > 1) {
            intervalRef.current = setInterval(() => {
                setCurrentIndex(prevIndex => (prevIndex + 1) % alerts.length);
            }, 5000);
        }
    };

    useEffect(() => {
        startRotation();
        return () => stopRotation();
    }, [alerts]);

    const getAlertColors = (alert) => {
        switch (alert.categoria) {
            case 'fiscale':
                if (alert.urgenza === 'alta') return 'bg-red-50 border-red-200 text-red-800';
                if (alert.urgenza === 'media') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
                return 'bg-slate-100 border-slate-200 text-slate-700';
            case 'bando':
                return 'bg-blue-50 border-blue-200 text-blue-800';
            case 'normativa':
                return 'bg-purple-50 border-purple-200 text-purple-800';
            default:
                return 'bg-slate-100 border-slate-200 text-slate-700';
        }
    };
    
    const getAlertIcon = (categoria) => {
        switch (categoria) {
            case 'fiscale': return icons.fiscale;
            case 'bando': return icons.bando;
            case 'normativa': return icons.normativa;
            default: return icons.support;
        }
    };

    if (isLoading) {
        return <div className="mt-8 p-4 h-16 bg-slate-100 rounded-lg animate-pulse"></div>;
    }

    if (error) {
        return <div className="mt-8 p-4 bg-slate-100 border border-slate-200 text-slate-600 text-sm rounded-lg">{error}</div>;
    }

    if (alerts.length === 0) {
        return <div className="mt-8 p-4 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg">Nessun alert disponibile oggi.</div>;
    }

    const currentAlert = alerts[currentIndex];

    return (
        <div 
            className={`mt-8 p-4 rounded-lg border transition-all duration-300 ${getAlertColors(currentAlert)}`}
            onMouseEnter={stopRotation}
            onMouseLeave={startRotation}
        >
            <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 mr-3">
                   <Icon path={getAlertIcon(currentAlert.categoria)} className="w-5 h-5" />
                </div>
                <div className="flex-grow">
                    <h3 className="font-bold text-sm">{currentAlert.titolo}</h3>
                    <p className="text-xs mt-1">{currentAlert.impatto_ai || currentAlert.descrizione || 'Approfondisci nella sezione risorse.'}</p>
                </div>
                {currentAlert.link && (
                    <a href={currentAlert.link} target="_blank" rel="noopener noreferrer" className="ml-4 flex-shrink-0 self-center px-3 py-1 text-xs font-semibold bg-white rounded-md shadow-sm hover:bg-slate-50 transition-colors">
                        {currentAlert.cta || 'Dettagli'} &rarr;
                    </a>
                )}
            </div>
        </div>
    );
};


export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userAnalyses, setUserAnalyses] = useState([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(true); // Impostato a true di default
  const [userEmail, setUserEmail] = useState('');
  const [icons, setIcons] = useState({}); // Stato per le icone

  const checkAuthentication = () => {
    if (typeof window !== 'undefined' && window.Outseta) {
      window.Outseta.getUser()
        .then(user => {
          if (user && user.Email) {
            setIsAuthenticated(true);
            setUserName(user.FirstName || user.Email.split('@')[0]);
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
      setTimeout(checkAuthentication, 100);
    }
  };

  useEffect(() => {
    checkAuthentication();
    // Definizione icone
    setIcons({
        dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
        profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
        calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>,
        marketplace: <><path d="M12 2H6.5C4.5 2 3 3.5 3 5.5V18.5C3 20.5 4.5 22 6.5 22H17.5C19.5 22 21 20.5 21 18.5V12L12 2Z" /><path d="M12 2V12H21" /><path d="M15 22V18C15 16.9 15.9 16 17 16H19" /></>,
        support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
        menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
        logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
        time: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
        bureaucracy: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
        xbrl: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="m9 15 3-3 3 3"></path></>,
        rag: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></>,
        fiscale: <><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"></path><path d="m15 9-6 6"></path><path d="M9 9h.01"></path><path d="M15 15h.01"></path></>,
        bando: <><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></>,
        normativa: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></>,
        checkbanche: <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path><path d="M12 5L8 21l4-7 4 7-4-16Z"></path></>,
    });
  }, []);

  const fetchUserAnalyses = async (email) => {
    if (!email) return;

    setIsLoadingAnalyses(true);
    try {
      const response = await fetch(`/api/user-analyses?email=${encodeURIComponent(email)}`, { 
        method: 'GET' 
      });

      if (response.ok) {
        const data = await response.json();
        setUserAnalyses(data.analyses || []);
      } else {
        console.error('Errore nella risposta del server:', response.status);
        setUserAnalyses([]);
      }
    } catch (error) {
      console.error('Errore durante il fetch delle analisi utente:', error);
      setUserAnalyses([]);
    } finally {
      setIsLoadingAnalyses(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userEmail) {
      fetchUserAnalyses(userEmail);
    }
  }, [isAuthenticated, userEmail]);

  if (isLoading || isAuthenticated === null) {
    return (
      <>
        <Head>
          <title>Caricamento - PMIScout</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
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
            <p className="text-slate-600">Verifica dell'autenticazione in corso...</p>
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

  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: true },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    { href: 'https://pmiscoutai.vercel.app/check-ai-xbrl', text: 'Check-AI XBRL', icon: icons.xbrl, active: false },
    { href: '#', text: 'Marketplace', icon: icons.marketplace, active: false },
  ];
  
  const toolCards = [
    { title: 'Check-AI XBRL', description: 'Carica un file XBRL per un\'analisi finanziaria istantanea e precisa.', linkText: 'Avvia Analisi XBRL', href: '/check-ai-xbrl', icon: icons.xbrl },
    { title: 'Analisi Attività (RAG)', description: 'Analisi potenziata con tecnologia RAG per una precisione e un dettaglio superiori.', linkText: 'Avvia Analisi Attività', href: '/checkup-hd', icon: icons.rag },
    { title: 'Check Banche', description: 'Verifica la tua bancabilità, confronta finanziamenti esistenti e trova condizioni migliori sul mercato.', linkText: 'Controlla le tue banche', href: '/check-banche', icon: icons.checkbanche },
    { title: 'Risparmio Tempo', description: 'Automatizza i processi e guadagna tempo prezioso.', linkText: 'Automatizza ora', href: '#', icon: icons.time },
    { title: 'Semplifica Burocrazia', description: 'Gestisci documenti e adempimenti in modo facile e veloce.', linkText: 'Inizia a semplificare', href: '#', icon: icons.bureaucracy },
  ];

  return (
    <>
      <Head>
        <title>Dashboard PMIScout</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
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
        <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
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
              
              <AnalisiRecenti analyses={userAnalyses} isLoading={isLoadingAnalyses} />

              <div className="px-2 py-3 border-t border-slate-200">
                <div className="flex items-center px-2 py-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Connesso come {userName}
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
            <div className="py-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col pb-6 border-b md:flex-row md:items-center md:justify-between border-slate-200">
                <div>
                  <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">Dashboard</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {userName ? `Benvenuto, ${userName}!` : 'Benvenuto!'}
                  </p>
                </div>
                <div className="flex items-center mt-4 space-x-3 md:mt-0">
                  <Link href="/profilo">
                    <a className="flex items-center px-4 py-2 text-sm font-medium bg-white border rounded-lg shadow-sm text-slate-700 border-slate-300 hover:bg-slate-50 transition-colors">
                      <Icon path={icons.profile} className="w-5 h-5 mr-2 text-slate-500" />
                      Profilo
                    </a>
                  </Link>
                  <a href="https://pmiscout.outseta.com/auth?widgetMode=logout" className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg shadow-sm hover:bg-red-700 transition-colors">
                    <Icon path={icons.logout} className="w-5 h-5 mr-2" />
                    Logout
                  </a>
                </div>
              </div>
              
              <div className="relative p-8 mt-8 overflow-hidden text-white bg-center bg-cover rounded-lg shadow-lg" style={{ backgroundImage: "url('https://www.pmiscout.eu/wp-content/uploads/2022/03/115-business-consulting-agency_blog_4.jpg')" }}>
                <div className="absolute inset-0 bg-black bg-opacity-50" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold md:text-3xl">Inizia con il Check-AI XBRL</h2>
                  <p className="mt-2 text-gray-200">La nuova analisi basata su file XBRL per la massima precisione.</p>
                  <Link href="/check-ai-xbrl" legacyBehavior>
                    <a className="inline-block px-5 py-2 mt-6 font-semibold text-blue-600 bg-white rounded-lg shadow-md hover:bg-blue-50 transition-colors">Esegui Analisi &rarr;</a>
                  </Link>
                </div>
              </div>

              <SubHeroAlerts Icon={Icon} icons={icons} userEmail={userEmail} />

              <div className="mt-10">
                <h2 className="text-lg font-semibold leading-6 text-slate-900">I tuoi Macro Tool</h2>
                <div className="grid grid-cols-1 gap-6 mt-4 sm:grid-cols-2 lg:grid-cols-3">
                  {toolCards.map((card) => (
                    <div key={card.title} className="flex flex-col h-full p-6 transition-all duration-300 bg-white border rounded-lg shadow-sm hover:shadow-xl hover:-translate-y-1">
                      <div className="flex-grow">
                        <div className="p-3 bg-blue-100 rounded-lg w-fit">
                          <Icon path={card.icon} className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">{card.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">{card.description}</p>
                      </div>
                      <a href={card.href} className="inline-block mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">{card.linkText} &rarr;</a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

