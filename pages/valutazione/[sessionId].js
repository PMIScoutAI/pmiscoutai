// /pages/valutazione/[sessionId].js
// Pagina dinamica per il wizard di valutazione aziendale.

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { api } from '../../utils/api';
import Layout from '../../components/Layout';
import { ProtectedPage } from '../../utils/ProtectedPage';

// Componente Wrapper per la protezione della pagina
export default function ValutazionePageWrapper() {
  return (
    <ProtectedPage>
      <Layout pageTitle="Valutazione Aziendale">
        <ValutazioneWizard />
      </Layout>
    </ProtectedPage>
  );
}

// Componente Principale del Wizard
function ValutazioneWizard() {
  const router = useRouter();
  const { sessionId } = router.query;
  
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState('loading'); // loading, entry, results

  // State per i form
  const [financialData, setFinancialData] = useState({});
  const [valuationInputs, setValuationInputs] = useState({});
  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Carica i dati della sessione all'avvio
  useEffect(() => {
    if (sessionId) {
      const fetchSession = async () => {
        try {
          setLoading(true);
          const response = await api.get(`/valuta-pmi/get-session?sessionId=${sessionId}`);
          if (response.data.success) {
            const data = response.data.data;
            setSessionData(data);
            setFinancialData(data.historical_data || {});
            setValuationInputs(data.valuation_inputs || {});
            
            if(data.status === 'completed' && data.results_data) {
                setResults(data.results_data);
                setCurrentStep('results');
            } else {
                setCurrentStep('entry');
            }
          } else {
            throw new Error(response.data.error);
          }
        } catch (err) {
          setError(err.message || 'Impossibile caricare la sessione.');
        } finally {
          setLoading(false);
        }
      };
      fetchSession();
    }
  }, [sessionId]);

  const handleFinancialChange = (e, year, field) => {
    const { value } = e.target;
    setFinancialData(prev => ({
      ...prev,
      [year]: {
        ...prev[year],
        [field]: value === '' ? null : parseFloat(value)
      }
    }));
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setValuationInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    setError('');
    try {
        const payload = {
            sessionId,
            updatedData: financialData,
            valuationInputs
        };
        const response = await api.post('/valuta-pmi/calculate', payload);
        if(response.data.success){
            setResults(response.data.results);
            setCurrentStep('results');
        } else {
            throw new Error(response.data.error);
        }
    } catch (err) {
        setError(err.message || 'Errore durante il calcolo della valutazione.');
    } finally {
        setIsCalculating(false);
    }
  };

  const renderContent = () => {
    if (loading) return <div className="text-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4">Caricamento sessione...</p></div>;
    if (error) return <div className="p-6 bg-red-100 text-red-800 rounded-lg">{error}</div>;

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
        return <ResultsStep results={results} onRecalculate={() => setCurrentStep('entry')} />;
      default:
        return <div>Stato non valido</div>;
    }
  };

  return (
    <div className="py-8 mx-auto max-w-4xl px-4">
      {renderContent()}
    </div>
  );
}

// Componente per lo Step di Data Entry
const DataEntryStep = ({ sessionData, financialData, valuationInputs, handleFinancialChange, handleInputChange, onCalculate, isCalculating }) => {
  const years = sessionData.years_analyzed.sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Verifica e Completa i Dati</h1>
        <p className="mt-2 text-slate-600">Controlla i dati estratti dall'XBRL e inserisci i parametri qualitativi per una valutazione accurata.</p>
      </div>

      {/* Sezione Dati Finanziari */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Dati Finanziari</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {years.map(year => (
            <div key={year} className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-bold text-lg">{year}</h3>
              {['ricavi', 'ebitda', 'patrimonio_netto', 'pfn'].map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-slate-700 capitalize">{field.replace('_', ' ')} (€)</label>
                  <input
                    type="number"
                    value={financialData[year]?.[field] ?? ''}
                    onChange={(e) => handleFinancialChange(e, year, field)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Sezione Input Qualitativi */}
      <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Parametri Qualitativi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label htmlFor="market_position" className="block text-sm font-medium text-slate-700">Posizione di Mercato</label>
                  <select id="market_position" value={valuationInputs.market_position || 'follower'} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                      <option value="leader">Leader</option>
                      <option value="challenger">Challenger</option>
                      <option value="follower">Follower</option>
                      <option value="niche">Nicchia</option>
                  </select>
              </div>
              <div>
                  <label htmlFor="management_quality" className="block text-sm font-medium text-slate-700">Qualità del Management</label>
                  <select id="management_quality" value={valuationInputs.management_quality || 'average'} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                      <option value="excellent">Eccellente</option>
                      <option value="good">Buona</option>
                      <option value="average">Media</option>
                      <option value="poor">Scarsa</option>
                  </select>
              </div>
              <div>
                  <label htmlFor="customer_concentration" className="block text-sm font-medium text-slate-700">Concentrazione Clienti</label>
                  <select id="customer_concentration" value={valuationInputs.customer_concentration || 'medium'} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                      <option value="low">Bassa (&lt;10% dal cliente principale)</option>
                      <option value="medium">Media (10-30%)</option>
                      <option value="high">Alta (&gt;30%)</option>
                  </select>
              </div>
              <div>
                  <label htmlFor="technology_risk" className="block text-sm font-medium text-slate-700">Rischio Tecnologico/Obsolescenza</label>
                  <select id="technology_risk" value={valuationInputs.technology_risk || 'medium'} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                      <option value="low">Basso</option>
                      <option value="medium">Medio</option>
                      <option value="high">Alto</option>
                  </select>
              </div>
          </div>
      </div>

      <button onClick={onCalculate} disabled={isCalculating} className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400">
          {isCalculating ? 'Calcolo in corso...' : 'Calcola Valutazione'}
      </button>
    </div>
  );
};

// Componente per lo Step dei Risultati
const ResultsStep = ({ results, onRecalculate }) => {
    if (!results) return <div>Caricamento risultati...</div>;

    const formatCurrency = (value) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold">Risultato della Valutazione</h1>
                <p className="mt-2 text-slate-600">Basato sui dati forniti e sui multipli di mercato del settore di riferimento.</p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-xl text-center">
                <p className="text-lg text-slate-600">Valore di Mercato Stimato (Equity Value)</p>
                <p className="text-5xl font-extrabold text-blue-600 my-4">{formatCurrency(results.fair_market_value)}</p>
                <div className="flex justify-center gap-8 mt-6 text-slate-700">
                    <div>
                        <p className="text-sm">Range Conservativo</p>
                        <p className="font-bold text-lg">{formatCurrency(results.conservative_value)}</p>
                    </div>
                    <div>
                        <p className="text-sm">Range Ottimistico</p>
                        <p className="font-bold text-lg">{formatCurrency(results.optimistic_value)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Dettagli del Calcolo</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <p><strong>Settore:</strong> {results.calculation_details.multiples_used.sector}</p>
                    <p><strong>Multiplo EBITDA usato:</strong> {results.calculation_details.multiples_used.ebitda}x</p>
                    <p><strong>Multiplo Ricavi usato:</strong> {results.calculation_details.multiples_used.revenue}x</p>
                    <p><strong>Fattore di Aggiustamento:</strong> {results.calculation_details.adjustment_factor}x</p>
                    <p><strong>Enterprise Value (Base):</strong> {formatCurrency(results.calculation_details.base_ev)}</p>
                    <p><strong>Enterprise Value (Aggiustato):</strong> {formatCurrency(results.calculation_details.adjusted_ev)}</p>
                    <p><strong>PFN sottratta:</strong> {formatCurrency(results.calculation_details.pfn_used)}</p>
                </div>
            </div>
            
            <button onClick={onRecalculate} className="w-full px-4 py-3 font-bold text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200">
                Modifica Dati e Ricalcola
            </button>
        </div>
    );
};
