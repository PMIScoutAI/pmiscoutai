// /pages/analisi/[sessionId].js
// VERSIONE DEBUG: Aggiunto console.log per identificare il problema

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient'; // Usa la chiave pubblica
import { ProtectedPage } from '../../utils/ProtectedPage';

// --- Componente Wrapper ---
export default function AnalisiReportPageWrapper() {
  return (
    <>
      <Head>
        <title>Report Analisi - PMIScout</title>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script
        id="outseta-script"
        src="https://cdn.outseta.com/outseta.min.js"
        strategy="beforeInteractive"
      />
      <ProtectedPage>
        {(user) => <AnalisiReportPage user={user} />}
      </ProtectedPage>
    </>
  );
}

// --- Componente Principale della Pagina ---
function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;

  const [sessionData, setSessionData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const channelRef = useRef(null);

  useEffect(() => {
    // DEBUG LOGS
    console.log('🔍 Router query:', router.query);
    console.log('🔍 SessionId:', sessionId);
    console.log('🔍 User:', user);

    // Funzione per recuperare i dati della sessione e dei risultati
    const fetchSessionData = async () => {
      console.log('🔍 Controllo pre-fetch:', { sessionId, userId: user?.id });
      
      if (!sessionId || !user.id) {
        console.log('❌ BLOCCO: sessionId o user.id mancante');
        return;
      }

      console.log('✅ Inizio fetch sessione...');

      try {
        // 1. Recupera i dati della sessione
        console.log('📊 Query sessione con ID:', sessionId);
        const { data: session, error: sessionError } = await supabase
          .from('checkup_sessions')
          .select('*, companies(*)')
          .eq('id', sessionId)
          .single();

        console.log('📊 Risultato query sessione:', { session, sessionError });

        if (sessionError) throw new Error('Sessione non trovata o accesso negato.');
        
        // 2. Sicurezza: Controlla che l'utente loggato sia il proprietario della sessione
        console.log('🔒 Controllo sicurezza:', { 
          sessionUserId: session.user_id, 
          currentUserId: user.id,
          match: session.user_id === user.id 
        });

        if (session.user_id !== user.id) {
          throw new Error('Non sei autorizzato a visualizzare questa analisi.');
        }

        console.log('✅ Sessione valida, setting sessionData');
        setSessionData(session);

        // 3. Se l'analisi è completata, recupera anche i risultati
        console.log('📊 Status sessione:', session.status);
        if (session.status === 'completed') {
          console.log('📊 Query analysis_results...');
          const { data: results, error: resultsError } = await supabase
            .from('analysis_results')
            .select('*')
            .eq('session_id', sessionId)
            .single();
          
          console.log('📊 Risultato analysis_results:', { results, resultsError });
          
          if (resultsError) throw new Error('Impossibile caricare i risultati dell\'analisi.');
          
          console.log('✅ Setting analysisData');
          setAnalysisData(results);
          
          // Una volta completato, possiamo rimuovere il listener
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        } else if (session.status === 'failed') {
            setError(session.error_message || 'Si è verificato un errore durante l\'analisi.');
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        }

      } catch (err) {
        console.error('💥 Data fetching error:', err);
        setError(err.message);
      } finally {
        console.log('🏁 Setting isLoading = false');
        setIsLoading(false);
      }
    };

    // Esegui il primo fetch
    fetchSessionData();

    // 4. Setup del listener Realtime solo se la sessione non è già terminata
    if (sessionData?.status !== 'completed' && sessionData?.status !== 'failed') {
        // Assicurati di non creare canali duplicati
        if (!channelRef.current) {
            const channel = supabase
              .channel(`session-updates-${sessionId}`)
              .on(
                'postgres_changes',
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'checkup_sessions',
                  filter: `id=eq.${sessionId}`,
                },
                (payload) => {
                  console.log('Session update received!', payload.new);
                  // Quando riceviamo un aggiornamento, rieseguiamo il fetch dei dati
                  fetchSessionData();
                }
              )
              .subscribe();
            
            channelRef.current = channel;
        }
    }

    // Funzione di cleanup per rimuovere il listener quando il componente viene smontato
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, user.id, sessionData?.status]); // riesegue l'effetto se lo stato cambia

  // DEBUG RENDER STATES
  console.log('🎨 Render states:', { 
    isLoading, 
    error, 
    sessionData: !!sessionData,
    analysisData: !!analysisData,
    sessionStatus: sessionData?.status 
  });

  // --- Render del Contenuto ---
  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center p-10">Caricamento del report...</div>;
    }

    if (error) {
      return <div className="text-center p-10 text-red-600">Errore: {error}</div>;
    }
    
    if (!sessionData) {
        return <div className="text-center p-10">Nessun dato trovato per questa sessione.</div>;
    }

    // Se l'analisi è completata, mostra i risultati
    if (sessionData.status === 'completed' && analysisData) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Report Completato</h2>
          <div className="p-4 bg-slate-100 rounded-lg">
            <h3 className="font-semibold">Health Score</h3>
            <p className="text-4xl font-bold text-blue-600">{analysisData.health_score}/100</p>
          </div>
          <div className="p-4 bg-slate-100 rounded-lg">
            <h3 className="font-semibold">Sintesi</h3>
            <p>{analysisData.summary}</p>
          </div>
          {/* Aggiungi qui la visualizzazione di SWOT, metriche, ecc. */}
        </div>
      );
    }

    // Altrimenti, mostra lo stato di attesa
    return (
      <div className="text-center p-10 bg-white rounded-xl shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-slate-800">Analisi in corso</h2>
        <p className="text-slate-600 mt-2">
          Stiamo analizzando il tuo documento. La pagina si aggiornerà automaticamente non appena i risultati saranno pronti.
        </p>
        <p className="text-sm text-slate-500 mt-4">Stato attuale: <strong>{sessionData?.status || 'sconosciuto'}</strong></p>
      </div>
    );
  };

  return (
    <main className="flex justify-center items-start min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="w-full max-w-4xl">
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Report di Analisi</h1>
            <p className="text-slate-600">Azienda: {sessionData?.companies?.company_name || '...'}</p>
        </div>
        {renderContent()}
      </div>
    </main>
  );
}
