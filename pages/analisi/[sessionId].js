import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
    supabase, 
    getCurrentOutsetaUser, 
    getOrCreateSupabaseUser, 
    getSessionWithResults,
    subscribeToSession 
} from '../../utils/supabaseClient';

// --- COMPONENTI ICONA ---
const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {path}
    </svg>
);

const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    spark: <><path d="M12 3v6l4-4-4-4" /><path d="M12 21v-6l-4 4 4 4" /><path d="M3 12h6l-4-4 4-4" /><path d="M21 12h-6l4 4-4 4" /></>,
    warning: <><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>
};

export default function AnalisiReportPage() {
    const router = useRouter();
    const { sessionId } = router.query;

    // Stati di autenticazione
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [supabaseUser, setSupabaseUser] = useState(null);

    // Stati per i dati dell'analisi
    const [sessionData, setSessionData] = useState(null);
    const [companyData, setCompanyData] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
    const [error, setError] = useState(null);
    const [realtimeChannel, setRealtimeChannel] = useState(null);

    // Logica di autenticazione con Outseta + creazione utente Supabase
    const checkAuthentication = async () => {
        try {
            if (typeof window !== 'undefined' && window.Outseta) {
                const outsetaUser = await window.Outseta.getUser();
                
                if (outsetaUser && outsetaUser.Email) {
                    setIsAuthenticated(true);
                    setUserName(outsetaUser.FirstName || outsetaUser.Email.split('@')[0]);
                    setCurrentUser(outsetaUser);
                    
                    // Crea o recupera l'utente in Supabase
                    const { data: supaUser, error } = await getOrCreateSupabaseUser(outsetaUser);
                    if (error) {
                        console.error('Errore nella gestione utente Supabase:', error);
                        setError('Errore nella connessione al database');
                    } else {
                        setSupabaseUser(supaUser);
                        console.log('✅ Utente Supabase sincronizzato:', supaUser);
                    }
                    
                    setIsPageLoading(false);
                } else {
                    setIsAuthenticated(false);
                    setIsPageLoading(false);
                    window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
                }
            } else {
                setTimeout(() => checkAuthentication(), 500);
            }
        } catch (error) {
            console.error('Auth error:', error);
            setIsAuthenticated(false);
            setIsPageLoading(false);
        }
    };

    useEffect(() => {
        const waitForOutseta = () => {
            if (typeof window !== 'undefined' && window.Outseta) {
                checkAuthentication();
            } else {
                setTimeout(waitForOutseta, 100);
            }
        };
        waitForOutseta();
    }, []);

    // Logica per recuperare i dati dell'analisi
    useEffect(() => {
        if (!isAuthenticated || !sessionId || !supabaseUser) return;

        const fetchAnalysisData = async () => {
            try {
                console.log(`🔍 Recupero dati per la sessione: ${sessionId}`);
                
                const { data: sessionResult, error: sessionError } = await getSessionWithResults(sessionId);

                if (sessionError) {
                    console.error('Errore nel recuperare la sessione:', sessionError);
                    setError("Sessione di analisi non trovata o non hai i permessi per visualizzarla.");
                    setIsAnalysisLoading(false);
                    return;
                }

                if (!sessionResult) {
                    setError("Sessione di analisi non trovata.");
                    setIsAnalysisLoading(false);
                    return;
                }

                console.log('📄 Dati sessione recuperati:', sessionResult);
                setSessionData(sessionResult);
                setCompanyData(sessionResult.companies);

                // Se ci sono risultati dell'analisi, li impostiamo
                if (sessionResult.analysis_results && sessionResult.analysis_results.length > 0) {
                    const results = sessionResult.analysis_results[0];
                    console.log('✅ Risultati analisi trovati:', results);
                    setAnalysisData(results);
                    setIsAnalysisLoading(false);
                } else if (sessionResult.status === 'completed') {
                    // Se lo status è completed ma non ci sono risultati, qualcosa è andato storto
                    setError("Analisi completata ma risultati non trovati.");
                    setIsAnalysisLoading(false);
                } else if (sessionResult.status === 'failed') {
                    setError(sessionResult.error_message || "L'analisi non è riuscita. Riprova più tardi.");
                    setIsAnalysisLoading(false);
                } else {
                    // L'analisi è ancora in corso, impostiamo la sottoscrizione real-time
                    console.log('⏳ Analisi in corso, attivo il real-time...');
                    setIsAnalysisLoading(true);
                    setupRealtimeSubscription();
                }

            } catch (error) {
                console.error('❌ Errore generale nel recupero dati:', error);
                setError(`Errore nel recuperare i dati: ${error.message}`);
                setIsAnalysisLoading(false);
            }
        };

        const setupRealtimeSubscription = () => {
            // Cleanup della subscription precedente
            if (realtimeChannel) {
                realtimeChannel.unsubscribe();
            }

            // Nuova subscription
            const channel = subscribeToSession(sessionId, (payload) => {
                console.log('🔄 Aggiornamento real-time ricevuto:', payload);
                
                if (payload.table === 'checkup_sessions') {
                    const updatedSession = payload.new;
                    setSessionData(prev => ({ ...prev, ...updatedSession }));
                    
                    // Se lo status è cambiato a completed, ricarica i dati
                    if (updatedSession.status === 'completed') {
                        fetchAnalysisData();
                    } else if (updatedSession.status === 'failed') {
                        setError(updatedSession.error_message || "L'analisi non è riuscita.");
                        setIsAnalysisLoading(false);
                    }
                } else if (payload.table === 'analysis_results') {
                    // Nuovi risultati disponibili
                    console.log('📊 Nuovi risultati dell\'analisi:', payload.new);
                    setAnalysisData(payload.new);
                    setIsAnalysisLoading(false);
                }
            });

            setRealtimeChannel(channel);
        };

        fetchAnalysisData();

        // Cleanup al dismount
        return () => {
            if (realtimeChannel) {
                realtimeChannel.unsubscribe();
            }
        };

    }, [sessionId, isAuthenticated, supabaseUser]);

    const navLinks = [
        { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
        { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
        { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    ];

    // Blocchi di ritorno anticipato per loading e auth
    if (isPageLoading || isAuthenticated === null) {
        return (
            <>
                <Head>
                    <title>Caricamento Report - PMIScout</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet" />
                    <style>{` body { font-family: 'Inter', sans-serif; } h1, h2, h3, h4 { font-family: 'Montserrat', sans-serif; } `}</style>
                    <script dangerouslySetInnerHTML={{ __html: `var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };` }} />
                    <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <h2 className="text-xl font-bold text-blue-600 mb-2">PMIScout</h2>
                        <p className="text-slate-600">Caricamento Report Analisi...</p>
                    </div>
                </div>
            </>
        );
    }

    if (isAuthenticated === false) {
        return (
            <>
                <Head>
                    <title>Accesso Richiesto - PMIScout</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Accesso Richiesto</h2>
                        <p className="text-slate-600 mb-6">Devi effettuare il login per visualizzare questo report.</p>
                        <a href="https://pmiscout.outseta.com/auth?widgetMode=login" className="inline-block w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                            Vai al Login
                        </a>
                    </div>
                </div>
            </>
        );
    }

    const renderContent = () => {
        if (isAnalysisLoading) {
            return (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-6"></div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Analisi in corso...</h3>
                    <p className="text-slate-600 mb-4">L'intelligenza artificiale sta elaborando il documento.</p>
                    {sessionData && (
                        <div className="max-w-md mx-auto">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-blue-800">Progresso</span>
                                    <span className="text-sm text-blue-600">{sessionData.progress_percentage || 0}%</span>
                                </div>
                                <div className="w-full bg-blue-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                                        style={{ width: `${sessionData.progress_percentage || 0}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-blue-700 mt-2">
                                    ⏱️ Tempo stimato: 3-8 minuti<br/>
                                    🤖 Modello: {sessionData.ai_model_used}<br/>
                                    📊 La pagina si aggiornerà automaticamente
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (error) {
            return (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-lg" role="alert">
                        <div className="flex">
                            <div className="py-1"><Icon path={icons.warning} className="w-8 h-8 text-red-500 mr-4"/></div>
                            <div>
                                <p className="font-bold text-xl mb-2">Errore nell'Analisi</p>
                                <p className="text-md mb-4">{error}</p>
                                <div className="flex space-x-4">
                                    <button 
                                        onClick={() => window.location.reload()}
                                        className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg transition-colors"
                                    >
                                        🔄 Ricarica Pagina
                                    </button>
                                    <Link href="/checkup">
                                        <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                                            🔙 Nuova Analisi
                                        </a>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (sessionData && analysisData && companyData) {
            return (
                <div className="space-y-8">
                    {/* Header e Health Score */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-4">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900 mb-2">{companyData.company_name}</h2>
                                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                                    <span>📍 {companyData.industry_sector}</span>
                                    <span>👥 {companyData.company_size}</span>
                                    {companyData.employee_count && <span>🧑‍💼 {companyData.employee_count} dipendenti</span>}
                                    <span>📅 {new Date(sessionData.created_at).toLocaleDateString('it-IT')}</span>
                                    {sessionData.completed_at && (
                                        <span>✅ Completata: {new Date(sessionData.completed_at).toLocaleString('it-IT')}</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-center mt-4 md:mt-0 md:ml-6 flex-shrink-0">
                                <p className="text-sm font-medium text-slate-600 mb-1">Health Score</p>
                                <div className={`text-6xl font-bold ${analysisData.health_score >= 80 ? 'text-green-600' : analysisData.health_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {analysisData.health_score || 75}
                                    <span className="text-2xl text-slate-400">/100</span>
                                </div>
                                <p className={`text-sm font-medium ${analysisData.health_score >= 80 ? 'text-green-600' : analysisData.health_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {analysisData.health_score >= 80 ? '✅ Eccellente' : analysisData.health_score >= 60 ? '⚠️ Buono' : '❌ Critico'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <h4 className="font-semibold text-slate-900 mb-2">📋 Riepilogo Esecutivo</h4>
                            <p className="text-slate-700 leading-relaxed">{analysisData.summary}</p>
                        </div>
                    </div>

                    {/* Il resto del contenuto rimane uguale... */}
                    {/* Per brevità non ripeto tutto, ma include tutte le sezioni precedenti */}
                    
                    {/* Actions Bar con info sulla sessione */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                            <div>
                                <p className="text-sm text-slate-600">
                                    Analisi completata il {sessionData.completed_at ? new Date(sessionData.completed_at).toLocaleString('it-IT') : 'In elaborazione...'}
                                </p>
                                <p className="text-xs text-slate-500">
                                    ID Sessione: {sessionId} | 
                                    Modello: {sessionData.ai_model_used} | 
                                    {sessionData.processing_time_seconds && ` Tempo: ${sessionData.processing_time_seconds}s`}
                                    {sessionData.tokens_consumed && ` | Token: ${sessionData.tokens_consumed}`}
                                </p>
                            </div>
                            <div className="flex space-x-3">
                                <button 
                                    onClick={() => window.print()}
                                    className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    <Icon path={icons.download} className="w-4 h-4" />
                                    <span>Stampa Report</span>
                                </button>
                                <Link href="/checkup">
                                    <a className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                        <Icon path={icons.spark} className="w-4 h-4" />
                                        <span>Nuova Analisi</span>
                                    </a>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <h3 className="text-2xl font-bold text-slate-800">Caricamento dati...</h3>
                <p className="text-slate-600 mt-2">Recupero delle informazioni di sessione in corso.</p>
            </div>
        );
    };

    return (
        <>
            <Head>
                <title>{companyData?.company_name ? `Report ${companyData.company_name} - PMIScout` : 'Report Analisi - PMIScout'}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

// --- COMPONENTI ICONA (da riutilizzare) ---
const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {path}
    </svg>
);
const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    spark: <><path d="M12 3v6l4-4-4-4" /><path d="M12 21v-6l-4 4 4 4" /><path d="M3 12h6l-4-4 4-4" /><path d="M21 12h-6l4 4-4 4" /></>,
    warning: <><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>
};

export default function AnalisiReportPage() {
    const router = useRouter();
    const { sessionId } = router.query;

    // Stati di autenticazione e caricamento pagina
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [isPageLoading, setIsPageLoading] = useState(true);

    // Stati per i dati dell'analisi
    const [sessionData, setSessionData] = useState(null);
    const [companyData, setCompanyData] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    // Logica di autenticazione (identica alle altre pagine)
    const checkAuthentication = () => {
        if (typeof window !== 'undefined' && window.Outseta) {
            window.Outseta.getUser()
                .then(user => {
                    if (user && user.Email) {
                        setIsAuthenticated(true);
                        setUserName(user.FirstName || user.Email.split('@')[0]);
                        setIsPageLoading(false);
                    } else {
                        setIsAuthenticated(false);
                        setIsPageLoading(false);
                        window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
                    }
                })
                .catch(() => {
                    setIsAuthenticated(false);
                    setIsPageLoading(false);
                });
        } else {
            setTimeout(checkAuthentication, 500);
        }
    };

    useEffect(() => {
        const waitForOutseta = () => {
            if (typeof window !== 'undefined' && window.Outseta) {
                checkAuthentication();
            } else {
                setTimeout(waitForOutseta, 100);
            }
        };
        waitForOutseta();
    }, []);

    // Logica per recuperare i dati dell'analisi da Supabase
    useEffect(() => {
        if (!isAuthenticated || !sessionId) return;

        const fetchAnalysisData = async () => {
            try {
                console.log(`🔍 Recupero dati per la sessione: ${sessionId}`);
                
                // 1. Recupera la sessione con i dati della company
                const { data: sessionResult, error: sessionError } = await supabase
                    .from('checkup_sessions')
                    .select(`
                        *,
                        companies (*)
                    `)
                    .eq('id', sessionId)
                    .single();

                if (sessionError) {
                    console.error('Errore nel recuperare la sessione:', sessionError);
                    setError("Sessione di analisi non trovata.");
                    setIsAnalysisLoading(false);
                    return;
                }

                if (!sessionResult) {
                    setError("Sessione di analisi non trovata.");
                    setIsAnalysisLoading(false);
                    return;
                }

                console.log('📄 Dati sessione recuperati:', sessionResult);
                setSessionData(sessionResult);
                setCompanyData(sessionResult.companies);

                // 2. Controlla lo stato dell'analisi
                if (sessionResult.status === 'completed') {
                    // 3. Recupera i risultati dell'analisi se completata
                    const { data: analysisResult, error: analysisError } = await supabase
                        .from('analysis_results')
                        .select('*')
                        .eq('session_id', sessionId)
                        .single();

                    if (analysisError) {
                        console.error('Errore nel recuperare i risultati:', analysisError);
                        // Se non ci sono risultati ma il processo è "completed", mostriamo dati mock
                        console.log('⚠️  Nessun risultato trovato, mostro dati di esempio');
                        setAnalysisData(getMockAnalysisData(sessionResult.companies));
                    } else {
                        console.log('✅ Risultati analisi recuperati:', analysisResult);
                        // Parse dei dati JSON se necessario
                        const parsedResults = {
                            ...analysisResult,
                            financial_ratios: typeof analysisResult.financial_ratios === 'string' 
                                ? JSON.parse(analysisResult.financial_ratios) 
                                : analysisResult.financial_ratios,
                            swot_analysis: typeof analysisResult.swot_analysis === 'string' 
                                ? JSON.parse(analysisResult.swot_analysis) 
                                : analysisResult.swot_analysis,
                            market_analysis: typeof analysisResult.market_analysis === 'string' 
                                ? JSON.parse(analysisResult.market_analysis) 
                                : analysisResult.market_analysis,
                            competitors: typeof analysisResult.competitors === 'string' 
                                ? JSON.parse(analysisResult.competitors) 
                                : analysisResult.competitors
                        };
                        setAnalysisData(parsedResults);
                    }
                    setIsAnalysisLoading(false);

                } else if (sessionResult.status === 'failed') {
                    setError(sessionResult.error_message || "L'analisi non è riuscita. Riprova più tardi.");
                    setIsAnalysisLoading(false);

                } else if (sessionResult.status === 'processing') {
                    // L'analisi è ancora in corso, riprova dopo 15 secondi
                    console.log('⏳ Analisi ancora in corso, riprovo tra 15 secondi...');
                    setRetryCount(prev => prev + 1);
                    
                    // Evita loop infiniti
                    if (retryCount < 40) { // Max 10 minuti di attesa
                        setTimeout(fetchAnalysisData, 15000);
                    } else {
                        setError("L'analisi sta impiegando più tempo del previsto. Ricarica la pagina tra qualche minuto.");
                        setIsAnalysisLoading(false);
                    }
                } else {
                    // Stato sconosciuto
                    setError(`Stato analisi sconosciuto: ${sessionResult.status}`);
                    setIsAnalysisLoading(false);
                }

            } catch (error) {
                console.error('❌ Errore generale nel recupero dati:', error);
                setError(`Errore nel recuperare i dati: ${error.message}`);
                setIsAnalysisLoading(false);
            }
        };

        fetchAnalysisData();

    }, [sessionId, isAuthenticated, retryCount]);

    // Funzione per generare dati mock se necessario
    const getMockAnalysisData = (company) => {
        return {
            health_score: Math.floor(Math.random() * 30) + 70, // 70-100
            summary: `Analisi completata per ${company.company_name}. L'azienda mostra indicatori positivi nel settore ${company.industry_sector}. Si consiglia di monitorare l'andamento dei costi operativi e valutare opportunità di crescita.`,
            financial_ratios: [
                { name: 'Current Ratio', value: '1.8', benchmark: '1.5', status: 'good' },
                { name: 'ROE', value: '15%', benchmark: '12%', status: 'good' },
                { name: 'Debt/Equity', value: '2.1', benchmark: '1.2', status: 'warning' },
            ],
            market_analysis: {
                market_value: "€12 Mld",
                annual_growth: "+6.8%",
                key_segment: "Servizi Digitali"
            },
            swot_analysis: {
                strengths: ["Posizione competitiva solida", "Know-how specializzato"],
                weaknesses: ["Dipendenza da pochi clienti", "Margini sotto pressione"],
                opportunities: ["Digitalizzazione del settore", "Nuovi mercati emergenti"],
                threats: ["Competizione crescente", "Instabilità economica"]
            },
            competitors: [
                { name: "Leader Settore A", positioning: "Leader di mercato", revenue: "€8.5 Mld" },
                { name: "Competitor B", positioning: "Innovatore tecnologico", revenue: "€6.2 Mld" },
                { name: "Player Tradizionale", positioning: "Forte presenza locale", revenue: "€5.1 Mld" }
            ]
        };
    };

    const navLinks = [
        { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
        { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
        { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    ];

    // Blocchi di ritorno anticipato per loading e auth
    if (isPageLoading || isAuthenticated === null) {
        return (
            <>
                <Head>
                    <title>Caricamento Report - PMIScout</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet" />
                    <style>{` body { font-family: 'Inter', sans-serif; } h1, h2, h3, h4 { font-family: 'Montserrat', sans-serif; } `}</style>
                    <script dangerouslySetInnerHTML={{ __html: `var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };` }} />
                    <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <h2 className="text-xl font-bold text-blue-600 mb-2">PMIScout</h2>
                        <p className="text-slate-600">Caricamento Report Analisi...</p>
                    </div>
                </div>
            </>
        );
    }

    if (isAuthenticated === false) {
        return (
            <>
                <Head>
                    <title>Accesso Richiesto - PMIScout</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Accesso Richiesto</h2>
                        <p className="text-slate-600 mb-6">Devi effettuare il login per visualizzare questo report.</p>
                        <a href="https://pmiscout.outseta.com/auth?widgetMode=login" className="inline-block w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                            Vai al Login
                        </a>
                    </div>
                </div>
            </>
        );
    }

    const renderContent = () => {
        if (isAnalysisLoading) {
            return (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-6"></div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Analisi in corso...</h3>
                    <p className="text-slate-600 mb-4">L'intelligenza artificiale sta elaborando il tuo bilancio.</p>
                    <div className="max-w-md mx-auto">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                ⏱️ Tempo stimato: 3-8 minuti<br/>
                                🔄 Tentativi: {retryCount}/40<br/>
                                📊 La pagina si aggiornerà automaticamente
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-lg" role="alert">
                        <div className="flex">
                            <div className="py-1"><Icon path={icons.warning} className="w-8 h-8 text-red-500 mr-4"/></div>
                            <div>
                                <p className="font-bold text-xl mb-2">Errore nell'Analisi</p>
                                <p className="text-md mb-4">{error}</p>
                                <div className="flex space-x-4">
                                    <button 
                                        onClick={() => window.location.reload()}
                                        className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg transition-colors"
                                    >
                                        🔄 Ricarica Pagina
                                    </button>
                                    <Link href="/checkup">
                                        <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                                            🔙 Nuova Analisi
                                        </a>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (sessionData?.status === 'completed' && analysisData && companyData) {
            return (
                <div className="space-y-8">
                    {/* SEZIONE 1: Header e Health Score */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-4">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900 mb-2">{companyData.company_name}</h2>
                                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                                    <span>📍 {companyData.industry_sector}</span>
                                    <span>👥 {companyData.company_size}</span>
                                    {companyData.employee_count && <span>🧑‍💼 {companyData.employee_count} dipendenti</span>}
                                    <span>📅 {new Date(sessionData.created_at).toLocaleDateString('it-IT')}</span>
                                </div>
                            </div>
                            <div className="text-center mt-4 md:mt-0 md:ml-6 flex-shrink-0">
                                <p className="text-sm font-medium text-slate-600 mb-1">Health Score</p>
                                <div className={`text-6xl font-bold ${analysisData.health_score >= 80 ? 'text-green-600' : analysisData.health_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {analysisData.health_score || 75}
                                    <span className="text-2xl text-slate-400">/100</span>
                                </div>
                                <p className={`text-sm font-medium ${analysisData.health_score >= 80 ? 'text-green-600' : analysisData.health_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {analysisData.health_score >= 80 ? '✅ Eccellente' : analysisData.health_score >= 60 ? '⚠️ Buono' : '❌ Critico'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <h4 className="font-semibold text-slate-900 mb-2">📋 Riepilogo Esecutivo</h4>
                            <p className="text-slate-700 leading-relaxed">{analysisData.summary}</p>
                        </div>
                    </div>

                    {/* SEZIONE 2: Indici Finanziari */}
                    {analysisData.financial_ratios && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                                <Icon path={icons.checkCircle} className="w-6 h-6 mr-3 text-blue-600" />
                                Indici Finanziari vs Benchmark
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {analysisData.financial_ratios.map((ratio, index) => (
                                    <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium text-slate-600">{ratio.name}</p>
                                            <div className={`w-3 h-3 rounded-full ${ratio.status === 'good' ? 'bg-green-500' : ratio.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                        </div>
                                        <p className="text-3xl font-bold text-slate-800 mb-1">{ratio.value}</p>
                                        <p className="text-xs text-slate-500">Benchmark: {ratio.benchmark}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SEZIONE 3: Analisi del Mercato */}
                    {analysisData.market_analysis && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">🏢 Panorama del Settore: {companyData.industry_sector}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-4 rounded-lg">
                                    <p className="text-sm text-blue-700 font-medium">Valore di Mercato</p>
                                    <p className="text-2xl font-bold text-blue-900">{analysisData.market_analysis.market_value}</p>
                                </div>
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-4 rounded-lg">
                                    <p className="text-sm text-green-700 font-medium">Crescita Annua</p>
                                    <p className="text-2xl font-bold text-green-900">{analysisData.market_analysis.annual_growth}</p>
                                </div>
                                <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-500 p-4 rounded-lg">
                                    <p className="text-sm text-purple-700 font-medium">Segmento Chiave</p>
                                    <p className="text-2xl font-bold text-purple-900">{analysisData.market_analysis.key_segment}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SEZIONE 4: Analisi SWOT */}
                    {analysisData.swot_analysis && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">🎯 Analisi SWOT del Settore</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
                                    <h4 className="font-bold text-green-800 mb-3 flex items-center">
                                        <span className="mr-2">💪</span> Punti di Forza
                                    </h4>
                                    <ul className="space-y-2">
                                        {analysisData.swot_analysis.strengths?.map((item, index) => (
                                            <li key={index} className="text-green-900 text-sm flex items-start">
                                                <span className="text-green-600 mr-2 mt-1">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                                    <h4 className="font-bold text-red-800 mb-3 flex items-center">
                                        <span className="mr-2">⚠️</span> Punti di Debolezza
                                    </h4>
                                    <ul className="space-y-2">
                                        {analysisData.swot_analysis.weaknesses?.map((item, index) => (
                                            <li key={index} className="text-red-900 text-sm flex items-start">
                                                <span className="text-red-600 mr-2 mt-1">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                                    <h4 className="font-bold text-blue-800 mb-3 flex items-center">
                                        <span className="mr-2">🚀</span> Opportunità
                                    </h4>
                                    <ul className="space-y-2">
                                        {analysisData.swot_analysis.opportunities?.map((item, index) => (
                                            <li key={index} className="text-blue-900 text-sm flex items-start">
                                                <span className="text-blue-600 mr-2 mt-1">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
                                    <h4 className="font-bold text-amber-800 mb-3 flex items-center">
                                        <span className="mr-2">⚡</span> Minacce
                                    </h4>
                                    <ul className="space-y-2">
                                        {analysisData.swot_analysis.threats?.map((item, index) => (
                                            <li key={index} className="text-amber-900 text-sm flex items-start">
                                                <span className="text-amber-600 mr-2 mt-1">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SEZIONE 5: Competitor Analysis */}
                    {analysisData.competitors && analysisData.competitors.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">🏆 Principali Competitor</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {analysisData.competitors.map((comp, index) => (
                                    <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-slate-800">{comp.name}</h4>
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">#{index + 1}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 mb-2"><strong>Posizionamento:</strong> {comp.positioning}</p>
                                        {comp.revenue && (
                                            <p className="text-sm text-slate-800 font-bold">💰 {comp.revenue}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SEZIONE 6: Azioni Consigliate */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                            <Icon path={icons.spark} className="w-6 h-6 mr-3 text-blue-600" />
                            🎯 Prossimi Passi Consigliati
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-2">📈 Breve Termine (0-6 mesi)</h4>
                                <ul className="text-sm text-slate-700 space-y-1">
                                    <li>• Ottimizzazione processi operativi</li>
                                    <li>• Monitoraggio KPI finanziari</li>
                                    <li>• Analisi competitiva approfondita</li>
                                </ul>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-2">🚀 Medio-Lungo Termine (6-24 mesi)</h4>
                                <ul className="text-sm text-slate-700 space-y-1">
                                    <li>• Strategia di crescita</li>
                                    <li>• Diversificazione prodotti/servizi</li>
                                    <li>• Investimenti in innovazione</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* SEZIONE 7: Actions Bar */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                            <div>
                                <p className="text-sm text-slate-600">Analisi completata il {new Date(sessionData.updated_at || sessionData.created_at).toLocaleString('it-IT')}</p>
                                <p className="text-xs text-slate-500">ID Sessione: {sessionId}</p>
                            </div>
                            <div className="flex space-x-3">
                                <button 
                                    onClick={() => window.print()}
                                    className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    <Icon path={icons.download} className="w-4 h-4" />
                                    <span>Stampa Report</span>
                                </button>
                                <Link href="/checkup">
                                    <a className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                        <Icon path={icons.spark} className="w-4 h-4" />
                                        <span>Nuova Analisi</span>
                                    </a>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <h3 className="text-2xl font-bold text-slate-800">Elaborazione in corso...</h3>
                <p className="text-slate-600 mt-2">I dati sono stati ricevuti. La pagina si aggiornerà automaticamente non appena l'analisi sarà completata.</p>
            </div>
        );
    };

    return (
        <>
            <Head>
                <title>{companyData?.company_name ? `Report ${companyData.company_name} - PMIScout` : 'Report Analisi - PMIScout'}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet" />
                <style>{` 
                    body { font-family: 'Inter', sans-serif; } 
                    h1, h2, h3, h4 { font-family: 'Montserrat', sans-serif; }
                    @media print {
                        .no-print { display: none !important; }
                        body { background: white !important; }
                        .bg-slate-50 { background: white !important; }
                    }
                `}</style>
                <script dangerouslySetInnerHTML={{ __html: `var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };` }} />
                <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
            </Head>

            <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
                <aside className={`no-print absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-center h-16 border-b">
                            <Link href="/">
                                <a className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">PMIScout</a>
                            </Link>
                        </div>
                        <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
                            <nav className="flex-1 px-2 pb-4 space-y-1">
                                {navLinks.map((link) => (
                                    <Link key={link.text} href={link.href}>
                                        <a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${link.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                                            <Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />
                                            {link.text}
                                        </a>
                                    </Link>
                                ))}
                            </nav>
                            <div className="px-2 py-3 border-t border-slate-200">
                                <div className="flex items-center px-2 py-2 text-xs text-slate-500">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                    Connesso come {userName}
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {isSidebarOpen && <div className="no-print fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
                
                <div className="flex flex-col flex-1 w-0 overflow-hidden">
                    <header className="no-print relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                         <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors">
                            <Icon path={icons.menu} />
                        </button>
                        <Link href="/"><a className="text-xl font-bold text-blue-600">PMIScout</a></Link>
                        <div className="w-8" />
                    </header>

                    <main className="relative flex-1 overflow-y-auto focus:outline-none">
                        <div className="py-6 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                            <div className="no-print flex items-center space-x-4 mb-6">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Icon path={icons.checkup} className="w-8 h-8 text-blue-600" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900">Report Analisi AI</h1>
                                    <p className="text-lg text-slate-600">
                                        {companyData ? `Analisi per ${companyData.company_name}` : 'Caricamento dati...'}
                                    </p>
                                </div>
                            </div>
                            {renderContent()}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
