import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
// import { supabase } from '../../utils/supabaseClient'; // Assicurati che il percorso sia corretto

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
    checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
};


export default function AnalisiReportPage() {
    const router = useRouter();
    const { sessionId } = router.query;

    const [sessionData, setSessionData] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Sidebar e utente (stati e logica simili alle altre pagine)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('Utente'); // Placeholder

    useEffect(() => {
        if (!sessionId) return;

        // --- FUNZIONE PER RECUPERARE I DATI DELL'ANALISI ---
        const fetchAnalysisData = async () => {
            // SIMULAZIONE: In un'applicazione reale, qui interroghi Supabase
            console.log(`Recupero dati per la sessione: ${sessionId}`);
            
            // 1. Recupera lo stato della sessione
            // const { data: session, error: sessionError } = await supabase
            //     .from('checkup_sessions')
            //     .select('*, companies(company_name)')
            //     .eq('id', sessionId)
            //     .single();
            
            // Simuliamo una risposta da Supabase
            const session = { 
                id: sessionId, 
                status: 'completed', // Cambia in 'processing' o 'failed' per testare gli altri stati
                session_name: 'Analisi per Rossi SRL',
                companies: { company_name: 'Rossi SRL' },
                error_message: 'Estrazione dati fallita a causa della bassa qualità del documento.'
            };

            if (!session) { // o if (sessionError)
                setError("Sessione di analisi non trovata.");
                setIsLoading(false);
                return;
            }

            setSessionData(session);

            // 2. Se la sessione è completata, recupera tutti i dati correlati
            if (session.status === 'completed') {
                // Qui faresti le query a `italian_balance_sheets`, `balance_sheet_ratios`, etc.
                // const { data: balanceData } = await supabase.from(...);
                // const { data: ratiosData } = await supabase.from(...);
                
                // Simuliamo i dati di analisi
                setAnalysisData({
                    healthScore: 82,
                    summary: "L'azienda mostra una solida redditività (ROE 15%) e una buona liquidità (Current Ratio 1.8), superando la media del settore. Tuttavia, si nota un elevato indebitamento a breve termine che richiede attenzione.",
                    ratios: [
                        { name: 'Current Ratio', value: '1.8', benchmark: '1.5', status: 'good' },
                        { name: 'ROE', value: '15%', benchmark: '12%', status: 'good' },
                        { name: 'Debt/Equity', value: '2.1', benchmark: '1.2', status: 'warning' },
                    ]
                });
                setIsLoading(false);
            } else if (session.status === 'failed') {
                setError(session.error_message || "L'analisi non è riuscita.");
                setIsLoading(false);
            } else {
                // Se è ancora in 'processing', potresti voler fare un refresh periodico
                setTimeout(fetchAnalysisData, 10000); // Riprova tra 10 secondi
            }
        };

        fetchAnalysisData();

    }, [sessionId]);

    const navLinks = [
        { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
        { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
        { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    ];

    // --- RENDER DEL CONTENUTO DELLA PAGINA ---
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <h3 className="text-2xl font-bold text-slate-800">Analisi in corso...</h3>
                    <p className="text-slate-600 mt-2">L'intelligenza artificiale sta elaborando il tuo bilancio. Questo processo potrebbe richiedere alcuni minuti.</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-lg" role="alert">
                    <div className="flex">
                        <div className="py-1"><Icon path={icons.warning} className="w-8 h-8 text-red-500 mr-4"/></div>
                        <div>
                            <p className="font-bold text-xl">Errore nell'Analisi</p>
                            <p className="text-md mt-2">{error}</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (sessionData?.status === 'completed' && analysisData) {
            return (
                <div className="space-y-8">
                    {/* SEZIONE 1: Riepilogo e Health Score */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Riepilogo Analisi per {sessionData.companies.company_name}</h2>
                                <p className="text-slate-500">Dati aggiornati al {new Date().toLocaleDateString('it-IT')}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-slate-600">Health Score</p>
                                <p className="text-5xl font-bold text-green-600">{analysisData.healthScore}<span className="text-2xl text-slate-400">/100</span></p>
                            </div>
                        </div>
                        <p className="mt-4 text-slate-700 text-lg">{analysisData.summary}</p>
                    </div>

                    {/* SEZIONE 2: Indici Principali */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Indici Chiave vs Benchmark</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {analysisData.ratios.map(ratio => (
                                <div key={ratio.name} className="border rounded-lg p-4">
                                    <p className="text-sm text-slate-500">{ratio.name}</p>
                                    <p className="text-3xl font-bold text-slate-800">{ratio.value}</p>
                                    <p className={`text-sm font-medium ${ratio.status === 'good' ? 'text-green-600' : 'text-amber-600'}`}>
                                        Benchmark di settore: {ratio.benchmark}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Aggiungi qui altre sezioni per grafici, predizioni, etc. */}
                </div>
            );
        }

        // Stato intermedio se la sessione è ancora in elaborazione
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
                <title>Report Analisi - PMIScout</title>
                {/* ... altri tag Head ... */}
            </Head>

            <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
                {/* --- SIDEBAR (riutilizzata) --- */}
                <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    {/* ... Incolla qui il codice della tua sidebar ... */}
                </aside>

                {isSidebarOpen && <div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
                
                <div className="flex flex-col flex-1 w-0 overflow-hidden">
                    {/* --- HEADER MOBILE (riutilizzato) --- */}
                    <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                        {/* ... Incolla qui il codice del tuo header mobile ... */}
                    </header>

                    <main className="relative flex-1 overflow-y-auto focus:outline-none">
                        <div className="py-6 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                            <div className="flex items-center space-x-4 mb-6">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Icon path={icons.checkup} className="w-8 h-8 text-blue-600" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900">Report Analisi AI</h1>
                                    <p className="text-lg text-slate-600">Risultati per la sessione: <span className="font-mono bg-slate-200 px-1 rounded">{sessionId}</span></p>
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
