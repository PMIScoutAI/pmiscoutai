import React, { useState, useMemo, useEffect } from 'react';

// Simulazione delle dipendenze esterne per l'anteprima
const useAuth = () => ({ user: { name: 'Utente Demo', email: 'demo@example.com' } });
const Link = ({ href, className, children, ...props }) => <a href={href} className={className} {...props}>{children}</a>;

// Dati e configurazione
const industryMultiples = {
  technology: { revenue: 3.5, ebitda: 12, pe: 18 },
  healthcare: { revenue: 2.8, ebitda: 10, pe: 16 },
  fintech: { revenue: 4.2, ebitda: 14, pe: 20 },
  ecommerce: { revenue: 2.5, ebitda: 8, pe: 14 },
  manufacturing: { revenue: 1.8, ebitda: 8, pe: 12 },
  services: { revenue: 2.2, ebitda: 9, pe: 14 },
  energy: { revenue: 1.5, ebitda: 6, pe: 10 },
  real_estate: { revenue: 2.0, ebitda: 8, pe: 12 },
  media: { revenue: 2.8, ebitda: 10, pe: 15 },
  retail: { revenue: 1.2, ebitda: 5, pe: 10 },
  automotive: { revenue: 1.6, ebitda: 7, pe: 11 },
  food: { revenue: 1.8, ebitda: 8, pe: 13 }
};

const initialFormData = {
  industry: 'technology', companySize: 'small', marketPosition: 'challenger', geography: 'national',
  revenue: '4500000', ebitda: '900000', netIncome: '675000',
  previousRevenue: '3500000', previousEbitda: '560000', previousNetIncome: '420000',
  grossMargin: '50', recurringRevenue: '70', debtLevel: 'low', customerConcentration: '30',
  technologyRisk: 'medium', managementQuality: 'good'
};

const blankFormData = {
  industry: 'technology', companySize: 'micro', marketPosition: 'follower', geography: 'local',
  revenue: '', ebitda: '', netIncome: '', previousRevenue: '', previousEbitda: '', previousNetIncome: '',
  grossMargin: '', recurringRevenue: '', debtLevel: 'medium', customerConcentration: '',
  technologyRisk: 'medium', managementQuality: 'average'
};

const formConfig = [
  {
    id: 'companyInfo',
    title: 'Informazioni Azienda',
    icon: '🏢',
    fields: [
      {
        id: 'industry',
        label: 'Settore',
        type: 'select',
        options: [
          { value: 'technology', label: 'Tecnologia & Software' },
          { value: 'healthcare', label: 'Sanità & Life Sciences' },
          { value: 'fintech', label: 'Fintech & Servizi Finanziari' },
          { value: 'ecommerce', label: 'E-commerce & Digital' },
          { value: 'manufacturing', label: 'Manifatturiero & Industria' },
          { value: 'services', label: 'Servizi Professionali' },
          { value: 'energy', label: 'Energia & Utilities' },
          { value: 'real_estate', label: 'Real Estate & Costruzioni' },
          { value: 'media', label: 'Media & Entertainment' },
          { value: 'retail', label: 'Retail & Consumer' },
          { value: 'automotive', label: 'Automotive & Componentistica' },
          { value: 'food', label: 'Food & Beverage' }
        ]
      },
      {
        id: 'companySize',
        label: 'Dimensione',
        type: 'select',
        options: [
          { value: 'micro', label: 'Micro (< €2M fatturato)' },
          { value: 'small', label: 'Piccola (€2M - €10M)' },
          { value: 'medium', label: 'Media (€10M - €50M)' },
          { value: 'large', label: 'Grande (> €50M)' }
        ]
      },
      {
        id: 'marketPosition',
        label: 'Posizione di Mercato',
        type: 'select',
        options: [
          { value: 'leader', label: 'Leader di Mercato' },
          { value: 'challenger', label: 'Challenger' },
          { value: 'follower', label: 'Follower' },
          { value: 'niche', label: 'Nicchia Specializzata' }
        ]
      },
      {
        id: 'geography',
        label: 'Copertura Geografica',
        type: 'select',
        options: [
          { value: 'local', label: 'Locale/Regionale' },
          { value: 'national', label: 'Nazionale' },
          { value: 'european', label: 'Europea' },
          { value: 'international', label: 'Internazionale' }
        ]
      }
    ]
  },
  {
    id: 'currentFinancials',
    title: 'Dati Finanziari Anno Corrente',
    icon: '💰',
    fields: [
      { id: 'revenue', label: 'Ricavi (€)', type: 'number', placeholder: 'es. 4500000' },
      { id: 'ebitda', label: 'EBITDA (€)', type: 'number', placeholder: 'es. 900000' },
      { id: 'netIncome', label: 'Utile Netto (€)', type: 'number', placeholder: 'es. 675000' }
    ]
  },
  {
    id: 'previousFinancials',
    title: 'Dati Anno Precedente',
    icon: '📊',
    fields: [
      { id: 'previousRevenue', label: 'Ricavi Anno Precedente (€)', type: 'number', placeholder: 'es. 3500000' },
      { id: 'previousEbitda', label: 'EBITDA Anno Precedente (€)', type: 'number', placeholder: 'es. 560000' },
      { id: 'previousNetIncome', label: 'Utile Netto Anno Precedente (€)', type: 'number', placeholder: 'es. 420000' }
    ]
  },
  {
    id: 'performanceMetrics',
    title: 'Metriche di Performance',
    icon: '🎯',
    fields: [
      { id: 'grossMargin', label: 'Margine Lordo (%)', type: 'number', placeholder: 'es. 50' },
      { id: 'recurringRevenue', label: 'Ricavi Ricorrenti (%)', type: 'number', placeholder: 'es. 70' },
      { id: 'customerConcentration', label: 'Concentrazione Clienti (%)', type: 'number', placeholder: 'es. 30' },
      {
        id: 'debtLevel',
        label: 'Livello Indebitamento',
        type: 'select',
        options: [
          { value: 'low', label: 'Basso (< 2x EBITDA)' },
          { value: 'medium', label: 'Medio (2-4x EBITDA)' },
          { value: 'high', label: 'Alto (> 4x EBITDA)' }
        ]
      },
      {
        id: 'technologyRisk',
        label: 'Rischio Tecnologico',
        type: 'select',
        options: [
          { value: 'low', label: 'Basso' },
          { value: 'medium', label: 'Medio' },
          { value: 'high', label: 'Alto' }
        ]
      },
      {
        id: 'managementQuality',
        label: 'Qualità Management',
        type: 'select',
        options: [
          { value: 'excellent', label: 'Eccellente' },
          { value: 'good', label: 'Buona' },
          { value: 'average', label: 'Media' },
          { value: 'poor', label: 'Scarsa' }
        ]
      }
    ]
  }
];

// Logica di calcolo
const performCalculation = (formData) => {
  const data = { ...formData };
  const numericKeys = ['revenue', 'ebitda', 'netIncome', 'previousRevenue', 'previousEbitda', 'previousNetIncome', 'grossMargin', 'recurringRevenue', 'customerConcentration'];
  numericKeys.forEach(key => {
    data[key] = Math.max(0, parseFloat(data[key]) || 0);
  });

  const industryData = industryMultiples[data.industry];
  if (data.revenue === 0 || !industryData) return {
    fairMarketValue: 0, conservativeValue: 0, optimisticValue: 0,
    evRevenue: 'N/A', evEbitda: 'N/A', peRatio: 'N/A',
    revenueGrowth: 0, ebitdaGrowth: 0, qualityScore: 0, riskScore: 0, liquidityDiscount: 0
  };

  let revenueMultiple = data.revenue * industryData.revenue;
  let ebitdaMultiple = data.ebitda * industryData.ebitda;
  let peMultiple = data.netIncome * industryData.pe;
  let adjustmentFactor = 1;

  let liquidityDiscount = { micro: 0.30, small: 0.20, medium: 0.12, large: 0.08 }[data.companySize] || 0.15;
  adjustmentFactor -= liquidityDiscount;

  const geographyAdjustments = { international: 0.15, european: 0.08, national: 0.03, local: -0.05 };
  adjustmentFactor += geographyAdjustments[data.geography] || 0;
  
  const revenueGrowth = data.previousRevenue > 0 ? ((data.revenue - data.previousRevenue) / data.previousRevenue) * 100 : 0;
  if (revenueGrowth > 20) adjustmentFactor += 0.12;
  else if (revenueGrowth > 10) adjustmentFactor += 0.06;
  else if (revenueGrowth > 3) adjustmentFactor += 0.02;
  else if (revenueGrowth < 0) adjustmentFactor -= 0.20;
  
  if (data.grossMargin > 60) adjustmentFactor += 0.08;
  else if (data.grossMargin > 40) adjustmentFactor += 0.04;
  else if (data.grossMargin < 25) adjustmentFactor -= 0.12;
  
  if (data.recurringRevenue > 80) adjustmentFactor += 0.10;
  else if (data.recurringRevenue > 60) adjustmentFactor += 0.06;
  else if (data.recurringRevenue > 40) adjustmentFactor += 0.03;
  else if (data.recurringRevenue < 20) adjustmentFactor -= 0.08;
  
  const marketPosAdjustments = { leader: 0.08, challenger: 0.03, follower: -0.08, niche: 0.02 };
  adjustmentFactor += marketPosAdjustments[data.marketPosition] || 0;
  
  const techRiskAdjustments = { low: 0.05, high: -0.15, medium: 0 };
  adjustmentFactor += techRiskAdjustments[data.technologyRisk] || 0;
  
  if (data.customerConcentration > 50) adjustmentFactor -= 0.20;
  else if (data.customerConcentration > 30) adjustmentFactor -= 0.10;
  else if (data.customerConcentration < 15) adjustmentFactor += 0.05;
  
  const debtLevelAdjustments = { high: -0.15, medium: -0.05, low: 0.03 };
  adjustmentFactor += debtLevelAdjustments[data.debtLevel] || 0;
  
  const mgmtQualityAdjustments = { excellent: 0.08, good: 0.03, poor: -0.12, average: 0 };
  adjustmentFactor += mgmtQualityAdjustments[data.managementQuality] || 0;

  adjustmentFactor = Math.min(1.8, Math.max(0.5, adjustmentFactor));

  const baseValuation = (revenueMultiple * 0.25 + ebitdaMultiple * 0.60 + peMultiple * 0.15);
  const adjustedValuation = Math.max(0, baseValuation * adjustmentFactor);
  const ebitdaGrowth = data.previousEbitda > 0 ? ((data.ebitda - data.previousEbitda) / data.previousEbitda) * 100 : 0;
  
  const qualityScore = Math.min(100, Math.max(0,
    (data.grossMargin * 0.25) +
    (data.recurringRevenue * 0.35) +
    (Math.max(0, Math.min(revenueGrowth, 30)) * 0.25) +
    ({ international: 15, european: 10, national: 5, local: 0 }[data.geography] || 0)
  ));
  
  const riskScore = Math.min(100, Math.max(0,
    100 - data.customerConcentration * 0.8 +
    ({ low: 15, medium: 5, high: -15 }[data.technologyRisk] || 0) +
    ({ excellent: 15, good: 8, poor: -15, average: 0 }[data.managementQuality] || 0) +
    ({ low: 10, high: -15, medium: -5 }[data.debtLevel] || 0)
  ));

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

// Componenti UI
const Icon = ({ name, size = 24, color = "currentColor" }) => {
  const icons = {
    menu: <path d="M3 12h18M3 6h18M3 18h18" />,
    home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    user: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    calculator: (
      <>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8M8 10h8M8 14h2M8 18h2M14 14h2M14 18h2" />
      </>
    ),
    briefcase: <rect x="2" y="7" width="20" height="14" rx="2" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    chevronLeft: <path d="M15 18l-6-6 6-6" />,
    chevronRight: <path d="M9 18l6-6-6-6" />
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
};

const FormField = ({ config, value, onChange }) => {
  const { id, label, type, options, placeholder } = config;
  const commonProps = {
    id,
    value,
    onChange,
    className: `form-${type}`
  };

  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}</label>
      {type === 'select' ? (
        <select {...commonProps}>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          min="0"
          step="1"
          placeholder={placeholder}
          {...commonProps}
        />
      )}
    </div>
  );
};

const FormSection = ({ config, formData, handleInputChange }) => (
  <div className="card">
    <div className="card-header">
      <span className="card-icon">{config.icon}</span>
      <h3 className="card-title">{config.title}</h3>
    </div>
    <div className="form-grid">
      {config.fields.map(field => (
        <FormField
          key={field.id}
          config={field}
          value={formData[field.id]}
          onChange={handleInputChange}
        />
      ))}
    </div>
  </div>
);

const ResultsPanel = ({ results, onSave, onPrint, isSubmitting, saveSuccess }) => {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);

  const formatPercentage = (value) => `${value >= 0 ? '+' : ''}${(value || 0).toFixed(1)}%`;
  const getMetricClass = (value) => value >= 0 ? 'metric-positive' : 'metric-negative';
  const displayMetric = v => (v == null || v === 'N/A' ? 'N/A' : `${v}x`);

  return (
    <div className="results-panel">
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
        
        <div className="metrics-section">
          <h4 className="section-title">Multipli di Valutazione</h4>
          <div className="metric-row">
            <span className="metric-label">EV/Ricavi</span>
            <span className="metric-value metric-neutral">{displayMetric(results.evRevenue)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">EV/EBITDA</span>
            <span className="metric-value metric-neutral">{displayMetric(results.evEbitda)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">P/E Ratio</span>
            <span className="metric-value metric-neutral">{displayMetric(results.peRatio)}</span>
          </div>
        </div>

        <div className="metrics-section">
          <h4 className="section-title">Performance & Risk Metrics</h4>
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

        <div className="action-buttons">
          <button
            onClick={onSave}
            disabled={isSubmitting || saveSuccess}
            className="btn btn-primary"
          >
            {isSubmitting ? '⏳ Salvataggio...' : (saveSuccess ? '✅ Salvato!' : '💾 Salva Valutazione')}
          </button>
          <button onClick={onPrint} className="btn btn-outline">
            🖨️ Stampa Report
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente principale
const ValutazioneAziendaleCalculator = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [showCompanyList, setShowCompanyList] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const results = useMemo(() => performCalculation(formData), [formData]);

  const handleInputChange = (e) => {
    const { id, value, type } = e.target;
    let sanitizedValue = value;
    if (type === 'number') {
      sanitizedValue = value.replace(/,/g, '.');
      if (sanitizedValue === '' || isNaN(Number(sanitizedValue))) {
        sanitizedValue = '';
      }
    }
    setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  const saveValuation = async () => {
    if (!user || Object.keys(results).length === 0) return;
    setIsSubmitting(true);
    setSaveSuccess(false);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Errore nel salvataggio:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadUserAnalyses = async () => {
    if (!user?.email) return;
    setLoadingCompanies(true);
    try {
      // Simulazione API per demo
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAvailableCompanies([
        { session_id: '1', company_name: 'Tech Solutions SRL', health_score: 85, created_at: new Date() },
        { session_id: '2', company_name: 'Manufacturing Plus', health_score: 72, created_at: new Date() }
      ]);
      setShowCompanyList(true);
    } catch (error) {
      console.error('Errore caricamento cronologia:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadCompanyDataFromAnalysis = async (analysis) => {
    try {
      // Simulazione caricamento dati
      setFormData(prev => ({
        ...prev,
        revenue: '5200000',
        ebitda: '1040000',
        netIncome: '780000'
      }));
      setShowCompanyList(false);
      console.log(`Dati caricati per: ${analysis.company_name}`);
    } catch (error) {
      console.error('Errore caricamento dati XBRL:', error);
    }
  };

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: 'home' },
    { href: '/profilo', label: 'Profilo', icon: 'user' },
    { href: '/calcolatori', label: 'Calcolatori', icon: 'calculator', active: true },
    { href: '/marketplace', label: 'Marketplace', icon: 'briefcase' }
  ];

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a202c;
          background-color: #f7fafc;
        }

        .app-container {
          display: flex;
          min-height: 100vh;
        }

        /* Sidebar migliorata */
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 280px;
          height: 100vh;
          background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
          color: white;
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 1000;
          box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
        }

        .sidebar.open {
          transform: translateX(0);
        }

        @media (min-width: 1024px) {
          .sidebar {
            position: sticky;
            transform: translateX(0);
          }
          
          .main-content {
            margin-left: 0;
          }
        }

        .sidebar-header {
          padding: 2rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          text-align: center;
        }

        .sidebar-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: white;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .sidebar-header p {
          font-size: 0.875rem;
          opacity: 0.8;
          margin-top: 0.5rem;
        }

        .sidebar-nav {
          padding: 1.5rem 0;
        }

        .nav-link {
          display: flex;
          align-items: center;
          padding: 1rem 1.5rem;
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s ease;
          position: relative;
        }

        .nav-link:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .nav-link.active {
          color: white;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border-right: 4px solid white;
        }

        .nav-link svg {
          margin-right: 0.75rem;
          opacity: 0.8;
        }

        .nav-link:hover svg,
        .nav-link.active svg {
          opacity: 1;
        }

        .close-sidebar {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          padding: 0.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          display: block;
        }

        @media (min-width: 1024px) {
          .close-sidebar {
            display: none;
          }
        }

        /* Main content */
        .main-content {
          flex: 1;
          min-width: 0;
        }

        @media (min-width: 1024px) {
          .main-content {
            margin-left: 280px;
          }
        }

        .mobile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        @media (min-width: 1024px) {
          .mobile-header {
            display: none;
          }
        }

        .mobile-menu-btn {
          background: none;
          border: none;
          color: #4a5568;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.375rem;
        }

        .mobile-menu-btn:hover {
          background: #f7fafc;
        }

        .content-wrapper {
          padding: 2rem 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Header section */
        .page-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .page-header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 0.5rem;
        }

        .page-header p {
          font-size: 1.125rem;
          color: #4a5568;
          max-width: 600px;
          margin: 0 auto;
        }

        /* Content grid */
        .content-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }

        @media (min-width: 1280px) {
          .content-grid {
            grid-template-columns: 2fr 1fr;
            align-items: start;
          }
        }

        /* Form sections */
        .form-sections {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .card {
          background: white;
          border-radius: 1rem;
          padding: 2rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #f7fafc;
        }

        .card-icon {
          font-size: 1.5rem;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .card-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1a202c;
          margin: 0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 0.5rem;
          display: block;
        }

        .form-number,
        .form-select {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 2px solid #e2e8f0;
          border-radius: 0.75rem;
          font-size: 0.95rem;
          background: #f8fafc;
          color: #2d3748;
          transition: all 0.2s ease;
        }

        .form-number:focus,
        .form-select:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-number:hover,
        .form-select:hover {
          border-color: #cbd5e0;
          background: white;
        }

        /* Buttons */
        .button-group {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 0.75rem;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          white-space: nowrap;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
        }

        .btn-secondary {
          background: linear-gradient(135deg, #4fd1c7, #06b6d4);
          color: white;
          box-shadow: 0 4px 15px rgba(79, 209, 199, 0.4);
        }

        .btn-secondary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(79, 209, 199, 0.5);
        }

        .btn-danger {
          background: linear-gradient(135deg, #f56565, #e53e3e);
          color: white;
          box-shadow: 0 4px 15px rgba(245, 101, 101, 0.4);
        }

        .btn-danger:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(245, 101, 101, 0.5);
        }

        .btn-outline {
          background: white;
          color: #4a5568;
          border: 2px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .btn-outline:hover:not(:disabled) {
          background: #f7fafc;
          border-color: #cbd5e0;
          transform: translateY(-1px);
        }

        /* Results panel */
        .results-panel {
          position: sticky;
          top: 2rem;
        }

        .valuation-display {
          text-align: center;
          margin-bottom: 2rem;
          padding: 2rem;
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border-radius: 1rem;
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
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }

        .scenario {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-radius: 0.75rem;
          font-weight: 600;
          transition: transform 0.2s ease;
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
          color: #1a202c;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.875rem 0;
          border-bottom: 1px solid #f7fafc;
          font-size: 0.9rem;
        }

        .metric-row:last-child {
          border-bottom: none;
        }

        .metric-label {
          color: #4a5568;
          font-weight: 500;
        }

        .metric-value {
          font-weight: 600;
          font-size: 1rem;
        }

        .metric-positive {
          color: #38a169;
        }

        .metric-negative {
          color: #e53e3e;
        }

        .metric-neutral {
          color: #3182ce;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .action-buttons .btn {
          width: 100%;
        }

        /* Company list */
        .company-list {
          background: white;
          border-radius: 1rem;
          padding: 1.5rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          margin-bottom: 1.5rem;
        }

        .company-list-content {
          max-height: 300px;
          overflow-y: auto;
        }

        .company-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          margin-bottom: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .company-item:hover {
          background: #f7fafc;
          border-color: #cbd5e0;
          transform: translateX(4px);
        }

        .company-item:last-child {
          margin-bottom: 0;
        }

        .company-info h4 {
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 0.25rem;
        }

        .company-info small {
          color: #4a5568;
          font-size: 0.8rem;
        }

        .company-score {
          text-align: right;
        }

        .company-score strong {
          color: #3182ce;
          font-size: 1.1rem;
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .content-wrapper {
            padding: 1rem;
          }

          .page-header h1 {
            font-size: 2rem;
          }

          .page-header p {
            font-size: 1rem;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .button-group {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }

          .valuation-amount {
            font-size: 2rem;
          }

          .scenarios {
            gap: 0.5rem;
          }

          .scenario {
            padding: 0.875rem 1rem;
          }
        }

        /* Overlay for mobile sidebar */
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }

        .sidebar-overlay.visible {
          opacity: 1;
          visibility: visible;
        }

        @media (min-width: 1024px) {
          .sidebar-overlay {
            display: none;
          }
        }

        /* Print styles */
        @media print {
          .sidebar,
          .mobile-header,
          .button-group,
          .action-buttons {
            display: none !important;
          }

          .main-content {
            margin-left: 0 !important;
          }

          .content-grid {
            grid-template-columns: 1fr !important;
          }

          .card {
            box-shadow: none;
            border: 1px solid #ccc;
            page-break-inside: avoid;
          }

          .results-panel {
            position: static;
          }
        }
      `}</style>

      <div className="app-container">
        {/* Sidebar Overlay */}
        <div
          className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`}
          onClick={() => setIsSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <button
            className="close-sidebar"
            onClick={() => setIsSidebarOpen(false)}
          >
            <Icon name="x" size={20} />
          </button>
          
          <div className="sidebar-header">
            <h1>PMIScout</h1>
            <p>AI per le PMI italiane</p>
          </div>
          
          <nav className="sidebar-nav">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`nav-link ${link.active ? 'active' : ''}`}
              >
                <Icon name={link.icon} size={20} />
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="main-content">
          {/* Mobile Header */}
          <div className="mobile-header">
            <button
              className="mobile-menu-btn"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Icon name="menu" size={24} />
            </button>
            <h1>PMIScout</h1>
            <div></div>
          </div>

          {/* Content */}
          <div className="content-wrapper">
            <div className="page-header">
              <h1>Calcolatore Valutazione Aziendale</h1>
              <p>Ottieni una stima professionale del valore della tua impresa basata sui multipli di mercato</p>
            </div>

            <div className="content-grid">
              {/* Form Sections */}
              <div className="form-sections">
                {/* Action Buttons */}
                <div className="button-group">
                  <button
                    className="btn btn-danger"
                    onClick={() => setFormData({...blankFormData})}
                  >
                    Pulisci Dati
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setFormData({...initialFormData})}
                  >
                    Carica Esempio
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={loadUserAnalyses}
                    disabled={!user || loadingCompanies}
                  >
                    {loadingCompanies ? 'Caricamento...' : 'Carica da Cronologia'}
                  </button>
                </div>

                {/* Company List */}
                {showCompanyList && (
                  <div className="company-list">
                    <div className="card-header">
                      <span className="card-icon">📋</span>
                      <h3 className="card-title">Seleziona Azienda dalla Cronologia</h3>
                    </div>
                    <div className="company-list-content">
                      {availableCompanies.length > 0 ? (
                        availableCompanies.map((analysis) => (
                          <div
                            key={analysis.session_id}
                            className="company-item"
                            onClick={() => loadCompanyDataFromAnalysis(analysis)}
                          >
                            <div className="company-info">
                              <h4>{analysis.company_name}</h4>
                              <small>{new Date(analysis.created_at).toLocaleDateString('it-IT')}</small>
                            </div>
                            <div className="company-score">
                              <strong>Score: {analysis.health_score}/100</strong>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p>Nessuna analisi trovata.</p>
                      )}
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowCompanyList(false)}
                      style={{marginTop: '1rem'}}
                    >
                      Chiudi
                    </button>
                  </div>
                )}

                {/* Form Sections */}
                {formConfig.map(section => (
                  <FormSection
                    key={section.id}
                    config={section}
                    formData={formData}
                    handleInputChange={handleInputChange}
                  />
                ))}
              </div>

              {/* Results Panel */}
              <ResultsPanel
                results={results}
                onSave={saveValuation}
                onPrint={handlePrint}
                isSubmitting={isSubmitting}
                saveSuccess={saveSuccess}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ValutazioneAziendaleCalculator;
