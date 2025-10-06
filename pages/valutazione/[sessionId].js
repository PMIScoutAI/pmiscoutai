// /pages/valutazione/[sessionId].js
// Pagina dinamica per il wizard di valutazione aziendale.
// VERSIONE 2.1 - Calcolo PFN automatico e UI parametri qualitativi migliorata.

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
            
            // Inizializza e calcola PFN
            const initialFinancialData = data.historical_data || {};
            for (const year in initialFinancialData) {
                const yearData = initialFinancialData[year];
                const ml = parseFloat(yearData.debiti_finanziari_ml) || 0;
                const breve = parseFloat(yearData.debiti_finanziari_breve) || 0;
                const liquidita = parseFloat(yearData.disponibilita_liquide) || 0;
                yearData.pfn = ml + breve - liquidita;
            }

            setFinancialData(initialFinancialData);
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
    
    // Crea una copia profonda per evitare problemi di mutabilità
    const newFinancialData = JSON.parse(JSON.stringify(financialData));
    
    // Aggiorna il valore modificato dall'utente
    newFinancialData[year][field] = value === '' ? null : parseFloat(value);
    
    // Ricalcola PFN per l'anno modificato
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

// Componenti Helper per i Form
const InputField = ({ label, value, onChange, readOnly = false }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 capitalize">{label} (€)</label>
    <input
      type="number"
      value={value ?? ''}
      onChange={onChange}
      readOnly={readOnly}
      className={`mt-1 w-full px-3 py-2 border rounded-md ${readOnly ? 'bg-slate-100 text-slate-500' : 'border-slate-300'}`}
    />
  </div>
);

const SelectField = ({ id, label, value, onChange, children, helpText }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
        <select id={id} value={value} onChange={onChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            {children}
        </select>
        {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
    </div>
);


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
              <InputField label="Ricavi" value={financialData[year]?.ricavi} onChange={(e) => handleFinancialChange(e, year, 'ricavi')} />
              <InputField label="EBITDA" value={financialData[year]?.ebitda} onChange={(e) => handleFinancialChange(e, year, 'ebitda')} />
              <InputField label="Patrimonio Netto" value={financialData[year]?.patrimonio_netto} onChange={(e) => handleFinancialChange(e, year, 'patrimonio_netto')} />
              <InputField label="Debiti Finanziari M/L" value={financialData[year]?.debiti_finanziari_ml} onChange={(e) => handleFinancialChange(e, year, 'debiti_finanziari_ml')} />
              <InputField label="Debiti Finanziari a Breve" value={financialData[year]?.debiti_finanziari_breve} onChange={(e) => handleFinancialChange(e, year, 'debiti_finanziari_breve')} />
              <InputField label="Disponibilità Liquide" value={financialData[year]?.disponibilita_liquide} onChange={(e) => handleFinancialChange(e, year, 'disponibilita_liquide')} />
              <InputField label="PFN (Calcolata)" value={financialData[year]?.pfn} readOnly={true} />
            </div>
          ))}
        </div>
      </div>
      
      {/* Sezione Input Qualitativi */}
      <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Parametri Qualitativi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SelectField id="market_position" label="Posizione di Mercato" value={valuationInputs.market_position || 'follower'} onChange={handleInputChange} helpText="La posizione competitiva dell'azienda nel suo settore di riferimento.">
                  <option value="leader">Leader</option>
                  <option value="challenger">Challenger</option>
                  <option value="follower">Follower</option>
                  <option value="niche">Nicchia</option>
              </SelectField>
              <SelectField id="customer_concentration" label="Concentrazione Clienti" value={valuationInputs.customer_concentration || 'medium'} onChange={handleInputChange} helpText="Indica la dipendenza dal fatturato generato dai clienti principali.">
                  <option value="low">Bassa (&lt;10% dal cliente principale)</option>
                  <option value="medium">Media (10-30%)</option>
                  <option value="high">Alta (&gt;30%)</option>
              </SelectField>
              <SelectField id="technology_risk" label="Rischio Tecnologico/Obsolescenza" value={valuationInputs.technology_risk || 'medium'} onChange={handleInputChange} helpText="Valuta l'impatto dell'innovazione tecnologica sul modello di business.">
                  <option value="low">Basso</option>
                  <option value="medium">Medio</option>
                  <option value="high">Alto</option>
              </SelectField>
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

