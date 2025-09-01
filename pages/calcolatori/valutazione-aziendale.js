import React, { useState, useMemo } from 'react';

// Questa funzione serve per passare il titolo della pagina al componente Layout
export async function getStaticProps() {
  return {
    props: {
      title: 'Valutazione Aziendale',
    },
  };
}

// --- Dati e Configurazione (invariati) ---
const industryMultiples = {
  technology: { revenue: 3.5, ebitda: 12, pe: 18 }, healthcare: { revenue: 2.8, ebitda: 10, pe: 16 }, fintech: { revenue: 4.2, ebitda: 14, pe: 20 }, ecommerce: { revenue: 2.5, ebitda: 8, pe: 14 }, manufacturing: { revenue: 1.8, ebitda: 8, pe: 12 }, services: { revenue: 2.2, ebitda: 9, pe: 14 }, energy: { revenue: 1.5, ebitda: 6, pe: 10 }, real_estate: { revenue: 2.0, ebitda: 8, pe: 12 }, media: { revenue: 2.8, ebitda: 10, pe: 15 }, retail: { revenue: 1.2, ebitda: 5, pe: 10 }, automotive: { revenue: 1.6, ebitda: 7, pe: 11 }, food: { revenue: 1.8, ebitda: 8, pe: 13 }
};
const initialFormData = {
  industry: 'technology', companySize: 'small', marketPosition: 'challenger', geography: 'national', revenue: '4500000', ebitda: '900000', netIncome: '675000', previousRevenue: '3500000', previousEbitda: '560000', previousNetIncome: '420000', grossMargin: '50', recurringRevenue: '70', debtLevel: 'low', customerConcentration: '30', technologyRisk: 'medium', managementQuality: 'good'
};
const blankFormData = {
  industry: 'technology', companySize: 'micro', marketPosition: 'follower', geography: 'local', revenue: '', ebitda: '', netIncome: '', previousRevenue: '', previousEbitda: '', previousNetIncome: '', grossMargin: '', recurringRevenue: '', debtLevel: 'medium', customerConcentration: '', technologyRisk: 'medium', managementQuality: 'average'
};
const formConfig = [
  { id: 'companyInfo', title: 'Informazioni Azienda', icon: '🏢', fields: [ { id: 'industry', label: 'Settore', type: 'select', options: [ { value: 'technology', label: 'Tecnologia & Software' }, { value: 'healthcare', label: 'Sanità & Life Sciences' }, { value: 'fintech', label: 'Fintech & Servizi Finanziari' }, { value: 'ecommerce', label: 'E-commerce & Digital' }, { value: 'manufacturing', label: 'Manifatturiero & Industria' }, { value: 'services', label: 'Servizi Professionali' }, { value: 'energy', label: 'Energia & Utilities' }, { value: 'real_estate', label: 'Real Estate & Costruzioni' }, { value: 'media', label: 'Media & Entertainment' }, { value: 'retail', label: 'Retail & Consumer' }, { value: 'automotive', label: 'Automotive & Componentistica' }, { value: 'food', label: 'Food & Beverage' } ] }, { id: 'companySize', label: 'Dimensione', type: 'select', options: [ { value: 'micro', label: 'Micro (< €2M fatturato)' }, { value: 'small', label: 'Piccola (€2M - €10M)' }, { value: 'medium', label: 'Media (€10M - €50M)' }, { value: 'large', label: 'Grande (> €50M)' } ] }, { id: 'marketPosition', label: 'Posizione di Mercato', type: 'select', options: [ { value: 'leader', label: 'Leader di Mercato' }, { value: 'challenger', label: 'Challenger' }, { value: 'follower', label: 'Follower' }, { value: 'niche', label: 'Nicchia Specializzata' } ] }, { id: 'geography', label: 'Copertura Geografica', type: 'select', options: [ { value: 'local', label: 'Locale/Regionale' }, { value: 'national', label: 'Nazionale' }, { value: 'european', label: 'Europea' }, { value: 'international', label: 'Internazionale' } ] } ] },
  { id: 'currentFinancials', title: 'Dati Finanziari Anno Corrente', icon: '💰', fields: [ { id: 'revenue', label: 'Ricavi (€)', type: 'number', placeholder: 'es. 4500000' }, { id: 'ebitda', label: 'EBITDA (€)', type: 'number', placeholder: 'es. 900000' }, { id: 'netIncome', label: 'Utile Netto (€)', type: 'number', placeholder: 'es. 675000' } ] },
  { id: 'previousFinancials', title: 'Dati Anno Precedente', icon: '📊', fields: [ { id: 'previousRevenue', label: 'Ricavi Anno Precedente (€)', type: 'number', placeholder: 'es. 3500000' }, { id: 'previousEbitda', label: 'EBITDA Anno Precedente (€)', type: 'number', placeholder: 'es. 560000' }, { id: 'previousNetIncome', label: 'Utile Netto Anno Precedente (€)', type: 'number', placeholder: 'es. 420000' } ] },
  { id: 'performanceMetrics', title: 'Metriche di Performance', icon: '🎯', fields: [ { id: 'grossMargin', label: 'Margine Lordo (%)', type: 'number', placeholder: 'es. 50' }, { id: 'recurringRevenue', label: 'Ricavi Ricorrenti (%)', type: 'number', placeholder: 'es. 70' }, { id: 'customerConcentration', label: 'Concentrazione Clienti (%)', type: 'number', placeholder: 'es. 30' }, { id: 'debtLevel', label: 'Livello Indebitamento', type: 'select', options: [ { value: 'low', label: 'Basso (< 2x EBITDA)' }, { value: 'medium', label: 'Medio (2-4x EBITDA)' }, { value: 'high', label: 'Alto (> 4x EBITDA)' } ] }, { id: 'technologyRisk', label: 'Rischio Tecnologico', type: 'select', options: [ { value: 'low', label: 'Basso' }, { value: 'medium', label: 'Medio' }, { value: 'high', label: 'Alto' } ] }, { id: 'managementQuality', label: 'Qualità Management', type: 'select', options: [ { value: 'excellent', label: 'Eccellente' }, { value: 'good', label: 'Buona' }, { value: 'average', label: 'Media' }, { value: 'poor', label: 'Scarsa' } ] } ] }
];

// --- Logica di Calcolo (invariata) ---
const performCalculation = (formData) => {
    const data = { ...formData };
    const numericKeys = ['revenue', 'ebitda', 'netIncome', 'previousRevenue', 'previousEbitda', 'previousNetIncome', 'grossMargin', 'recurringRevenue', 'customerConcentration'];
    numericKeys.forEach(key => { data[key] = Math.max(0, parseFloat(data[key]) || 0); });
    const industryData = industryMultiples[data.industry];
    if (data.revenue === 0 || !industryData) return { fairMarketValue: 0, conservativeValue: 0, optimisticValue: 0, evRevenue: 'N/A', evEbitda: 'N/A', peRatio: 'N/A', revenueGrowth: 0, ebitdaGrowth: 0, qualityScore: 0, riskScore: 0, liquidityDiscount: 0 };
    let revenueMultiple = data.revenue * industryData.revenue;
    let ebitdaMultiple = data.ebitda * industryData.ebitda;
    let peMultiple = data.netIncome * industryData.pe;
    let adjustmentFactor = 1;
    let liquidityDiscount = { micro: 0.30, small: 0.20, medium: 0.12, large: 0.08 }[data.companySize] || 0.15;
    adjustmentFactor -= liquidityDiscount;
    adjustmentFactor += { international: 0.15, european: 0.08, national: 0.03, local: -0.05 }[data.geography] || 0;
    const revenueGrowth = data.previousRevenue > 0 ? ((data.revenue - data.previousRevenue) / data.previousRevenue) * 100 : 0;
    if (revenueGrowth > 20) adjustmentFactor += 0.12; else if (revenueGrowth > 10) adjustmentFactor += 0.06; else if (revenueGrowth > 3) adjustmentFactor += 0.02; else if (revenueGrowth < 0) adjustmentFactor -= 0.20;
    if (data.grossMargin > 60) adjustmentFactor += 0.08; else if (data.grossMargin > 40) adjustmentFactor += 0.04; else if (data.grossMargin < 25) adjustmentFactor -= 0.12;
    if (data.recurringRevenue > 80) adjustmentFactor += 0.10; else if (data.recurringRevenue > 60) adjustmentFactor += 0.06; else if (data.recurringRevenue > 40) adjustmentFactor += 0.03; else if (data.recurringRevenue < 20) adjustmentFactor -= 0.08;
    adjustmentFactor += { leader: 0.08, challenger: 0.03, follower: -0.08, niche: 0.02 }[data.marketPosition] || 0;
    adjustmentFactor += { low: 0.05, high: -0.15, medium: 0 }[data.technologyRisk] || 0;
    if (data.customerConcentration > 50) adjustmentFactor -= 0.20; else if (data.customerConcentration > 30) adjustmentFactor -= 0.10; else if (data.customerConcentration < 15) adjustmentFactor += 0.05;
    adjustmentFactor += { high: -0.15, medium: -0.05, low: 0.03 }[data.debtLevel] || 0;
    adjustmentFactor += { excellent: 0.08, good: 0.03, poor: -0.12, average: 0 }[data.managementQuality] || 0;
    adjustmentFactor = Math.min(1.8, Math.max(0.5, adjustmentFactor));
    const baseValuation = (revenueMultiple * 0.25 + ebitdaMultiple * 0.60 + peMultiple * 0.15);
    const adjustedValuation = Math.max(0, baseValuation * adjustmentFactor);
    const ebitdaGrowth = data.previousEbitda > 0 ? ((data.ebitda - data.previousEbitda) / data.previousEbitda) * 100 : 0;
    const qualityScore = Math.min(100, Math.max(0, (data.grossMargin * 0.25) + (data.recurringRevenue * 0.35) + (Math.max(0, Math.min(revenueGrowth, 30)) * 0.25) + ({ international: 15, european: 10, national: 5, local: 0 }[data.geography] || 0)));
    const riskScore = Math.min(100, Math.max(0, 100 - data.customerConcentration * 0.8 + ({ low: 15, medium: 5, high: -15 }[data.technologyRisk] || 0) + ({ excellent: 15, good: 8, poor: -15, average: 0 }[data.managementQuality] || 0) + ({ low: 10, high: -15, medium: -5 }[data.debtLevel] || 0)));
    return { fairMarketValue: Math.round(adjustedValuation), conservativeValue: Math.round(adjustedValuation * 0.80), optimisticValue: Math.round(adjustedValuation * 1.20), evRevenue: data.revenue > 0 ? (adjustedValuation / data.revenue).toFixed(1) : 'N/A', evEbitda: data.ebitda > 0 ? (adjustedValuation / data.ebitda).toFixed(1) : 'N/A', peRatio: data.netIncome > 0 ? (adjustedValuation / data.netIncome).toFixed(1) : 'N/A', revenueGrowth, ebitdaGrowth, qualityScore, riskScore, liquidityDiscount };
};

// --- Componenti UI con Tailwind CSS ---

const FormField = ({ config, value, onChange }) => {
  const { id, label, type, options, placeholder } = config;
  const commonClasses = "w-full px-3 py-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";
  
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {type === 'select' ? (
        <select id={id} value={value} onChange={onChange} className={commonClasses}>
          {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      ) : (
        <input type="number" id={id} value={value} onChange={onChange} placeholder={placeholder} className={commonClasses} />
      )}
    </div>
  );
};

const FormSection = ({ config, formData, handleInputChange }) => (
  <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
    <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-200">
      <span className="text-xl">{config.icon}</span>
      <h3 className="text-lg font-semibold text-slate-800">{config.title}</h3>
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {config.fields.map(field => (
        <FormField key={field.id} config={field} value={formData[field.id]} onChange={handleInputChange} />
      ))}
    </div>
  </div>
);

const ResultsPanel = ({ results }) => {
  const formatCurrency = (amount) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
  const formatPercentage = (value) => `${value >= 0 ? '+' : ''}${(value || 0).toFixed(1)}%`;
  const getMetricClass = (value) => value >= 0 ? 'text-green-600' : 'text-red-600';
  const displayMetric = v => (v == null || v === 'N/A' ? 'N/A' : `${v}x`);

  return (
    <div className="sticky top-6">
        <div className="p-6 space-y-6 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="text-center">
                <p className="text-sm font-medium text-slate-500">Valutazione Fair Market Value</p>
                <p className="text-4xl font-bold text-blue-600">{formatCurrency(results.fairMarketValue)}</p>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between p-3 text-sm rounded-md bg-red-50 text-red-800"><span>🔻 Conservativo</span><strong>{formatCurrency(results.conservativeValue)}</strong></div>
                <div className="flex justify-between p-3 text-sm rounded-md bg-green-50 text-green-800"><span>🔺 Ottimistico</span><strong>{formatCurrency(results.optimisticValue)}</strong></div>
            </div>

            <div>
                <h4 className="font-semibold text-slate-700">Multipli di Valutazione</h4>
                <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">EV/Ricavi</span><span className="font-medium text-slate-800">{displayMetric(results.evRevenue)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">EV/EBITDA</span><span className="font-medium text-slate-800">{displayMetric(results.evEbitda)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">P/E Ratio</span><span className="font-medium text-slate-800">{displayMetric(results.peRatio)}</span></div>
                </div>
            </div>

             <div>
                <h4 className="font-semibold text-slate-700">Performance & Risk</h4>
                <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Crescita Ricavi</span><span className={`font-medium ${getMetricClass(results.revenueGrowth)}`}>{formatPercentage(results.revenueGrowth)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Crescita EBITDA</span><span className={`font-medium ${getMetricClass(results.ebitdaGrowth)}`}>{formatPercentage(results.ebitdaGrowth)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Score Qualità</span><span className="font-medium text-slate-800">{Math.round(results.qualityScore || 0)}/100</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Score Rischio</span><span className="font-medium text-slate-800">{Math.round(results.riskScore || 0)}/100</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Sconto Liquidità</span><span className="font-medium text-red-600">-{Math.round((results.liquidityDiscount || 0) * 100)}%</span></div>
                </div>
            </div>
            
            <div className="pt-4 border-t border-slate-200">
                 <button onClick={() => window.print()} className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    🖨️ Stampa Report
                </button>
            </div>
        </div>
    </div>
  );
};


// --- Componente Principale della Pagina ---
// Questa è la parte che viene renderizzata come "children" nel tuo Layout
const ValutazioneAziendalePage = () => {
  const [formData, setFormData] = useState(initialFormData);
  const results = useMemo(() => performCalculation(formData), [formData]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="p-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
      {/* Header della pagina */}
      <div className="pb-6 mb-6 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900">Calcolatore Valutazione Aziendale</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ottieni una stima professionale del valore della tua impresa basata sui multipli di mercato.
        </p>
      </div>

      {/* Layout a griglia per form e risultati */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
        
        {/* Colonna sinistra: Form */}
        <div className="space-y-6 lg:col-span-2">
            <div className="flex flex-wrap gap-3 p-4 bg-white border rounded-lg border-slate-200">
                 <button onClick={() => setFormData({...blankFormData})} className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200">Pulisci Dati</button>
                 <button onClick={() => setFormData({...initialFormData})} className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200">Carica Esempio</button>
            </div>
            {formConfig.map(section => (
                <FormSection key={section.id} config={section} formData={formData} handleInputChange={handleInputChange} />
            ))}
        </div>

        {/* Colonna destra: Risultati */}
        <div className="lg:col-span-1">
          <ResultsPanel results={results} />
        </div>

      </div>
    </div>
  );
};

export default ValutazioneAziendalePage;
