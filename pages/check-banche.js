import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth'; // Se esiste, altrimenti usa pattern da dashboard

export default function CheckBanche() {
  const [userEmail, setUserEmail] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [bankingScore, setBankingScore] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pattern autenticazione (riutilizza da dashboard principale)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Outseta) {
      window.Outseta.getUser()
        .then(user => {
          if (user && user.Email) {
            setUserEmail(user.Email);
            fetchAnalyses(user.Email);
          }
        });
    }
  }, []);

  const fetchAnalyses = async (email) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/banking-analysis?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      setAnalyses(data.analyses || []);
      if (data.analyses && data.analyses.length > 0) {
        // Seleziona automaticamente l'analisi più recente
        handleAnalysisSelect(data.analyses[0]);
      }
    } catch (error) {
      console.error('Errore caricamento analisi:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisSelect = async (analysis) => {
    setSelectedAnalysis(analysis);
    
    // Carica score bancabilità per l'analisi selezionata
    try {
      const response = await fetch(
        `/api/banking-analysis?email=${encodeURIComponent(userEmail)}&session_id=${analysis.session_id}`
      );
      const data = await response.json();
      setBankingScore(data.banking_score);
    } catch (error) {
      console.error('Errore caricamento score:', error);
    }
  };

  return (
    <>
      <Head>
        <title>Check Banche - PMIScout</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header con breadcrumb */}
          <div className="mb-8">
            <Link href="/">
              <a className="text-blue-600 hover:text-blue-800">← Dashboard</a>
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">Check Banche</h1>
            <p className="text-slate-600">Verifica la tua bancabilità e confronta le condizioni di mercato</p>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Caricamento analisi...</p>
            </div>
          ) : analyses.length === 0 ? (
            // Nessuna analisi XBRL disponibile
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Nessuna Analisi Disponibile</h2>
              <p className="text-slate-600 mb-6">Per utilizzare Check Banche, devi prima completare un'analisi XBRL della tua azienda.</p>
              <Link href="/check-ai-xbrl">
                <a className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                  Inizia Analisi XBRL
                </a>
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Selector Analisi */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Seleziona Analisi</h2>
                <div className="space-y-3">
                  {analyses.map((analysis) => (
                    <div
                      key={analysis.session_id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedAnalysis?.session_id === analysis.session_id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => handleAnalysisSelect(analysis)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-slate-900">{analysis.company_name}</h3>
                          <p className="text-sm text-slate-600">
                            Analisi del {new Date(analysis.created_at).toLocaleDateString('it-IT')}
                          </p>
                          <p className="text-sm text-slate-600">
                            Health Score: {analysis.health_score} | Settore: {analysis.ateco_code}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-slate-900">
                            Fatturato: €{analysis.fatturato?.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dashboard Bancabilità */}
              {selectedAnalysis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card Situazione Attuale */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Situazione Attuale</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm text-slate-600">Current Ratio</span>
                        <p className={`text-xl font-bold ${selectedAnalysis.current_ratio < 1.2 ? 'text-red-600' : 'text-green-600'}`}>
                          {selectedAnalysis.current_ratio?.toFixed(2) || 'N/D'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-slate-600">Debiti/Patrimonio</span>
                        <p className="text-xl font-bold text-slate-900">
                          {((selectedAnalysis.debiti_totali / selectedAnalysis.patrimonio_netto) || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Capacità di Credito */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Capacità di Credito</h3>
                    {bankingScore ? (
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-slate-600">DSCR</span>
                          <p className="text-xl font-bold text-blue-600">{bankingScore.dscr_ratio?.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-sm text-slate-600">Classe MCC</span>
                          <p className="text-xl font-bold text-blue-600">{bankingScore.mcc_class}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="animate-pulse">Calcolo in corso...</div>
                    )}
                  </div>

                  {/* Card Punti di Forza */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Punti di Forza</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">✓ Health Score: {selectedAnalysis.health_score}/100</p>
                      <p className="text-sm text-green-600">✓ Settore: {selectedAnalysis.ateco_code}</p>
                      {selectedAnalysis.current_ratio > 1.5 && (
                        <p className="text-sm text-green-600">✓ Buona liquidità</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sezione Contratti */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">I Tuoi Finanziamenti</h2>
                <div className="text-center py-8">
                  <p className="text-slate-600 mb-4">Nessun contratto caricato</p>
                  <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
                    Aggiungi Finanziamento
                  </button>
                </div>
              </div>

              {/* Confronto Tassi */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Tassi di Mercato</h2>
                <div className="text-center py-8 text-slate-600">
                  Sezione in sviluppo - Confronto con benchmark di settore
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
