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
    const [saveSuccess, setSaveSuccess] = useState(false);

    const results = useMemo(() => performCalculation(formData), [formData]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handlePrint = () => {
        window.print();
    };

    const saveValuation = async () => {
        if (!user || Object.keys(results).length === 0) return;
        setIsSubmitting(true);
        setSaveSuccess(false);
        try {
            const response = await fetch('/api/save-valuation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, inputs: formData, outputs: results }),
            });
            if (!response.ok) throw new Error('Salvataggio fallito');
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
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
        <>
            <style jsx>{`
                * {
                    box-sizing: border-box;
                }
                
                .container {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 2rem 1rem;
                }
                
                .main-wrapper {
                    max-width: 1400px;
                    margin: 0 auto;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 3rem;
                    color: white;
                }
                
                .header h1 {
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .header p {
                    font-size: 1.1rem;
                    opacity: 0.9;
                    font-weight: 300;
                }
                
                .content-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 2rem;
                    align-items: start;
                }
                
                @media (max-width: 1024px) {
                    .content-grid {
                        grid-template-columns: 1fr;
                        gap: 1.5rem;
                    }
                }
                
                .card {
                    background: white;
                    border-radius: 16px;
                    padding: 2rem;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.2);
                    transition: all 0.3s ease;
                }
                
                .card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                }
                
                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px solid #f1f5f9;
                }
                
                .card-icon {
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                }
                
                .card-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #1e293b;
                    margin: 0;
                }
                
                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                }
                
                .form-group {
                    display: flex;
                    flex-direction: column;
                }
                
                .form-label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #4b5563;
                    margin-bottom: 0.5rem;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .form-input, .form-select {
                    padding: 12px 16px;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    background: #f8fafc;
                    transition: all 0.3s ease;
                    color: #1e293b;
                }
                
                .form-input:focus, .form-select:focus {
                    outline: none;
                    border-color: #3b82f6;
                    background: white;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    transform: translateY(-1px);
                }
                
                .form-input:hover, .form-select:hover {
                    border-color: #cbd5e0;
                    background: white;
                }
                
                .button-group {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                }
                
                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    text-decoration: none;
                    white-space: nowrap;
                }
                
                .btn-primary {
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    color: white;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
                }
                
                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
                }
                
                .btn-secondary {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                }
                
                .btn-secondary:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
                }
                
                .btn-danger {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
                }
                
                .btn-danger:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
                }
                
                .btn-outline {
                    background: white;
                    color: #6b7280;
                    border: 2px solid #e5e7eb;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                
                .btn-outline:hover:not(:disabled) {
                    background: #f9fafb;
                    border-color: #d1d5db;
                    transform: translateY(-1px);
                }
                
                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none !important;
                }
                
                .results-card {
                    position: sticky;
                    top: 2rem;
                }
                
                .valuation-display {
                    text-align: center;
                    margin-bottom: 2rem;
                    padding: 2rem;
                    background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
                    border-radius: 16px;
                    border: 2px solid #bae6fd;
                }
                
                .valuation-amount {
                    font-size: 2.5rem;
                    font-weight: 800;
                    color: #0c4a6e;
                    margin-bottom: 0.5rem;
                    text-shadow: 0 2px 4px rgba(12, 74, 110, 0.1);
                }
                
                .valuation-subtitle {
                    color: #0369a1;
                    font-weight: 500;
                    font-size: 1rem;
                }
                
                .scenarios {
                    margin-bottom: 2rem;
                }
                
                .scenario {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-radius: 12px;
                    margin-bottom: 8px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }
                
                .scenario:hover {
                    transform: translateX(4px);
                }
                
                .scenario-conservative {
                    background: linear-gradient(135deg, #fef3c7, #fde68a);
                    color: #92400e;
                    border: 1px solid #f59e0b;
                }
                
                .scenario-fair {
                    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
                    color: #1e40af;
                    border: 1px solid #3b82f6;
                }
                
                .scenario-optimistic {
                    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
                    color: #065f46;
                    border: 1px solid #10b981;
                }
                
                .metrics-section {
                    margin-bottom: 2rem;
                }
                
                .section-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #1e293b;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .metric-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.9rem;
                }
                
                .metric-row:last-child {
                    border-bottom: none;
                }
                
                .metric-label {
                    color: #64748b;
                    font-weight: 500;
                }
                
                .metric-value {
                    font-weight: 600;
                    font-size: 1rem;
                }
                
                .metric-positive {
                    color: #059669;
                }
                
                .metric-negative {
                    color: #dc2626;
                }
                
                .metric-neutral {
                    color: #3b82f6;
                }
                
                .divider {
                    height: 2px;
                    background: linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9);
                    border: none;
                    margin: 2rem 0;
                    border-radius: 1px;
                }
                
                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: white;
                    text-decoration: none;
                    font-weight: 500;
                    margin-bottom: 2rem;
                    padding: 8px 16px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.2);
                    transition: all 0.3s ease;
                }
                
                .back-link:hover {
                    background: rgba(255,255,255,0.2);
                    transform: translateX(-4px);
                }
                
                @media print {
                    body { background: #ffffff !important; color: #000000 !important; }
                    .container { background: white !important; padding: 20px !important; }
                    .header, .button-group, .btn, .back-link { display: none !important; }
                    .content-grid { grid-template-columns: 1fr !important; }
                    .card { box-shadow: none; border: 1px solid #ccc; margin: 0; }
                    .metric-positive { color: #166534; } 
                    .metric-negative { color: #991b1b; } 
                    .metric-neutral { color: #1e40af; }
                }
                
                .input-sections {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
            `}</style>

            <div className="container">
                <div className="main-wrapper">
                    <Link href="/calcolatori">
                        <a className="back-link">
                            ← Torna ai calcolatori
                        </a>
                    </Link>

                    <div className="header">
                        <h1>📊 Calcolatore Valutazione Aziendale</h1>
                        <p>Ottieni una stima professionale del valore della tua impresa basata sui multipli di mercato</p>
                    </div>

                    <div className="content-grid">
                        {/* Sezione Input */}
                        <div className="input-sections">
                            <div className="button-group">
                                <button className="btn btn-danger" onClick={() => setFormData(blankFormData)}>
                                    🗑️ Pulisci Dati
                                </button>
                                <button className="btn btn-secondary" onClick={() => setFormData(initialFormData)}>
                                    📋 Carica Esempio
                                </button>
                            </div>
                            
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-icon">🏢</div>
                                    <h2 className="card-title">Informazioni Azienda</h2>
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="industry">🚀 Settore</label>
                                        <select className="form-select" id="industry" value={formData.industry} onChange={handleInputChange}>
                                            <option value="technology">Tecnologia & Software</option>
                                            <option value="healthcare">Sanità & Life Sciences</option>
                                            <option value="fintech">Fintech & Servizi Finanziari</option>
                                            <option value="ecommerce">E-commerce & Digital</option>
                                            <option value="manufacturing">Manifatturiero & Industria</option>
                                            <option value="services">Servizi Professionali</option>
                                            <option value="energy">Energia & Utilities</option>
                                            <option value="real_estate">Real Estate & Costruzioni</option>
                                            <option value="media">Media & Entertainment</option>
                                            <option value="retail">Retail & Consumer</option>
                                            <option value="automotive">Automotive & Componentistica</option>
                                            <option value="food">Food & Beverage</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="companySize">📏 Dimensione</label>
                                        <select className="form-select" id="companySize" value={formData.companySize} onChange={handleInputChange}>
                                            <option value="micro">Micro (&lt; €2M fatturato)</option>
                                            <option value="small">Piccola (€2M - €10M)</option>
                                            <option value="medium">Media (€10M - €50M)</option>
                                            <option value="large">Grande (&gt; €50M)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="marketPosition">🎯 Posizione di Mercato</label>
                                        <select className="form-select" id="marketPosition" value={formData.marketPosition} onChange={handleInputChange}>
                                            <option value="leader">Leader di Mercato</option>
                                            <option value="challenger">Challenger</option>
                                            <option value="follower">Follower</option>
                                            <option value="niche">Nicchia Specializzata</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="geography">🌍 Copertura Geografica</label>
                                        <select className="form-select" id="geography" value={formData.geography} onChange={handleInputChange}>
                                            <option value="local">Locale/Regionale</option>
                                            <option value="national">Nazionale</option>
                                            <option value="european">Europea</option>
                                            <option value="international">Internazionale</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <div className="card-icon">💰</div>
                                    <h2 className="card-title">Dati Finanziari Anno Corrente</h2>
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="revenue">💵 Ricavi (€)</label>
                                        <input className="form-input" type="number" id="revenue" value={formData.revenue} onChange={handleInputChange} placeholder="es. 4500000" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="ebitda">📈 EBITDA (€)</label>
                                        <input className="form-input" type="number" id="ebitda" value={formData.ebitda} onChange={handleInputChange} placeholder="es. 900000" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="netIncome">💎 Utile Netto (€)</label>
                                        <input className="form-input" type="number" id="netIncome" value={formData.netIncome} onChange={handleInputChange} placeholder="es. 675000" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-icon">📊</div>
                                    <h2 className="card-title">Dati Anno Precedente</h2>
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="previousRevenue">💵 Ricavi Anno Precedente (€)</label>
                                        <input className="form-input" type="number" id="previousRevenue" value={formData.previousRevenue} onChange={handleInputChange} placeholder="es. 3500000" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="previousEbitda">📈 EBITDA Anno Precedente (€)</label>
                                        <input className="form-input" type="number" id="previousEbitda" value={formData.previousEbitda} onChange={handleInputChange} placeholder="es. 560000" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="previousNetIncome">💎 Utile Netto Anno Precedente (€)</label>
                                        <input className="form-input" type="number" id="previousNetIncome" value={formData.previousNetIncome} onChange={handleInputChange} placeholder="es. 420000" />
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <div className="card-icon">🎯</div>
                                    <h2 className="card-title">Metriche di Performance</h2>
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="grossMargin">📊 Margine Lordo (%)</label>
                                        <input className="form-input" type="number" id="grossMargin" value={formData.grossMargin} onChange={handleInputChange} placeholder="es. 50" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="recurringRevenue">🔄 Ricavi Ricorrenti (%)</label>
                                        <input className="form-input" type="number" id="recurringRevenue" value={formData.recurringRevenue} onChange={handleInputChange} placeholder="es. 70" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="customerConcentration">👥 Concentrazione Clienti (%)</label>
                                        <input className="form-input" type="number" id="customerConcentration" value={formData.customerConcentration} onChange={handleInputChange} placeholder="es. 30" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="debtLevel">💳 Livello Indebitamento</label>
                                        <select className="form-select" id="debtLevel" value={formData.debtLevel} onChange={handleInputChange}>
                                            <option value="low">Basso (&lt; 2x EBITDA)</option>
                                            <option value="medium">Medio (2-4x EBITDA)</option>
                                            <option value="high">Alto (&gt; 4x EBITDA)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="technologyRisk">⚠️ Rischio Tecnologico</label>
                                        <select className="form-select" id="technologyRisk" value={formData.technologyRisk} onChange={handleInputChange}>
                                            <option value="low">Basso</option>
                                            <option value="medium">Medio</option>
                                            <option value="high">Alto</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="managementQuality">👔 Qualità Management</label>
                                        <select className="form-select" id="managementQuality" value={formData.managementQuality} onChange={handleInputChange}>
                                            <option value="excellent">Eccellente</option>
                                            <option value="good">Buona</option>
                                            <option value="average">Media</option>
                                            <option value="poor">Scarsa</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sezione Risultati */}
                        <div className="results-card">
                            <div className="card">
                                <div className="valuation-display">
                                    <div className="valuation-amount">{formatCurrency(results.fairMarketValue)}</div>
                                    <div className="valuation-subtitle">Valutazione Fair Market Value</div>
                                </div>
                                
                                <div className="scenarios">
                                    <div className="scenario scenario-conservative">
                                        <span>🔻 Conservativo</span>
                                        <strong>{formatCurrency(results.conservativeValue)}</strong>
                                    </div>
                                    <div className="scenario scenario-fair">
                                        <span>⚖️ Mercato Equo</span>
                                        <strong>{formatCurrency(results.fairMarketValue)}</strong>
                                    </div>
                                    <div className="scenario scenario-optimistic">
                                        <span>🔺 Ottimistico</span>
                                        <strong>{formatCurrency(results.optimisticValue)}</strong>
                                    </div>
                                </div>
                                
                                <hr className="divider"/>

                                <div className="metrics-section">
                                    <h3 className="section-title">🔢 Multipli di Valutazione</h3>
                                    <div className="metric-row">
                                        <span className="metric-label">EV/Ricavi</span>
                                        <span className="metric-value metric-neutral">{results.evRevenue}x</span>
                                    </div>
                                    <div className="metric-row">
                                        <span className="metric-label">EV/EBITDA</span>
                                        <span className="metric-value metric-neutral">{results.evEbitda}x</span>
                                    </div>
                                    <div className="metric-row">
                                        <span className="metric-label">P/E Ratio</span>
                                        <span className="metric-value metric-neutral">{results.peRatio}x</span>
                                    </div>
                                </div>

                                <hr className="divider"/>

                                <div className="metrics-section">
                                    <h3 className="section-title">📈 Performance & Risk Metrics</h3>
                                    <div className="metric-row">
                                        <span className="metric-label">Crescita Ricavi</span>
                                        <span className={`metric-value ${getMetricClass(results.revenueGrowth)}`}>
                                            {formatPercentage(results.revenueGrowth)}
                                        </span>
                                    </div>
                                    <div className="metric-row">
                                        <span className="metric-label">Crescita EBITDA</span>
                                        <span className={`metric-value ${getMetricClass(results.ebitdaGrowth)}`}>
                                            {formatPercentage(results.ebitdaGrowth)}
                                        </span>
                                    </div>
                                    <div className="metric-row">
                                        <span className="metric-label">Score Qualità</span>
                                        <span className="metric-value metric-neutral">
                                            {Math.round(results.qualityScore || 0)}/100
                                        </span>
                                    </div>
                                    <div className="metric-row">
                                        <span className="metric-label">Score Rischio</span>
                                        <span className="metric-value metric-neutral">
                                            {Math.round(results.riskScore || 0)}/100
                                        </span>
                                    </div>
                                    <div className="metric-row">
                                        <span className="metric-label">Sconto Liquidità</span>
                                        <span className="metric-value metric-negative">
                                            -{Math.round((results.liquidityDiscount || 0) * 100)}%
                                        </span>
                                    </div>
                                </div>

                                <hr className="divider"/>

                                <div className="button-group" style={{flexDirection: 'column', gap: '12px'}}>
                                    <button 
                                        onClick={saveValuation} 
                                        disabled={isSubmitting || saveSuccess} 
                                        className="btn btn-primary"
                                        style={{width: '100%'}}
                                    >
                                        {isSubmitting ? '⏳ Salvataggio...' : (saveSuccess ? '✅ Salvato!' : '💾 Salva Valutazione')}
                                    </button>
                                    <button 
                                        onClick={handlePrint} 
                                        className="btn btn-outline"
                                        style={{width: '100%'}}
                                    >
                                        🖨️ Stampa Report
                                    </button>
                                </div>
                            </div>
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
