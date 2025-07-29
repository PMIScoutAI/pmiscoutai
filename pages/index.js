import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading, false = not auth, true = auth
  const [isLoading, setIsLoading] = useState(true);

  // --- Funzione per verificare l'autenticazione ---
  const checkAuthentication = () => {
    if (typeof window !== 'undefined' && window.Outseta) {
      window.Outseta.getUser()
        .then(user => {
          if (user && user.Email) {
            // Utente autenticato
            setIsAuthenticated(true);
            setUserName(user.FirstName || user.Email.split('@')[0]);
            setIsLoading(false);
          } else {
            // Utente non autenticato - reindirizza al login
            setIsAuthenticated(false);
            setIsLoading(false);
            // Reindirizza alla pagina di login di Outseta
            window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
          }
        })
        .catch(error => {
          console.error('Errore durante la verifica dell\'autenticazione:', error);
          setIsAuthenticated(false);
          setIsLoading(false);
          // In caso di errore, reindirizza comunque al login
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login';
        });
    } else {
      // Outseta non ancora caricato, riprova dopo un breve delay
      setTimeout(checkAuthentication, 500);
    }
  };

  // --- Effect per verificare l'autenticazione al caricamento ---
  useEffect(() => {
    // Aspetta che Outseta sia completamente caricato
    const waitForOutseta = () => {
      if (typeof window !== 'undefined' && window.Outseta) {
        checkAuthentication();
      } else {
        setTimeout(waitForOutseta, 100);
      }
    };

    waitForOutseta();
  }, []);

  // --- Loading screen mentre verifichiamo l'autenticazione ---
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

          {/* Script Outseta */}
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

  // --- Se non autenticato, mostra messaggio di reindirizzamento ---
  if (isAuthenticated === false) {
    return (
      <>
        <Head>
          <title>Accesso Richiesto - PMIScout</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
        </Head>

        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-blue-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Accesso Richiesto</h2>
            <p className="text-slate-600 mb-6">Devi effettuare il login per accedere alla dashboard.</p>
            <a 
              href="https://pmiscout.outseta.com/auth?widgetMode=login"
              className="inline-block w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Vai al Login
            </a>
          </div>
        </div>
      </>
    );
  }

  // --- Componenti Icona (per pulizia e riusabilità) ---
  const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {path}
    </svg>
  );

  // --- Collezione icone ---
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>,
    marketplace: <><path d="M12 2H6.5C4.5 2 3 3.5 3 5.5V18.5C3 20.5 4.5 22 6.5 22H17.5C19.5 22 21 20.5 21 18.5V12L12 2Z" /><path d="M12 2V12H21" /><path d="M15 22V18C15 16.9 15.9 16 17 16H19" /></>,
    support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
    cost: <><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" /><path d="M12 16v-4M12 8h.01" /></>,
    time: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    bureaucracy: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
    campaigns: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
    competitor: <><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" /><path d="m9 12 2 2 4-4" /></>,
  };

  // --- Dati per la UI ---
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: true },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    { href: '#', text: 'Ricerca AI', icon: icons.search, active: false },
    { href: '/calcolatori', text: 'Calcolatori', icon: icons.calculator, active: false }, // <-- MODIFICA EFFETTUATA QUI
    { href: '#', text: 'Marketplace', icon: icons.marketplace, active: false },
  ];

  const toolCards = [
    { title: 'Check-UP AI Azienda', description: 'Analisi approfondita della tua azienda tramite intelligenza artificiale.', linkText: 'Inizia analisi', href: '#', icon: icons.checkup },
    { title: 'Risparmio Costi', description: 'Identifica e ottimizza le spese per massimizzare i profitti.', linkText: 'Scopri come', href: '#', icon: icons.cost },
    { title: 'Risparmio Tempo', description: 'Automatizza i processi e guadagna tempo prezioso per il tuo business.', linkText: 'Automatizza ora', href: '#', icon: icons.time },
    { title: 'Semplifica Burocrazia', description: 'Gestisci documenti e adempimenti in modo facile e veloce.', linkText: 'Inizia a semplificare', href: '#', icon: icons.bureaucracy },
    { title: 'Ottimizza Campagne', description: 'Migliora il ROI delle tue campagne pubblicitarie con i nostri tool.', linkText: 'Ottimizza campagne', href: '#', icon: icons.campaigns },
    { title: 'Il tuo Competitor', description: 'Analizza la concorrenza e scopri i loro punti deboli e di forza.', linkText: 'Analizza competitor', href: '#', icon: icons.competitor },
  ];

  // --- DASHBOARD PRINCIPALE (solo per utenti autenticati) ---
  return (
    <>
      <Head>
        <title>Dashboard PMIScout</title>
        <meta name="description" content="Dashboard privata PMIScout - Accesso riservato agli utenti registrati" />
        
        <script src="https://cdn.tailwindcss.com"></script>
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>

        {/* Script Outseta */}
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
        {/* Sidebar */}
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
              
              {/* Status utente nella sidebar */}
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

        {/* Overlay mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Contenuto Principale */}
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          {/* Header mobile */}
          <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Apri menu"
            >
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
                    {userName ? `Benvenuto, ${userName}!` : 'Benvenuto, qui trovi tutti i tool per la tua crescita.'}
                  </p>
                </div>
                <div className="flex items-center mt-4 space-x-3 md:mt-0">
                  <Link href="/profilo">
                    <a className="flex items-center px-4 py-2 text-sm font-medium bg-white border rounded-lg shadow-sm text-slate-700 border-slate-300 hover:bg-slate-50 transition-colors">
                      <Icon path={icons.profile} className="w-5 h-5 mr-2 text-slate-500" />
                      Profilo
                    </a>
                  </Link>
                  <a 
                    href="https://pmiscout.outseta.com/auth?widgetMode=logout" 
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg shadow-sm hover:bg-red-700 transition-colors"
                  >
                    <Icon path={icons.logout} className="w-5 h-5 mr-2" />
                    Logout
                  </a>
                </div>
              </div>

              {/* Alert di benvenuto */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-blue-800">
                    <strong>Area Protetta:</strong> Questa dashboard è accessibile solo agli utenti registrati.
                  </p>
                </div>
              </div>

              <div className="relative p-8 mt-8 overflow-hidden text-white bg-center bg-cover rounded-lg shadow-lg" style={{ backgroundImage: "url('https://www.pmiscout.eu/wp-content/uploads/2022/03/115-business-consulting-agency_blog_4.jpg')" }}>
                <div className="absolute inset-0 bg-black bg-opacity-50" />
                <div className="relative z-10">
                  <h2
