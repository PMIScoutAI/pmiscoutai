// /pages/analisi-hd/[sessionId].js
// Pagina dinamica per visualizzare lo stato e i risultati dell'analisi.
// Utilizza getServerSideProps per essere generata sul server ad ogni richiesta.

import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

// --- Componenti UI (Icone, etc.) ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></>,
  check: <><polyline points="20 6 9 17 4 12"></polyline></>,
  clock: <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></>,
};

// --- Componente Principale della Pagina ---
export default function AnalisiHdPage({ sessionData, error }) {
  const router = useRouter();

  // Questa funzione fa sì che la pagina si aggiorni automaticamente ogni 5 secondi
  // se l'analisi è ancora in corso, per mostrare i risultati appena sono pronti.
  useEffect(() => {
    if (sessionData && (sessionData.status === 'indexing' || sessionData.status === 'processing')) {
      const interval = setInterval(() => {
        router.replace(router.asPath); // Ricarica i dati chiamando di nuovo getServerSideProps
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionData, router]);

  // Gestione degli errori
  if (error) {
    return <StatusDisplay icon={icons.alert} title="Errore" message={error} color="red" />;
  }

  // Visualizzazione in base allo stato
  switch (sessionData.status) {
    case 'indexing':
    case 'processing':
      return <StatusDisplay icon={icons.clock} title="Analisi in corso..." message="Il tuo documento è in fase di analisi. La pagina si aggiornerà automaticamente non appena i risultati saranno pronti." color="blue" />;
    case 'completed':
      return <ResultsDisplay session={sessionData} />;
    case 'failed':
      return <StatusDisplay icon={icons.alert} title="Analisi Fallita" message={sessionData.error_message || "Si è verificato un errore sconosciuto."} color="red" />;
    default:
      return <StatusDisplay icon={icons.alert} title="Stato Sconosciuto" message="Lo stato della sessione di analisi non è riconoscibile." color="yellow" />;
  }
}

// --- Componenti di Visualizzazione ---
const StatusDisplay = ({ icon, title, message, color }) => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
      <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-${color}-100`}>
        <Icon path={icon} className={`h-6 w-6 text-${color}-600`} />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-slate-800">{title}</h2>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link href="/checkup-hd">
        <a className="mt-6 inline-block px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
          Torna indietro
        </a>
      </Link>
    </div>
  </div>
);

const ResultsDisplay = ({ session }) => {
  // Qui visualizzerai i risultati finali dell'analisi.
  // Per ora, mostriamo un messaggio di successo e i dati grezzi.
  return (
    <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-md">
                <div className="flex items-center text-green-600">
                    <Icon path={icons.check} className="w-8 h-8 mr-3" />
                    <h1 className="text-3xl font-bold text-slate-900">Analisi Completata</h1>
                </div>
                <p className="mt-2 text-slate-600">Ecco i dati estratti dal tuo documento per la sessione: {session.id}</p>
                
                <div className="mt-6 bg-slate-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-slate-800">Dati Numerici Estratti:</h3>
                    <pre className="mt-2 text-sm text-slate-700 whitespace-pre-wrap break-all">
                        {JSON.stringify(session.raw_parsed_data, null, 2)}
                    </pre>
                </div>
                 <Link href="/checkup-hd">
                    <a className="mt-6 inline-block px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
                    Esegui un'altra analisi
                    </a>
                </Link>
            </div>
        </div>
    </div>
  );
};


// --- FUNZIONE SERVER-SIDE ---
// Questa funzione viene eseguita sul server di Vercel AD OGNI RICHIESTA della pagina.
// Risolve il problema del build perché la pagina non viene più generata in anticipo.
export async function getServerSideProps(context) {
  const { sessionId } = context.params;

  // Inizializza il client Supabase con la chiave di servizio (sicuro perché eseguito solo sul server)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Recupera i dati della sessione E i risultati dell'analisi (se esistono)
    const { data: sessionData, error } = await supabase
      .from('checkup_sessions_hd')
      .select(`
        *,
        analysis_results_hd ( raw_parsed_data )
      `)
      .eq('id', sessionId)
      .single();

    if (error) {
      throw new Error(`Sessione non trovata o errore nel database: ${error.message}`);
    }
    
    // Semplifichiamo l'oggetto dei risultati per passarlo come prop
    const finalData = {
        ...sessionData,
        raw_parsed_data: sessionData.analysis_results_hd[0]?.raw_parsed_data || null
    };
    delete finalData.analysis_results_hd;

    return {
      props: {
        sessionData: finalData,
      },
    };

  } catch (error) {
    console.error("Errore in getServerSideProps:", error.message);
    return {
      props: {
        error: error.message,
      },
    };
  }
}
