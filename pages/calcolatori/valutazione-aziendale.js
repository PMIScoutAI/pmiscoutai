// pages/calcolatori/valutazione-aziendale.js

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';

// Dati e stato iniziale del form, basati sul tuo esempio
const industryMultiples = { technology: { revenue: 3.5, ebitda: 12, pe: 18 }, healthcare: { revenue: 2.8, ebitda: 10, pe: 16 }, fintech: { revenue: 4.2, ebitda: 14, pe: 20 }, ecommerce: { revenue: 2.5, ebitda: 8, pe: 14 }, manufacturing: { revenue: 1.8, ebitda: 8, pe: 12 }, services: { revenue: 2.2, ebitda: 9, pe: 14 }, energy: { revenue: 1.5, ebitda: 6, pe: 10 }, real_estate: { revenue: 2.0, ebitda: 8, pe: 12 }, media: { revenue: 2.8, ebitda: 10, pe: 15 }, retail: { revenue: 1.2, ebitda: 5, pe: 10 }, automotive: { revenue: 1.6, ebitda: 7, pe: 11 }, food: { revenue: 1.8, ebitda: 8, pe: 13 } };
const initialFormData = { industry: 'technology', companySize: 'small', marketPosition: 'challenger', geography: 'national', revenue: '4500000', ebitda: '900000', netIncome: '675000', previousRevenue: '3500000', previousEbitda: '560000', previousNetIncome: '420000', grossMargin: '50', recurringRevenue: '70', debtLevel: 'low', customerConcentration: '30', technologyRisk: 'medium', managementQuality: 'good' };
const blankFormData = { industry: 'technology', companySize: 'micro', marketPosition: 'follower', geography: 'local', revenue: '', ebitda: '', netIncome: '', previousRevenue: '', previousEbitda: '', previousNetIncome: '', grossMargin: '', recurringRevenue: '', debtLevel: 'medium', customerConcentration: '', technologyRisk: 'medium', managementQuality: 'average' };

// Funzione di calcolo pura, separata dal componente per pulizia
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
    let liquidityDiscount = 0.15; if (data.companySize === 'micro') liquidityDiscount = 0.30; else if (data.companySize === 'small') liquidityDiscount = 0.20; else if (data.companySize === 'medium') liquidityDiscount = 0.12; else liquidityDiscount = 0.08;
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

    return {
        fairMarketValue: Math.round(adjustedValuation),
        conservativeValue: Math.round(adjustedValuation * 0.80),
        optimisticValue: Math.round(adjustedValuation * 1.20),
        evRevenue: data.revenue > 0 ? (adjustedValuation / data.revenue).toFixed(1) : 'N/A',
        evEbitda: data.ebitda > 0 ? (adjustedValuation / data.ebitda).toFixed(1) : 'N/A',
        peRatio: data.netIncome > 0 ? (adjustedValuation / data.netIncome).toFixed(1) : 'N/A',
        revenueGrowth, ebitdaGrowth, qualityScore, riskScore, liquidityDiscount
    };
};

// Componente principale del calcolatore
const ValutazioneAziendaleCalculator = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // I risultati vengono calcolati in modo reattivo ogni volta che formData cambia
    const results = useMemo(() => performCalculation(formData), [formData]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const saveValuation = async () => {
        if (!user || Object.keys(results).length === 0) return;
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/save-valuation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, inputs: formData, outputs: results }),
            });
            if (!response.ok) throw new Error('Salvataggio fallito');
            // Qui potresti mostrare una notifica di successo
        } catch (error) {
            console.error("Errore nel salvataggio:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
    const formatPercentage = (value) => `${value >= 0 ? '+' : ''}${(value || 0).toFixed(1)}%`;
    const getMetricClass = (value) => value >= 0 ? 'metric-positive' : 'metric-negative';

    return (
        <div className="layout-dark-theme">
            <style jsx>{`
                .layout-dark-theme { background: linear-gradient(135deg, #1a1a1a 0%, #2d3748 50%, #1a1a1a 100%); color: white; }
                .card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px; margin-bottom: 20px; }
                label { display: block; margin-bottom: 8px; font-weight: 500; color: #e2e8f0; }
                input, select { width: 100%; background: rgba(55, 65, 81, 0.5); border: 1px solid #4a5568; border-radius: 8px; padding: 12px 16px; color: white; font-size: 14px; transition: all 0.3s ease; }
                input:focus, select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
                option { background: #374151; color: white; }
                .btn { background: linear-gradient(135deg, #3b82f6, #1d4ed8); border: none; border-radius: 8px; padding: 12px 24px; color: white; font-weight: 600; cursor: pointer; transition: all 0.3s ease; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3); }
                .btn-clear { background: linear-gradient(135deg, #ef4444, #dc2626); }
                .btn-example { background: linear-gradient(135deg, #10b981, #059669); }
                .metric-positive { color: #34d399; } .metric-negative { color: #f87171; } .metric-neutral { color: #a78bfa; }
                .multiple-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
                .multiple-value { font-weight: 600; color: #06b6d4; }
                .scenario { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px; }
                .scenario-conservative { background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.3); }
                .scenario-fair { background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.3); }
                .scenario-optimistic { background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.3); }
            `}</style>
            <div className="container max-w-7xl mx-auto p-4">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold mb-2">🧮 Calcolatore Valutazione Aziendale</h1>
                    <p className="text-lg text-gray-300">Valutazione conservativa per il mercato italiano</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Colonna Input */}
                    <div className="lg:col-span-2 space-y-5">
                        <div className="flex flex-wrap gap-4">
                            <button className="btn btn-clear" onClick={() => setFormData(blankFormData)}>🗑️ Pulisci Dati</button>
                            <button className="btn btn-example" onClick={() => setFormData(initialFormData)}>📊 Carica Esempio</button>
                        </div>
                        
                        <div className="card">
                            <h2 className="text-xl font-bold mb-4">📈 Informazioni Azienda</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label htmlFor="industry">Settore</label><select id="industry" value={formData.industry} onChange={handleInputChange}><option value="technology">🚀 Tecnologia & Software</option><option value="healthcare">🏥 Sanità & Life Sciences</option><option value="fintech">💰 Fintech & Servizi Finanziari</option><option value="ecommerce">🛒 E-commerce & Digital</option><option value="manufacturing">🏭 Manifatturiero & Industria</option><option value="services">🔧 Servizi Professionali</option><option value="energy">⚡ Energia & Utilities</option><option value="real_estate">🏠 Real Estate & Costruzioni</option><option value="media">🎮 Media & Entertainment</option><option value="retail">🛍️ Retail & Consumer</option><option value="automotive">🚗 Automotive & Componentistica</option><option value="food">🍝 Food & Beverage</option></select></div>
                                <div><label htmlFor="companySize">Dimensione Azienda</label><select id="companySize" value={formData.companySize} onChange={handleInputChange}><option value="micro">Micro (&lt; €2M fatturato)</option><option value="small">Piccola (€2M - €10M)</option><option value="medium">Media (€10M - €50M)</option><option value="large">Grande (&gt; €50M)</option></select></div>
                                <div><label htmlFor="marketPosition">Posizione di Mercato</label><select id="marketPosition" value={formData.marketPosition} onChange={handleInputChange}><option value="leader">Leader di Mercato</option><option value="challenger">Challenger</option><option value="follower">Follower</option><option value="niche">Nicchia Specializzata</option></select></div>
                                <div><label htmlFor="geography">Copertura Geografica</label><select id="geography" value={formData.geography} onChange={handleInputChange}><option value="local">Locale/Regionale</option><option value="national">Nazionale</option><option value="european">Europea</option><option value="international">Internazionale</option></select></div>
                            </div>
                        </div>

                        <div className="card">
                             <h3 className="text-xl font-bold mb-4">💰 Dati Finanziari Anno Corrente</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label htmlFor="revenue">Ricavi (€)</label><input type="number" id="revenue" value={formData.revenue} onChange={handleInputChange} /></div>
                                <div><label htmlFor="ebitda">EBITDA (€)</label><input type="number" id="ebitda" value={formData.ebitda} onChange={handleInputChange} /></div>
                                <div><label htmlFor="netIncome">Utile Netto (€)</label><input type="number" id="netIncome" value={formData.netIncome} onChange={handleInputChange} /></div>
                             </div>
                        </div>
                        
                        <div className="card">
                             <h3 className="text-xl font-bold mb-4">📊 Dati Anno Precedente</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label htmlFor="previousRevenue">Ricavi Anno Precedente (€)</label><input type="number" id="previousRevenue" value={formData.previousRevenue} onChange={handleInputChange} /></div>
                                <div><label htmlFor="previousEbitda">EBITDA Anno Precedente (€)</label><input type="number" id="previousEbitda" value={formData.previousEbitda} onChange={handleInputChange} /></div>
                                <div><label htmlFor="previousNetIncome">Utile Netto Anno Precedente (€)</label><input type="number" id="previousNetIncome" value={formData.previousNetIncome} onChange={handleInputChange} /></div>
                             </div>
                        </div>

                        <div className="card">
                             <h3 className="text-xl font-bold mb-4">📈 Metriche di Performance</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label htmlFor="grossMargin">Margine Lordo (%)</label><input type="number" id="grossMargin" value={formData.grossMargin} onChange={handleInputChange} /></div>
                                <div><label htmlFor="recurringRevenue">Ricavi Ricorrenti (%)</label><input type="number" id="recurringRevenue" value={formData.recurringRevenue} onChange={handleInputChange} /></div>
                                <div><label htmlFor="customerConcentration">Concentrazione Clienti (%)</label><input type="number" id="customerConcentration" value={formData.customerConcentration} onChange={handleInputChange} /></div>
                                <div><label htmlFor="debtLevel">Livello Indebitamento</label><select id="debtLevel" value={formData.debtLevel} onChange={handleInputChange}><option value="low">Basso (&lt; 2x EBITDA)</option><option value="medium">Medio (2-4x EBITDA)</option><option value="high">Alto (&gt; 4x EBITDA)</option></select></div>
                                <div><label htmlFor="technologyRisk">Rischio Tecnologico</label><select id="technologyRisk" value={formData.technologyRisk} onChange={handleInputChange}><option value="low">Basso</option><option value="medium">Medio</option><option value="high">Alto</option></select></div>
                                <div><label htmlFor="managementQuality">Qualità Management</label><select id="managementQuality" value={formData.managementQuality} onChange={handleInputChange}><option value="excellent">Eccellente</option><option value="good">Buona</option><option value="average">Media</option><option value="poor">Scarsa</option></select></div>
                             </div>
                        </div>

                    </div>

                    {/* Colonna Risultati */}
                    <div className="lg:col-span-1">
                        <div className="card sticky top-8">
                            <h2 className="text-2xl font-bold mb-4 text-center">🎯 Valutazione</h2>
                            <div className="text-4xl font-bold mb-2 text-center">{formatCurrency(results.fairMarketValue)}</div>
                            <div className="text-gray-400 mb-6 text-center">Scenari di Valutazione</div>
                            
                            <div className="space-y-2">
                                <div className="scenario scenario-conservative"><span>Conservativo</span><span>{formatCurrency(results.conservativeValue)}</span></div>
                                <div className="scenario scenario-fair"><span>Mercato Equo</span><span>{formatCurrency(results.fairMarketValue)}</span></div>
                                <div className="scenario scenario-optimistic"><span>Ottimistico</span><span>{formatCurrency(results.optimisticValue)}</span></div>
                            </div>
                            
                            <hr className="border-gray-700 my-6"/>

                            <h3 className="text-xl font-bold mb-4">🔢 Multipli</h3>
                            <div className="space-y-4 text-sm">
                                <div className="multiple-row"><span>EV/Ricavi</span><span className="multiple-value">{results.evRevenue}x</span></div>
                                <div className="multiple-row"><span>EV/EBITDA</span><span className="multiple-value">{results.evEbitda}x</span></div>
                                <div className="multiple-row"><span>P/E Ratio</span><span className="multiple-value">{results.peRatio}x</span></div>
                            </div>

                            <hr className="border-gray-700 my-6"/>

                            <h3 className="text-xl font-bold mb-4">📊 Metriche</h3>
                             <div className="space-y-4 text-sm">
                                <div className="multiple-row"><span>Crescita Ricavi</span><span className={getMetricClass(results.revenueGrowth)}>{formatPercentage(results.revenueGrowth)}</span></div>
                                <div className="multiple-row"><span>Crescita EBITDA</span><span className={getMetricClass(results.ebitdaGrowth)}>{formatPercentage(results.ebitdaGrowth)}</span></div>
                                <div className="multiple-row"><span>Score Qualità</span><span className="metric-neutral">{Math.round(results.qualityScore || 0)}%</span></div>
                                <div className="multiple-row"><span>Score Rischio</span><span className="metric-neutral">{Math.round(results.riskScore || 0)}%</span></div>
                                <div className="multiple-row"><span>Sconto Liquidità</span><span className="metric-negative">-{Math.round((results.liquidityDiscount || 0) * 100)}%</span></div>
                            </div>

                            <button onClick={saveValuation} disabled={isSubmitting} className="btn w-full mt-6">
                                {isSubmitting ? 'Salvataggio...' : '💾 Salva Valutazione'}
                            </button>
                        </div>
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
