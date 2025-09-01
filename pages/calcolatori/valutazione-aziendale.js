// pages/calcolatori/valutazione-aziendale.js
import React, { useState, useMemo } from 'react';

// --- QUANDO INTEGRI NEL TUO PROGETTO, CANCELLA LA SEZIONE SOTTOSTANTE ---
// --- SIMULAZIONE DELLE DIPENDENZE ESTERNE (PER FUNZIONARE NELL'ANTEPRIMA) ---
const useAuth = () => ({ user: { name: 'Utente Demo', email: 'demo@example.com' } }); 
const Layout = ({ children, pageTitle }) => <div title={pageTitle}>{children}</div>;
const Link = ({ href, children }) => <a href={href}>{children}</a>;
// --- FINE SEZIONE DA CANCELLARE ---


// --- E DE-COMMENTA GLI IMPORT ORIGINALI QUI SOTTO ---
// import Link from 'next/link';
// import { useAuth } from '../../hooks/useAuth';
// import Layout from '../../components/Layout';


// --- CONFIGURAZIONE E DATI INIZIALI ---

// Multipli di settore (invariati)
const industryMultiples = { technology: { revenue: 3.5, ebitda: 12, pe: 18 }, healthcare: { revenue: 2.8, ebitda: 10, pe: 16 }, fintech: { revenue: 4.2, ebitda: 14, pe: 20 }, ecommerce: { revenue: 2.5, ebitda: 8, pe: 14 }, manufacturing: { revenue: 1.8, ebitda: 8, pe: 12 }, services: { revenue: 2.2, ebitda: 9, pe: 14 }, energy: { revenue: 1.5, ebitda: 6, pe: 10 }, real_estate: { revenue: 2.0, ebitda: 8, pe: 12 }, media: { revenue: 2.8, ebitda: 10, pe: 15 }, retail: { revenue: 1.2, ebitda: 5, pe: 10 }, automotive: { revenue: 1.6, ebitda: 7, pe: 11 }, food: { revenue: 1.8, ebitda: 8, pe: 13 } };

// Dati iniziali e vuoti (invariati)
const initialFormData = { industry: 'technology', companySize: 'small', marketPosition: 'challenger', geography: 'national', revenue: '4500000', ebitda: '900000', netIncome: '675000', previousRevenue: '3500000', previousEbitda: '560000', previousNetIncome: '420000', grossMargin: '50', recurringRevenue: '70', debtLevel: 'low', customerConcentration: '30', technologyRisk: 'medium', managementQuality: 'good' };
const blankFormData = { industry: 'technology', companySize: 'micro', marketPosition: 'follower', geography: 'local', revenue: '', ebitda: '', netIncome: '', previousRevenue: '', previousEbitda: '', previousNetIncome: '', grossMargin: '', recurringRevenue: '', debtLevel: 'medium', customerConcentration: '', technologyRisk: 'medium', managementQuality: 'average' };

// Configurazione centralizzata per la creazione dinamica del form
const formConfig = [
    {
        id: 'companyInfo',
        title: 'Informazioni Azienda',
        icon: '🏢',
        fields: [
            { id: 'industry', label: '🚀 Settore', type: 'select', options: [ { value: 'technology', label: 'Tecnologia & Software' }, { value: 'healthcare', label: 'Sanità & Life Sciences' }, { value: 'fintech', label: 'Fintech & Servizi Finanziari' }, { value: 'ecommerce', label: 'E-commerce & Digital' }, { value: 'manufacturing', label: 'Manifatturiero & Industria' }, { value: 'services', label: 'Servizi Professionali' }, { value: 'energy', label: 'Energia & Utilities' }, { value: 'real_estate', label: 'Real Estate & Costruzioni' }, { value: 'media', label: 'Media & Entertainment' }, { value: 'retail', label: 'Retail & Consumer' }, { value: 'automotive', label: 'Automotive & Componentistica' }, { value: 'food', label: 'Food & Beverage' } ] },
            { id: 'companySize', label: '📏 Dimensione', type: 'select', options: [ { value: 'micro', label: 'Micro (< €2M fatturato)' }, { value: 'small', label: 'Piccola (€2M - €10M)' }, { value: 'medium', label: 'Media (€10M - €50M)' }, { value: 'large', label: 'Grande (> €50M)' } ] },
            { id: 'marketPosition', label: '🎯 Posizione di Mercato', type: 'select', options: [ { value: 'leader', label: 'Leader di Mercato' }, { value: 'challenger', label: 'Challenger' }, { value: 'follower', label: 'Follower' }, { value: 'niche', label: 'Nicchia Specializzata' } ] },
            { id: 'geography', label: '🌍 Copertura Geografica', type: 'select', options: [ { value: 'local', label: 'Locale/Regionale' }, { value: 'national', label: 'Nazionale' }, { value: 'european', label: 'Europea' }, { value: 'international', label: 'Internazionale' } ] },
        ]
    },
    {
        id: 'currentFinancials',
        title: 'Dati Finanziari Anno Corrente',
        icon: '💰',
        fields: [
            { id: 'revenue', label: '💵 Ricavi (€)', type: 'number', placeholder: 'es. 4500000' },
            { id: 'ebitda', label: '📈 EBITDA (€)', type: 'number', placeholder: 'es. 900000' },
            { id: 'netIncome', label: '💎 Utile Netto (€)', type: 'number', placeholder: 'es. 675000' },
        ]
    },
    {
        id: 'previousFinancials',
        title: 'Dati Anno Precedente',
        icon: '📊',
        fields: [
            { id: 'previousRevenue', label: '💵 Ricavi Anno Precedente (€)', type: 'number', placeholder: 'es. 3500000' },
            { id: 'previousEbitda', label: '📈 EBITDA Anno Precedente (€)', type: 'number', placeholder: 'es. 560000' },
            { id: 'previousNetIncome', label: '💎 Utile Netto Anno Precedente (€)', type: 'number', placeholder: 'es. 420000' },
        ]
    },
    {
        id: 'performanceMetrics',
        title: 'Metriche di Performance',
        icon: '🎯',
        fields: [
            { id: 'grossMargin', label: '📊 Margine Lordo (%)', type: 'number', placeholder: 'es. 50' },
            { id: 'recurringRevenue', label: '🔄 Ricavi Ricorrenti (%)', type: 'number', placeholder: 'es. 70' },
            { id: 'customerConcentration', label: '👥 Concentrazione Clienti (%)', type: 'number', placeholder: 'es. 30' },
            { id: 'debtLevel', label: '💳 Livello Indebitamento', type: 'select', options: [ { value: 'low', label: 'Basso (< 2x EBITDA)' }, { value: 'medium', label: 'Medio (2-4x EBITDA)' }, { value: 'high', label: 'Alto (> 4x EBITDA)' } ] },
            { id: 'technologyRisk', label: '⚠️ Rischio Tecnologico', type: 'select', options: [ { value: 'low', label: 'Basso' }, { value: 'medium', label: 'Medio' }, { value: 'high', label: 'Alto' } ] },
            { id: 'managementQuality', label: '👔 Qualità Management', type: 'select', options: [ { value: 'excellent', label: 'Eccellente' }, { value: 'good', label: 'Buona' }, { value: 'average', label: 'Media' }, { value: 'poor', label: 'Scarsa' } ] },
        ]
    }
];

// --- LOGICA DI CALCOLO (invariata) ---
const performCalculation = (formData) => {
    const data = { ...formData };
    Object.keys(data).forEach(key => {
        if (['revenue', 'ebitda', 'netIncome', 'previousRevenue', 'previousEbitda', 'previousNetIncome', 'grossMargin', 'recurringRevenue', 'customerConcentration'].includes(key)) {
            data[key] = parseFloat(data[key]) || 0;
        }
    });

    if (data.revenue === 0) return {};

    const industryData = industryMultiples[data.industry];
    if (!industryData) return {};

    let revenueMultiple = data.revenue * industryData.revenue;
    let ebitdaMultiple = data.ebitda * industryData.ebitda;
    let peMultiple = data.netIncome * industryData.pe;
    let adjustmentFactor = 1;

    if (data.companySize === 'micro') adjustmentFactor -= 0.25; else if (data.companySize === 'small') adjustmentFactor -= 0.15; else if (data.companySize === 'medium') adjustmentFactor -= 0.08;
    let liquidityDiscount = 0.15; if (data.companySize === 'micro') liquidityDiscount = 0.30; else if (data.companySize === 'small') liquidityDiscount = 0.20; else if (data.companySize === 'medium') liquidityDiscount = 0.12; else if (data.companySize === 'large') liquidityDiscount = 0.08;
    adjustmentFactor -= liquidityDiscount;
    if (data.geography === 'international') adjustmentFactor += 0.15; else if (data.geography === 'european') adjustmentFactor += 0.08; else if (data.geography === 'national') adjustmentFactor += 0.03; else adjustmentFactor -= 0.05;
    const revenueGrowth = data.previousRevenue > 0 ? ((data.revenue - data.previousRevenue) / data.previousRevenue) * 100 : 0;
    if (revenueGrowth > 20) adjustmentFactor += 0.12; else if (revenueGrowth > 10) adjustmentFactor += 0.06; else if (revenueGrowth > 3) adjustmentFactor += 0.02; else if (revenueGrowth < 0) adjustmentFactor -= 0.20;
    if (data.grossMargin > 60) adjustmentFactor += 0.08; else if (data.grossMargin > 40) adjustmentFactor += 0.04; else if (data.grossMargin < 25) adjustmentFactor -= 0.12;
    if (data.recurringRevenue > 80) adjustmentFactor += 0.10; else if (data.recurringRevenue > 60) adjustmentFactor += 0.06; else if (data.recurringRevenue > 40) adjustmentFactor += 0.03; else if (data.recurringRevenue < 20) adjustmentFactor -= 0.08;
    if (data.marketPosition === 'leader') adjustmentFactor += 0.08; else if (data.marketPosition === 'challenger') adjustmentFactor += 0.03; else if (data.marketPosition === 'follower') adjustmentFactor -= 0.08; else if (data.marketPosition === 'niche') adjustmentFactor += 0.02;
    if (data.technologyRisk === 'low') adjustmentFactor += 0.05; else if (data.technologyRisk === 'high') adjustmentFactor -= 0.15;
    if (data.customerConcentration > 50) adjustmentFactor -= 0.20; else if (data.customerConcentration > 30) adjustmentFactor -= 0.10; else if (data.customerConcentration < 15) adjustmentFactor += 0.05;
    if (data.debtLevel === 'high') adjustmentFactor -= 0.15; else if (data.debtLevel === 'medium') adjustmentFactor -= 0.05; else adjustmentFactor += 0.03;
    if (data.managementQuality === 'excellent') adjustmentFactor += 0.08; else if (data.managementQuality === 'good') adjustmentFactor += 0.03; else if (data.managementQuality === 'poor') adjustmentFactor -= 0.12;

    const baseValuation = (revenueMultiple * 0.25 + ebitdaMultiple * 0.60 + peMultiple * 0.15);
    const adjustedValuation = Math.max(0, baseValuation * adjustmentFactor);
    const ebitdaGrowth = data.previousEbitda > 0 ? ((data.ebitda - data.previousEbitda) / data.previousEbitda) * 100 : 0;
    const qualityScore = Math.min(100, Math.max(0, (data.grossMargin * 0.25) + (data.recurringRevenue * 0.35) + (Math.max(0, Math.min(revenueGrowth, 30)) * 0.25) + (data.geography === 'international' ? 15 : data.geography === 'european' ? 10 : data.geography === 'national' ? 5 : 0)));
    const riskScore = Math.min(100, Math.max(0, 100 - data.customerConcentration * 0.8 + (data.technologyRisk === 'low' ? 15 : data.technologyRisk === 'medium' ? 5 : -15) + (data.managementQuality === 'excellent' ? 15 : data.managementQuality === 'good' ? 8 : data.managementQuality === 'poor' ? -15 : 0) + (data.debtLevel === 'low' ? 10 : data.debtLevel === 'high' ? -15 : -5)));

    return { fairMarketValue: Math.round(adjustedValuation), conservativeValue: Math.round(adjustedValuation * 0.80), optimisticValue: Math.round(adjustedValuation * 1.20), evRevenue: data.revenue > 0 ? (adjustedValuation / data.revenue).toFixed(1) : 'N/A', evEbitda: data.ebitda > 0 ? (adjustedValuation / data.ebitda).toFixed(1) : 'N/A', peRatio: data.netIncome > 0 ? (adjustedValuation / data.netIncome).toFixed(1) : 'N/A', revenueGrowth, ebitdaGrowth, qualityScore, riskScore, liquidityDiscount };
};

// --- COMPONENTI RIUTILIZZABILI ---

const FormField = ({ config, value, onChange }) => {
    const { id, label, type, options, placeholder } = config;
    const commonProps = { id, value, onChange, className: type === 'select' ? 'form-select' : 'form-input' };

    return (
        <div className="form-group">
            <label className="form-label" htmlFor={id}>{label}</label>
            {type === 'select' ? (
                <select {...commonProps}>
                    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            ) : (
                <input type={type} placeholder={placeholder} {...commonProps} />
            )}
        </div>
    );
};

const FormSection = ({ config, formData, handleInputChange }) => (
    <div className="card">
        <div className="card-header">
            <div className="card-icon">{config.icon}</div>
            <h2 className="card-title">{config.title}</h2>
        </div>
        <div className="form-grid">
            {config.fields.map(field => (
                <FormField key={field.id} config={field} value={formData[field.id]} onChange={handleInputChange} />
            ))}
        </div>
    </div>
);

const ResultsPanel = ({ results, onSave, onPrint, onExportExcel, isSubmitting, saveSuccess }) => {
    const formatCurrency = (amount) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
    const formatPercentage = (value) => `${value >= 0 ? '+' : ''}${(value || 0).toFixed(1)}%`;
    const getMetricClass = (value) => value >= 0 ? 'metric-positive' : 'metric-negative';

    return (
        <div className="results-card">
            <div className="card">
                <div className="valuation-display">
                    <div className="valuation-amount">{formatCurrency(results.fairMarketValue)}</div>
                    <div className="valuation-subtitle">Valutazione Fair Market Value</div>
                </div>
                
                <div className="scenarios">
                    <div className="scenario scenario-conservative"><span>🔻 Conservativo</span><strong>{formatCurrency(results.conservativeValue)}</strong></div>
                    <div className="scenario scenario-fair"><span>⚖️ Mercato Equo</span><strong>{formatCurrency(results.fairMarketValue)}</strong></div>
                    <div className="scenario scenario-optimistic"><span>🔺 Ottimistico</span><strong>{formatCurrency(results.optimisticValue)}</strong></div>
                </div>
                
                <hr className="divider"/>

                <div className="metrics-section">
                    <h3 className="section-title">🔢 Multipli di Valutazione</h3>
                    <div className="metric-row"><span className="metric-label">EV/Ricavi</span><span className="metric-value metric-neutral">{results.evRevenue}x</span></div>
                    <div className="metric-row"><span className="metric-label">EV/EBITDA</span><span className="metric-value metric-neutral">{results.evEbitda}x</span></div>
                    <div className="metric-row"><span className="metric-label">P/E Ratio</span><span className="metric-value metric-neutral">{results.peRatio}x</span></div>
                </div>

                <hr className="divider"/>

                <div className="metrics-section">
                    <h3 className="section-title">📈 Performance & Risk Metrics</h3>
                    <div className="metric-row"><span className="metric-label">Crescita Ricavi</span><span className={`metric-value ${getMetricClass(results.revenueGrowth)}`}>{formatPercentage(results.revenueGrowth)}</span></div>
                    <div className="metric-row"><span className="metric-label">Crescita EBITDA</span><span className={`metric-value ${getMetricClass(results.ebitdaGrowth)}`}>{formatPercentage(results.ebitdaGrowth)}</span></div>
                    <div className="metric-row"><span className="metric-label">Score Qualità</span><span className="metric-value metric-neutral">{Math.round(results.qualityScore || 0)}/100</span></div>
                    <div className="metric-row"><span className="metric-label">Score Rischio</span><span className="metric-value metric-neutral">{Math.round(results.riskScore || 0)}/100</span></div>
                    <div className="metric-row"><span className="metric-label">Sconto Liquidità</span><span className="metric-value metric-negative">-{Math.round((results.liquidityDiscount || 0) * 100)}%</span></div>
                </div>

                <hr className="divider"/>

                <div className="button-group" style={{flexDirection: 'column', gap: '12px'}}>
                    <button onClick={onSave} disabled={isSubmitting || saveSuccess} className="btn btn-primary" style={{width: '100%'}}>
                        {isSubmitting ? '⏳ Salvataggio...' : (saveSuccess ? '✅ Salvato!' : '💾 Salva Valutazione')}
                    </button>
                    <button onClick={onExportExcel} className="btn btn-secondary" style={{width: '100%'}}>
                        📄 Esporta in Excel
                    </button>
                    <button onClick={onPrint} className="btn btn-outline" style={{width: '100%'}}>
                        🖨️ Stampa Report
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPALE ---
const ValutazioneAziendaleCalculator = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    
    // Stato per la selezione aziende
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [showCompanyList, setShowCompanyList] = useState(false);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    const results = useMemo(() => performCalculation(formData), [formData]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    // Funzione per caricare cronologia
    const loadUserAnalyses = async () => {
      if (!user?.email) {
        console.warn('Devi essere loggato per accedere alla cronologia');
        return;
      }
      setLoadingCompanies(true);
      try {
        const response = await fetch(`/api/user-analyses?email=${user.email}`);
        const data = await response.json();
        if (data.success) {
          setAvailableCompanies(data.analyses || []);
          setShowCompanyList(true);
        } else {
          throw new Error(data.message || 'Risposta non riuscita');
        }
      } catch (error) {
        console.error('Errore caricamento cronologia:', error);
      } finally {
        setLoadingCompanies(false);
      }
    };

    // Funzione per caricare dati specifici azienda
    const loadCompanyDataFromAnalysis = async (analysis) => {
      try {
        const response = await fetch(`/api/company-xbrl-details?session_id=${analysis.session_id}`);
        const data = await response.json();
        if (data.success) {
          // Sovrascrivi solo i campi disponibili, mantenendo gli altri
          setFormData(prev => ({
            ...prev,
            ...data.mappedData
          }));
          setShowCompanyList(false);
          // Mostra messaggio di conferma in console
          console.log(`Dati caricati per: ${data.companyName}\nHealth Score: ${data.healthScore}`);
        } else {
          throw new Error(data.message || 'Risposta non riuscita');
        }
      } catch (error) {
        console.error('Errore caricamento dati XBRL:', error);
      }
    };


    const handlePrint = () => window.print();

    const handleExportExcel = () => {
        if (typeof window.XLSX === 'undefined') {
            console.error("La libreria XLSX non è caricata.");
            // Potresti voler mostrare un avviso all'utente qui
            return;
        }
        const inputDataForSheet = [['Metrica', 'Valore Inserito']];
        formConfig.forEach(section => {
            section.fields.forEach(field => {
                const value = formData[field.id];
                let displayValue = value;
                if (field.type === 'select') {
                    const selectedOption = field.options.find(opt => opt.value === value);
                    displayValue = selectedOption ? selectedOption.label : value;
                }
                inputDataForSheet.push([field.label, displayValue]);
            });
        });
        
        const resultsDataForSheet = [
            ['Risultato', 'Valore'],
            ['Valutazione Fair Market Value', results.fairMarketValue || 0],
            ['Valutazione Conservativa', results.conservativeValue || 0],
            ['Valutazione Ottimistica', results.optimisticValue || 0],
            ['EV/Ricavi', results.evRevenue ? `${results.evRevenue}x` : 'N/A'],
            ['EV/EBITDA', results.evEbitda ? `${results.evEbitda}x` : 'N/A'],
            ['P/E Ratio', results.peRatio ? `${results.peRatio}x` : 'N/A'],
            ['Crescita Ricavi', results.revenueGrowth ? `${results.revenueGrowth.toFixed(1)}%` : '0.0%'],
            ['Crescita EBITDA', results.ebitdaGrowth ? `${results.ebitdaGrowth.toFixed(1)}%` : '0.0%'],
            ['Score Qualità', results.qualityScore ? `${Math.round(results.qualityScore)}/100` : '0/100'],
            ['Score Rischio', results.riskScore ? `${Math.round(results.riskScore)}/100` : '0/100'],
            ['Sconto Liquidità', results.liquidityDiscount ? `${(results.liquidityDiscount * 100).toFixed(0)}%` : '0%']
        ];
        
        const ws_inputs = window.XLSX.utils.aoa_to_sheet(inputDataForSheet);
        const ws_results = window.XLSX.utils.aoa_to_sheet(resultsDataForSheet);
        ws_inputs['!cols'] = [{ wch: 40 }, { wch: 30 }];
        ws_results['!cols'] = [{ wch: 30 }, { wch: 20 }];
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws_inputs, "Dati Input");
        window.XLSX.utils.book_append_sheet(wb, ws_results, "Risultati Valutazione");
        window.XLSX.writeFile(wb, "Valutazione_Aziendale.xlsx");
    };

    const saveValuation = async () => {
        if (!user || Object.keys(results).length === 0) {
            console.log("Salvataggio non disponibile in questa modalità.");
            return;
        }
        setIsSubmitting(true);
        setSaveSuccess(false);
        try {
            // Qui andrebbe la vera chiamata API per il salvataggio
            console.log("Tentativo di salvataggio (simulato):", { user, inputs: formData, outputs: results });
            await new Promise(resolve => setTimeout(resolve, 1500)); 
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Errore nel salvataggio:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
            <style>{`
                /* CSS (invariato) */
                * { box-sizing: border-box; }
                .container { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 2rem 1rem; }
                .main-wrapper { max-width: 1400px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 3rem; color: white; }
                .header h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .header p { font-size: 1.1rem; opacity: 0.9; font-weight: 300; }
                .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; align-items: start; }
                @media (max-width: 1024px) { .content-grid { grid-template-columns: 1fr; gap: 1.5rem; } }
                .card { background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 10px 40px rgba(0,0,0,0.1); transition: all 0.3s ease; }
                .card:hover { transform: translateY(-2px); box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
                .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #f1f5f9; }
                .card-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
                .card-title { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin: 0; }
                .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
                .form-group { display: flex; flex-direction: column; }
                .form-label { font-size: 0.9rem; font-weight: 500; color: #4b5563; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px; }
                .form-input, .form-select { padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 0.95rem; background: #f8fafc; transition: all 0.3s ease; color: #1e293b; width: 100%; }
                .form-input:focus, .form-select:focus { outline: none; border-color: #3b82f6; background: white; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); transform: translateY(-1px); }
                .button-group { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
                .btn { padding: 12px 24px; border: none; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; white-space: nowrap; }
                .btn-primary { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); }
                .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4); }
                .btn-secondary { background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
                .btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); }
                .btn-outline { background: white; color: #6b7280; border: 2px solid #e5e7eb; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .results-card { position: sticky; top: 2rem; }
                .valuation-display { text-align: center; margin-bottom: 2rem; padding: 2rem; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-radius: 16px; border: 2px solid #bae6fd; }
                .valuation-amount { font-size: 2.5rem; font-weight: 800; color: #0c4a6e; }
                .valuation-subtitle { color: #0369a1; font-weight: 500; }
                .scenarios { margin-bottom: 2rem; }
                .scenario { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-radius: 12px; margin-bottom: 8px; font-weight: 500; }
                .scenario-conservative { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e; border: 1px solid #f59e0b; }
                .scenario-fair { background: linear-gradient(135deg, #dbeafe, #bfdbfe); color: #1e40af; border: 1px solid #3b82f6; }
                .scenario-optimistic { background: linear-gradient(135deg, #d1fae5, #a7f3d0); color: #065f46; border: 1px solid #10b981; }
                .metrics-section { margin-bottom: 2rem; }
                .section-title { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 1rem; }
                .metric-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
                .metric-row:last-child { border-bottom: none; }
                .metric-label { color: #64748b; }
                .metric-value { font-weight: 600; font-size: 1rem; }
                .metric-positive { color: #059669; }
                .metric-negative { color: #dc2626; }
                .metric-neutral { color: #3b82f6; }
                .divider { height: 2px; background: linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9); border: none; margin: 2rem 0; }
                .back-link { display: inline-flex; align-items: center; gap: 8px; color: white; text-decoration: none; font-weight: 500; margin-bottom: 2rem; padding: 8px 16px; border-radius: 8px; background: rgba(255,255,255,0.1); transition: all 0.3s ease; }
                .back-link:hover { background: rgba(255,255,255,0.2); }
                .input-sections { display: flex; flex-direction: column; gap: 1.5rem; }
                @media print { /* Stili per la stampa (invariati) */ }
            `}</style>

            <div className="container">
                <div className="main-wrapper">
                    <Link href="/calcolatori">
                        <div className="back-link">← Torna ai calcolatori</div>
                    </Link>

                    <div className="header">
                        <h1>📊 Calcolatore Valutazione Aziendale</h1>
                        <p>Ottieni una stima professionale del valore della tua impresa basata sui multipli di mercato</p>
                    </div>

                    <div className="content-grid">
                        <div className="input-sections">
                            <div className="button-group">
                                <button className="btn btn-danger" onClick={() => setFormData(blankFormData)}>🗑️ Pulisci Dati</button>
                                <button className="btn btn-secondary" onClick={() => setFormData(initialFormData)}>📋 Carica Esempio</button>
                                <button className="btn btn-secondary" onClick={loadUserAnalyses} disabled={!user || loadingCompanies}>
                                  {loadingCompanies ? '⏳ Caricamento...' : '📊 Carica da Cronologia'}
                                </button>
                            </div>
                            
                            {showCompanyList && (
                              <div className="card" style={{marginTop: '1rem'}}>
                                <div className="card-header">
                                  <div className="card-icon">📋</div>
                                  <h3 className="card-title">Seleziona Azienda dalla Cronologia</h3>
                                </div>
                                <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                                  {availableCompanies.length > 0 ? availableCompanies.map((analysis) => (
                                    <div 
                                      key={analysis.session_id}
                                      style={{
                                        padding: '12px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        margin: '8px 0',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                      }}
                                      onClick={() => loadCompanyDataFromAnalysis(analysis)}
                                    >
                                      <div>
                                        <strong>{analysis.company_name}</strong>
                                        <br />
                                        <small>{new Date(analysis.created_at).toLocaleDateString()}</small>
                                      </div>
                                      <div style={{textAlign: 'right'}}>
                                        <strong>Score: {analysis.health_score}/100</strong>
                                      </div>
                                    </div>
                                  )) : <p>Nessuna analisi trovata.</p>}
                                </div>
                                <button 
                                  className="btn btn-outline" 
                                  onClick={() => setShowCompanyList(false)}
                                  style={{marginTop: '12px'}}
                                >
                                  Chiudi
                                </button>
                              </div>
                            )}
                            
                            {formConfig.map(section => (
                                <FormSection 
                                    key={section.id} 
                                    config={section}
                                    formData={formData} 
                                    handleInputChange={handleInputChange} 
                                />
                            ))}
                        </div>

                        <ResultsPanel 
                            results={results}
                            onSave={saveValuation}
                            onPrint={handlePrint}
                            onExportExcel={handleExportExcel}
                            isSubmitting={isSubmitting}
                            saveSuccess={saveSuccess}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default function ValutazioneAziendalePage() {
    return (
        <Layout pageTitle="Calcolatore Valutazione Aziendale">
            <ValutazioneAziendaleCalculator />
        </Layout>
    );
}

