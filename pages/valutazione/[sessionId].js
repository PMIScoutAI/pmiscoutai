// /pages/valutazione/[sessionId].js
// VERSIONE 7.0 - VALUTAZIONE SEMPLIFICATA + STAMPA PDF
// RIMOZIONE: Margine Lordo, Concentrazione Clienti, Posizione Mercato, Rischio Tecnologico

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { api } from '../../utils/api';
import Layout from '../../components/Layout';
import { ProtectedPage } from '../../utils/ProtectedPage';

const SETTORI_ITALIANI = [
  { id: 'manifatturiero_generale', nome: 'Manifatturiero - Generale' },
  { id: 'manifatturiero_metalli', nome: 'Manifatturiero - Metalli' },
  { id: 'manifatturiero_plastica', nome: 'Manifatturiero - Plastica/Gomma' },
  { id: 'manifatturiero_macchinari', nome: 'Manifatturiero - Macchinari' },
  { id: 'manifatturiero_elettronica', nome: 'Manifatturiero - Elettronica' },
  { id: 'alimentare_produzione', nome: 'Alimentare - Produzione' },
  { id: 'alimentare_distribuzione', nome: 'Alimentare - Distribuzione' },
  { id: 'ristorazione', nome: 'Ristorazione' },
  { id: 'retail_abbigliamento', nome: 'Retail - Abbigliamento' },
  { id: 'retail_alimentare', nome: 'Retail - Alimentare' },
  { id: 'retail_specializzato', nome: 'Retail - Specializzato' },
  { id: 'retail_edilizia', nome: 'Retail - Edilizia' },
  { id: 'edilizia_costruzioni', nome: 'Edilizia - Costruzioni' },
  { id: 'edilizia_materiali', nome: 'Edilizia - Materiali' },
  { id: 'trasporti_logistica', nome: 'Trasporti - Logistica' },
  { id: 'servizi_professionali', nome: 'Servizi Professionali' },
  { id: 'software_it', nome: 'Software/IT' },
  { id: 'ecommerce', nome: 'E-commerce' },
  { id: 'sanita_prodotti', nome: 'Sanità - Prodotti' },
  { id: 'sanita_servizi', nome: 'Sanità - Servizi' },
  { id: 'turismo_hotel', nome: 'Turismo/Hotel' },
  { id: 'energia_rinnovabili', nome: 'Energia - Rinnovabili' },
  { id: 'commercio_auto', nome: 'Commercio Auto' },
  { id: 'tessile', nome: 'Tessile' },
  { id: 'packaging', nome: 'Packaging' }
];

export default function ValutazionePageWrapper() {
  return (
    <>
      <Head>
        <title>Valutazione Aziendale - PMIScout</title>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      <ProtectedPage>
        <Layout pageTitle="Valutazione Aziendale">
          <ValutazioneWizard />
        </Layout>
      </ProtectedPage>
    </>
  );
}

function ValutazioneWizard() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState('loading');
  const [financialData, setFinancialData] = useState({});
  const [valuationInputs, setValuationInputs] = useState({
    settore: 'manifatturiero_generale',
    dimensione: 'piccola'
  });
  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (sessionId) {
      const fetchSession = async () => {
        try {
          setLoading(true);
          const response = await api.get(`/valuta-pmi/get-session?sessionId=${sessionId}`);
          
          if (response.data.success) {
            const data = response.data.data;
            setSessionData(data);
            
            const initialFinancialData = data.historical_data || {};
            for (const year in initialFinancialData) {
              const yearData = initialFinancialData[year];
              const ml = parseFloat(yearData.debiti_finanziari_ml) || 0;
              const breve = parseFloat(yearData.debiti_finanziari_breve) || 0;
              const liquidita = parseFloat(yearData.disponibilita_liquide) || 0;
              yearData.pfn = ml + breve - liquidita;
            }

            setFinancialData(initialFinancialData);
            
            const years = data.years_analyzed.sort((a,b) => b-a);
            const ricaviN = initialFinancialData[years[0]]?.ricavi || 0;
            let dimensioneAuto = 'piccola';
            if (ricaviN > 50000000) dimensioneAuto = 'grande';
            else if (ricaviN > 10000000) dimensioneAuto = 'media';
            else if (ricaviN > 2000000) dimensioneAuto = 'piccola';
            else dimensioneAuto = 'micro';
            
            setValuationInputs(prev => ({
              ...prev,
              dimensione: dimensioneAuto,
              settore: data.valuation_inputs?.settore || 'manifatturiero_generale'
            }));
            
            if (data.status === 'completed' && data.results_data) {
              setResults(data.results_data);
              setCurrentStep('results');
            } else {
              setCurrentStep('entry');
            }
          } else {
            throw new Error(response.data.error || 'Errore nel caricamento della sessione');
          }
        } catch (err) {
          console.error('[ValutaPMI] Errore:', err);
          setError(err.response?.data?.error || err.message || 'Impossibile caricare la sessione.');
        } finally {
          setLoading(false);
        }
      };
      fetchSession();
    }
  }, [sessionId]);

  const handleFinancialChange = (e, year, field) => {
    const { value } = e.target;
    const newFinancialData = JSON.parse(JSON.stringify(financialData));
    newFinancialData[year][field] = value === '' ? null : parseFloat(value);
    
    const yearData = newFinancialData[year];
    const ml = yearData.debiti_finanziari_ml || 0;
    const breve = yearData.debiti_finanziari_breve || 0;
    const liquidita = yearData.disponibilita_liquide || 0;
    yearData.pfn = ml + breve - liquidita;

    setFinancialData(newFinancialData);
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setValuationInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    setError('');
    
    try {
      const payload = { sessionId, updatedData: financialData, valuationInputs };
      const response = await api.post('/valuta-pmi/calculate', payload);
      
      if (response.data.success) {
        setResults(response.data.results);
        setCurrentStep('results');
      } else {
        throw new Error(response.data.error || 'Errore nel calcolo');
      }
    } catch (err) {
      console.error('[ValutaPMI] Errore calcolo:', err);
      setError(err.response?.data?.error || err.message || 'Errore durante il calcolo.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleRecalculate = () => {
    setCurrentStep('entry');
    setResults(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <svg className="animate-spin mx-auto h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-slate-700">Caricamento in corso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-semibold">❌ Errore</p>
        <p className="text-red-700 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {currentStep === 'entry' && (
        <DataEntryStep 
          sessionData={sessionData}
          financialData={financialData}
          valuationInputs={valuationInputs}
          onFinancialChange={handleFinancialChange}
          onInputChange={handleInputChange}
          onCalculate={handleCalculate}
          isCalculating={isCalculating}
        />
      )}
      
      {currentStep === 'results' && results && (
        <ResultsStep 
          results={results} 
          sessionData={sessionData}
          onRecalculate={handleRecalculate}
        />
      )}
    </div>
  );
}

const DataEntryStep = ({ 
  sessionData, 
  financialData, 
  valuationInputs, 
  onFinancialChange, 
  onInputChange, 
  onCalculate, 
  isCalculating 
}) => {
  if (!sessionData || !sessionData.years_analyzed) {
    return <div>Caricamento dati...</div>;
  }

  const years = sessionData.years_analyzed.sort((a,b) => b-a);
  const yearN = years[0];
  const yearN1 = years[1];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>📊 Azienda:</strong> {sessionData.company_name} <br/>
          <strong>📅 Bilancio:</strong> {yearN1} vs {yearN}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {[yearN, yearN1].map((year) => {
          const data = financialData[year] || {};
          return (
            <div key={year} className="border border-slate-200 rounded-lg p-6 bg-white">
              <h3 className="font-bold text-lg mb-4 text-slate-900">Anno {year}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ricavi (€)</label>
                  <input
                    type="number"
                    step="1"
                    value={data.ricavi ?? ''}
                    onChange={(e) => onFinancialChange(e, year, 'ricavi')}
                    placeholder="Es: 1000000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">EBITDA (€)</label>
                  <input
                    type="number"
                    step="1"
                    value={data.ebitda ?? ''}
                    onChange={(e) => onFinancialChange(e, year, 'ebitda')}
                    placeholder="Es: 150000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Debiti M/L (€)</label>
                  <input
                    type="number"
                    step="1"
                    value={data.debiti_finanziari_ml ?? ''}
                    onChange={(e) => onFinancialChange(e, year, 'debiti_finanziari_ml')}
                    placeholder="Es: 500000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Debiti Breve (€)</label>
                  <input
                    type="number"
                    step="1"
                    value={data.debiti_finanziari_breve ?? ''}
                    onChange={(e) => onFinancialChange(e, year, 'debiti_finanziari_breve')}
                    placeholder="Es: 200000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Disponibilità Liquide (€)</label>
                  <input
                    type="number"
                    step="1"
                    value={data.disponibilita_liquide ?? ''}
                    onChange={(e) => onFinancialChange(e, year, 'disponibilita_liquide')}
                    placeholder="Es: 100000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ✅ FORM SEMPLIFICATO: Solo 2 campi */}
      <div className="border border-slate-200 rounded-lg p-6 bg-white space-y-4">
        <h3 className="font-bold text-lg text-slate-900">📋 Parametri di Valutazione</h3>

        <div>
          <label htmlFor="settore" className="block text-sm font-medium text-slate-700 mb-1">
            Settore
          </label>
          <select
            id="settore"
            value={valuationInputs.settore}
            onChange={onInputChange}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            {SETTORI_ITALIANI.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Seleziona il settore dell'azienda</p>
        </div>

        <div>
          <label htmlFor="dimensione" className="block text-sm font-medium text-slate-700 mb-1">
            Dimensione Azienda
          </label>
          <select
            id="dimensione"
            value={valuationInputs.dimensione}
            onChange={onInputChange}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="micro">Micro (&lt;€2M)</option>
            <option value="piccola">Piccola (€2M-€10M)</option>
            <option value="media">Media (€10M-€50M)</option>
            <option value="grande">Grande (&gt;€50M)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Basato sui ricavi annuali</p>
        </div>
      </div>

      <button 
        onClick={onCalculate} 
        disabled={isCalculating} 
        className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
      >
        {isCalculating ? 'Calcolo in corso...' : '🚀 Calcola Valutazione'}
      </button>
    </div>
  );
};

const ResultsStep = ({ results, sessionData, onRecalculate }) => {
  const [expandedSection, setExpandedSection] = useState('risultati');

  if (!results) {
    return <div className="text-center p-12"><p className="text-slate-600">Caricamento...</p></div>;
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const details = results.calculation_details;

  return (
    <div className="space-y-6" id="results-section">
      {/* CSS per stampa */}
      <style jsx global>{`
        @media print {
          nav, header, footer, .no-print {
            display: none !important;
          }
          
          body {
            background: white;
          }
          
          .print-container {
            max-width: 100%;
            padding: 20px;
          }
          
          .print-avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Header stampabile */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6 print-avoid-break">
        <h1 className="text-2xl font-bold mb-2">📊 Valutazione Aziendale</h1>
        <p className="text-blue-100">{sessionData.company_name}</p>
        <p className="text-sm text-blue-200">Metodo: Multipli di Mercato (EBITDA)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print-avoid-break">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <p className="text-sm text-green-700 mb-2">Fair Market Value</p>
          <p className="text-3xl font-bold text-green-900">{formatCurrency(results.fair_market_value)}</p>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-sm text-blue-700 mb-2">Conservativo (-15%)</p>
          <p className="text-3xl font-bold text-blue-900">{formatCurrency(results.conservative_value)}</p>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <p className="text-sm text-purple-700 mb-2">Ottimistico (+15%)</p>
          <p className="text-3xl font-bold text-purple-900">{formatCurrency(results.optimistic_value)}</p>
        </div>
      </div>

      {/* Accordion: Dettaglio Calcolo */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden print-avoid-break">
        <button
          onClick={() => toggleSection('risultati')}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 no-print"
        >
          <span className="text-lg font-semibold text-slate-900">📈 Dettaglio Calcolo</span>
          <svg className={`w-6 h-6 transform ${expandedSection === 'risultati' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSection === 'risultati' && (
          <div className="px-6 pb-6 border-t border-slate-200">
            <div className="mt-4 space-y-4 text-sm">
              
              {/* STEP 1 */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-bold text-blue-900 mb-2">1️⃣ Enterprise Value Base</h4>
                <div className="space-y-2">
                  <div className="flex justify-between bg-white p-2 rounded">
                    <span>EBITDA:</span>
                    <span>{formatCurrency(details.inputs_used.ebitda)}</span>
                  </div>
                  <div className="flex justify-between bg-white p-2 rounded">
                    <span>Multiplo Settore ({details.settore.nome}):</span>
                    <span>{details.step1_multiplo}x</span>
                  </div>
                  <div className="flex justify-between bg-blue-700 text-white p-2 rounded font-bold">
                    <span>EV Base:</span>
                    <span>{formatCurrency(details.step1_ev_base)}</span>
                  </div>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-bold text-orange-900 mb-2">2️⃣ Sconto Liquidità</h4>
                <div className="space-y-2">
                  <div className="flex justify-between bg-white p-2 rounded">
                    <span>Dimensione: {details.dimensione_azienda}</span>
                    <span>Liquidità: {details.settore.liquidita}</span>
                  </div>
                  <div className="flex justify-between bg-white p-2 rounded">
                    <span>Sconto applicato:</span>
                    <span className="text-orange-700 font-semibold">-{details.step2_sconto_liquidita_pct}%</span>
                  </div>
                  <div className="flex justify-between bg-orange-700 text-white p-2 rounded font-bold">
                    <span>EV Post-Sconto:</span>
                    <span>{formatCurrency(details.step2_ev_post_sconto)}</span>
                  </div>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-bold text-purple-900 mb-2">3️⃣ Aggiustamenti</h4>
                <div className="space-y-2">
                  <div className="flex justify-between bg-white p-2 rounded">
                    <span>Crescita Ricavi:</span>
                    <span className={details.step3_fattori_ev.crescita_ricavi >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {details.step3_fattori_ev.crescita_ricavi >= 0 ? '+' : ''}{details.step3_fattori_ev.crescita_ricavi}%
                    </span>
                  </div>
                  <div className="flex justify-between bg-white p-2 rounded">
                    <span>Indebitamento:</span>
                    <span className={details.step3_fattori_ev.indebitamento >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {details.step3_fattori_ev.indebitamento >= 0 ? '+' : ''}{details.step3_fattori_ev.indebitamento}%
                    </span>
                  </div>
                  <div className="flex justify-between bg-purple-700 text-white p-2 rounded font-bold">
                    <span>Aggiustamento Totale:</span>
                    <span>{details.step3_fattori_ev.totale >= 0 ? '+' : ''}{details.step3_fattori_ev.totale}%</span>
                  </div>
                  <div className="flex justify-between bg-purple-900 text-white p-2 rounded font-bold">
                    <span>EV Aggiustato:</span>
                    <span>{formatCurrency(details.step3_ev_aggiustato)}</span>
                  </div>
                </div>
              </div>

              {/* STEP 4 */}
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-bold text-green-900 mb-2">4️⃣ Equity Value</h4>
                <div className="space-y-2">
                  <div className="flex justify-between bg-white p-2 rounded">
                    <span>EV Aggiustato:</span>
                    <span>{formatCurrency(details.step3_ev_aggiustato)}</span>
                  </div>
                  <div className="flex justify-between bg-white p-2 rounded">
                    <span>PFN (Posizione Finanziaria Netta):</span>
                    <span className="text-red-700">-{formatCurrency(details.step4_pfn_sottratta)}</span>
                  </div>
                  <div className="flex justify-between bg-green-700 text-white p-3 rounded font-bold text-lg">
                    <span>💎 Equity Value:</span>
                    <span>{formatCurrency(details.step4_equity_value)}</span>
                  </div>
                </div>
              </div>

              {/* KPI */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-3">📊 KPI Utilizzati</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Crescita Ricavi:</span>
                    <span className="font-semibold">{details.inputs_used.crescita_ricavi_pct?.toFixed(1) || 'N/A'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Debt/EBITDA:</span>
                    <span className="font-semibold">{details.inputs_used.debt_ebitda_ratio?.toFixed(1) || 'N/A'}x</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Bottoni Azione */}
      <div className="flex gap-4 no-print">
        <button 
          onClick={handlePrintPDF}
          className="flex-1 px-4 py-3 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Stampa PDF
        </button>
        
        <button 
          onClick={onRecalculate} 
          className="flex-1 px-4 py-3 font-bold text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200"
        >
          🔄 Modifica Dati e Ricalcola
        </button>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
        <p className="font-semibold mb-2">⚠️ Disclaimer</p>
        <p>
          Questa valutazione è basata sul metodo dei multipli di mercato e rappresenta una stima indicativa. 
          Per una valutazione formale è consigliabile rivolgersi a un professionista certificato.
        </p>
      </div>
    </div>
  );
};
