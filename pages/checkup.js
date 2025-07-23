import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';

export default function CheckupPage() {
    // STATI PRINCIPALI (Sidebar, Autenticazione, Caricamento)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('');
    // 'isAuthenticated' è stato rimosso per semplificare la logica.
    const [isLoading, setIsLoading] = useState(true);
    const [outsetaUser, setOutsetaUser] = useState(null); // Unico stato per i dati utente
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

    // --- LOGICA DI AUTENTICAZIONE SEMPLIFICATA ---
    useEffect(() => {
        const verifyAuth = () => {
            if (typeof window !== 'undefined' && window.Outseta) {
                window.Outseta.getUser()
                    .then(user => {
                        // Se l'utente esiste ed ha un Uid, è autenticato.
                        if (user && user.Uid) {
                            setUserName(user.FirstName || user.Email.split('@')[0]);
                            setOutsetaUser(user);
                            setIsLoading(false); // Stoppa il caricamento, mostra la pagina
                        } else {
                            // Altrimenti, reindirizza subito al login.
                            window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
                        }
                    })
                    .catch(error => {
                        console.error('Auth error:', error);
                        // Anche in caso di errore, reindirizza al login.
                        window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login';
                    });
            } else {
                // Se Outseta non è ancora pronto, riprova tra poco.
                setTimeout(verifyAuth, 100);
            }
        };
        verifyAuth();
    }, []); // L'array vuoto assicura che venga eseguito solo una volta.

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

    // --- FUNZIONE DI SUBMIT ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!balanceSheetFile) {
            alert('Per favore, carica un documento di bilancio.');
            return;
        }
        // Questo controllo rimane una sicurezza fondamentale prima di scrivere sul DB.
        if (!outsetaUser || !outsetaUser.Uid) {
            alert("Errore di autenticazione, impossibile procedere. Ricarica la pagina e riprova.");
            setIsSubmitting(false);
            return;
        }
        setIsSubmitting(true);

        try {
            // STEP 1: Salva i dati dell'azienda nel database e ottieni l'ID
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .insert({
                    company_name: formData.company_name,
                    vat_number: formData.vat_number,
                    industry_sector: formData.industry_sector,
                    ateco_code: formData.ateco_code,
                    company_size: formData.company_size,
                    employee_count: formData.employee_count ? parseInt(formData.employee_count, 10) : null,
                    location_city: formData.location_city,
                    location_region: formData.location_region,
                    website_url: formData.website_url,
                    description: formData.description,
                    revenue_range: formData.revenue_range,
                    // === MODIFICHE CHIAVE QUI ===
                    // 1. Il nome della colonna è 'user_id', non 'owner_uid'
                    user_id: outsetaUser.Uid, 
                    // 2. Rimossi 'main_challenges' e 'business_goals' perché non esistono nella tabella
                })
                .select()
                .single();

            if (companyError) throw companyError;
            const companyId = companyData.id;

            // STEP 2: Crea la sessione di checkup collegata all'azienda e all'utente
            const { data: sessionData, error: sessionError } = await supabase
                .from('checkup_sessions')
                .insert({
                    company_id: companyId,
                    user_id: outsetaUser.Uid, // Anche qui usiamo user_id per coerenza
                    session_name: `Analisi per ${formData.company_name}`,
                    status: 'processing'
                })
                .select()
                .single();

            if (sessionError) throw sessionError;
            const sessionId = sessionData.id;

            // STEP 3: Carica il file PDF nello Storage di Supabase
            const filePath = `public/${sessionId}/${balanceSheetFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('checkup-documents')
                .upload(filePath, balanceSheetFile);

            if (uploadError) throw uploadError;

            // STEP 4: Reindirizza alla pagina di analisi con il vero ID di sessione
            console.log(`Redirect alla sessione: /analisi/${sessionId}`);
            router.push(`/analisi/${sessionId}`);

        } catch (error) {
            console.error("Errore durante l'avvio dell'analisi:", error);
            alert(`Si è verificato un errore durante l'invio: ${error.message}. Riprova più tardi.`);
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

    // --- DEFINIZIONE ICONE E LINK NAVIGAZIONE (invariato) ---
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

    // --- BLOCCO DI CARICAMENTO ---
    // Mostra lo spinner finché `verifyAuth` non ha finito.
    // Se l'utente non è loggato, viene reindirizzato prima che questo blocco cambi.
    if (isLoading) {
        return (
            <>
                <Head>
                    <title>Caricamento Check-UP - PMIScout</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                    <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
                    <script dangerouslySetInnerHTML={{ __html: `var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };` }} />
                    <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <h2 className="text-xl font-bold text-blue-600 mb-2">PMIScout</h2>
                        <p className="text-slate-600">Caricamento Check-UP AI...</p>
                    </div>
                </div>
            </>
        );
    }
    
    // --- RITORNO DEL COMPONENTE PRINCIPALE (SOLO SE AUTENTICATO) ---
    return (
        <>
            <Head>
                <title>Check-UP AI Azienda - PMIScout</title>
                <meta name="description" content="Analisi AI completa della tua azienda con insights e raccomandazioni personalizzate" />
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
                <script dangerouslySetInnerHTML={{ __html: `var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };` }} />
                <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
            </Head>

            <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
                <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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

                {isSidebarOpen && <div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
                
                <div className="flex flex-col flex-1 w-0 overflow-hidden">
                    <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors">
                            <Icon path={icons.menu} />
                        </button>
                        <Link href="/"><a className="text-xl font-bold text-blue-600">PMIScout</a></Link>
                        <div className="w-8" />
                    </header>

                    <main className="relative flex-1 overflow-y-auto focus:outline-none">
                        <div className="py-6 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                            
                            <div className="mb-8">
                                <nav className="flex items-center text-sm mb-4" aria-label="Breadcrumb">
                                    <Link href="/"><a className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
                                        <Icon path={icons.home} className="w-4 h-4 mr-1" />Dashboard</a></Link>
                                    <span className="mx-2 text-slate-400">/</span>
                                    <span className="text-slate-600 font-medium">Check-UP AI</span>
                                </nav>
                                <div className="flex items-center space-x-4 mb-4">
                                    <div className="p-3 bg-blue-100 rounded-xl">
                                        <Icon path={icons.spark} className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-slate-900">Check-UP AI Azienda</h1>
                                        <p className="text-lg text-slate-600">Analisi approfondita della tua azienda con intelligenza artificiale</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-center space-x-4 mt-8 mb-8">
                                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        <Icon path={icons.building} className="w-4 h-4" />
                                        <span>Dati Azienda</span>
                                    </div>
                                    <div className={`w-8 h-px transition-colors ${currentStep >= 2 ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        <Icon path={icons.upload} className="w-4 h-4" />
                                        <span>Documenti</span>
                                    </div>
                                    <div className={`w-8 h-px transition-colors ${currentStep >= 3 ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        <Icon path={icons.spark} className="w-4 h-4" />
                                        <span>Analisi AI</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border p-8">
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    
                                    {/* --- STEP 1: DATI AZIENDA --- */}
                                    {currentStep === 1 && (
                                        <>
                                            <div>
                                                <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center">
                                                    <Icon path={icons.building} className="w-6 h-6 mr-3 text-blue-600" />
                                                    Informazioni Azienda
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Nome Azienda *</label>
                                                        <input type="text" name="company_name" required value={formData.company_name} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" placeholder="La tua azienda..." />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Partita IVA</label>
                                                        <input type="text" name="vat_number" value={formData.vat_number} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" placeholder="IT..." />
                                                    </div>
                                                     <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Settore di Attività *</label>
                                                        <select name="industry_sector" required value={formData.industry_sector} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                                            <option value="">Seleziona settore...</option>
                                                            <option value="Commercio">Commercio</option>
                                                            <option value="Informatica">Informatica e Software</option>
                                                            <option value="Consulenza">Consulenza</option>
                                                            <option value="Manifatturiero">Manifatturiero</option>
                                                            <option value="Edilizia">Edilizia</option>
                                                            <option value="Ristorazione">Ristorazione</option>
                                                            <option value="Turismo">Turismo</option>
                                                            <option value="Altro">Altro</option>
                                                        </select>
                                                     </div>
                                                     <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Dimensione Azienda *</label>
                                                        <select name="company_size" required value={formData.company_size} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                                          <option value="">Seleziona dimensione...</option>
                                                          <option value="micro">Micro (1-9 dipendenti)</option>
                                                          <option value="piccola">Piccola (10-49 dipendenti)</option>
                                                          <option value="media">Media (50-249 dipendenti)</option>
                                                          <option value="grande">Grande (250+ dipendenti)</option>
                                                        </select>
                                                      </div>
                                                      <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Numero Dipendenti</label>
                                                        <input type="number" name="employee_count" value={formData.employee_count} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" placeholder="es. 15" />
                                                      </div>
                                                      <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Fatturato Annuo</label>
                                                        <select name="revenue_range" value={formData.revenue_range} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                                                          <option value="">Seleziona range...</option>
                                                          <option value="0-100k">0 - 100.000€</option>
                                                          <option value="100k-500k">100.000€ - 500.000€</option>
                                                          <option value="500k-2M">500.000€ - 2.000.000€</option>
                                                          <option value="2M-10M">2.000.000€ - 10.000.000€</option>
                                                          <option value="10M+">Oltre 10.000.000€</option>
                                                        </select>
                                                      </div>
                                                </div>
                                                <div className="mt-6">
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">Descrizione Attività</label>
                                                    <textarea name="description" rows={4} value={formData.description} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" placeholder="Descrivi brevemente la tua attività, i prodotti/servizi offerti..."></textarea>
                                                </div>
                                            </div>

                                            <div className="border-t pt-8">
                                                <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center">
                                                    <Icon path={icons.spark} className="w-6 h-6 mr-3 text-blue-600" />
                                                    Obiettivi e Sfide
                                                </h3>
                                                <div className="space-y-6">
                                                   <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Principali Sfide Aziendali</label>
                                                        <textarea name="main_challenges" rows={3} value={formData.main_challenges} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" placeholder="Quali sono le principali difficoltà che stai affrontando? (es. costi elevati, competizione, mancanza di visibilità...)"></textarea>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Obiettivi di Business</label>
                                                        <textarea name="business_goals" rows={3} value={formData.business_goals} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" placeholder="Quali sono i tuoi obiettivi per i prossimi 12-24 mesi? (es. aumentare fatturato, espansione, ottimizzazione costi...)"></textarea>
                                                    </div>
                                                </div>
                                            </div>

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
                                            <div>
                                                <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center">
                                                    <Icon path={icons.upload} className="w-6 h-6 mr-3 text-blue-600" />
                                                    Carica il Bilancio
                                                </h3>
                                                <div {...getRootProps()} className={`mt-4 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}>
                                                    <input {...getInputProps()} />
                                                    <div className="space-y-1 text-center">
                                                        <Icon path={icons.file} className="mx-auto h-12 w-12 text-slate-400" />
                                                        <div className="flex text-sm text-slate-600">
                                                            <p className="pl-1">{balanceSheetFile ? `File selezionato: ${balanceSheetFile.name}` : 'Trascina qui il tuo bilancio in PDF o clicca per selezionarlo'}</p>
                                                        </div>
                                                        <p className="text-xs text-slate-500">PDF fino a 10MB</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
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
