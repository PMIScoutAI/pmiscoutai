// pages/calcolatori/valutazione-aziendale.js
import React, { useState, useMemo } from 'react';

// --- QUANDO INTEGRI NEL TUO PROGETTO, CANCELLA LA SEZIONE SOTTOSTANTE ---
// --- SIMULAZIONE DELLE DIPENDENZE ESTERNE (PER FUNZIONARE NELL'ANTEPRIMA) ---
const useAuth = () => ({ user: { name: 'Utente Demo', email: 'demo@example.com' } });
const Link = ({ href, children }) => <a href={href} className={children.props.className}>{children.props.children}</a>;
// --- FINE SEZIONE DA CANCELLARE ---

// --- E DE-COMMENTA GLI IMPORT ORIGINALI QUI SOTTO ---
// import Link from 'next/link';
// import { useAuth } from '../../hooks/useAuth';
// import Layout from '../../components/Layout'; // Assumendo che il Layout gestisca Head, sidebar etc.


// --- DATI E CONFIGURAZIONE ---
const industryMultiples = { technology: { revenue: 3.5, ebitda: 12, pe: 18 }, healthcare: { revenue: 2.8, ebitda: 10, pe: 16 }, fintech: { revenue: 4.2, ebitda: 14, pe: 20 }, ecommerce: { revenue: 2.5, ebitda: 8, pe: 14 }, manufacturing: { revenue: 1.8, ebitda: 8, pe: 12 }, services: { revenue: 2.2, ebitda: 9, pe: 14 }, energy: { revenue: 1.5, ebitda: 6, pe: 10 }, real_estate: { revenue: 2.0, ebitda: 8, pe: 12 }, media: { revenue: 2.8, ebitda: 10, pe: 15 }, retail: { revenue: 1.2, ebitda: 5, pe: 10 }, automotive: { revenue: 1.6, ebitda: 7, pe: 11 }, food: { revenue: 1.8, ebitda: 8, pe: 13 } };
const initialFormData = { industry: 'technology', companySize: 'small', marketPosition: 'challenger', geography: 'national', revenue: '4500000', ebitda: '900000', netIncome: '675000', previousRevenue: '3500000', previousEbitda: '560000', previousNetIncome: '420000', grossMargin: '50', recurringRevenue: '70', debtLevel: 'low', customerConcentration: '30', technologyRisk: 'medium', managementQuality: 'good' };
const blankFormData = { industry: 'technology', companySize: 'micro', marketPosition: 'follower', geography: 'local', revenue: '', ebitda: '', netIncome: '', previousRevenue: '', previousEbitda: '', previousNetIncome: '', grossMargin: '', recurringRevenue: '', debtLevel: 'medium', customerConcentration: '', technologyRisk: 'medium', managementQuality: 'average' };

const formConfig = [
    { id: 'companyInfo', title: 'Informazioni Azienda', icon: '🏢', fields: [ { id: 'industry', label: '🚀 Settore', type: 'select', options: [ { value: 'technology', label: 'Tecnologia & Software' }, { value: 'healthcare', label: 'Sanità & Life Sciences' }, { value: 'fintech', label: 'Fintech & Servizi Finanziari' }, { value: 'ecommerce', label: 'E-commerce & Digital' }, { value: 'manufacturing', label: 'Manifatturiero & Industria' }, { value: 'services', label: 'Servizi Professionali' }, { value: 'energy', label: 'Energia & Utilities' }, { value: 'real_estate', label: 'Real Estate & Costruzioni' }, { value: 'media', label: 'Media & Entertainment' }, { value: 'retail', label: 'Retail & Consumer' }, { value: 'automotive', label: 'Automotive & Componentistica' }, { value: 'food', label: 'Food & Beverage' } ] }, { id: 'companySize', label: '📏 Dimensione', type: 'select', options: [ { value: 'micro', label: 'Micro (< €2M fatturato)' }, { value: 'small', label: 'Piccola (€2M - €10M)' }, { value: 'medium', label: 'Media (€10M - €50M)' }, { value: 'large', label: 'Grande (> €50M)' } ] }, { id: 'marketPosition', label: '🎯 Posizione di Mercato', type: 'select', options: [ { value: 'leader', label: 'Leader di Mercato' }, { value: 'challenger', label: 'Challenger' }, { value: 'follower', label: 'Follower' }, { value: 'niche', label: 'Nicchia Specializzata' } ] }, { id: 'geography', label: '🌍 Copertura Geografica', type: 'select', options: [ { value: 'local', label: 'Locale/Regionale' }, { value: 'national', label: 'Nazionale' }, { value: 'european', label: 'Europea' }, { value: 'international', label: 'Internazionale' } ] }, ] },
    { id: 'currentFinancials', title: 'Dati Finanziari Anno Corrente', icon: '💰', fields: [ { id: 'revenue', label: '💵 Ricavi (€)', type: 'number', placeholder: 'es. 4500000' }, { id: 'ebitda', label: '📈 EBITDA (€)', type: 'number', placeholder: 'es. 900000' }, { id: 'netIncome', label: '💎 Utile Netto (€)', type: 'number', placeholder: 'es. 675000' }, ] },
    { id: 'previousFinancials', title: 'Dati Anno Precedente', icon: '📊', fields: [ { id: 'previousRevenue', label: '💵 Ricavi Anno Precedente (€)', type: 'number', placeholder: 'es. 3500000' }, { id: 'previousEbitda', label: '📈 EBITDA Anno Precedente (€)', type: 'number', placeholder: 'es. 560000' }, { id: 'previousNetIncome', label: '💎 Utile Netto Anno Precedente (€)', type: 'number', placeholder: 'es. 420000' }, ] },
    { id: 'performanceMetrics', title: 'Metriche di Performance', icon: '🎯', fields: [ { id: 'grossMargin', label: '📊 Margine Lordo (%)', type: 'number', placeholder: 'es. 50' }, { id: 'recurringRevenue', label: '🔄 Ricavi Ricorrenti (%)', type: 'number', placeholder: 'es. 70' }, { id: 'customerConcentration', label: '👥 Concentrazione Clienti (%)', type: 'number', placeholder: 'es. 30' }, { id: 'debtLevel', label: '💳 Livello Indebitamento', type: 'select', options: [ { value: 'low', label: 'Basso (< 2x EBITDA)' }, { value: 'medium', label: 'Medio (2-4x EBITDA)' }, { value: 'high', label: 'Alto (> 4x EBITDA)' } ] }, { id: 'technologyRisk', label: '⚠️ Rischio Tecnologico', type: 'select', options: [ { value: 'low', label: 'Basso' }, { value: 'medium', label: 'Medio' }, { value: 'high', label: 'Alto' } ] }, { id: 'managementQuality', label: '👔 Qualità Management', type: 'select', options: [ { value: 'excellent', label: 'Eccellente' }, { value: 'good', label: 'Buona' }, { value: 'average', label: 'Media' }, { value: 'poor', label: 'Scarsa' } ] }, ] }
];

// --- LOGICA DI CALCOLO ---
const performCalculation = (formData) => {
    const data = { ...formData };
    Object.keys(data).forEach(key => {
        const numericKeys = ['revenue', 'ebitda', 'netIncome', 'previousRevenue', 'previousEbitda', 'previousNetIncome', 'grossMargin', 'recurringRevenue', 'customerConcentration'];
        if (numericKeys.includes(key)) {
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
    let liquidityDiscount = { micro: 0.30, small: 0.20, medium: 0.12, large: 0.08 }[data.companySize] || 0.15;
    adjustmentFactor -= liquidityDiscount;
    const geographyAdjustments = { international: 0.15, european: 0.08, national: 0.03, local: -0.05 };
    adjustmentFactor += geographyAdjustments[data.geography] || 0;
    const revenueGrowth = data.previousRevenue > 0 ? ((data.revenue - data.previousRevenue) / data.previousRevenue) * 100 : 0;
    if (revenueGrowth > 20) adjustmentFactor += 0.12; else if (revenueGrowth > 10) adjustmentFactor += 0.06; else if (revenueGrowth > 3) adjustmentFactor += 0.02; else if (revenueGrowth < 0) adjustmentFactor -= 0.20;
    if (data.grossMargin > 60) adjustmentFactor += 0.08; else if (data.grossMargin > 40) adjustmentFactor += 0.04; else if (data.grossMargin < 25) adjustmentFactor -= 0.12;
    if (data.recurringRevenue > 80) adjustmentFactor += 0.10; else if (data.recurringRevenue > 60) adjustmentFactor += 0.06; else if (data.recurringRevenue > 40) adjustmentFactor += 0.03; else if (data.recurringRevenue < 20) adjustmentFactor -= 0.08;
    const marketPosAdjustments = { leader: 0.08, challenger: 0.03, follower: -0.08, niche: 0.02 };
    adjustmentFactor += marketPosAdjustments[data.marketPosition] || 0;
    const techRiskAdjustments = { low: 0.05, high: -0.15, medium: 0 };
    adjustmentFactor += techRiskAdjustments[data.technologyRisk] || 0;
    if (data.customerConcentration > 50) adjustmentFactor -= 0.20; else if (data.customerConcentration > 30) adjustmentFactor -= 0.10; else if (data.customerConcentration < 15) adjustmentFactor += 0.05;
    const debtLevelAdjustments = { high: -0.15, medium: -0.05, low: 0.03 };
    adjustmentFactor += debtLevelAdjustments[data.debtLevel] || 0;
    const mgmtQualityAdjustments = { excellent: 0.08, good: 0.03, poor: -0.12, average: 0 };
    adjustmentFactor += mgmtQualityAdjustments[data.managementQuality] || 0;
    const baseValuation = (revenueMultiple * 0.25 + ebitdaMultiple * 0.60 + peMultiple * 0.15);
    const adjustedValuation = Math.max(0, baseValuation * adjustmentFactor);
    const ebitdaGrowth = data.previousEbitda > 0 ? ((data.ebitda - data.previousEbitda) / data.previousEbitda) * 100 : 0;
    const qualityScore = Math.min(100, Math.max(0, (data.grossMargin * 0.25) + (data.recurringRevenue * 0.35) + (Math.max(0, Math.min(revenueGrowth, 30)) * 0.25) + ({ international: 15, european: 10, national: 5, local: 0 }[data.geography] || 0)));
    const riskScore = Math.min(100, Math.max(0, 100 - data.customerConcentration * 0.8 + ({ low: 15, medium: 5, high: -15 }[data.technologyRisk] || 0) + ({ excellent: 15, good: 8, poor: -15, average: 0 }[data.managementQuality] || 0) + ({ low: 10, high: -15, medium: -5 }[data.debtLevel] || 0)));
    return { fairMarketValue: Math.round(adjustedValuation), conservativeValue: Math.round(adjustedValuation * 0.80), optimisticValue: Math.round(adjustedValuation * 1.20), evRevenue: data.revenue > 0 ? (adjustedValuation / data.revenue).toFixed(1) : 'N/A', evEbitda: data.ebitda > 0 ? (adjustedValuation / data.ebitda).toFixed(1) : 'N/A', peRatio: data.netIncome > 0 ? (adjustedValuation / data.netIncome).toFixed(1) : 'N/A', revenueGrowth, ebitdaGrowth, qualityScore, riskScore, liquidityDiscount };
};

// --- COMPONENTI UI RIUTILIZZABILI ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const FormField = ({ config, value, onChange }) => { const { id, label, type, options, placeholder } = config; const commonProps = { id, value, onChange, className: type === 'select' ? 'form-select' : 'form-input' }; return ( <div className="form-group"> <label className="form-label" htmlFor={id}>{label}</label> {type === 'select' ? ( <select {...commonProps}>{options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select> ) : ( <input type={type} placeholder={placeholder} {...commonProps} /> )} </div> ); };
const FormSection = ({ config, formData, handleInputChange }) => ( <div className="card"> <div className="card-header"> <div className="card-icon">{config.icon}</div> <h2 className="card-title">{config.title}</h2> </div> <div className="form-grid">{config.fields.map(field => ( <FormField key={field.id} config={field} value={formData[field.id]} onChange={handleInputChange} /> ))}</div> </div> );
const ResultsPanel = ({ results, onSave, onPrint, onExportExcel, isSubmitting, saveSuccess }) => { const formatCurrency = (amount) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0); const formatPercentage = (value) => `${value >= 0 ? '+' : ''}${(value || 0).toFixed(1)}%`; const getMetricClass = (value) => value >= 0 ? 'metric-positive' : 'metric-negative'; return ( <div className="results-card"> <div className="card"> <div className="valuation-display"> <div className="valuation-amount">{formatCurrency(results.fairMarketValue)}</div> <div className="valuation-subtitle">Valutazione Fair Market Value</div> </div> <div className="scenarios"> <div className="scenario scenario-conservative"><span>🔻 Conservativo</span><strong>{formatCurrency(results.conservativeValue)}</strong></div> <div className="scenario scenario-fair"><span>⚖️ Mercato Equo</span><strong>{formatCurrency(results.fairMarketValue)}</strong></div> <div className="scenario scenario-optimistic"><span>🔺 Ottimistico</span><strong>{formatCurrency(results.optimisticValue)}</strong></div> </div> <hr className="divider"/> <div className="metrics-section"> <h3 className="section-title">🔢 Multipli di Valutazione</h3> <div className="metric-row"><span className="metric-label">EV/Ricavi</span><span className="metric-value metric-neutral">{results.evRevenue}x</span></div> <div className="metric-row"><span className="metric-label">EV/EBITDA</span><span className="metric-value metric-neutral">{results.evEbitda}x</span></div> <div className="metric-row"><span className="metric-label">P/E Ratio</span><span className="metric-value metric-neutral">{results.peRatio}x</span></div> </div> <hr className="divider"/> <div className="metrics-section"> <h3 className="section-title">📈 Performance & Risk Metrics</h3> <div className="metric-row"><span className="metric-label">Crescita Ricavi</span><span className={`metric-value ${getMetricClass(results.revenueGrowth)}`}>{formatPercentage(results.revenueGrowth)}</span></div> <div className="metric-row"><span className="metric-label">Crescita EBITDA</span><span className={`metric-value ${getMetricClass(results.ebitdaGrowth)}`}>{formatPercentage(results.ebitdaGrowth)}</span></div> <div className="metric-row"><span className="metric-label">Score Qualità</span><span className="metric-value metric-neutral">{Math.round(results.qualityScore || 0)}/100</span></div> <div className="metric-row"><span className="metric-label">Score Rischio</span><span className="metric-value metric-neutral">{Math.round(results.riskScore || 0)}/100</span></div> <div className="metric-row"><span className="metric-label">Sconto Liquidità</span><span className="metric-value metric-negative">-{Math.round((results.liquidityDiscount || 0) * 100)}%</span></div> </div> <hr className="divider"/> <div className="button-group" style={{flexDirection: 'column', gap: '12px'}}> <button onClick={onSave} disabled={isSubmitting || saveSuccess} className="btn btn-primary" style={{width: '100%'}}> {isSubmitting ? '⏳ Salvataggio...' : (saveSuccess ? '✅ Salvato!' : '💾 Salva Valutazione')} </button> <button onClick={onExportExcel} className="btn btn-secondary" style={{width: '100%'}}> 📄 Esporta in Excel </button> <button onClick={onPrint} className="btn btn-outline" style={{width: '100%'}}> 🖨️ Stampa Report </button> </div> </div> </div> ); };

// --- COMPONENTE CALCOLATORE PRINCIPALE ---
const ValutazioneAziendaleCalculator = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [showCompanyList, setShowCompanyList] = useState(false);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    const results = useMemo(() => performCalculation(formData), [formData]);
    const handleInputChange = (e) => { const { id, value } = e.target; setFormData(prev => ({ ...prev, [id]: value })); };
    
    const loadUserAnalyses = async () => { if (!user?.email) return; setLoadingCompanies(true); try { const response = await fetch(`/api/user-analyses?email=${user.email}`); const data = await response.json(); if (data.success) { setAvailableCompanies(data.analyses || []); setShowCompanyList(true); } else { throw new Error(data.message || 'Error'); } } catch (error) { console.error('Errore caricamento cronologia:', error); } finally { setLoadingCompanies(false); } };
    const loadCompanyDataFromAnalysis = async (analysis) => { try { const response = await fetch(`/api/company-xbrl-details?session_id=${analysis.session_id}`); const data = await response.json(); if (data.success) { setFormData(prev => ({ ...prev, ...data.mappedData })); setShowCompanyList(false); console.log(`Dati caricati per: ${data.companyName}`); } else { throw new Error(data.message || 'Error'); } } catch (error) { console.error('Errore caricamento dati XBRL:', error); } };
    
    const handlePrint = () => window.print();
    const handleExportExcel = () => { if (typeof XLSX === 'undefined') { console.error("Libreria XLSX non trovata."); return; } const inputDataForSheet = [['Metrica', 'Valore Inserito']]; formConfig.forEach(section => { section.fields.forEach(field => { const value = formData[field.id]; let displayValue = value; if (field.type === 'select') { const selectedOption = field.options.find(opt => opt.value === value); displayValue = selectedOption ? selectedOption.label : value; } inputDataForSheet.push([field.label, displayValue]); }); }); const resultsDataForSheet = [ ['Risultato', 'Valore'], ['Valutazione Fair Market Value', results.fairMarketValue || 0], ['Valutazione Conservativa', results.conservativeValue || 0], ['Valutazione Ottimistica', results.optimisticValue || 0], ['EV/Ricavi', results.evRevenue ? `${results.evRevenue}x` : 'N/A'], ['EV/EBITDA', results.evEbitda ? `${results.evEbitda}x` : 'N/A'], ['P/E Ratio', results.peRatio ? `${results.peRatio}x` : 'N/A'], ['Crescita Ricavi', results.revenueGrowth ? `${results.revenueGrowth.toFixed(1)}%` : '0.0%'], ['Crescita EBITDA', results.ebitdaGrowth ? `${results.ebitdaGrowth.toFixed(1)}%` : '0.0%'], ['Score Qualità', results.qualityScore ? `${Math.round(results.qualityScore)}/100` : '0/100'], ['Score Rischio', results.riskScore ? `${Math.round(results.riskScore)}/100` : '0/100'], ['Sconto Liquidità', results.liquidityDiscount ? `${(results.liquidityDiscount * 100).toFixed(0)}%` : '0%'] ]; const ws_inputs = XLSX.utils.aoa_to_sheet(inputDataForSheet); const ws_results = XLSX.utils.aoa_to_sheet(resultsDataForSheet); ws_inputs['!cols'] = [{ wch: 40 }, { wch: 30 }]; ws_results['!cols'] = [{ wch: 30 }, { wch: 20 }]; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws_inputs, "Dati Input"); XLSX.utils.book_append_sheet(wb, ws_results, "Risultati Valutazione"); XLSX.writeFile(wb, "Valutazione_Aziendale.xlsx"); };
    const saveValuation = async () => { if (!user || Object.keys(results).length === 0) return; setIsSubmitting(true); setSaveSuccess(false); try { await new Promise(resolve => setTimeout(resolve, 1500)); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); } catch (error) { console.error("Errore nel salvataggio:", error); } finally { setIsSubmitting(false); } };

    return (
        <div id="calculator-page">
            <div className="header">
                <h1>📊 Calcolatore Valutazione Aziendale</h1>
                <p>Ottieni una stima professionale del valore della tua impresa basata sui multipli di mercato</p>
            </div>
            <div className="content-grid">
                <div className="input-sections">
                    <div className="button-group">
                        <button className="btn btn-danger" onClick={() => setFormData(blankFormData)}>🗑️ Pulisci Dati</button>
                        <button className="btn btn-secondary" onClick={() => setFormData(initialFormData)}>📋 Carica Esempio</button>
                        <button className="btn btn-secondary" onClick={loadUserAnalyses} disabled={!user || loadingCompanies}>{loadingCompanies ? '⏳ Caricamento...' : '📊 Carica da Cronologia'}</button>
                    </div>
                    {showCompanyList && (
                      <div className="card" style={{marginTop: '1rem'}}>
                        <div className="card-header"><div className="card-icon">📋</div><h3 className="card-title">Seleziona Azienda dalla Cronologia</h3></div>
                        <div style={{maxHeight: '300px', overflowY: 'auto'}}>
                          {availableCompanies.length > 0 ? availableCompanies.map((analysis) => (
                            <div key={analysis.session_id} className="company-list-item" onClick={() => loadCompanyDataFromAnalysis(analysis)}>
                              <div><strong>{analysis.company_name}</strong><br /><small>{new Date(analysis.created_at).toLocaleDateString()}</small></div>
                              <div style={{textAlign: 'right'}}><strong>Score: {analysis.health_score}/100</strong></div>
                            </div>
                          )) : <p>Nessuna analisi trovata.</p>}
                        </div>
                        <button className="btn btn-outline" onClick={() => setShowCompanyList(false)} style={{marginTop: '12px'}}>Chiudi</button>
                      </div>
                    )}
                    {formConfig.map(section => ( <FormSection key={section.id} config={section} formData={formData} handleInputChange={handleInputChange} /> ))}
                </div>
                <ResultsPanel results={results} onSave={saveValuation} onPrint={handlePrint} onExportExcel={handleExportExcel} isSubmitting={isSubmitting} saveSuccess={saveSuccess} />
            </div>
        </div>
    );
};

// --- COMPONENTE LAYOUT PAGINA (Wrapper) ---
const AppLayout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { user } = useAuth(); // Usiamo l'utente reale qui

    // Icone come definite nella tua dashboard
    const icons = {
        dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
        profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
        calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>,
        marketplace: <><path d="M12 2H6.5C4.5 2 3 3.5 3 5.5V18.5C3 20.5 4.5 22 6.5 22H17.5C19.5 22 21 20.5 21 18.5V12L12 2Z" /><path d="M12 2V12H21" /><path d="M15 22V18C15 16.9 15.9 16 17 16H19" /></>,
        support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
        menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
        logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    };

    const navLinks = [
      { href: '/', text: 'Dashboard', icon: icons.dashboard },
      { href: '/profilo', text: 'Profilo', icon: icons.profile },
      { href: '/calcolatori', text: 'Calcolatori', icon: icons.calculator, active: true }, // Pagina attiva
      { href: '#', text: 'Marketplace', icon: icons.marketplace },
    ];

    return (
        <>
            <script src="https://cdn.tailwindcss.com"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
            <style>{`
                /* Stili Globali e di Layout */
                body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }
                .app-layout { display: flex; min-height: 100vh; }
                .sidebar { width: 256px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; transition: transform 0.3s ease; }
                .main-content { flex-grow: 1; display: flex; flex-direction: column; }
                .header-mobile { display: none; }
                @media (max-width: 768px) {
                    .sidebar { position: fixed; height: 100%; z-index: 1000; transform: translateX(-100%); }
                    .sidebar.open { transform: translateX(0); }
                    .header-mobile { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: white; border-bottom: 1px solid #e2e8f0; }
                    .content-wrapper { padding-top: 0; }
                }
                .sidebar-header { padding: 1rem; border-bottom: 1px solid #e2e8f0; text-align: center; }
                .sidebar-header h1 { font-size: 1.5rem; font-weight: bold; color: #4f46e5; }
                .sidebar-nav { padding: 1rem; }
                .nav-link { display: flex; align-items: center; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 0.25rem; color: #475569; font-weight: 500; }
                .nav-link:hover { background-color: #f1f5f9; }
                .nav-link.active { background-color: #4f46e5; color: white; }
                .nav-link .icon { margin-right: 0.75rem; }
                .content-wrapper { padding: 2rem; }
                
                /* Stili Specifici del Calcolatore */
                #calculator-page { background: #f8fafc; } /* Rimuovi lo sfondo viola dal container specifico */
                .header { text-align: center; margin-bottom: 2rem; }
                .header h1 { font-size: 2.25rem; font-weight: 700; color: #1e293b; }
                .header p { font-size: 1.125rem; color: #64748b; }
                .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; align-items: flex-start; }
                @media (max-width: 1024px) { .content-grid { grid-template-columns: 1fr; } }
                .card { background: white; border-radius: 0.75rem; padding: 2rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); }
                .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; }
                .card-icon { font-size: 1.25rem; }
                .card-title { font-size: 1.25rem; font-weight: 600; color: #1e293b; }
                .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
                .form-group { display: flex; flex-direction: column; }
                .form-label { font-size: 0.875rem; font-weight: 500; color: #475569; margin-bottom: 0.5rem; }
                .form-input, .form-select { width: 100%; padding: 0.75rem 1rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; background: #f8fafc; transition: all 0.2s ease; }
                .form-input:focus, .form-select:focus { outline: none; border-color: #4f46e5; background: white; box-shadow: 0 0 0 2px #c7d2fe; }
                .button-group { display: flex; gap: 1rem; flex-wrap: wrap; }
                .btn { padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; }
                .btn-primary { background-color: #4f46e5; color: white; } .btn-primary:hover { background-color: #4338ca; }
                .btn-secondary { background-color: #10b981; color: white; } .btn-secondary:hover { background-color: #059669; }
                .btn-danger { background-color: #ef4444; color: white; } .btn-danger:hover { background-color: #dc2626; }
                .btn-outline { background-color: transparent; color: #475569; border: 1px solid #cbd5e1; } .btn-outline:hover { background-color: #f1f5f9; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .results-card { position: sticky; top: 2rem; }
                .valuation-display { text-align: center; margin-bottom: 1.5rem; padding: 1.5rem; background-color: #eef2ff; border-radius: 0.75rem; }
                .valuation-amount { font-size: 2.25rem; font-weight: 800; color: #312e81; }
                .valuation-subtitle { color: #4338ca; font-weight: 500; }
                .scenarios { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
                .scenario { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-radius: 0.5rem; font-weight: 500; }
                .scenario-conservative { background-color: #fef3c7; color: #92400e; }
                .scenario-fair { background-color: #dbeafe; color: #1e40af; }
                .scenario-optimistic { background-color: #d1fae5; color: #065f46; }
                .metrics-section { margin-bottom: 1.5rem; }
                .section-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; }
                .metric-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; }
                .metric-row:last-child { border-bottom: none; }
                .metric-label { color: #64748b; } .metric-value { font-weight: 600; }
                .metric-positive { color: #16a34a; } .metric-negative { color: #dc2626; } .metric-neutral { color: #2563eb; }
                .divider { border: none; height: 1px; background-color: #e2e8f0; margin: 1.5rem 0; }
                .company-list-item { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 8px 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
                .company-list-item:hover { background-color: #f1f5f9; }
                
                /* Stili di Stampa */
                @media print {
                  body * { visibility: hidden; }
                  .printable-area, .printable-area * { visibility: visible; }
                  .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                  .header h1 { font-size: 24pt; }
                  .header p { font-size: 12pt; }
                  .card { box-shadow: none; border: 1px solid #ccc; }
                  .results-card { position: static; }
                  .content-grid { grid-template-columns: 1fr; }
                }
            `}</style>
            <div className="app-layout">
                <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                    <div className="sidebar-header"><h1>PMIScout</h1></div>
                    <nav className="sidebar-nav">
                        {navLinks.map((link) => (
                            <Link key={link.text} href={link.href}>
                                <div className={`nav-link ${link.active ? 'active' : ''}`}>
                                  <Icon path={link.icon} className="icon" />
                                  {link.text}
                                </div>
                            </Link>
                        ))}
                    </nav>
                </aside>
                <div className="main-content">
                    <header className="header-mobile">
                        <button onClick={() => setIsSidebarOpen(true)} aria-label="Apri menu">
                            <Icon path={icons.menu} />
                        </button>
                        <h1>PMIScout</h1>
                        <div/>
                    </header>
                    <main className="content-wrapper printable-area">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
}


// --- PAGINA FINALE ---
export default function ValutazioneAziendalePage() {
    return (
        <AppLayout>
            <ValutazioneAziendaleCalculator />
        </AppLayout>
    );
}

