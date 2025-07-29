// pages/calcolatori.js

import React from 'react';
import Link from 'next/link';
import Layout from '../components/Layout'; // Importiamo il nostro Layout

// Le definizioni delle icone e delle card rimangono qui,
// perché sono specifiche per il contenuto di questa pagina.
const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg>
);

const icons = {
    fondoGaranzia: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    valutazioneAziendale: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    capacitaAcquisto: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>,
    rendimentoInvestimento: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    ratingBancario: <><path d="M12 12c-2 0-4.5 1-6 2.5s-1.5 4-1.5 4" /><path d="M21.5 18.5c-.5-1-2.5-3.5-5-5" /><path d="M12 12c2 0 4.5 1 6 2.5s1.5 4 1.5 4" /><path d="M2.5 18.5c.5-1 2.5-3.5 5-5" /><circle cx="12" cy="12" r="10" /><path d="m12 12-2 4" /></>
};

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

// La pagina ora è un componente molto più semplice che usa il Layout
export default function CalcolatoriHub() {
  return (
    <Layout pageTitle="Calcolatori">
      <div className="py-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="pb-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">I tuoi Calcolatori</h1>
          <p className="mt-1 text-sm text-slate-500">
            Usa i nostri strumenti per fare simulazioni e calcoli per la tua impresa.
          </p>
        </div>
        
        {/* Griglia delle card dei calcolatori */}
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
    </Layout>
  );
}
