import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function ProfilePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading, false = not auth, true = auth
  const [isLoading, setIsLoading] = useState(true);

  // --- Funzione per verificare l'autenticazione e recuperare dati utente ---
  const checkAuthenticationAndLoadUser = () => {
    if (typeof window !== 'undefined' && window.Outseta) {
      window.Outseta.getUser()
        .then(user => {
          if (user && user.Email) {
            // Utente autenticato - salva tutti i dati
            setIsAuthenticated(true);
            setUserName(user.FirstName || user.Email.split('@')[0]);
            setUserEmail(user.Email);
            setUserFullName(`${user.FirstName || ''} ${user.LastName || ''}`.trim() || user.Email);
            setIsLoading(false);
            
            // Log per debug (rimuovi in produzione)
            console.log('Dati utente recuperati:', {
              FirstName: user.FirstName,
              LastName: user.LastName,
              Email: user.Email,
              FullUser: user
            });
          } else {
            // Utente non autenticato - reindirizza al login
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
      // Outseta non ancora caricato, riprova dopo un breve delay
      setTimeout(checkAuthenticationAndLoadUser, 500);
    }
  };

  // --- Effect per verificare l'autenticazione al caricamento ---
  useEffect(() => {
    const waitForOutseta = () => {
      if (typeof window !== 'undefined' && window.Outseta) {
        checkAuthenticationAndLoadUser();
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
          <title>Caricamento Profilo - PMIScout</title>
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
                  load: 'auth,nocode,profile,support',
                  tokenStorage: 'cookie',
                  auth: {
                    authenticationCallbackUrl: window.location.origin + '/profilo'
                  }
                };
              `,
            }}
          />
          <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options" />
        </Head>

        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <h2 className="text-xl font-bold text-blue-600 mb-2">PMIScout</h2>
            <p className="text-slate-600">Caricamento profilo...</p>
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
            <p className="text-slate-600 mb-6">Devi effettuare il login per accedere al tuo profilo.</p>
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
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  };

  // --- Dati per la UI ---
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: true },
    { href: '#', text: 'Ricerca AI', icon: icons.search, active: false },
    { href: '#', text: 'Calcolatori', icon: icons.calculator, active: false },
    { href: '#', text: 'Marketplace', icon: icons.marketplace, active: false },
  ];

  // --- PAGINA PROFILO PRINCIPALE (solo per utenti autenticati) ---
  return (
    <>
      <Head>
        <title>Il Mio Profilo - PMIScout</title>
        <meta name="description" content="Gestisci le tue informazioni personali e di fatturazione su PMIScout" />
        
        <script src="https://cdn.tailwindcss.com"></script>
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>

        {/* Script Principale di Outseta con configurazione ottimizzata */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var o_options = {
                domain: 'pmiscout.outseta.com',
                load: 'auth,nocode,profile,support',
                tokenStorage: 'cookie',
                auth: {
                  authenticationCallbackUrl: window.location.origin + '/profilo'
                }
              };
            `,
          }}
        />
        <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options" />
        
      </Head>

      <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
        {/* Sidebar */}
        <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-center h-16 border-b">
              <Link href="/">
                <a className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  PMIScout
                </a>
              </Link>
            </div>

            {/* Navigation */}
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                {navLinks.map((link) => (
                   <Link key={link.text} href={link.href}>
                    <a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ 
                      link.active 
                        ? 'bg-blue-600 text-white' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' 
                    }`}>
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

              {/* Footer Support */}
              <div className="px-2 py-4 border-t">
                <a 
                  href="mailto:antonio@pmiscout.eu" 
                  className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors"
                >
                  <Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />
                  Supporto
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay per mobile */}
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
            <Link href="/">
              <a className="text-xl font-bold text-blue-600">PMIScout</a>
            </Link>
            <div className="w-8" />
          </header>

          <main className="relative flex-1 overflow-y-auto focus:outline-none">
            <div className="py-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              
              {/* Header della pagina */}
              <div className="flex flex-col pb-6 border-b md:flex-row md:items-center md:justify-between border-slate-200">
                <div>
                  {/* Breadcrumb */}
                  <nav className="flex items-center text-sm mb-2" aria-label="Breadcrumb">
                    <Link href="/">
                      <a className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
                        <Icon path={icons.home} className="w-4 h-4 mr-1" />
                        Dashboard
                      </a>
                    </Link>
                    <span className="mx-2 text-slate-400">/</span>
                    <span className="text-slate-600 font-medium">Profilo</span>
                  </nav>

                  <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
                    Il Mio Profilo
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {userFullName ? `Benvenuto ${userFullName}! ` : ''}
                    Gestisci le tue informazioni personali, di fatturazione e le preferenze dell'account.
                  </p>
                </div>

                <div className="flex items-center mt-4 space-x-3 md:mt-0">
                  <Link href="/">
                    <a className="flex items-center px-4 py-2 text-sm font-medium bg-white border rounded-lg shadow-sm text-slate-700 border-slate-300 hover:bg-slate-50 transition-colors">
                      <Icon path={icons.dashboard} className="w-5 h-5 mr-2 text-slate-500" />
                      Torna alla Dashboard
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

              {/* Card informazioni utente recuperate */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <Icon path={icons.user} className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">
                      Informazioni Account Recuperate
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Icon path={icons.user} className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-800">
                          <strong>Nome:</strong> {userFullName || 'Non specificato'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Icon path={icons.mail} className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-800">
                          <strong>Email:</strong> {userEmail}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-blue-700">
                      ✅ I dati sono stati recuperati correttamente da Outseta e sono disponibili per l'utilizzo nel tuo SaaS.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Widget del Profilo Outseta */}
              <div className="mt-8">
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Gestione Account Outseta</h2>
                    <p className="text-sm text-slate-600">
                      Modifica i tuoi dati personali, gestisci la fatturazione e le preferenze dell'account.
                    </p>
                  </div>
                  
                  {/* Widget Outseta Profile */}
                  <div data-o-profile="1" data-mode="embed"></div>
                  
                  {/* Fallback message */}
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 text-center">
                      Se il profilo non si carica correttamente, puoi accedere direttamente 
                      <a 
                        href="https://pmiscout.outseta.com/profile" 
                        className="ml-1 text-blue-600 hover:text-blue-800 underline transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        cliccando qui
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Sezione informazioni aggiuntive */}
              <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Card supporto */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center mb-4">
                    <Icon path={icons.support} className="w-6 h-6 text-blue-600 mr-3" />
                    <h3 className="text-lg font-semibold text-slate-900">Serve aiuto?</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Il nostro team di supporto è sempre disponibile per aiutarti con qualsiasi domanda o problema.
                  </p>
                  <a 
                    href="mailto:antonio@pmiscout.eu" 
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Contatta il Supporto
                  </a>
                </div>

                {/* Card sicurezza */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center mb-4">
                    <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-slate-900">Account Sicuro</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    I tuoi dati sono protetti con crittografia di livello bancario e autenticazione sicura.
                  </p>
                  <div className="flex items-center text-sm text-green-600">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Account Verificato - {userEmail}
                  </div>
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
