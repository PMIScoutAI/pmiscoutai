// /pages/valutazione/[sessionId].js
// VERSIONE 8.0 - UX/UI UPGRADE: Hero Value, KPI Dashboard, Metodologia Always Visible, Benchmark Settore
// MODIFICHE: Hero gradient, Range slider, KPI cards, Step flow verticale, Benchmark posizionamento

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
  if (!results) {
    return <div className="text-center p-12"><p className="text-slate-600">Caricamento...</p></div>;
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const details = results.calculation_details;

  // Calcolo benchmark settore
  const multiploBase = details.step1_multiplo;
  const multiploMin = (multiploBase * 0.8).toFixed(1);
  const multiploMax = (multiploBase * 1.2).toFixed(1);
  const percentile = Math.round(((multiploBase - parseFloat(multiploMin)) / (parseFloat(multiploMax) - parseFloat(multiploMin))) * 100);

  return (
    <div className="space-y-6" id="results-section">
      {/* CSS per stampa */}
      <style jsx global>{`
        @media print {
          nav, header, footer, .no-print {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          .print-container {
            max-width: 100%;
            padding: 20px;
          }
          
          .print-avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Forza colori gradient su stampa */
          .bg-gradient-to-br {
            background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Ottimizza dimensioni font per A4 */
          .text-7xl {
            font-size: 3.5rem !important;
          }

          .text-5xl {
            font-size: 2.5rem !important;
          }
        }
      `}</style>

      {/* 🎯 HERO VALUE - VERSIONE UPGRADE */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 rounded-2xl p-8 md:p-12 text-white shadow-2xl print-avoid-break">
        {/* Decorazione sfondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>
        
        {/* Contenuto */}
        <div className="relative z-10">
          {/* Badge metodologia */}
          <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-xs font-medium mb-4">
            <span className="mr-2">📊</span>
            Metodo: Multipli di Mercato (EBITDA)
          </div>
          
          {/* Titolo azienda */}
          <h2 className="text-2xl md:text-3xl font-bold mb-8">
            Valutazione {sessionData.company_name}
          </h2>
          
          {/* Fair Market Value - HERO */}
          <div className="text-center mb-8">
            <p className="text-sm md:text-base uppercase tracking-wider opacity-80 mb-3">
              Fair Market Value
            </p>
            <p className="text-5xl md:text-7xl font-bold mb-2">
              {formatCurrency(results.fair_market_value)}
            </p>
            <p className="text-sm md:text-base opacity-70">
              Valore equo di mercato
            </p>
          </div>
          
          {/* Range Slider Visuale */}
          <div className="mt-10">
            <p className="text-sm uppercase tracking-wide opacity-80 mb-4 text-center">
              Range Valutativo
            </p>
            
            {/* Barra range */}
            <div className="relative h-3 bg-white/20 rounded-full mb-6">
              {/* Sezione conservativa (sinistra) */}
              <div 
                className="absolute left-0 h-3 bg-blue-400 rounded-l-full" 
                style={{width: '33.33%'}}
              ></div>
              {/* Sezione fair value (centro) */}
              <div 
                className="absolute left-1/3 right-1/3 h-3 bg-white"
              ></div>
              {/* Sezione ottimistica (destra) */}
              <div 
                className="absolute right-0 h-3 bg-purple-400 rounded-r-full" 
                style={{width: '33.33%'}}
              ></div>
              
              {/* Indicatore punto centrale */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-4 border-blue-900"></div>
            </div>
            
            {/* Etichette range */}
            <div className="grid grid-cols-3 gap-2 text-xs md:text-sm">
              <div className="text-left">
                <p className="opacity-70 mb-1">Conservativo (-15%)</p>
                <p className="font-semibold text-base md:text-lg">
                  {formatCurrency(results.conservative_value)}
                </p>
              </div>
              
              <div className="text-center">
                <p className="opacity-70 mb-1">Fair Value</p>
                <p className="font-semibold text-base md:text-lg">
                  {formatCurrency(results.fair_market_value)}
                </p>
              </div>
              
              <div className="text-right">
                <p className="opacity-70 mb-1">Ottimistico (+15%)</p>
                <p className="font-semibold text-base md:text-lg">
                  {formatCurrency(results.optimistic_value)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 KPI DASHBOARD */}
      <div className="bg-white rounded-lg shadow-md p-6 print-avoid-break">
        <h3 className="text-lg font-bold text-slate-900 mb-4">📊 Dati Aziendali Utilizzati</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* EBITDA */}
          <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide">EBITDA</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(details.inputs_used.ebitda)}</p>
            <p className="text-xs text-slate-500 mt-1">Anno N</p>
          </div>

          {/* Crescita Ricavi */}
          <div className={`text-center p-4 rounded-lg border ${details.inputs_used.crescita_ricavi_pct >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Crescita Ricavi</p>
            <p className={`text-2xl font-bold ${details.inputs_used.crescita_ricavi_pct >= 0 ? 'text-green-900' : 'text-orange-900'}`}>
              {details.inputs_used.crescita_ricavi_pct >= 0 ? '+' : ''}{details.inputs_used.crescita_ricavi_pct?.toFixed(1) || 'N/A'}%
            </p>
            <p className="text-xs text-slate-500 mt-1">vs Anno N-1</p>
          </div>

          {/* Debt/EBITDA */}
          <div className={`text-center p-4 rounded-lg border ${details.inputs_used.debt_ebitda_ratio < 2 ? 'bg-green-50 border-green-200' : details.inputs_used.debt_ebitda_ratio <= 4 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Debt/EBITDA</p>
            <p className={`text-2xl font-bold ${details.inputs_used.debt_ebitda_ratio < 2 ? 'text-green-900' : details.inputs_used.debt_ebitda_ratio <= 4 ? 'text-yellow-900' : 'text-red-900'}`}>
              {details.inputs_used.debt_ebitda_ratio?.toFixed(1) || 'N/A'}x
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {details.inputs_used.debt_ebitda_ratio < 2 ? 'Basso' : details.inputs_used.debt_ebitda_ratio <= 4 ? 'Medio' : 'Alto'}
            </p>
          </div>

          {/* Settore */}
          <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Settore</p>
            <p className="text-base font-bold text-slate-900">{details.settore.nome}</p>
            <p className="text-xs text-slate-500 mt-1">Multiplo: {details.settore.multiplo_ebitda}x</p>
          </div>

          {/* Dimensione */}
          <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Dimensione</p>
            <p className="text-base font-bold text-slate-900 capitalize">{details.dimensione_azienda}</p>
            <p className="text-xs text-slate-500 mt-1">
              {details.dimensione_azienda === 'micro' && '< €2M'}
              {details.dimensione_azienda === 'piccola' && '€2M-€10M'}
              {details.dimensione_azienda === 'media' && '€10M-€50M'}
              {details.dimensione_azienda === 'grande' && '> €50M'}
            </p>
          </div>

          {/* PFN */}
          <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 mb-1 uppercase tracking-wide">PFN</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(details.inputs_used.pfn)}</p>
            <p className="text-xs text-slate-500 mt-1">Posizione Fin. Netta</p>
          </div>
        </div>
      </div>

      {/* 📈 METODOLOGIA - ALWAYS VISIBLE */}
      <div className="bg-white rounded-lg shadow-md p-6 print-avoid-break">
        <h3 className="text-lg font-bold text-slate-900 mb-6">📈 Metodologia di Calcolo</h3>
        
        <div className="space-y-6">
          {/* STEP 1 */}
          <div>
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm mr-3">1</div>
              <h4 className="font-bold text-slate-900">Enterprise Value Base</h4>
            </div>
            <div className="ml-11 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">EBITDA × Multiplo Settore</span>
                  <span className="font-mono font-semibold text-blue-900">{formatCurrency(details.inputs_used.ebitda)} × {details.step1_multiplo}x</span>
                </div>
                <div className="border-t border-blue-300 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-900">EV Base:</span>
                    <span className="text-xl font-bold text-blue-900">{formatCurrency(details.step1_ev_base)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 italic mt-2">💡 {details.settore.nome}</p>
              </div>
            </div>
          </div>

          {/* Freccia */}
          <div className="flex justify-center">
            <svg className="w-6 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          {/* STEP 2 */}
          <div>
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-sm mr-3">2</div>
              <h4 className="font-bold text-slate-900">Sconto Liquidità</h4>
            </div>
            <div className="ml-11 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">EV Base × Sconto</span>
                  <span className="font-mono font-semibold text-orange-900">{formatCurrency(details.step1_ev_base)} × (-{details.step2_sconto_liquidita_pct}%)</span>
                </div>
                <div className="border-t border-orange-300 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-orange-900">EV Post-Sconto:</span>
                    <span className="text-xl font-bold text-orange-900">{formatCurrency(details.step2_ev_post_sconto)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 italic mt-2">💡 Dimensione: {details.dimensione_azienda}, Liquidità settore: {details.settore.liquidita}</p>
              </div>
            </div>
          </div>

          {/* Freccia */}
          <div className="flex justify-center">
            <svg className="w-6 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          {/* STEP 3 */}
          <div>
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm mr-3">3</div>
              <h4 className="font-bold text-slate-900">Aggiustamenti Performance</h4>
            </div>
            <div className="ml-11 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">EV Post-Sconto × Aggiustamento</span>
                  <span className="font-mono font-semibold text-purple-900">{formatCurrency(details.step2_ev_post_sconto)} × ({details.step3_fattori_ev.totale >= 0 ? '+' : ''}{details.step3_fattori_ev.totale}%)</span>
                </div>
                <div className="border-t border-purple-300 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-purple-900">EV Aggiustato:</span>
                    <span className="text-xl font-bold text-purple-900">{formatCurrency(details.step3_ev_aggiustato)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-purple-300">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Dettaglio aggiustamenti:</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">• Crescita Ricavi:</span>
                      <span className={`font-semibold ${details.step3_fattori_ev.crescita_ricavi >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {details.step3_fattori_ev.crescita_ricavi >= 0 ? '+' : ''}{details.step3_fattori_ev.crescita_ricavi}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">• Livello Indebitamento:</span>
                      <span className={`font-semibold ${details.step3_fattori_ev.indebitamento >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {details.step3_fattori_ev.indebitamento >= 0 ? '+' : ''}{details.step3_fattori_ev.indebitamento}%
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 italic mt-2">💡 Crescita {details.inputs_used.crescita_ricavi_pct?.toFixed(1)}%, Debt/EBITDA {details.inputs_used.debt_ebitda_ratio?.toFixed(1)}x</p>
              </div>
            </div>
          </div>

          {/* Freccia */}
          <div className="flex justify-center">
            <svg className="w-6 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          {/* STEP 4 */}
          <div>
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm mr-3">4</div>
              <h4 className="font-bold text-slate-900">Equity Value Finale</h4>
            </div>
            <div className="ml-11 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">EV Aggiustato</span>
                  <span className="font-mono font-semibold text-green-900">{formatCurrency(details.step3_ev_aggiustato)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">− PFN (Posizione Fin. Netta)</span>
                  <span className="font-mono font-semibold text-red-700">−{formatCurrency(details.step4_pfn_sottratta)}</span>
                </div>
                <div className="border-t-2 border-green-400 pt-3 mt-3">
                  <div className="flex justify-between items-center bg-green-700 text-white p-3 rounded-lg">
                    <span className="font-semibold flex items-center">
                      <span className="mr-2">💎</span> EQUITY VALUE:
                    </span>
                    <span className="text-2xl font-bold">{formatCurrency(details.step4_equity_value)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 italic mt-2">💡 Valore del capitale azionario (Enterprise Value meno debito netto)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 BENCHMARK SETTORE */}
      <div className="bg-white rounded-lg shadow-md p-6 print-avoid-break">
        <h3 className="text-lg font-bold text-slate-900 mb-4">📊 Posizionamento nel Settore</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-600">Multiplo Applicato:</p>
              <p className="text-xl font-bold text-blue-600">{multiploBase}x EBITDA</p>
            </div>
            <div>
              <p className="text-slate-600">Range Settore:</p>
              <p className="text-xl font-bold text-slate-900">{multiploMin}x - {multiploMax}x</p>
            </div>
            <div>
              <p className="text-slate-600">Settore:</p>
              <p className="text-base font-bold text-slate-900">{details.settore.nome}</p>
            </div>
          </div>

          {/* Barra posizionamento */}
          <div className="mt-6">
            <div className="relative h-4 bg-slate-200 rounded-full">
              <div 
                className="absolute h-4 bg-blue-600 rounded-full transition-all duration-500"
                style={{width: `${percentile}%`}}
              ></div>
              <div 
                className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-900 border-4 border-white rounded-full shadow-lg"
                style={{left: `${percentile}%`, marginLeft: '-8px'}}
              ></div>
            </div>
            
            <div className="flex justify-between mt-2 text-xs text-slate-600">
              <span>{multiploMin}x<br/>Minimo</span>
              <span className="font-semibold text-blue-600">{multiploBase}x (tuo)<br/>{percentile}° percentile</span>
              <span>{multiploMax}x<br/>Massimo</span>
            </div>
          </div>

          {/* Insight */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">💡 Insight:</span> Sei nel {percentile}° percentile del settore. 
              {percentile >= 60 ? ' Valutazione superiore alla media delle aziende comparabili.' : percentile >= 40 ? ' Valutazione in linea con la media delle aziende comparabili.' : ' Valutazione inferiore alla media, possibile margine di miglioramento.'}
            </p>
          </div>
        </div>
      </div>

      {/* Bottoni Azione */}
      <div className="flex flex-col md:flex-row gap-4 no-print">
        <button 
          onClick={handlePrintPDF}
          className="flex-1 px-4 py-3 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Stampa PDF
        </button>
        
        <button 
          onClick={onRecalculate} 
          className="flex-1 px-4 py-3 font-bold text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
        >
          🔄 Modifica Dati e Ricalcola
        </button>
      </div>

      {/* Disclaimer Aggiornato */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900 print-avoid-break">
        <p className="font-semibold mb-2">⚠️ Disclaimer</p>
        <p>
          Questa valutazione utilizza multipli standard di mercato adattati al contesto italiano e rappresenta una stima indicativa. PMIScout non si assume alcuna responsabilità per decisioni prese sulla base di questa analisi.
        </p>
      </div>
    </div>
  );
};
