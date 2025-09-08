// pages/calcolatori.js
// VERSIONE STANDALONE SENZA LAYOUT CONDIVISO E SENZA MARKETPLACE

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg>
);

// Icone per la navigazione (SENZA MARKETPLACE)
const navIcons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>,
    xbrl: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="m9 15 3-3 3 3"></path></>,
    support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
};

// Icone per i calcolatori
const calculatorIcons = {
    fondoGaranzia: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    valutazioneAziendale: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    capacitaAcquisto: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>,
    rendimentoInvestimento: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    ratingBancario: <><path d="M12 12c-2 0-4.5 1-6 2.5s-1.5 4-1.5 4" /><path d="M21.5 18.5c-.5-1-2.5-3.5-5-5" /><path d="M12 12c2 0 4.5 1 6 2.5s1.5 4 1.5 4" /><path d="M2.5 18.5c.5-1 2.5-3.5 5-5" /><circle cx="12" cy="12" r="10" /><path d="m12 12-2 4" /></>
};

// NAVIGAZIONE PULITA SENZA MARKETPLACE
const navLinks = [
    { href: '/', text: 'Dashboard', icon: navIcons.dashboard, active: false },
    { href: '/profilo', text: 'Profilo', icon: navIcons.profile, active: false },
    { href: 'https://pmiscoutai.vercel.app/check-ai-xbrl', text: 'Check-AI XBRL', icon: navIcons.xbrl, active: false },
    { href: '/calcolatori', text: 'Calcolatori', icon: navIcons.calculator, active: true },
];

const calculatorCards = [
    {
      title: 'Simulazione Fondo Garanzia PMI',
      description: 'Verifica l\'ammissibilità e l\'importo della garanzia statale per i tuoi finanziamenti.',
      href: '/calcolatori/simulazione-fondo-garanzia',
      icon: calculatorIcons.fondoGaranzia,
      category: 'Finanziamenti',
      difficulty: 'Facile'
    },
    {
      title: 'Calcolatore Valutazione Aziendale',
      description: 'Ottieni una stima del valore della tua impresa basata su multipli di mercato.',
      href: '/calcolatori/valutazione-aziendale',
      icon: calculatorIcons.valutazioneAziendale,
      category: 'Valutazione',
      difficulty: 'Intermedio'
    },
    {
      title: 'Calcolatore Capacità di Acquisto',
      description: 'Determina il potenziale di acquisizione per i tuoi prossimi investimenti aziendali.',
      href: '/calcolatori/capacita-acquisto',
      icon: calculatorIcons.capacitaAcquisto,
      category: 'Investimenti',
      difficulty: 'Facile'
    },
    {
      title: 'Calcolatore Rendimento Investimento (ROI)',
      description: 'Analizza l\'efficacia e il ritorno economico degli investimenti per acquisizioni.',
      href: '/calcolatori/rendimento-investimento',
      icon: calculatorIcons.rendimentoInvestimento,
      category: 'Investimenti',
      difficulty: 'Intermedio'
    },
    {
      title: 'Simulatore Rating Bancario Semplificato',
      description: 'Simula il tuo rating creditizio per migliorare l\'accesso al credito bancario.',
      href: '/calcolatori/simulatore-rating-bancario',
      icon: calculatorIcons.ratingBancario,
      category: 'Credito',
      difficulty: 'Avanzato'
    },
];

// Funzioni helper per i colori
const getCategoryColor = (category) => {
  const colors = {
    'Finanziamenti': 'bg-green-100 text-green-800',
    'Valutazione': 'bg-blue-100 text-blue-800',
    'Investimenti': 'bg-purple-100 text-purple-800',
    'Credito': 'bg-orange-100 text-orange-800'
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
};

const getDifficultyColor = (difficulty) => {
  const colors = {
    'Facile': 'bg-green-50 text-green-700 border border-green-200',
    'Intermedio': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    'Avanzato': 'bg-red-50 text-red-700 border border-red-200'
  };
  return colors[difficulty] || 'bg-gray-50 text-gray-700 border border-gray-200';
};

export default function CalcolatoriHub() {
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
  }, []);

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

  return (
    <>
      <Head>
        <title>Calcolatori - PMIScout</title>
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
        {/* SIDEBAR SENZA MARKETPLACE */}
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

              <div className="px-2 py-3 border-t border-slate-200">
                <div className="flex items-center px-2 py-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Connesso come {userName}
                </div>
              </div>

              <div className="px-2 py-4 border-t">
                <a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors">
                  <Icon path={navIcons.support} className="w-6 h-6 mr-3 text-slate-500" />
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
          {/* Header mobile */}
          <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors" aria-label="Apri menu">
              <Icon path={navIcons.menu} />
            </button>
            <h1 className="text-xl font-bold text-blue-600">PMIScout</h1>
            <div className="w-8" />
          </header>

          {/* Main content */}
          <main className="relative flex-1 overflow-y-auto focus:outline-none">
            <div className="py-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col pb-6 border-b md:flex-row md:items-center md:justify-between border-slate-200">
                <div>
                  <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">I tuoi Calcolatori</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Strumenti di calcolo specializzati per PMI italiane - simulazioni finanziarie precise e immediate.
                  </p>
                </div>
                <div className="flex items-center mt-4 space-x-3 md:mt-0">
                  <Link href="/profilo">
                    <a className="flex items-center px-4 py-2 text-sm font-medium bg-white border rounded-lg shadow-sm text-slate-700 border-slate-300 hover:bg-slate-50 transition-colors">
                      <Icon path={navIcons.profile} className="w-5 h-5 mr-2 text-slate-500" />
                      Profilo
                    </a>
                  </Link>
                  <a href="https://pmiscout.outseta.com/auth?widgetMode=logout" className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg shadow-sm hover:bg-red-700 transition-colors">
                    <Icon path={navIcons.logout} className="w-5 h-5 mr-2" />
                    Logout
                  </a>
                </div>
              </div>

              {/* Sezione informativa */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Icon path={navIcons.support} className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Strumenti Professionali</h3>
                    <p className="mt-1 text-sm text-blue-700">
                      Tutti i calcolatori sono basati su normative italiane aggiornate e best practice del settore finanziario.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Griglia delle card dei calcolatori */}
              <div className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3">
                  {calculatorCards.map((card) => (
                    <Link key={card.title} href={card.href} passHref>
                        <a className="flex flex-col h-full p-6 transition-all duration-300 bg-white border rounded-lg shadow-sm hover:shadow-xl hover:-translate-y-1 group">
                          <div className="flex-grow">
                            {/* Header con icona e badge categoria */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                <Icon path={card.icon} className="w-6 h-6 text-blue-600" />
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(card.category)}`}>
                                {card.category}
                              </span>
                            </div>
                            
                            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {card.title}
                            </h3>
                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                              {card.description}
                            </p>
                            
                            {/* Badge difficoltà */}
                            <div className="mt-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getDifficultyColor(card.difficulty)}`}>
                                {card.difficulty}
                              </span>
                            </div>
                          </div>
                          
                          {/* CTA button */}
                          <div className="mt-4 flex items-center text-sm font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
                            <span>Apri strumento</span>
                            <svg className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </a>
                    </Link>
                  ))}
                </div>

                {/* Sezione di supporto */}
                <div className="mt-12 text-center">
                  <div className="inline-flex items-center px-4 py-2 bg-slate-100 rounded-lg">
                    <Icon path={navIcons.support} className="w-4 h-4 text-slate-500 mr-2" />
                    <span className="text-sm text-slate-600">
                      Hai bisogno di supporto? 
                      <a href="mailto:antonio@pmiscout.eu" className="ml-1 font-medium text-blue-600 hover:text-blue-800">
                        Contatta il nostro team
                      </a>
                    </span>
                  </div>
                </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
