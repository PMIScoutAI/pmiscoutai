// /pages/piano-economico/[sessionId]/output.jsx
// Output finale Piano Economico Triennale
// Visualizzazione completa con grafici, tabelle, KPI e export

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Download, FileText, Share2, Home } from 'lucide-react';

export default function PianoEconomicoOutput() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);

  // Fetch dati dal backend
  useEffect(() => {
    if (!sessionId) return;

    const fetchPlanData = async () => {
      try {
        const response = await fetch(`/api/piano-economico/${sessionId}/results`);
        if (!response.ok) throw new Error('Errore caricamento dati');
        const data = await response.json();
        setPlanData(data.data);
        setLoading(false);
      } catch (error) {
        console.error('Errore:', error);
        setLoading(false);
      }
    };

    fetchPlanData();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="mb-4 w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-medium">Caricamento piano economico...</p>
        </div>
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-4">Piano economico non trovato</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Torna al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // PREPARAZIONE DATI PER GRAFICI
  // ============================================

  const timeSeriesData = [
    {
      anno: 'Anno 0',
      ricavi: planData.anno0.ricavi,
      ebitda: planData.anno0.ebitda,
      ebit: planData.anno0.ebit,
      utile: planData.anno0.utileNetto || 0
    },
    {
      anno: 'Anno 1',
      ricavi: planData.anno1.ricavi,
      ebitda: planData.anno1.ebitda,
      ebit: planData.anno1.ebit,
      utile: planData.anno1.utileNetto
    },
    {
      anno: 'Anno 2',
      ricavi: planData.anno2.ricavi,
      ebitda: planData.anno2.ebitda,
      ebit: planData.anno2.ebit,
      utile: planData.anno2.utileNetto
    },
    {
      anno: 'Anno 3',
      ricavi: planData.anno3.ricavi,
      ebitda: planData.anno3.ebitda,
      ebit: planData.anno3.ebit,
      utile: planData.anno3.utileNetto
    }
  ];

  const marginiData = [
    {
      anno: 'Anno 0',
      ebitda: planData.anno0.margineEbitda,
      ebit: planData.anno0.margineEbit,
      netto: planData.anno0.margineNetto
    },
    {
      anno: 'Anno 1',
      ebitda: planData.anno1.margineEbitda,
      ebit: planData.anno1.margineEbit,
      netto: planData.anno1.margineNetto
    },
    {
      anno: 'Anno 2',
      ebitda: planData.anno2.margineEbitda,
      ebit: planData.anno2.margineEbit,
      netto: planData.anno2.margineNetto
    },
    {
      anno: 'Anno 3',
      ebitda: planData.anno3.margineEbitda,
      ebit: planData.anno3.margineEbit,
      netto: planData.anno3.margineNetto
    }
  ];

  const sensitivitaData = [
    {
      scenario: '-10%',
      ricavi: planData.sensibilita.ricavi_minus10.ricavi,
      ebitda: planData.sensibilita.ricavi_minus10.ebitda,
      margine: planData.sensibilita.ricavi_minus10.margine_ebitda
    },
    {
      scenario: 'Base',
      ricavi: planData.sensibilita.ricavi_baseline.ricavi,
      ebitda: planData.sensibilita.ricavi_baseline.ebitda,
      margine: planData.sensibilita.ricavi_baseline.margine_ebitda
    },
    {
      scenario: '+10%',
      ricavi: planData.sensibilita.ricavi_plus10.ricavi,
      ebitda: planData.sensibilita.ricavi_plus10.ebitda,
      margine: planData.sensibilita.ricavi_plus10.margine_ebitda
    }
  ];

  const kpiRadarData = [
    { metric: 'CAGR', value: Math.min(planData.kpi.cagr_ricavi / 2, 100) }, // Normalizzato
    { metric: 'EBITDA Margin', value: planData.kpi.margine_ebitda_medio },
    { metric: 'Interest Cov.', value: Math.min(planData.kpi.interest_coverage_y3 * 10, 100) },
    { metric: 'ROE', value: Math.min(planData.kpi.roe_y3, 100) },
    { metric: 'ROI', value: Math.min(planData.kpi.roi_y3, 100) }
  ];

  // ============================================
  // UTILITY FORMATTING
  // ============================================

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '—';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    if (!value && value !== 0) return '—';
    return `${value.toFixed(2)}%`;
  };

  const getAssessmentColor = (assessment) => {
    switch (assessment) {
      case 'SOSTENIBILE': return 'bg-green-50 border-green-200 text-green-900';
      case 'MONITORARE': return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'CRITICO': return 'bg-red-50 border-red-200 text-red-900';
      default: return 'bg-slate-50 border-slate-200 text-slate-900';
    }
  };

  const getAssessmentBadge = (assessment) => {
    switch (assessment) {
      case 'SOSTENIBILE': return 'bg-green-100 text-green-800';
      case 'MONITORARE': return 'bg-yellow-100 text-yellow-800';
      case 'CRITICO': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/piano-economico/${sessionId}/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planData })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Piano-Economico-${sessionId}.pdf`;
        a.click();
      }
    } catch (error) {
      console.error('Errore export PDF:', error);
      alert('Errore durante l\'esportazione PDF');
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/piano-economico/${sessionId}/export-xlsx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planData })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Piano-Economico-${sessionId}.xlsx`;
        a.click();
      }
    } catch (error) {
      console.error('Errore export Excel:', error);
      alert('Errore durante l\'esportazione Excel');
    } finally {
      setExporting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Piano Economico Triennale</h1>
              <p className="text-slate-600">Analisi finanziaria dettagliata e proiezioni strategiche</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <Home size={18} />
              <span>Dashboard</span>
            </button>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3">
            <button
              onClick={exportToPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              <FileText size={18} />
              <span>{exporting ? 'Esportazione...' : 'Scarica PDF'}</span>
            </button>
            <button
              onClick={exportToExcel}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              <Download size={18} />
              <span>{exporting ? 'Esportazione...' : 'Scarica Excel'}</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Share2 size={18} />
              <span>Condividi</span>
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 bg-white rounded-t-lg px-6">
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'dettagli', label: '📋 Dettagli' },
            { id: 'kpi', label: '🎯 KPI' },
            { id: 'sensibilita', label: '📉 Sensibilità' },
            { id: 'narrative', label: '📄 Relazione' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-b-lg shadow-lg p-8">
          {/* ============================================ */}
          {/* TAB: OVERVIEW */}
          {/* ============================================ */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                  <p className="text-sm text-blue-900 font-medium mb-2">CAGR Ricavi (3Y)</p>
                  <p className="text-3xl font-bold text-blue-900">{formatPercent(planData.kpi.cagr_ricavi)}</p>
                  <p className="text-xs text-blue-700 mt-2">Tasso annuale composto</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-6">
                  <p className="text-sm text-emerald-900 font-medium mb-2">EBITDA Margin (media)</p>
                  <p className="text-3xl font-bold text-emerald-900">{formatPercent(planData.kpi.margine_ebitda_medio)}</p>
                  <p className="text-xs text-emerald-700 mt-2">Margine operativo medio</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                  <p className="text-sm text-purple-900 font-medium mb-2">Leverage Y3</p>
                  <p className="text-3xl font-bold text-purple-900">{planData.kpi.leverage_y3.toFixed(2)}x</p>
                  <p className="text-xs text-purple-700 mt-2">D/EBITDA anno 3</p>
                </div>
                <div className={`rounded-lg p-6 border ${getAssessmentColor(planData.kpi.breakeven_assessment)}`}>
                  <p className="text-sm font-medium mb-2">Valutazione</p>
                  <p className={`text-3xl font-bold ${
                    planData.kpi.breakeven_assessment === 'SOSTENIBILE' ? 'text-green-900' :
                    planData.kpi.breakeven_assessment === 'MONITORARE' ? 'text-yellow-900' :
                    'text-red-900'
                  }`}>
                    {planData.kpi.breakeven_assessment}
                  </p>
                  <p className="text-xs mt-2 opacity-75">Assessment complessivo</p>
                </div>
              </div>

              {/* Time Series Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ricavi e Utile */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Ricavi e Utile Netto</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="anno" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="ricavi" stroke="#3b82f6" strokeWidth={2} name="Ricavi" />
                      <Line type="monotone" dataKey="utile" stroke="#10b981" strokeWidth={2} name="Utile Netto" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* EBITDA Trend */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Evoluzione EBITDA</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="anno" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Bar dataKey="ebitda" fill="#8b5cf6" name="EBITDA" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="ebit" fill="#f59e0b" name="EBIT" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Margini % */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Evoluzione Margini %</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={marginiData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="anno" stroke="#64748b" />
                    <YAxis stroke="#64748b" label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      formatter={(value) => `${value.toFixed(2)}%`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="ebitda" stroke="#8b5cf6" strokeWidth={2} name="EBITDA %" />
                    <Line type="monotone" dataKey="ebit" stroke="#f59e0b" strokeWidth={2} name="EBIT %" />
                    <Line type="monotone" dataKey="netto" stroke="#10b981" strokeWidth={2} name="Utile Netto %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* TAB: DETTAGLI */}
          {/* ============================================ */}
          {activeTab === 'dettagli' && (
            <div className="space-y-8">
              {/* Anno 0 */}
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">Anno 0 (Storico)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-slate-900 font-semibold">Voce</th>
                        <th className="px-4 py-3 text-right text-slate-900 font-semibold">Importo €</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Ricavi', value: planData.anno0.ricavi },
                        { label: 'Costi Personale', value: -planData.anno0.costiPersonale },
                        { label: 'Materie Prime', value: -planData.anno0.materiePrime },
                        { label: 'Servizi', value: -planData.anno0.servizi },
                        { label: 'Godimento Beni', value: -planData.anno0.godimento },
                        { label: 'Oneri Diversi', value: -planData.anno0.oneriDiversi },
                        { label: 'EBITDA', value: planData.anno0.ebitda, highlight: true },
                        { label: 'Ammortamenti', value: -planData.anno0.ammortamenti },
                        { label: 'EBIT', value: planData.anno0.ebit, highlight: true },
                        { label: 'Oneri Finanziari', value: -planData.anno0.oneriFinanziari },
                        { label: 'Utile Netto', value: planData.anno0.utileNetto || 0, highlight: true }
                      ].map((row, idx) => (
                        <tr key={idx} className={`border-b border-slate-100 ${row.highlight ? 'bg-blue-50 font-semibold' : ''}`}>
                          <td className="px-4 py-3 text-slate-900">{row.label}</td>
                          <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Anni 1-3 */}
              {['anno1', 'anno2', 'anno3'].map((anno, idx) => {
                const data = planData[anno];
                return (
                  <div key={anno}>
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Anno {idx + 1}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="px-4 py-3 text-left text-slate-900 font-semibold">Voce</th>
                            <th className="px-4 py-3 text-right text-slate-900 font-semibold">Importo €</th>
                            <th className="px-4 py-3 text-right text-slate-900 font-semibold">Margine %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'Ricavi', value: data.ricavi },
                            { label: 'Costi Personale', value: -data.costiPersonale },
                            { label: 'Materie Prime', value: -data.materiePrime },
                            { label: 'Servizi', value: -data.servizi },
                            { label: 'Godimento Beni', value: -data.godimento },
                            { label: 'Oneri Diversi', value: -data.oneriDiversi },
                            { label: 'EBITDA', value: data.ebitda, margin: data.margineEbitda, highlight: true },
                            { label: 'Ammortamenti', value: -data.ammortamenti },
                            { label: 'EBIT', value: data.ebit, margin: data.margineEbit, highlight: true },
                            { label: 'Oneri Finanziari', value: -data.oneriFinanziari },
                            { label: 'Utile Netto', value: data.utileNetto, margin: data.margineNetto, highlight: true }
                          ].map((row, idx) => (
                            <tr key={idx} className={`border-b border-slate-100 ${row.highlight ? 'bg-blue-50 font-semibold' : ''}`}>
                              <td className="px-4 py-3 text-slate-900">{row.label}</td>
                              <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(row.value)}</td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {row.margin !== undefined ? formatPercent(row.margin) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================ */}
          {/* TAB: KPI */}
          {/* ============================================ */}
          {activeTab === 'kpi' && (
            <div className="space-y-8">
              {/* Radar Chart */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Profilo KPI Normalizzato</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={kpiRadarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" stroke="#64748b" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#94a3b8" />
                    <Radar name="Performance" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* KPI Detailed Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                  <h4 className="font-semibold text-slate-900 mb-4">Metriche di Crescita</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-600">CAGR Ricavi (3 anni)</p>
                      <p className="text-2xl font-bold text-blue-600">{formatPercent(planData.kpi.cagr_ricavi)}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-sm text-slate-600">Margine EBITDA medio</p>
                      <p className="text-2xl font-bold text-emerald-600">{formatPercent(planData.kpi.margine_ebitda_medio)}</p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                  <h4 className="font-semibold text-slate-900 mb-4">Metriche di Solidità</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-600">Leverage (D/EBITDA) Y3</p>
                      <p className="text-2xl font-bold text-purple-600">{planData.kpi.leverage_y3.toFixed(2)}x</p>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-sm text-slate-600">Interest Coverage Y3</p>
                      <p className="text-2xl font-bold text-orange-600">{planData.kpi.interest_coverage_y3.toFixed(2)}x</p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                  <h4 className="font-semibold text-slate-900 mb-4">Metriche di Redditività</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-600">ROE Y3</p>
                      <p className="text-2xl font-bold text-indigo-600">{formatPercent(planData.kpi.roe_y3)}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-sm text-slate-600">ROI Y3</p>
                      <p className="text-2xl font-bold text-cyan-600">{formatPercent(planData.kpi.roi_y3)}</p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-lg p-6 border ${getAssessmentColor(planData.kpi.breakeven_assessment)}`}>
                  <h4 className="font-semibold mb-4">Valutazione Complessiva</h4>
                  <div>
                    <p className={`text-3xl font-bold mb-2 ${
                      planData.kpi.breakeven_assessment === 'SOSTENIBILE' ? 'text-green-700' :
                      planData.kpi.breakeven_assessment === 'MONITORARE' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {planData.kpi.breakeven_assessment}
                    </p>
                    <p className="text-sm opacity-80">
                      {planData.kpi.breakeven_assessment === 'SOSTENIBILE' 
                        ? 'Piano finanziariamente equilibrato'
                        : planData.kpi.breakeven_assessment === 'MONITORARE'
                        ? 'Monitoraggio trimestrale consigliato'
                        : 'Revisione urgente necessaria'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* TAB: SENSIBILITÀ */}
          {/* ============================================ */}
          {activeTab === 'sensibilita' && (
            <div className="space-y-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  <strong>Analisi di Sensibilità:</strong> Variazioni percentuali applicate ai ricavi dell'anno 3. Misura l'impatto su EBITDA e margini in scenari di downside/upside del 10%.
                </p>
              </div>

              {/* Sensibilità Chart */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Impatto su Ricavi e EBITDA (Anno 3)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sensitivitaData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="scenario" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="ricavi" fill="#3b82f6" name="Ricavi" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="ebitda" fill="#8b5cf6" name="EBITDA" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sensibilità Table */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Scenario Dettagliato</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-slate-900 font-semibold">Scenario</th>
                        <th className="px-4 py-3 text-right text-slate-900 font-semibold">Ricavi Y3</th>
                        <th className="px-4 py-3 text-right text-slate-900 font-semibold">EBITDA Y3</th>
                        <th className="px-4 py-3 text-right text-slate-900 font-semibold">Margine EBITDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { scenario: 'Downside (-10%)', data: planData.sensibilita.ricavi_minus10, className: 'bg-red-50' },
                        { scenario: 'Base', data: planData.sensibilita.ricavi_baseline, className: 'bg-slate-50 font-semibold' },
                        { scenario: 'Upside (+10%)', data: planData.sensibilita.ricavi_plus10, className: 'bg-green-50' }
                      ].map((row, idx) => (
                        <tr key={idx} className={`border-b border-slate-100 ${row.className}`}>
                          <td className="px-4 py-3 text-slate-900">{row.scenario}</td>
                          <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(row.data.ricavi)}</td>
                          <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(row.data.ebitda)}</td>
                          <td className="px-4 py-3 text-right text-slate-900">{formatPercent(row.data.margine_ebitda)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* TAB: NARRATIVE */}
          {/* ============================================ */}
          {activeTab === 'narrative' && (
            <div className="space-y-6">
              <div className="prose prose-sm max-w-none">
                <pre className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-sm text-slate-800 whitespace-pre-wrap font-sans overflow-x-auto">
                  {planData.narrative}
                </pre>
              </div>

              {/* Assumptions Box */}
              <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-6">
                <h4 className="font-semibold text-yellow-900 mb-3">Assunzioni del Piano</h4>
                <ul className="text-sm text-yellow-900 space-y-2 list-disc list-inside">
                  <li>Tasso di crescita annuo: <strong>{planData.growth_rate_applied}%</strong></li>
                  <li>Inflazione personale: 2% annuo</li>
                  <li>Imposte (IRES + IRAP): 27,9%</li>
                  <li>Ammortamenti: costanti (no capex aggiuntivo)</li>
                  <li>Oneri finanziari: stabili (no nuovo debito)</li>
                  <li>Margini di costo: stabili in % sui ricavi</li>
                </ul>
              </div>

              {/* Risk Factors */}
              <div className="border border-red-200 bg-red-50 rounded-lg p-6">
                <h4 className="font-semibold text-red-900 mb-3">⚠️ Fattori di Rischio</h4>
                <ul className="text-sm text-red-900 space-y-2 list-disc list-inside">
                  <li>Variabilità della domanda di mercato</li>
                  <li>Volatilità prezzi materie prime</li>
                  <li>Efficienza operativa mantenuta</li>
                  <li>Stabililità condizioni macroeconomiche</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-600 text-sm">
          <p>Piano generato il {new Date().toLocaleDateString('it-IT')} | Session ID: {sessionId}</p>
        </div>
      </div>
    </div>
  );
}
