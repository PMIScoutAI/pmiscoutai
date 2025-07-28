import { useState, useEffect } from 'react';

// Componente Gauge Circolare (stile tachimetro auto)
const CircularGauge = ({ value, maxValue, minValue = 0, label, unit = "", benchmark, status }) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 500);
    return () => clearTimeout(timer);
  }, [value]);
  
  const normalizedValue = ((animatedValue - minValue) / (maxValue - minValue)) * 100;
  const rotation = (normalizedValue / 100) * 180 - 90; // -90 to 90 degrees
  
  const getColor = () => {
    switch(status) {
      case 'green': return '#10B981';
      case 'yellow': return '#F59E0B'; 
      case 'red': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <div className="relative w-48 h-32 mx-auto">
      {/* Gauge Background */}
      <svg className="w-48 h-32" viewBox="0 0 200 120">
        {/* Background Arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Colored Sections */}
        <path
          d="M 20 100 A 80 80 0 0 1 100 40"
          fill="none"
          stroke="#EF4444"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d="M 100 40 A 80 80 0 0 1 140 55"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d="M 140 55 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#10B981"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.3"
        />
        
        {/* Progress Arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={getColor()}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${normalizedValue * 2.51} 251`}
          className="transition-all duration-1000 ease-out"
          filter="drop-shadow(0 0 6px currentColor)"
        />
        
        {/* Needle */}
        <g transform={`translate(100, 100) rotate(${rotation})`}>
          <line
            x1="0" y1="0" x2="0" y2="-65"
            stroke={getColor()}
            strokeWidth="3"
            strokeLinecap="round"
            filter="drop-shadow(0 0 4px currentColor)"
          />
          <circle cx="0" cy="0" r="4" fill={getColor()} />
        </g>
      </svg>
      
      {/* Center Value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <div className="text-2xl font-bold text-gray-900" style={{ color: getColor() }}>
          {animatedValue}{unit}
        </div>
        <div className="text-xs text-gray-500 mt-1">vs {benchmark}</div>
      </div>
      
      {/* Label */}
      <div className="text-center mt-2">
        <div className="text-sm font-medium text-gray-700">{label}</div>
      </div>
    </div>
  );
};

// Componente Health Score (tachimetro principale)
const HealthScoreGauge = ({ score }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 800);
    return () => clearTimeout(timer);
  }, [score]);
  
  const getScoreColor = () => {
    if (animatedScore >= 80) return '#10B981';
    if (animatedScore >= 60) return '#F59E0B';
    return '#EF4444';
  };
  
  const rotation = (animatedScore / 100) * 180 - 90;

  return (
    <div className="relative w-80 h-48 mx-auto">
      <svg className="w-80 h-48" viewBox="0 0 320 200">
        {/* Outer Ring */}
        <circle cx="160" cy="160" r="140" fill="none" stroke="#E5E7EB" strokeWidth="2" opacity="0.3" />
        
        {/* Background Arc */}
        <path
          d="M 20 160 A 140 140 0 0 1 300 160"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="20"
          strokeLinecap="round"
        />
        
        {/* Score Sections */}
        <path d="M 20 160 A 140 140 0 0 1 106 46" fill="none" stroke="#EF4444" strokeWidth="16" strokeLinecap="round" opacity="0.2" />
        <path d="M 106 46 A 140 140 0 0 1 214 46" fill="none" stroke="#F59E0B" strokeWidth="16" strokeLinecap="round" opacity="0.2" />
        <path d="M 214 46 A 140 140 0 0 1 300 160" fill="none" stroke="#10B981" strokeWidth="16" strokeLinecap="round" opacity="0.2" />
        
        {/* Progress Arc */}
        <path
          d="M 20 160 A 140 140 0 0 1 300 160"
          fill="none"
          stroke={getScoreColor()}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${animatedScore * 4.4} 440`}
          className="transition-all duration-2000 ease-out"
          filter="drop-shadow(0 0 12px currentColor)"
        />
        
        {/* Needle */}
        <g transform={`translate(160, 160) rotate(${rotation})`}>
          <line x1="0" y1="0" x2="0" y2="-120" stroke={getScoreColor()} strokeWidth="4" strokeLinecap="round" />
          <circle cx="0" cy="0" r="8" fill={getScoreColor()} filter="drop-shadow(0 0 8px currentColor)" />
        </g>
        
        {/* Scale Marks */}
        {[0, 20, 40, 60, 80, 100].map((mark, i) => {
          const angle = ((mark / 100) * 180 - 90) * (Math.PI / 180);
          const x1 = 160 + Math.cos(angle) * 125;
          const y1 = 160 + Math.sin(angle) * 125;
          const x2 = 160 + Math.cos(angle) * 115;
          const y2 = 160 + Math.sin(angle) * 115;
          
          return (
            <g key={mark}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9CA3AF" strokeWidth="2" />
              <text 
                x={160 + Math.cos(angle) * 105} 
                y={160 + Math.sin(angle) * 105 + 4} 
                textAnchor="middle" 
                className="text-xs fill-gray-600"
              >
                {mark}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Center Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-12">
        <div className="text-5xl font-bold" style={{ color: getScoreColor() }}>
          {animatedScore}
        </div>
        <div className="text-gray-600 text-sm">HEALTH SCORE</div>
      </div>
    </div>
  );
};

// Componente Warning Light (spia auto)
const WarningLight = ({ active, color, icon, label }) => (
  <div className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-all duration-300 ${
    active 
      ? `border-${color}-500 bg-${color}-50 shadow-lg` 
      : 'border-gray-200 bg-gray-50'
  }`}>
    <div className={`w-4 h-4 rounded-full transition-all duration-300 ${
      active 
        ? `bg-${color}-500 shadow-lg animate-pulse` 
        : 'bg-gray-300'
    }`} style={{
      boxShadow: active ? `0 0 12px rgb(${color === 'red' ? '239, 68, 68' : color === 'yellow' ? '245, 158, 11' : '16, 185, 129'})` : 'none'
    }} />
    <span className={`text-sm font-medium ${active ? `text-${color}-700` : 'text-gray-500'}`}>
      {label}
    </span>
  </div>
);

// Demo Component
export default function CarDashboardUI() {
  const [demoData] = useState({
    healthScore: 85,
    company: "DBA GROUP S.p.A.",
    date: "28/07/2025",
    summary: "L'azienda presenta un buon stato di salute finanziaria con un Current Ratio superiore alla media di settore, un ROE accettabile, ma un Debt/Equity che indica una certa esposizione al debito.",
    extracted_values: {
      attivo_corrente: 407083,
      debiti_totali: 325005,
      patrimonio_netto: 126452,
      utile_netto: 7868
    },
    financial_metrics: {
      current_ratio: {
        value: 1.25,
        sector_benchmark: 1.5,
        status_color: "yellow"
      },
      roe: {
        value: 6.22,
        sector_benchmark: 8.0,
        status_color: "yellow"
      },
      debt_equity: {
        value: 2.57,
        sector_benchmark: 1.5,
        status_color: "red"
      }
    },
    swot_analysis: {
      strengths: [
        "Solida presenza nel settore costruzioni navali",
        "Portfolio ordini significativo (€1.116 milioni)"
      ],
      weaknesses: [
        "Rapporto debito/patrimonio sopra la soglia prudenziale",
        "ROE sotto la media settoriale"
      ],
      opportunities: [
        "Crescita del settore energie rinnovabili offshore",
        "Opportunità PNRR per transizione energetica"
      ],
      threats: [
        "Concorrenza internazionale intensa",
        "Volatilità prezzi materie prime"
      ]
    },
    recommendations: [
      "Monitorare l'esposizione al debito e pianificare strategie di riduzione",
      "Investire in innovazione per migliorare margini di redditività",
      "Diversificare verso settori rinnovabili per cogliere opportunità di crescita"
    ],
    warnings: [
      { active: false, color: 'red', label: 'Liquidità Critica' },
      { active: true, color: 'red', label: 'Alto Indebitamento' },
      { active: true, color: 'yellow', label: 'ROE Sotto Media' },
      { active: false, color: 'green', label: 'Performance Ottima' }
    ]
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-white text-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Dashboard */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl text-white">📊</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">PMI SCOUT</h1>
                <p className="text-blue-600">Check-UP AI</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{demoData.company}</div>
              <div className="text-blue-600">Aggiornato: {demoData.date}</div>
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          
          {/* Health Score Principale */}
          <div className="xl:col-span-2 bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">HEALTH SCORE</h2>
            <HealthScoreGauge score={demoData.healthScore} />
            
            {/* Status Summary */}
            <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-700 leading-relaxed">{demoData.summary}</p>
            </div>
          </div>

          {/* Warning Lights Panel */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 mb-6">SYSTEM STATUS</h3>
            <div className="space-y-4">
              {demoData.warnings.map((warning, index) => (
                <WarningLight key={index} {...warning} />
              ))}
            </div>
            
            {/* Quick Stats */}
            <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-700 mb-2">VALORI ESTRATTI</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-blue-600 font-semibold">€{(demoData.extracted_values.attivo_corrente / 1000).toFixed(0)}K</div>
                    <div className="text-gray-500">Attivo Corrente</div>
                  </div>
                  <div>
                    <div className="text-red-600 font-semibold">€{(demoData.extracted_values.debiti_totali / 1000).toFixed(0)}K</div>
                    <div className="text-gray-500">Debiti Totali</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Gauges */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">LIQUIDITÀ</h3>
            <CircularGauge
              value={demoData.financial_metrics.current_ratio.value}
              maxValue={3}
              label="Current Ratio"
              benchmark={demoData.financial_metrics.current_ratio.sector_benchmark}
              status={demoData.financial_metrics.current_ratio.status_color}
            />
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">REDDITIVITÀ</h3>
            <CircularGauge
              value={demoData.financial_metrics.roe.value}
              maxValue={25}
              label="ROE"
              unit="%"
              benchmark={`${demoData.financial_metrics.roe.sector_benchmark}%`}
              status={demoData.financial_metrics.roe.status_color}
            />
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">INDEBITAMENTO</h3>
            <CircularGauge
              value={demoData.financial_metrics.debt_equity.value}
              maxValue={4}
              label="Debt/Equity"
              benchmark={demoData.financial_metrics.debt_equity.sector_benchmark}
              status={demoData.financial_metrics.debt_equity.status_color}
            />
          </div>
        </div>

        {/* Raccomandazioni */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">RACCOMANDAZIONI</h3>
          <div className="space-y-4">
            {demoData.recommendations.map((recommendation, index) => (
              <div key={index} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <p className="text-gray-800">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SWOT Analysis */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">ANALISI SWOT</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Punti di Forza */}
            <div className="border-l-4 border-green-500 pl-6">
              <h4 className="text-lg font-semibold text-green-700 mb-3">Punti di Forza</h4>
              <ul className="space-y-2">
                {demoData.swot_analysis.strengths.map((item, index) => (
                  <li key={index} className="text-gray-700 flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Punti di Debolezza */}
            <div className="border-l-4 border-red-500 pl-6">
              <h4 className="text-lg font-semibold text-red-700 mb-3">Punti di Debolezza</h4>
              <ul className="space-y-2">
                {demoData.swot_analysis.weaknesses.map((item, index) => (
                  <li key={index} className="text-gray-700 flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Opportunità */}
            <div className="border-l-4 border-blue-500 pl-6">
              <h4 className="text-lg font-semibold text-blue-700 mb-3">Opportunità</h4>
              <ul className="space-y-2">
                {demoData.swot_analysis.opportunities.map((item, index) => (
                  <li key={index} className="text-gray-700 flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Minacce */}
            <div className="border-l-4 border-orange-500 pl-6">
              <h4 className="text-lg font-semibold text-orange-700 mb-3">Minacce</h4>
              <ul className="space-y-2">
                {demoData.swot_analysis.threats.map((item, index) => (
                  <li key={index} className="text-gray-700 flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Info Bar */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">€{(demoData.extracted_values.patrimonio_netto / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-600">PATRIMONIO NETTO</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">€{(demoData.extracted_values.utile_netto / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-600">UTILE NETTO</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{demoData.healthScore}/100</div>
              <div className="text-sm text-gray-600">PUNTEGGIO SALUTE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
