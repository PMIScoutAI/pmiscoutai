import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function CalcolatoriHub() {
  // --- La logica di autenticazione e lo stato rimangono invariati ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthentication = () => {
    if (typeof window !== 'undefined' && window.Outseta) {
      window.Outseta.getUser()
        .then(user => {
          if (user && user.Email) {
            setIsAuthenticated(true);
            setUserName(user.FirstName || user.Email.split('@')[0]);
            setIsLoading(false);
          } else {
            setIsAuthenticated(false);
            setIsLoading(false);
            window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
          }
        })
        .catch(() => {
          setIsAuthenticated(false);
          setIsLoading(false);
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login';
        });
    } else {
      setTimeout(checkAuthentication, 500);
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

  if (isLoading || isAuthenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
  }
  if (isAuthenticated === false) {
    return <div className="flex items-center justify-center min-h-screen">Accesso richiesto...</div>;
  }

  // --- Definizioni UI ---
  const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg>
  );

  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>,
    marketplace: <><path d="M12 2H6.5C4.5 2 3 3.5 3 5.5V18.5C3 20.5 4.5 22 6.5 22H17.5C19.5 22 21 20.5 21 18.5V12L12 2Z" /><path d="M12 2V12H21" /><path d="M15 22V18C15 16.9 15.9 16 17 16H19" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    // --- NUOVE ICONE PER I CALCOLATORI ---
    fondoGaranzia: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    valutazioneAziendale: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    capacitaAcquisto: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>,
    rendimentoInvestimento: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    ratingBancario: <><path d="M12 12c-2 0-4.5 1-6 2.5s-1.5 4-1.5 4" /><path d="M21.5 18.5c-.5-1-2.5-3.5-5-5" /><path d="M12 12c2 0 4.5 1 6 2.5s1.5 4 1.5 4" /><path d="M2.5 18.5c.5-1 2.5-3.5 5-5" /><circle cx="12" cy="12" r="10" /><path d="m12 12-2 4" /></>
  };
  
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    { href: '#', text: 'Ricerca AI', icon: icons.search, active: false },
    { href: '/calcolatori', text: 'Calcolatori', icon: icons.calculator, active: true },
    { href: '#', text: 'Marketplace', icon: icons.marketplace, active: false },
  ];

  // --- DATI PER LE CARD DEI CALCOLATORI ---
  const calculatorCards = [
    {
      title: 'Simulazione Fondo Garanzia PMI',
      description: 'Verifica l\'ammissibilità e l\'importo della garanzia statale per i tuoi finanziamenti.',
      href: '/calcolatori/simulazione-fondo-garanzia',
      icon: icons.fondoGaranzia,
    },
    {
      title: 'Calcolatore Valutazione Aziendale',
      description: 'Ottieni una stima del valore della tua impresa basata su multipli di mercato.',
      href: '/calcolatori/valutazione-aziendale',
      icon: icons.valutazioneAziendale,
    },
    {
      title: 'Calcolatore Capacità di Acquisto',
      description: 'Determina il potenziale di acquisizione per i tuoi prossimi investimenti aziendali.',
      href: '/calcolatori/capacita-acquisto',
      icon: icons.capacitaAcquisto,
    },
    {
      title: 'Calcolatore Rendimento Investimento (ROI)',
      description: 'Analizza l\'efficacia e il ritorno economico degli investimenti per acquisizioni.',
      href: '/calcolatori/rendimento-investimento',
      icon: icons.rendimentoInvestimento,
    },
    {
      title: 'Simulatore Rating Bancario Semplificato',
      description: 'Simula il tuo rating creditizio per migliorare l\'accesso al credito bancario.',
      href: '/calcolatori/simulatore-rating-bancario',
      icon: icons.ratingBancario,
    },
  ];

  return (
    <>
      <Head>
        <title>Calcolatori - PMIScout</title>
        <meta name="description" content="Calcolatori e strumenti per la tua PMI." />
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
        <script dangerouslySetInnerHTML={{ __html: `var o_options = { domain: 'pmiscout.outseta.com' };` }} />
        <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
      </Head>

      <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
        <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
            {/* Sidebar content */}
            <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b"><h1 className="text-2xl font-bold text-blue-600">PMIScout</h1></div>
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
            </div>
          </div>
        </aside>

        <div className="flex flex-col flex-1 w-0 overflow-hidden">
           <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500" aria-label="Apri menu"><Icon path={icons.menu} /></button>
             <h1 className="text-xl font-bold text-blue-600">Calcolatori</h1>
            <div className="w-8" />
          </header>

          <main className="relative flex-1 overflow-y-auto focus:outline-none">
            <div className="py-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="pb-6 border-b border-slate-200">
                <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">I tuoi Calcolatori</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Usa i nostri strumenti per fare simulazioni e calcoli per la tua impresa.
                </p>
              </div>
              
              {/* --- GRIGLIA DELLE CARD DEI CALCOLATORI --- */}
              <div className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
                  {calculatorCards.map((card) => (
                    <Link key={card.title} href={card.href} passHref>
                        <a className="flex flex-col h-full p-6 transition-all duration-300 bg-white border rounded-lg shadow-sm hover:shadow-xl hover:-translate-y-1">
                          <div className="flex-grow">
                            <div className="p-3 bg-blue-100 rounded-lg w-fit">
                              <Icon path={card.icon} className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-slate-900">{card.title}</h3>
                            <p className="mt-1 text-sm text-slate-500">{card.description}</p>
                          </div>
                          <div className="mt-4 text-sm font-semibold text-blue-600">
                            Apri strumento &rarr;
                          </div>
                        </a>
                    </Link>
                  ))}
                </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
