import { useState, useEffect } from 'react';

const colorMap = {
  red: {
    text: 'text-red-700',
    bg: 'bg-red-500',
    bgLight: 'bg-red-50',
    border: 'border-red-500',
    shadow: 'shadow-red-500',
    rgb: '239, 68, 68'
  },
  yellow: {
    text: 'text-yellow-700',
    bg: 'bg-yellow-500',
    bgLight: 'bg-yellow-50',
    border: 'border-yellow-500',
    shadow: 'shadow-yellow-500',
    rgb: '245, 158, 11'
  },
  green: {
    text: 'text-green-700',
    bg: 'bg-green-500',
    bgLight: 'bg-green-50',
    border: 'border-green-500',
    shadow: 'shadow-green-500',
    rgb: '16, 185, 129'
  }
};

const WarningLight = ({ active, color, label }) => {
  const colors = colorMap[color] || colorMap.red;
  return (
    <div className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-all duration-300 ${
      active ? `${colors.border} ${colors.bgLight} shadow-lg` : 'border-gray-200 bg-gray-50'}`}
    >
      <div className={`w-4 h-4 rounded-full ${active ? `${colors.bg} animate-pulse` : 'bg-gray-300'}`} />
      <span className={`text-sm font-medium ${active ? colors.text : 'text-gray-500'}`}>{label}</span>
    </div>
  );
};

const HealthScoreGauge = ({ score }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score || 0), 800);
    return () => clearTimeout(timer);
  }, [score]);
  const getScoreColor = () => {
    if (animatedScore >= 80) return '#10B981';
    if (animatedScore >= 60) return '#F59E0B';
    return '#EF4444';
  };
  const rotation = (animatedScore / 100) * 180 - 90;
  const mainArcLength = 440;
  const progressLength = (animatedScore / 100) * mainArcLength;
  return (
    <div className="relative w-80 h-48 mx-auto">
      <svg className="w-80 h-48" viewBox="0 0 320 200">
        <path d="M 20 160 A 140 140 0 0 1 300 160" fill="none" stroke="#E5E7EB" strokeWidth="20" strokeLinecap="round" />
        <path d="M 20 160 A 140 140 0 0 1 300 160" fill="none" stroke={getScoreColor()} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${progressLength} ${mainArcLength}`} style={{ transition: 'stroke 1s ease' }} />
        <g transform={`translate(160, 160) rotate(${rotation})`}>
          <line x1="0" y1="0" x2="0" y2="-120" stroke={getScoreColor()} strokeWidth="4" strokeLinecap="round" />
          <circle cx="0" cy="0" r="8" fill={getScoreColor()} />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-12">
        <div className="text-5xl font-bold" style={{ color: getScoreColor() }}>{Math.round(animatedScore)}</div>
        <div className="text-gray-600 text-sm">HEALTH SCORE</div>
      </div>
    </div>
  );
};

export default function PMIScoutDashboard({ analysisData }) {
  const analysis = analysisData?.raw_ai_response || {};
  const dashboardData = {
    healthScore: analysisData?.health_score || 85,
    company: analysis.company_name || "DBA GROUP S.p.A.",
    date: analysis.analysis_date || "28/07/2025",
    summary: analysisData?.summary || "L'azienda presenta un buon stato di salute finanziaria...",
    financial_metrics: analysis.financial_metrics || {
      current_ratio: { value: 1.25, sector_benchmark: 1.5, status_color: "yellow" },
      roe: { value: 6.22, sector_benchmark: 8.0, status_color: "yellow" },
      debt_equity: { value: 2.57, sector_benchmark: 1.5, status_color: "red" }
    },
    recommendations: analysisData?.recommendations || [
      "Monitorare l'esposizione al debito",
      "Investire in innovazione"
    ]
  };

  const generateWarnings = () => {
    const w = [];
    const m = dashboardData.financial_metrics;
    if (m.current_ratio?.value < 1.0) w.push({ active: true, color: 'red', label: 'Liquidità Critica' });
    else w.push({ active: false, color: 'red', label: 'Liquidità Critica' });
    if (m.debt_equity?.value > 2.0) w.push({ active: true, color: 'red', label: 'Alto Indebitamento' });
    else if (m.debt_equity?.value > 1.5) w.push({ active: true, color: 'yellow', label: 'Indebitamento Elevato' });
    else w.push({ active: false, color: 'green', label: 'Indebitamento Controllato' });
    if (m.roe?.value < 5) w.push({ active: true, color: 'red', label: 'ROE Critico' });
    else if (m.roe?.value < 8) w.push({ active: true, color: 'yellow', label: 'ROE Sotto Media' });
    else w.push({ active: false, color: 'green', label: 'ROE Ottimale' });
    if (dashboardData.healthScore >= 80) w.push({ active: true, color: 'green', label: 'Performance Ottima' });
    else w.push({ active: false, color: 'green', label: 'Performance Ottima' });
    return w;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-white text-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">PMI SCOUT</h1>
            <p className="text-blue-600">Check-UP AI</p>
          </div>
          <div className="text-right">
            <div className="font-semibold text-lg">{dashboardData.company}</div>
            <div className="text-sm text-gray-500">{dashboardData.date}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow">
          <HealthScoreGauge score={dashboardData.healthScore} />
          <p className="mt-6 text-gray-700 leading-relaxed text-sm text-center">{dashboardData.summary}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow space-y-3">
          <h2 className="text-lg font-semibold">System Status</h2>
          {generateWarnings().map((warning, i) => <WarningLight key={i} {...warning} />)}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow space-y-4">
          <h2 className="text-lg font-semibold">Raccomandazioni AI</h2>
          {dashboardData.recommendations.map((rec, i) => (
            <div key={i} className="bg-blue-50 p-3 rounded border-l-4 border-blue-500 text-sm text-gray-700">{rec}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
