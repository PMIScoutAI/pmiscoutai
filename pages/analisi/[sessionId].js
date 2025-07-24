// /pages/analisi/[sessionId].js
// Versione corretta applicando le best practice di Next.js e React

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script'; // Importare next/script
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { ProtectedPage } from '../../utils/ProtectedPage';

// --- Icone e componenti helper (con migliorie di accessibilità) ---
const Icon = ({ children, className = '' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`w-6 h-6 ${className}`}
        aria-hidden="true"
    >
        {children}
    </svg>
);

const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    spark: <><path d="M12 3v6l4-4-4-4" /><path d="M12 21v-6l-4 4 4 4" /><path d="M3 12h6l-4-4 4-4" /><path d="M21 12h-6l4 4-4 4" /></>,
    warning: <><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
};

// --- Componente Wrapper ---
export default function AnalisiReportPageWrapper() {
    return (
        <>
            <Head>
                <title>Report Analisi - PMIScout</title>
            </Head>

            {/* Uso di next/script per caricare script di terze parti in modo sicuro */}
            <Script id="outseta-options" strategy="beforeInteractive">
                {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };`}
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

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sessionData, setSessionData] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [error, setError] = useState(null);
    const [isLoadingPage, setIsLoadingPage] = useState(true);

    const channelRef = useRef(null);

    useEffect(() => {
        const fetchAndSubscribe = async () => {
            if (!sessionId || !user.id) return;

            // Non resettare lo stato se stiamo solo ri-validando
            if (isLoadingPage) setError(null);

            try {
                const { data: sessionResult, error: sessionError } = await supabase
                    .from('checkup_sessions')
                    .select('*, companies (*)')
                    .eq('id', sessionId)
                    .single();

                if (sessionError) throw new Error('Sessione non trovata o accesso negato.');
                if (sessionResult.user_id !== user.id) throw new Error("Non sei autorizzato a visualizzare questa analisi.");

                setSessionData(sessionResult);

                if (sessionResult.status === 'completed') {
                    const { data: analysisResult, error: analysisError } = await supabase
                        .from('analysis_results').select('*').eq('session_id', sessionId).single();
                    if (analysisError) throw new Error('Risultati analisi non trovati.');
                    setAnalysisData(analysisResult);
                    // Una volta completato, non serve più il listener
                    if (channelRef.current) {
                        supabase.removeChannel(channelRef.current);
                        channelRef.current = null;
                    }
                } else if (sessionResult.status === 'failed') {
                    setError(sessionResult.error_message || 'L\'analisi è fallita.');
                    if (channelRef.current) {
                        supabase.removeChannel(channelRef.current);
                        channelRef.current = null;
                    }
                } else if (!channelRef.current) {
                    // Setup realtime listener solo se non è già attivo
                    const channel = supabase
                        .channel(`session_${sessionId}`)
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'checkup_sessions', filter: `id=eq.${sessionId}` }, (payload) => {
                            console.log('Change received!', payload);
                            fetchAndSubscribe(); // Riesegue il fetch per aggiornare i dati
                        })
                        .subscribe();
                    channelRef.current = channel;
                }
            } catch (err) {
                console.error("Errore durante il fetch dei dati della sessione:", err);
                setError(err.message);
            } finally {
                setIsLoadingPage(false);
            }
        };

        fetchAndSubscribe();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [sessionId, user.id]); // Dipendenze corrette

    const getHealthScoreColor = (score) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        if (score >= 40) return 'text-orange-600';
        return 'text-red-600';
    };

    const renderContent = () => {
        if (isLoadingPage) {
            return (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <h3 className="text-2xl font-bold text-slate-800">Caricamento report...</h3>
                </div>
            );
        }

        if (error) {
            return (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-lg">
                    <div className="flex">
                        <Icon className="w-8 h-8 text-red-500 mr-4">{icons.warning}</Icon>
                        <div>
                            <p className="font-bold text-xl mb-2">Errore</p>
                            <p>{error}</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (!sessionData) {
            return <div className="text-center py-20">Nessun dato trovato per questa sessione.</div>;
        }

        if (!analysisData && sessionData.status !== 'completed') {
            return (
                <div className="text-center py-20 bg-white rounded-xl shadow-sm border p-8">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-6"></div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Analisi in corso...</h3>
                    <p className="text-slate-600 mb-4">L'IA sta elaborando il tuo documento. La pagina si aggiornerà automaticamente.</p>
                    <p className="text-sm text-slate-500">Stato: {sessionData.status}</p>
                </div>
            );
        }

        const company = sessionData.companies;
        const healthScore = analysisData?.health_score || 0;

        return (
            <div className="space-y-8">
                <div className="bg-white p-8 rounded-xl shadow-sm border">
                    <div className="flex flex-col lg:flex-row justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-3">{company?.company_name || 'Azienda'}</h2>
                            <p className="text-slate-600">{company?.industry_sector}</p>
                        </div>
                        <div className="text-center mt-6 lg:mt-0">
                            <p className="text-sm font-medium text-slate-600 mb-2">Health Score</p>
                            <div className={`text-6xl font-bold ${getHealthScoreColor(healthScore)}`}>
                                {healthScore}<span className="text-2xl text-slate-400">/100</span>
                            </div>
                        </div>
                    </div>
                    {analysisData?.summary && (
                        <div className="mt-6 bg-slate-50 rounded-lg p-4">
                            <h4 className="font-semibold text-slate-900 mb-2">Sintesi Esecutiva</h4>
                            <p className="text-slate-700">{analysisData.summary}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
            {/* Sidebar */}
            <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* ... Contenuto Sidebar ... */}
            </aside>

            {/* Main content */}
            <div className="flex flex-col flex-1 w-0 overflow-hidden">
                <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
                        <Icon>{icons.menu}</Icon>
                    </button>
                    <Link href="/" className="text-xl font-bold text-blue-600">
                        PMIScout
                    </Link>
                    <div className="w-8" />
                </header>

                <main className="relative flex-1 overflow-y-auto focus:outline-none">
                    <div className="py-6 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <Icon>{icons.checkup}</Icon>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900">Report Analisi AI</h1>
                                <p className="text-lg text-slate-600">
                                    {sessionData?.companies?.company_name ? `Analisi per ${sessionData.companies.company_name}` : 'Caricamento...'}
                                </p>
                            </div>
                        </div>
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
}
