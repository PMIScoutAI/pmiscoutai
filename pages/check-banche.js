import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// NOTA: L'hook useAuth non è utilizzato, si usa il pattern diretto con window.Outseta
// import { useAuth } from '../hooks/useAuth'; 

export default function CheckBanche() {
  const [userEmail, setUserEmail] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [bankingScore, setBankingScore] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScoreLoading, setIsScoreLoading] = useState(false); // Stato per il caricamento dello score

  // Pattern autenticazione (riutilizza da dashboard principale)
  useEffect(() => {
    // Funzione per gestire il recupero dell'utente
    const handleAuth = () => {
      window.Outseta.getUser()
        .then(user => {
          if (user && user.Email) {
            setUserEmail(user.Email);
            fetchAnalyses(user.Email); // Avvia il caricamento dati
          } else {
            // Se non c'è utente, smetti di caricare
            setIsLoading(false);
          }
        })
        .catch(err => {
            console.error("Errore recupero utente Outseta:", err);
            setIsLoading(false); // Sblocca il caricamento in caso di errore
        });
    };

    // Attendi che Outseta sia disponibile
    if (typeof window !== 'undefined' && window.Outseta) {
      handleAuth();
    } else {
      // Fallback per evitare che rimanga in caricamento infinito
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && window.Outseta) {
          handleAuth();
        } else {
          console.error("Outseta non è stato caricato in tempo.");
          setIsLoading(false);
        }
      }, 2000); // Attendi 2 secondi
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchAnalyses = async (email) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/banking-analysis?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Risposta non valida dal server');
      const data = await response.json();
      setAnalyses(data.analyses || []);
      if (data.analyses && data.analyses.length > 0) {
        // Seleziona e attendi il caricamento dello score per l'analisi più recente
        await handleAnalysisSelect(data.analyses[0], email);
      }
    } catch (error) {
      console.error('Errore caricamento analisi:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisSelect = async (analysis, email) => {
    setSelectedAnalysis(analysis);
    setBankingScore(null); // Resetta lo score precedente
    setIsScoreLoading(true); // Attiva il caricamento dello score
    
    // Usa l'email passata come parametro per evitare lo stato non aggiornato
    const emailToUse = email || userEmail;
    
    try {
      const response = await fetch(
        `/api/banking-analysis?email=${encodeURIComponent(emailToUse)}&session_id=${analysis.session_id}`
      );
      if (!response.ok) throw new Error('Risposta non valida dal server per lo score');
      const data = await response.json();
      setBankingScore(data.banking_score);
    } catch (error) {
      console.error('Errore caricamento score:', error);
    } finally {
      setIsScoreLoading(false); // Disattiva il caricamento dello score
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
                            Fatturato: €{analysis.fatturato?.toLocaleString('it-IT') || 'N/D'}
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
                          {selectedAnalysis.patrimonio_netto > 0 ? ((selectedAnalysis.debiti_totali / selectedAnalysis.patrimonio_netto)).toFixed(2) : 'N/D'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Capacità di Credito */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Capacità di Credito</h3>
                    {isScoreLoading ? (
                       <div className="space-y-3">
                         <div>
                           <span className="text-sm text-slate-600">DSCR</span>
                           <div className="h-7 bg-gray-200 rounded animate-pulse w-1/2"></div>
                         </div>
                         <div>
                           <span className="text-sm text-slate-600">Classe MCC</span>
                           <div className="h-7 bg-gray-200 rounded animate-pulse w-1/4"></div>
                         </div>
                       </div>
                    ) : bankingScore ? (
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
                      <p className="text-sm text-slate-500">Dati non disponibili.</p>
                    )}
                  </div>

                  {/* Card Punti di Forza */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Punti di Forza</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">✓ Health Score: {selectedAnalysis.health_score}/100</p>
                      <p className="text-sm text-green-600">✓ Settore: {selectedAnalysis.ateco_code}</p>
                      {selectedAnalysis.current_ratio > 1.5
