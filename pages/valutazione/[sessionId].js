// /pages/valutazione/[sessionId].js
// VERSIONE 9.0 - SEMPLIFICATA: Solo Fair Value + Range ±10% + Nota Metodologica
// REMOVED: KPI Dashboard, Step dettagliati, Benchmark, DataEntryStep complesso

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
        <InputStep 
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
          valuationInputs={valuationInputs}
          onRecalculate={handleRecalculate}
        />
      )}
    </div>
  );
}

// ============================================
// STEP 1: INPUT FORM - MINIMALISTA
// ============================================
const InputStep = ({ 
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
      {/* Header Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>📊 Azienda:</strong> {sessionData.company_name} <br/>
          <strong>📅 Bilancio:</strong> {yearN1} vs {yearN}
        </p>
      </div>

      {/* Dati Finanziari */}
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

      {/* Parametri Valutazione - Minimalista */}
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
        </div>
      </div>

      {/* Calcola Button */}
      <button 
        onClick={onCalculate} 
        disabled={isCalculating} 
        className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
      >
        {isCalculating ? 'Calcolo in corso...' : '🚀 Calcola Valutazione'}
      </button>
    </div>
  );
};

// ============================================
// STEP 2: RISULTATI - SEMPLIFICATI
// ============================================
const ResultsStep = ({ results, sessionData, valuationInputs, onRecalculate }) => {
  if (!results) {
    return <div className="text-center p-12"><p className="text-slate-600">Caricamento...</p></div>;
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR', 
      minimumFractionDigits: 0 
    }).format(value);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const details = results.calculation_details;

  // Calcolo generazione nota metodologica (semplificata)
  const generateMethodologyNote = () => {
    const settoreName = details.settore.nome;
    const multiploEbitda = details.step1_multiplo;
    const sconto = details.step2_sconto_liquidita_pct;
    const dimensione = valuationInputs.dimensione;
    
    return `
Valutazione tramite Multipli di Mercato

Il valore è calcolato applicando i multipli EBITDA medi del settore "${settoreName}" (${multiploEbitda}x) ai dati dell'azienda, aggiustati per:

• Dimensione: ${dimensione} (sconto liquidità −${sconto}%)
• Andamento finanziario: basato su crescita ricavi e livello di indebitamento
• Posizione finanziaria netta: ${formatCurrency(details.inputs_used.pfn)}

Il range ±10% rappresenta l'incertezza naturale nel comparare questa azienda con il benchmark di mercato.

Disclaimer: Questa è una stima indicativa basata su dati storici e multipli di mercato standard. Per una Due Diligence formale o valutazione per transazioni, consigliamo una valutazione da esperti indipendenti qualificati.
    `.trim();
  };

  return (
    <div className="space-y-6" id="results-section">
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

          .bg-gradient-to-br {
            background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .text-7xl {
            font-size: 3.5rem !important;
          }

          .text-5xl {
            font-size: 2.5rem !important;
          }
        }
      `}</style>

      {/* 🎯 HERO CARD - SEMPLIFICATO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 rounded-2xl p-8 md:p-12 text-white shadow-2xl print-avoid-break">
        {/* Decorazioni sfondo */}
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
            <p className="text-5xl md:text-7xl font-bold mb-4">
              {formatCurrency(results.fair_market_value)}
            </p>
          </div>
          
          {/* Range Valutativo Semplice */}
          <div className="mt-8">
            <p className="text-sm uppercase tracking-wide opacity-80 mb-4 text-center font-semibold">
              Range Valutativo (±10%)
            </p>
            
            <div className="grid grid-cols-3 gap-2 text-sm md:text-base">
              <div className="text-center p-3 bg-white/10 rounded-lg">
                <p className="opacity-70 text-xs mb-1">Conservativo</p>
                <p className="font-bold">
                  {formatCurrency(results.conservative_value)}
                </p>
              </div>
              
              <div className="text-center p-3 bg-white/20 rounded-lg border border-white/40">
                <p className="opacity-70 text-xs mb-1">Fair Value</p>
                <p className="font-bold text-lg">
                  {formatCurrency(results.fair_market_value)}
                </p>
              </div>
              
              <div className="text-center p-3 bg-white/10 rounded-lg">
                <p className="opacity-70 text-xs mb-1">Ottimistico</p>
                <p className="font-bold">
                  {formatCurrency(results.optimistic_value)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 NOTA METODOLOGICA */}
      <div className="bg-white rounded-lg shadow-md p-8 print-avoid-break border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-6">📊 Metodologia di Valutazione</h3>
        
        <div className="prose prose-sm max-w-none">
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
            {generateMethodologyNote()}
          </p>
        </div>

        {/* Dettagli Nascosti (collassabile per stampa) */}
        <details className="mt-6 pt-6 border-t border-slate-200">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
            💡 Dettagli Calcolo (espandi)
          </summary>
          
          <div className="mt-4 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>EBITDA (Anno N):</span>
              <span className="font-mono font-semibold">{formatCurrency(details.inputs_used.ebitda)}</span>
            </div>
            <div className="flex justify-between">
              <span>Multiplo Settore:</span>
              <span className="font-mono font-semibold">{details.step1_multiplo}x</span>
            </div>
            <div className="flex justify-between">
              <span>EV Base:</span>
              <span className="font-mono font-semibold">{formatCurrency(details.step1_ev_base)}</span>
            </div>
            <div className="flex justify-between">
              <span>Sconto Liquidità:</span>
              <span className="font-mono font-semibold">−{details.step2_sconto_liquidita_pct}%</span>
            </div>
            <div className="flex justify-between">
              <span>EV Post-Sconto:</span>
              <span className="font-mono font-semibold">{formatCurrency(details.step2_ev_post_sconto)}</span>
            </div>
            <div className="flex justify-between">
              <span>Aggiustamenti:</span>
              <span className="font-mono font-semibold">{details.step3_fattori_ev.totale >= 0 ? '+' : ''}{details.step3_fattori_ev.totale}%</span>
            </div>
            <div className="flex justify-between">
              <span>EV Aggiustato:</span>
              <span className="font-mono font-semibold">{formatCurrency(details.step3_ev_aggiustato)}</span>
            </div>
            <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between font-semibold">
              <span>PFN (sottratta):</span>
              <span className="font-mono">−{formatCurrency(details.step4_pfn_sottratta)}</span>
            </div>
            <div className="bg-slate-100 p-2 rounded flex justify-between font-bold">
              <span>EQUITY VALUE:</span>
              <span className="font-mono text-blue-600">{formatCurrency(details.step4_equity_value)}</span>
            </div>
          </div>
        </details>
      </div>

      {/* Bottoni Azione */}
      <div className="space-y-4 no-print">
        <div className="flex justify-start">
          <button 
            onClick={() => window.location.href = '/valuta-pmi'}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Torna all'Upload
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <button 
            onClick={handlePrintPDF}
            className="flex-1 px-4 py-3 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Stampa / Scarica PDF
          </button>
          
          <button 
            onClick={onRecalculate} 
            className="flex-1 px-4 py-3 font-bold text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
          >
            🔄 Modifica e Ricalcola
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs md:text-sm text-yellow-900 print-avoid-break">
        <p className="font-semibold mb-2">⚠️ Disclaimer</p>
        <p>
          Questa valutazione utilizza multipli standard di mercato adattati al contesto italiano e rappresenta una stima indicativa basata sui dati forniti. PMIScout non si assume alcuna responsabilità per decisioni prese sulla base di questa analisi. Per valutazioni ufficiali o transazioni, consultare esperti indipendenti qualificati.
        </p>
      </div>
    </div>
  );
};
