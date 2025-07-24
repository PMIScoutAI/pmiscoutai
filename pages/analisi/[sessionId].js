// /pages/analisi/[sessionId].js
// Versione con import corretti e protetta da login

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
// --- MODIFICA QUI ---
import { ProtectedPage } from '../../utils/ProtectedPage';
// --- FINE MODIFICA ---

// Le icone e gli altri componenti helper rimangono uguali...
const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {path}
    </svg>
);
const icons = { /* ... le tue icone ... */ };


export default function AnalisiReportPageWrapper() {
    // Usiamo il wrapper per poter passare l'utente alla pagina vera e propria
    return (
        <ProtectedPage>
            {(user) => <AnalisiReportPage user={user} />}
        </ProtectedPage>
    );
}


function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;
  
  // Stati
  const [isLoading, setIsLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);
  
  const channelRef = useRef(null);

  // ... il resto della tua logica per fetchSessionData, setupRealtime, etc. ...
  // Assicurati che funzioni correttamente con l'oggetto 'user' che ricevi.
  
  useEffect(() => {
    // La logica di autenticazione ora è gestita da ProtectedPage,
    // quindi possiamo semplificare questo effetto.
    const fetchAndSubscribe = async () => {
        if (!sessionId) return;
        
        setIsLoading(true);
        try {
            const { data: sessionResult, error: sessionError } = await supabase
                .from('checkup_sessions')
                .select('*, companies (*)')
                .eq('id', sessionId)
                .single();

            if (sessionError) throw new Error('Sessione non trovata o accesso negato.');
            
            // Potresti aggiungere un controllo per assicurarti che l'utente loggato
            // sia il proprietario della sessione.
            if (sessionResult.user_id !== user.id) {
                throw new Error("Non sei autorizzato a visualizzare questa analisi.");
            }

            setSessionData(sessionResult);

            if (sessionResult.status === 'completed') {
                const { data: analysisResult, error: analysisError } = await supabase
                    .from('analysis_results')
                    .select('*')
                    .eq('session_id', sessionId)
                    .single();
                
                if (analysisError) throw new Error('Risultati analisi non trovati.');
                setAnalysisData(analysisResult);

            } else {
                // Setup realtime listener
                if (channelRef.current) supabase.removeChannel(channelRef.current);
                const channel = supabase
                    .channel(`session_${sessionId}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'checkup_sessions', filter: `id=eq.${sessionId}` }, fetchAndSubscribe)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'analysis_results', filter: `session_id=eq.${sessionId}` }, fetchAndSubscribe)
                    .subscribe();
                channelRef.current = channel;
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchAndSubscribe();

    return () => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }
    };
  }, [sessionId, user.id]);


  // ... il resto del tuo JSX per visualizzare il report ...
  if (isLoading) return <div>Caricamento report...</div>;
  if (error) return <div>Errore: {error}</div>;
  if (!sessionData) return <div>Nessun dato trovato per questa sessione.</div>;

  return (
    <div>
        <h1>Report per {sessionData.companies.company_name}</h1>
        {analysisData ? (
            <div>
                <h2>Analisi Completata</h2>
                <p>Health Score: {analysisData.health_score}</p>
                {/* Visualizza gli altri dati dell'analisi */}
            </div>
        ) : (
            <div>
                <h2>Analisi in corso...</h2>
                <p>Lo stato attuale è: {sessionData.status}</p>
            </div>
        )}
    </div>
  );
}
