// pages/calcolatori.js
// VERSIONE PULITA SENZA RIFERIMENTI MARKETPLACE

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
      category: 'Finanziamenti',
      difficulty: 'Facile'
    },
    {
      title: 'Calcolatore Valutazione Aziendale',
      description: 'Ottieni una stima del valore della tua impresa basata su multipli di mercato.',
      href: '/calcolatori/valutazione-aziendale',
      icon: icons.valutazioneAziendale,
      category: 'Valutazione',
      difficulty: 'Intermedio'
    },
    {
      title: 'Calcolatore Capacità di Acquisto',
      description: 'Determina il potenziale di acquisizione per i tuoi prossimi investimenti aziendali.',
      href: '/calcolatori/capacita-acquisto',
      icon: icons.capacitaAcquisto,
      category: 'Investimenti',
      difficulty: 'Facile'
    },
    {
      title: 'Calcolatore Rendimento Investimento (ROI)',
      description: 'Analizza l\'efficacia e il ritorno economico degli investimenti per acquisizioni.',
      href: '/calcolatori/rendimento-investimento',
      icon: icons.rendimentoInvestimento,
      category: 'Investimenti',
      difficulty: 'Intermedio'
    },
    {
      title: 'Simulatore Rating Bancario Semplificato',
      description: 'Simula il tuo rating creditizio per migliorare l\'accesso al credito bancario.',
      href: '/calcolatori/simulatore-rating-bancario',
      icon: icons.ratingBancario,
      category: 'Credito',
      difficulty: 'Avanzato'
    },
];

// Funzione per ottenere il colore del badge in base alla categoria
const getCategoryColor = (category) => {
  const colors = {
    'Finanziamenti': 'bg-green-100 text-green-800',
    'Valutazione': 'bg-blue-100 text-blue-800',
    'Investimenti': 'bg-purple-100 text-purple-800',
    'Credito': 'bg-orange-100 text-orange-800'
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
};

// Funzione per ottenere il colore del badge difficoltà
const getDifficultyColor = (difficulty) => {
  const colors = {
    'Facile': 'bg-green-50 text-green-700 border border-green-200',
    'Intermedio': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    'Avanzato': 'bg-red-50 text-red-700 border border-red-200'
  };
  return colors[difficulty] || 'bg-gray-50 text-gray-700 border border-gray-200';
};

// La pagina ora è un componente molto più semplice che usa il Layout
export default function CalcolatoriHub() {
  return (
    <Layout pageTitle="Calcolatori">
      <div className="py-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="pb-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">I tuoi Calcolatori</h1>
          <p className="mt-1 text-sm text-slate-500">
            Strumenti di calcolo specializzati per PMI italiane - simulazioni finanziarie precise e immediate.
          </p>
        </div>

        {/* Sezione informativa */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Icon path={<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>} className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Strumenti Professionali</h3>
              <p className="mt-1 text-sm text-blue-700">
                Tutti i calcolatori sono basati su normative italiane aggiornate e best practice del settore finanziario.
              </p>
            </div>
          </div>
        </div>
        
        {/* Griglia delle card dei calcolatori con miglioramenti UX */}
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
              <Icon path={<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>} className="w-4 h-4 text-slate-500 mr-2" />
              <span className="text-sm text-slate-600">
                Hai bisogno di supporto? 
                <a href="mailto:antonio@pmiscout.eu" className="ml-1 font-medium text-blue-600 hover:text-blue-800">
                  Contatta il nostro team
                </a>
              </span>
            </div>
          </div>
      </div>
    </Layout>
  );
}
