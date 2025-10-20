// /pages/valutazione/[sessionId].js
// Pagina dinamica per il wizard di valutazione aziendale.
// VERSIONE 5.0 - Form semplificato + Output minimalista accordion

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { api } from '../../utils/api';
import Layout from '../../components/Layout';
import { ProtectedPage } from '../../utils/ProtectedPage';

// Settori italiani (sync con calculate.js)
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

// Componente Wrapper
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

// Componente Principale
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
    dimensione: 'piccola',
    margine_lordo: null,
    market_position: 'follower',
    customer_concentration: null,
    technology_risk: 'medium'
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
            
            // Calcola dimensione automatica dai ricavi
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
              ...(data.valuation_inputs || {})
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
    setValuationInputs(prev => ({ ...prev, [id]: value === '' ? null : value }));
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

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 mt-4">Caricamento sessione...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="p-6 bg-red-100 text-red-800 rounded-lg border border-red-200">
          <h3 className="font-bold mb-2">Errore</h3>
          <p>{error}</p>
          <button onClick={() => router.push('/valuta-pmi')} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Torna all'Upload
          </button>
        </div>
      );
    }

    switch (currentStep) {
      case 'entry':
        return (
          <DataEntryStep
            sessionData={sessionData}
            financialData={financialData}
            valuationInputs={valuationInputs}
            handleFinancialChange={handleFinancialChange}
            handleInputChange={handleInputChange}
            onCalculate={handleCalculate}
            isCalculating={isCalculating}
          />
        );
      case 'results':
        return <ResultsStep results={results} sessionData={sessionData} onRecalculate={() => setCurrentStep('entry')} />;
      default:
        return <div className="text-center p-12">Stato non valido</div>;
    }
  };

  return <div className="py-8 mx-auto max-w-4xl px-4">{renderContent()}</div>;
}

// ============================================
// COMPONENTI HELPER
// ============================================

const InputField = ({ label, value, onChange, readOnly = false, helpText, hasWarning = false }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label} (€)</label>
    <input
      type="number"
      value={value ?? ''}
      onChange={onChange}
      readOnly={readOnly}
      className={`mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
        readOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 
        hasWarning ? 'border-orange-400 bg-orange-50' : 'border-slate-300'
      }`}
    />
    {helpText && <p className={`mt-1 text-xs ${hasWarning ? 'text-orange-700 font-medium' : 'text-slate-500'}`}>{helpText}</p>}
  </div>
);

const SelectField = ({ id, label, value, onChange, children, helpText }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    <select id={id} value={value} onChange={onChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
      {children}
    </select>
    {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
  </div>
);

// ============================================
// STEP 1: DATA ENTRY
// ============================================

const DataEntryStep = ({ sessionData, financialData, valuationInputs, handleFinancialChange, handleInputChange, onCalculate, isCalculating }) => {
  if (!sessionData || !sessionData.years_analyzed) {
    return (
      <div className="text-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Caricamento dati finanziari...</p>
      </div>
    );
  }

  const years = (sessionData.years_analyzed || []).sort((a, b) => b - a);
  if (years.length === 0) {
    return (
      <div className="p-6 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
        <p className="text-yellow-800 font-semibold mb-4">⚠️ Nessun anno disponibile.</p>
        <a href="/valuta-pmi" className="inline-block px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold">
          Riprova con un altro file
        </a>
      </div>
    );
  }

  const yearN = years[0];
  const yearN1 = years[1];
  const dataN = financialData[yearN] || {};
  const dataN1 = financialData[yearN1] || {};

  // Calcolo automatico margine lordo approssimato (se possibile)
  const calcolaMargineLordoAuto = () => {
    if (!dataN.ricavi || !dataN.ebitda || dataN.ricavi === 0) return null;
    // Approssimazione: assumiamo che EBITDA + costi operativi ≈ Margine Lordo
    // In realtà serve Costo del Venduto, ma proviamo una stima
    const margineLordoStimato = ((dataN.ricavi - (dataN.ricavi - dataN.ebitda * 2)) / dataN.ricavi) * 100;
    return margineLordoStimato > 0 && margineLordoStimato <= 100 ? margineLordoStimato.toFixed(1) : null;
  };

  const margineLordoAuto = calcolaMargineLordoAuto();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Verifica e Completa i Dati</h1>
        {sessionData.company_name && (
          <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg inline-block">
            <p className="text-2xl font-bold text-blue-700">🏢 {sessionData.company_name}</p>
            <p className="text-sm text-blue-600 mt-1">Anno {yearN} | Anno {yearN1}</p>
          </div>
        )}
      </div>

      {/* Sezione Info Azienda */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">📋 Informazioni Azienda</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SelectField 
            id="settore" 
            label="Settore di Attività" 
            value={valuationInputs.settore} 
            onChange={handleInputChange}
            helpText="Seleziona il settore che meglio descrive l'attività principale"
          >
            {SETTORI_ITALIANI.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </SelectField>
          
          <SelectField 
            id="dimensione" 
            label="Dimensione Azienda" 
            value={valuationInputs.dimensione} 
            onChange={handleInputChange}
            helpText="Basata sui ricavi annuali"
          >
            <option value="micro">Micro (&lt;€2M)</option>
            <option value="piccola">Piccola (€2-10M)</option>
            <option value="media">Media (€10-50M)</option>
            <option value="grande">Grande (&gt;€50M)</option>
          </SelectField>
        </div>
      </div>

      {/* Sezione Dati Finanziari SEMPLIFICATA */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">💰 Dati Finanziari</h2>
        
        {/* Anno N */}
        <div className="mb-6 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
          <h3 className="font-bold text-lg text-blue-700 mb-4">Anno {yearN} (Ultimo Bilancio)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Ricavi" value={dataN.ricavi} onChange={(e) => handleFinancialChange(e, yearN, 'ricavi')} />
            <InputField label="EBITDA" value={dataN.ebitda} onChange={(e) => handleFinancialChange(e, yearN, 'ebitda')} />
            <InputField 
              label="Debiti Finanziari M/L" 
              value={dataN.debiti_finanziari_ml} 
              onChange={(e) => handleFinancialChange(e, yearN, 'debiti_finanziari_ml')}
              hasWarning={dataN.debiti_finanziari_ml === null}
              helpText={dataN.debiti_finanziari_ml === null ? '⚠️ Inserisci manualmente' : 'Oltre l\'esercizio'}
            />
            <InputField 
              label="Debiti Finanziari Breve" 
              value={dataN.debiti_finanziari_breve} 
              onChange={(e) => handleFinancialChange(e, yearN, 'debiti_finanziari_breve')}
              hasWarning={dataN.debiti_finanziari_breve === null}
              helpText={dataN.debiti_finanziari_breve === null ? '⚠️ Inserisci manualmente' : 'Entro l\'esercizio'}
            />
            <InputField label="Disponibilità Liquide" value={dataN.disponibilita_liquide} onChange={(e) => handleFinancialChange(e, yearN, 'disponibilita_liquide')} />
            <InputField label="PFN (Calcolata)" value={dataN.pfn} readOnly={true} helpText="Debiti Finanziari - Liquidità" />
          </div>
        </div>

        {/* Anno N-1 (solo ricavi per crescita) */}
        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
          <h3 className="font-bold text-base text-slate-700 mb-3">Anno {yearN1} (Anno Precedente)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField 
              label="Ricavi Anno Precedente" 
              value={dataN1.ricavi} 
              onChange={(e) => handleFinancialChange(e, yearN1, 'ricavi')}
              helpText="Serve per calcolare la crescita anno su anno"
            />
          </div>
        </div>
      </div>

      {/* Sezione Metriche Qualitative */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">📊 Metriche Operative</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="margine_lordo" className="block text-sm font-medium text-slate-700 mb-1">
              Margine Lordo (%)
            </label>
            <input
              id="margine_lordo"
              type="number"
              step="0.1"
              value={valuationInputs.margine_lordo ?? ''}
              onChange={handleInputChange}
              placeholder={margineLordoAuto ? `Stima auto: ${margineLordoAuto}%` : 'Opzionale'}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Formula: (Ricavi - Costo del Venduto) / Ricavi × 100
              {margineLordoAuto && <span className="block text-blue-600 mt-1">💡 Stima automatica: {margineLordoAuto}%</span>}
            </p>
          </div>

          <div>
            <label htmlFor="customer_concentration" className="block text-sm font-medium text-slate-700 mb-1">
              Concentrazione Clienti Top 3 (%)
            </label>
            <input
              id="customer_concentration"
              type="number"
              step="1"
              min="0"
              max="100"
              value={valuationInputs.customer_concentration ?? ''}
              onChange={handleInputChange}
              placeholder="Es: 35"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">% fatturato dai 3 clienti principali</p>
          </div>

          <SelectField 
            id="market_position" 
            label="Posizione di Mercato" 
            value={valuationInputs.market_position} 
            onChange={handleInputChange}
            helpText="La posizione competitiva nel settore"
          >
            <option value="leader">Leader (&gt;25% quota)</option>
            <option value="challenger">Challenger (10-25%)</option>
            <option value="follower">Follower (5-10%)</option>
            <option value="niche">Nicchia (&lt;5%)</option>
          </SelectField>
          
          <SelectField 
            id="technology_risk" 
            label="Rischio Tecnologico" 
            value={valuationInputs.technology_risk} 
            onChange={handleInputChange}
            helpText="Impatto innovazione sul business"
          >
            <option value="low">Basso (settore stabile)</option>
            <option value="medium">Medio</option>
            <option value="high">Alto (disruptive)</option>
          </SelectField>
        </div>
      </div>

      <button 
        onClick={onCalculate} 
        disabled={isCalculating} 
        className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
      >
        {isCalculating ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Calcolo in corso...
          </>
        ) : (
          'Calcola Valutazione'
        )}
      </button>
    </div>
  );
};

// ============================================
// STEP 2: RESULTS (MINIMALISTA + ACCORDION)
// ============================================

const ResultsStep = ({ results, sessionData, onRecalculate }) => {
  const [expandedSection, setExpandedSection] = useState(null);

  if (!results) {
    return (
      <div className="text-center p-12">
        <p className="text-slate-600">Caricamento risultati...</p>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR', 
      minimumFractionDigits: 0 
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('it-IT', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const details = results.calculation_details;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Valutazione Aziendale</h1>
        {sessionData?.company_name && (
          <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg inline-block">
            <p className="text-2xl font-bold text-blue-700">🏢 {sessionData.company_name}</p>
          </div>
        )}
      </div>

      {/* HERO: Valore Principale */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-xl shadow-2xl text-center text-white">
        <p className="text-xl font-medium mb-2 opacity-90">💰 Valore Stimato della Tua Azienda</p>
        <p className="text-6xl font-extrabold mb-6">
          {formatCurrency(results.fair_market_value)}
        </p>
        
        {/* Range Box */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6 max-w-2xl mx-auto">
          <p className="text-sm font-semibold mb-4 text-blue-100">Range di Valutazione Consigliato</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-blue-200 mb-1">Conservativo (-15%)</p>
              <p className="text-2xl font-bold">{formatCurrency(results.conservative_value)}</p>
            </div>
            <div className="border-l border-r border-white/30">
              <p className="text-xs text-blue-200 mb-1">Equo</p>
              <p className="text-2xl font-bold">{formatCurrency(results.fair_market_value)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-200 mb-1">Ottimistico (+15%)</p>
              <p className="text-2xl font-bold">{formatCurrency(results.optimistic_value)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion 1: Dettagli Calcolo */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => toggleSection('calcolo')}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
        >
          <span className="text-lg font-semibold text-slate-900">📊 Dettagli del Calcolo</span>
          <svg 
            className={`w-6 h-6 transform transition-transform ${expandedSection === 'calcolo' ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {expandedSection === 'calcolo' && (
          <div className="px-6 pb-6 border-t border-slate-200">
            <div className="space-y-6 mt-4">
              {/* Step 1 */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-bold text-blue-900 mb-2">1️⃣ Valore di Partenza (EV/EBITDA)</h3>
                <p className="text-sm text-slate-700 mb-3">
                  Il tuo EBITDA moltiplicato per il multiplo del settore <strong>{details.settore.nome}</strong>
                </p>
                <div className="flex justify-between items-center bg-white p-3 rounded">
                  <span className="text-sm">EBITDA × Multiplo ({details.step1_multiplo}x)</span>
                  <span className="font-bold text-blue-700">{formatCurrency(details.step1_ev_base)}</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 bg-orange-50 rounded-lg">
                <h3 className="font-bold text-orange-900 mb-2">2️⃣ Sconto per Dimensione PMI</h3>
                <p className="text-sm text-slate-700 mb-3">
                  Le PMI sono meno liquide sul mercato rispetto alle grandi società quotate
                </p>
                <div className="flex justify-between items-center bg-white p-3 rounded">
                  <span className="text-sm">Sconto {details.step2_sconto_liquidita_pct}% (Azienda {details.dimensione_azienda}, Settore {details.settore.liquidita})</span>
                  <span className="font-bold text-orange-700">{formatCurrency(details.step2_ev_post_sconto)}</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-bold text-green-900 mb-2">3️⃣ Aggiustamenti per Caratteristiche Azienda</h3>
                <div className="space-y-2 text-sm">
                  {details.inputs_used.crescita_ricavi_pct !== null && (
                    <div className="flex justify-between">
                      <span>Crescita Fatturato: {details.inputs_used.crescita_ricavi_pct > 0 ? '+' : ''}{details.inputs_used.crescita_ricavi_pct}%</span>
                      <span className={details.step3_fattori_ev.crescita_ricavi >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {details.step3_fattori_ev.crescita_ricavi > 0 ? '+' : ''}{details.step3_fattori_ev.crescita_ricavi}%
                      </span>
                    </div>
                  )}
                  {details.step3_fattori_ev.margine_lordo !== 0 && (
                    <div className="flex justify-between">
                      <span>Margine Lordo</span>
                      <span className={details.step3_fattori_ev.margine_lordo >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {details.step3_fattori_ev.margine_lordo > 0 ? '+' : ''}{details.step3_fattori_ev.margine_lordo}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Posizione Mercato: {details.inputs_used.market_position}</span>
                    <span className={details.step3_fattori_ev.posizione_mercato >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                      {details.step3_fattori_ev.posizione_mercato > 0 ? '+' : ''}{details.step3_fattori_ev.posizione_mercato}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Indebitamento: {details.inputs_used.debt_ebitda_ratio}x EBITDA</span>
                    <span className={details.step3_fattori_ev.indebitamento >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                      {details.step3_fattori_ev.indebitamento > 0 ? '+' : ''}{details.step3_fattori_ev.indebitamento}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rischio Tecnologico: {details.inputs_used.technology_risk}</span>
                    <span className={details.step3_fattori_ev.rischio_tecnologico >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                      {details.step3_fattori_ev.rischio_tecnologico > 0 ? '+' : ''}{details.step3_fattori_ev.rischio_tecnologico}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-white p-3 rounded mt-3">
                  <span className="font-semibold">Aggiustamento Totale: {details.step3_fattori_ev.totale > 0 ? '+' : ''}{details.step3_fattori_ev.totale}%</span>
                  <span className="font-bold text-green-700">{formatCurrency(details.step3_ev_aggiustato)}</span>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-bold text-purple-900 mb-2">4️⃣ Sottrazione Debiti Netti (PFN)</h3>
                <p className="text-sm text-slate-700 mb-3">
                  Dal valore aziendale operativo sottraiamo i debiti finanziari netti
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm bg-white p-2 rounded">
                    <span>Valore Aziendale (EV)</span>
                    <span className="font-semibold">{formatCurrency(details.step3_ev_aggiustato)}</span>
                  </div>
                  <div className="flex justify-between text-sm bg-white p-2 rounded">
                    <span>- PFN</span>
                    <span className="font-semibold text-red-700">-{formatCurrency(details.step4_pfn_sottratta)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-purple-700 text-white p-3 rounded">
                    <span className="font-semibold">= Equity Value (Lordo)</span>
                    <span className="font-bold">{formatCurrency(details.step4_equity_lordo)}</span>
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              {details.step5_concentrazione_clienti_pct !== 0 && (
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h3 className="font-bold text-yellow-900 mb-2">5️⃣ Aggiustamento Concentrazione Clienti</h3>
                  <p className="text-sm text-slate-700 mb-3">
                    {details.inputs_used.customer_concentration}% del fatturato dipende dai 3 clienti principali
                  </p>
                  <div className="flex justify-between items-center bg-white p-3 rounded">
                    <span className="text-sm">Riduzione rischio dipendenza: {details.step5_concentrazione_clienti_pct > 0 ? '+' : ''}{details.step5_concentrazione_clienti_pct}%</span>
                    <span className="font-bold text-yellow-700">{formatCurrency(details.step5_equity_netto)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Accordion 2: Cosa Influenza il Valore */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => toggleSection('influenze')}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
        >
          <span className="text-lg font-semibold text-slate-900">💡 Cosa Influenza il Valore</span>
          <svg 
            className={`w-6 h-6 transform transition-transform ${expandedSection === 'influenze' ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {expandedSection === 'influenze' && (
          <div className="px-6 pb-6 border-t border-slate-200">
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="font-semibold text-green-700 mb-2">✅ Fattori Positivi</h4>
                <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                  {details.inputs_used.crescita_ricavi_pct > 10 && (
                    <li>Crescita costante del fatturato ({details.inputs_used.crescita_ricavi_pct > 0 ? '+' : ''}{details.inputs_used.crescita_ricavi_pct}%)</li>
                  )}
                  {details.step3_fattori_ev.margine_lordo > 0 && (
                    <li>Buona marginalità operativa</li>
                  )}
                  {details.inputs_used.technology_risk === 'low' && (
                    <li>Basso rischio di obsolescenza tecnologica</li>
                  )}
                  {details.inputs_used.debt_ebitda_ratio < 2 && (
                    <li>Livello di indebitamento sostenibile</li>
                  )}
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-orange-700 mb-2">⚠️ Fattori di Attenzione</h4>
                <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                  {details.inputs_used.customer_concentration > 30 && (
                    <li>Dipendenza da pochi clienti ({details.inputs_used.customer_concentration}% su Top 3)</li>
                  )}
                  {details.inputs_used.debt_ebitda_ratio > 2 && (
                    <li>Livello di indebitamento da monitorare ({details.inputs_used.debt_ebitda_ratio}x EBITDA)</li>
                  )}
                  {details.inputs_used.crescita_ricavi_pct < 0 && (
                    <li>Fatturato in contrazione ({details.inputs_used.crescita_ricavi_pct}%)</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 3: Prossimi Passi */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => toggleSection('passi')}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
        >
          <span className="text-lg font-semibold text-slate-900">📄 Cosa Significa e Prossimi Passi</span>
          <svg 
            className={`w-6 h-6 transform transition-transform ${expandedSection === 'passi' ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {expandedSection === 'passi' && (
          <div className="px-6 pb-6 border-t border-slate-200">
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">💰 Cosa Significa Questo Valore?</h4>
                <p>
                  Questo è il <strong>prezzo indicativo</strong> che un acquirente ragionevole potrebbe pagare 
                  per il 100% delle quote della tua società, nelle condizioni di mercato attuali.
                </p>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Attenzione</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>È una <strong>stima</strong> basata su multipli di mercato</li>
                  <li>Non sostituisce una due diligence completa</li>
                  <li>Il valore finale dipende dalla negoziazione con l'acquirente</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">📋 Per una Valutazione Più Accurata</h4>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Analisi dettagliata dei contratti clienti e fornitori</li>
                  <li>Valutazione di asset immobiliari e macchinari</li>
                  <li>Review della situazione fiscale e legale</li>
                  <li>Analisi del management e dipendenti chiave</li>
                  <li>Proiezioni finanziarie future (business plan)</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Button Ricalcola */}
      <button 
        onClick={onRecalculate} 
        className="w-full px-4 py-3 font-bold text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
      >
        Modifica Dati e Ricalcola
      </button>
    </div>
  );
};
