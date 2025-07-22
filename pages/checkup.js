import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
// Importiamo sia supabase che la nuova funzione di sincronizzazione
import { supabase, syncSupabaseAuth } from '../utils/supabaseClient'; 

export default function CheckupPage() {
    // STATI PRINCIPALI
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter(); 

    // STATI SPECIFICI DEL CHECKUP
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        company_name: '',
        vat_number: '',
        industry_sector: '',
        ateco_code: '',
        company_size: '',
        employee_count: '',
        location_city: '',
        location_region: '',
        website_url: '',
        description: '',
        revenue_range: '',
        main_challenges: '',
        business_goals: ''
    });
    const [balanceSheetFile, setBalanceSheetFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- LOGICA DI AUTENTICAZIONE AGGIORNATA ---
    const checkAuthentication = () => {
        if (typeof window !== 'undefined' && window.Outseta) {
            window.Outseta.getUser()
                .then(async (user) => { // Aggiunto async per usare await
                    if (user && user.Email) {
                        // **MODIFICA CHIAVE**: Chiamiamo la funzione per sincronizzare con Supabase
                        const synced = await syncSupabaseAuth();
                        if (synced) {
                            // Se la sincronizzazione ha successo, procediamo
                            setIsAuthenticated(true);
                            setUserName(user.FirstName || user.Email.split('@')[0]);
                        } else {
                            // Altrimenti, consideriamo l'utente non autenticato correttamente
                            setIsAuthenticated(false);
                            // Potresti voler mostrare un messaggio di errore specifico qui
                        }
                        setIsLoading(false);
                    } else {
                        setIsAuthenticated(false);
                        setIsLoading(false);
                        window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
                    }
                })
                .catch(error => {
                    console.error('Auth error:', error);
                    setIsAuthenticated(false);
                    setIsLoading(false);
                    window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login';
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

    // --- FUNZIONI DI GESTIONE DEL FORM A STEP ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNextStep = (e) => {
        e.preventDefault();
        if (formData.company_name && formData.industry_sector && formData.company_size) {
            setCurrentStep(2);
        } else {
            alert('Per favore, compila tutti i campi obbligatori (*)');
        }
    };

    const handlePrevStep = () => {
        setCurrentStep(prev => prev - 1);
    };

    // --- FUNZIONE DI SUBMIT CON LOGICA SUPABASE ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!balanceSheetFile) {
            alert('Per favore, carica un documento di bilancio.');
            return;
        }
        setIsSubmitting(true);

        try {
            // 1. Recupera l'utente corrente da Supabase Auth (ora dovrebbe funzionare)
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("Utente non trovato. Effettua di nuovo il login.");

            // 2. Salva i dati dell'azienda nella tabella `companies`
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .insert({
                    user_id: user.id,
                    company_name: formData.company_name,
                    vat_number: formData.vat_number,
                    industry_sector: formData.industry_sector,
                    company_size: formData.company_size,
                })
                .select()
                .single();

            if (companyError) throw companyError;
            const companyId = companyData.id;

            // 3. Crea una `checkup_session`
            const { data: sessionData, error: sessionError } = await supabase
                .from('checkup_sessions')
                .insert({ 
                    company_id: companyId, 
                    user_id: user.id,
                    session_name: `Analisi per ${formData.company_name}`,
                    status: 'processing'
                })
                .select()
                .single();

            if (sessionError) throw sessionError;
            const sessionId = sessionData.id;
            
            // 4. Fai l'upload del file
            const filePath = `public/${sessionId}/${balanceSheetFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('checkup-documents')
                .upload(filePath, balanceSheetFile);

            if (uploadError) throw uploadError;

            // 5. Reindirizza l'utente
            router.push(`/analisi/${sessionId}`);

        } catch (error) {
            console.error("Errore durante l'avvio dell'analisi:", error);
            alert(`Si è verificato un errore: ${error.message}. Riprova più tardi.`);
            setIsSubmitting(false);
        }
    };

    // --- GESTIONE UPLOAD FILE ---
    const onDrop = useCallback(acceptedFiles => {
        setBalanceSheetFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false
    });

    // --- DEFINIZIONE ICONE E LINK NAVIGAZIONE ---
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
        building: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18H6Z" /><path d="M6 12h12" /><path d="M6 16h12" /><path d="M10 6h4" /><path d="M10 10h4" /></>,
        upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
        spark: <><path d="M12 3v6l4-4-4-4" /><path d="M12 21v-6l-4 4 4 4" /><path d="M3 12h6l-4-4 4-4" /><path d="M21 12h-6l4 4-4 4" /></>,
        file: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></>
    };
    const navLinks = [
        { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
        { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
        { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    ];

    // --- BLOCCHI DI RITORNO ANTICIPATO (ESSENZIALI) ---
    if (isLoading || isAuthenticated === null) {
        return (
            <>
                <Head>
                    <title>Caricamento Check-UP - PMIScout</title>
                    {/* ... altri tag head ... */}
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    {/* ... schermata di caricamento ... */}
                </div>
            </>
        );
    }

    if (isAuthenticated === false) {
        return (
            <>
                <Head>
                    <title>Accesso Richiesto - PMIScout</title>
                    {/* ... altri tag head ... */}
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    {/* ... schermata di accesso richiesto ... */}
                </div>
            </>
        );
    }


    // --- RITORNO DEL COMPONENTE PRINCIPALE (SOLO SE AUTENTICATO) ---
    return (
        <>
            <Head>
                <title>Check-UP AI Azienda - PMIScout</title>
                {/* ... altri tag head ... */}
            </Head>

            <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
                {/* ... Sidebar ... */}
                <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    {/* ... contenuto sidebar ... */}
                </aside>

                {/* ... Overlay e Header Mobile ... */}
                
                <div className="flex flex-col flex-1 w-0 overflow-hidden">
                    {/* ... header ... */}
                    <main className="relative flex-1 overflow-y-auto focus:outline-none">
                        <div className="py-6 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                            
                            {/* ... Titolo e Progress Steps ... */}

                            <div className="bg-white rounded-xl shadow-sm border p-8">
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    
                                    {/* --- STEP 1: DATI AZIENDA --- */}
                                    {currentStep === 1 && (
                                        <>
                                            {/* ... contenuto form step 1 ... */}
                                            <div className="border-t pt-8">
                                                <div className="flex justify-end">
                                                    <button type="button" onClick={handleNextStep}
                                                        className="flex items-center space-x-3 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                                        <span>Avanti</span>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* --- STEP 2: UPLOAD DOCUMENTI --- */}
                                    {currentStep === 2 && (
                                        <>
                                            {/* ... contenuto form step 2 ... */}
                                            <div className="border-t pt-8">
                                                <div className="flex items-center justify-between">
                                                    <button type="button" onClick={handlePrevStep}
                                                        className="px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                                                        Indietro
                                                    </button>
                                                    <button type="submit" disabled={!balanceSheetFile || isSubmitting}
                                                        className="flex items-center space-x-3 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
                                                        {isSubmitting ? (
                                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                        ) : (
                                                            <Icon path={icons.spark} className="w-5 h-5" />
                                                        )}
                                                        <span>{isSubmitting ? 'Invio in corso...' : 'Avvia Analisi AI'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </form>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
