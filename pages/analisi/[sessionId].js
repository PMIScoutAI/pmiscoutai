import React, { useState, useEffect } from 'react';
import { CheckCircle, TrendingUp, TrendingDown, Sparkles, ShieldAlert, Lightbulb, BarChart3, FileText, Info, Loader2 } from 'lucide-react';

// --- Componenti di Supporto ---

// Icona per le sezioni SWOT per un aspetto più pulito
const SwotIcon = ({ category }) => {
  const iconMap = {
    strengths: <TrendingUp className="w-6 h-6 text-green-500" />,
    weaknesses: <TrendingDown className="w-6 h-6 text-red-500" />,
    opportunities: <Sparkles className="w-6 h-6 text-blue-500" />,
    threats: <ShieldAlert className="w-6 h-6 text-orange-500" />,
  };
  return <div className="p-3 bg-gray-100 rounded-full">{iconMap[category]}</div>;
};

// Card per l'analisi SWOT
const SwotCard = ({ title, items = [], category }) => {
  const colorMap = {
    strengths: 'border-green-500',
    weaknesses: 'border-red-500',
    opportunities: 'border-blue-500',
    threats: 'border-orange-500',
  };

  return (
    <div className={`bg-white p-6 rounded-2xl border-l-4 ${colorMap[category]}`}>
      <div className="flex items-center gap-4 mb-4">
        <SwotIcon category={category} />
        <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
      </div>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3 text-gray-600">
            <Info size={16} className="mt-1 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};


// --- Componenti Principali (Gauge e Dashboard) ---

// Componente Gauge Circolare Migliorato
const CircularGauge = ({ value = 0, maxValue = 100, minValue = 0, label, unit = "", benchmark, status }) => {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 300);
    return () => clearTimeout(timer);
  }, [value]);

  const normalizedValue = Math.max(0, Math.min(100, ((animatedValue - minValue) / (maxValue - minValue)) * 100));
  const rotation = (normalizedValue / 100) * 180;
  const arcLength = 251.2;
  const progressLength = (normalizedValue / 100) * arcLength;

  const colorMap = {
    green: '#10B981',
    yellow: '#F59E0B',
    red: '#EF4444',
    default: '#6B7280',
  };
  const color = colorMap[status] || colorMap.default;

  return (
    <div className="relative w-full h-40 flex flex-col items-center justify-center">
      <svg className="w-full h-auto" viewBox="0 0 200 105">
        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${progressLength} ${arcLength}`}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 2px 4px ${color}80)` }}
        />
        <g transform={`translate(100, 100) rotate(${rotation - 90})`}>
          <line x1="0" y1="0" x2="80" y2="0" stroke={color} strokeWidth="3" className="transition-transform duration-1000 ease-out" />
          <circle cx="0" cy="0" r="6" fill={color} />
        </g>
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <div className="text-3xl font-bold" style={{ color }}>
          {animatedValue.toFixed(2)}{unit}
        </div>
        <div className="text-sm text-gray-500">{label} (vs {benchmark || 'N/A'})</div>
      </div>
    </div>
  );
};


// Health Score Gauge Migliorato
const HealthScoreGauge = ({ score = 0 }) => {
    const [animatedScore, setAnimatedScore] = useState(0);

    useEffect(() => {
        const animation = requestAnimationFrame(() => setAnimatedScore(score));
        return () => cancelAnimationFrame(animation);
    }, [score]);

    const getScoreStyle = (s) => {
        if (s >= 80) return { color: '#10B981', text: 'Eccellente', bg: 'bg-green-500/10' };
        if (s >= 60) return { color: '#F59E0B', text: 'Buono', bg: 'bg-yellow-500/10' };
        return { color: '#EF4444', text: 'Rischioso', bg: 'bg-red-500/10' };
    };

    const style = getScoreStyle(animatedScore);
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (animatedScore / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center gap-6 p-6">
            <div className="relative w-48 h-48">
                <svg className="w-full h-full" viewBox="0 0 120 120">
                    <circle className="text-gray-200" strokeWidth="10" stroke="currentColor" fill="transparent" r="52" cx="60" cy="60" />
                    <circle
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        className="transition-all duration-1000 ease-in-out"
                        style={{ color: style.color }}
                        fill="transparent"
                        r="52"
                        cx="60"
                        cy="60"
                        transform="rotate(-90 60 60)"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold" style={{ color: style.color }}>{Math.round(animatedScore)}</span>
                    <span className="text-sm font-semibold text-gray-500">/ 100</span>
                </div>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-lg font-semibold ${style.bg}`} style={{ color: style.color }}>
                {style.text}
            </div>
        </div>
    );
};


// Warning Light Migliorato
const WarningLight = ({ active, color, label }) => {
    const colorMap = {
        red: { text: 'text-red-800', bg: 'bg-red-100', dot: 'bg-red-500' },
        yellow: { text: 'text-yellow-800', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
        green: { text: 'text-green-800', bg: 'bg-green-100', dot: 'bg-green-500' },
    };
    const colors = colorMap[color] || colorMap.red;

    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${active ? colors.bg : 'bg-gray-100'}`}>
            <div className={`w-3 h-3 rounded-full transition-all duration-300 ${active ? `${colors.dot} animate-pulse` : 'bg-gray-400'}`} />
            <span className={`font-medium ${active ? colors.text : 'text-gray-600'}`}>{label}</span>
        </div>
    );
};


// --- Componente Principale del Dashboard ---
export default function PMIScoutDashboard({ analysisData }) {
    
    // Mostra uno stato di caricamento se i dati non sono disponibili
    if (!analysisData || !analysisData.raw_ai_response) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center p-4">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Caricamento Analisi...</h2>
                <p className="text-gray-500 mt-2">I dati sono in fase di elaborazione. Attendi un momento.</p>
            </div>
        );
    }

    // Una volta che i dati sono disponibili, li destrutturiamo in modo sicuro
    const { health_score = 0, summary = "Nessun sommario disponibile.", recommendations = [] } = analysisData;
    const analysis = analysisData.raw_ai_response;
    const { 
        company_name = "Azienda non specificata", 
        analysis_date = "Data non disponibile",
        financial_metrics = {}, 
        swot_analysis = {} 
    } = analysis;

    const generateWarnings = () => {
        const warnings = [];
        if (financial_metrics.debt_equity?.value > 2.0) warnings.push({ active: true, color: 'red', label: 'Alto Indebitamento' });
        if (financial_metrics.roe?.value < 8.0) warnings.push({ active: true, color: 'yellow', label: 'ROE Sotto la Media' });
        if (health_score >= 80) warnings.push({ active: true, color: 'green', label: 'Performance Ottima' });
        return warnings;
    };

    return (
        <div className="min-h-screen bg-slate-50 text-gray-800 p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">
                
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-xl"><BarChart3 size={28} /></div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">PMI Scout</h1>
                            <p className="text-blue-600 font-semibold">AI Financial Check-Up</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">{company_name}</div>
                        <div className="text-sm text-gray-500">Analisi del: {analysis_date}</div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Health Score</h2>
                            <HealthScoreGauge score={health_score} />
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">System Status</h3>
                            <div className="space-y-3">
                                {generateWarnings().map((warning, index) => <WarningLight key={index} {...warning} />)}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                             <div className="flex items-start gap-4">
                                <FileText className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Executive Summary</h2>
                                    <p className="text-gray-600 mt-2 leading-relaxed">{summary}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Liquidità</h3>
                                <CircularGauge
                                    value={financial_metrics.current_ratio?.value}
                                    maxValue={3}
                                    label="Current Ratio"
                                    benchmark={financial_metrics.current_ratio?.sector_benchmark}
                                    status={financial_metrics.current_ratio?.status_color}
                                />
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Redditività</h3>
                                <CircularGauge
                                    value={financial_metrics.roe?.value}
                                    maxValue={20}
                                    label="ROE"
                                    unit="%"
                                    benchmark={`${financial_metrics.roe?.sector_benchmark || 'N/A'}%`}
                                    status={financial_metrics.roe?.status_color}
                                />
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Indebitamento</h3>
                                <CircularGauge
                                    value={financial_metrics.debt_equity?.value}
                                    maxValue={4}
                                    label="Debt/Equity"
                                    benchmark={financial_metrics.debt_equity?.sector_benchmark}
                                    status={financial_metrics.debt_equity?.status_color}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Analisi SWOT</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SwotCard title="Punti di Forza" items={swot_analysis.strengths} category="strengths" />
                        <SwotCard title="Punti di Debolezza" items={swot_analysis.weaknesses} category="weaknesses" />
                        <SwotCard title="Opportunità" items={swot_analysis.opportunities} category="opportunities" />
                        <SwotCard title="Minacce" items={swot_analysis.threats} category="threats" />
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <Lightbulb className="w-8 h-8 text-yellow-500" />
                        <h2 className="text-2xl font-bold text-gray-900">Raccomandazioni AI</h2>
                    </div>
                    <div className="space-y-4">
                        {recommendations.map((rec, index) => (
                            <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                                <p className="text-gray-700">{rec}</p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
