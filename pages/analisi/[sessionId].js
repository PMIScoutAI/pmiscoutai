// /pages/analisi/[sessionId].js
// VERSIONE 12.2: Logica di autenticazione con Token
// - FIX: Replicata la logica di sicurezza del widget funzionante (checkup-hd.js).
// - Il token di Outseta viene ora ricevuto e usato per autenticare la sessione Supabase.
// - Questo risolve l'errore "Impossibile recuperare lo stato dell'analisi" dovuto a permessi mancanti.

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { ProtectedPage } from '../../utils/ProtectedPage';

// --- Componente Wrapper (Punto di ingresso) ---
export default function AnalisiReportPageWrapper() {
  return (
    <>
      <Head>
        <title>Report Analisi AI - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/recharts/umd/Recharts.min.js"></script>
        <style>{` body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; } `}</style>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">{`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}</Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      {/* ✅ CORREZIONE: Assicurati che il tuo ProtectedPage fornisca sia user che token */}
      <ProtectedPage>
        {(user, token) => <ReportPageLayout user={user} token={token} />}
      </ProtectedPage>
    </>
  );
}

// --- Icone ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  print: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  award: <><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 22 12 17 17 22 15.79 13.88"></polyline></>,
  dollarSign: <><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>,
  thumbsUp: <><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a2 2 0 0 1 3 1.88z" /></>,
  thumbsDown: <><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a2 2 0 0 1-3-1.88z" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  lightbulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 0 0-7-7z" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></>,
};

// --- Layout della Pagina ---
function ReportPageLayout({ user, token }) { // Riceve il token
  // ... (Il tuo codice del layout con la sidebar rimane invariato)
  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
      {/* ... Sidebar ... */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <AnalisiReportPage user={user} token={token} /> {/* Passa il token */}
      </div>
    </div>
  );
}

// --- Componente Principale della Pagina di Analisi ---
function AnalisiReportPage({ user, token }) { // Riceve il token
  const router = useRouter();
  const { sessionId } = router.query;
  const [analysisData, setAnalysisData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    if (!sessionId || !user) return;

    const fetchFinalData = async () => {
      // ... (logica di fetch invariata)
    };

    let channel;
    const checkInitialStatusAndSubscribe = async () => {
      try {
        // ✅ CORREZIONE DI SICUREZZA: Autentica la sessione prima di qualsiasi operazione
        if (!token) throw new Error("Token di autenticazione non trovato.");
        await supabase.auth.setSession({ access_token: token });

        // 1. Controlla lo stato iniziale (ora con utente autenticato)
        const { data: initialSession, error: initialError } = await supabase
          .from('checkup_sessions')
          .select('status, error_message, session_name')
          .eq('id', sessionId)
          .single();

        if (initialError) throw initialError;
        
        setSessionData(initialSession);
        const initialStatus = initialSession.status;

        // 2. Se è già completato o fallito, agisci subito
        if (initialStatus === 'completed') {
          setStatus('completed');
          fetchFinalData();
          return;
        }
        if (initialStatus === 'failed') {
          setStatus('failed');
          setError(initialSession.error_message || 'Si è verificato un errore.');
          return;
        }

        // 3. Altrimenti, iscriviti per aggiornamenti futuri
        setStatus(initialStatus);
        channel = supabase
          .channel(`session-updates:${sessionId}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkup_sessions', filter: `id=eq.${sessionId}`},
            (payload) => {
              // ... (logica di gestione aggiornamenti invariata)
            }
          ).subscribe();
      } catch (err) {
        console.error("Errore durante il recupero dello stato o l'autenticazione:", err);
        setError(err.message || "Impossibile recuperare lo stato dell'analisi.");
        setStatus('failed');
      }
    };

    checkInitialStatusAndSubscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId, user, token]); // Aggiunto token alle dipendenze

  const renderContent = () => {
    // ... (logica di rendering invariata)
  };

  return (
    <main className="relative flex-1 overflow-y-auto focus:outline-none">
      <div className="py-8 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </div>
    </main>
  );
}

// --- (Tutti gli altri componenti UI rimangono invariati) ---
// ...
