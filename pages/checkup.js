import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
// Puoi installare questa libreria per una UI di upload più carina: npm install react-dropzone
import { useDropzone } from 'react-dropzone';

export default function CheckupPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // --- LOGICA DI CHECKUP ---
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        // Dati azienda
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
        // Dati per analisi
        revenue_range: '',
        main_challenges: '',
        business_goals: ''
    });
    const [balanceSheetFile, setBalanceSheetFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    // --- FINE LOGICA DI CHECKUP ---

    // Verifica autenticazione (invariata)
    const checkAuthentication = () => {
        if (typeof window !== 'undefined' && window.Outseta) {
            window.Outseta.getUser()
                .then(user => {
                    if (user && user.Email) {
                        setIsAuthenticated(true);
                        setUserName(user.FirstName || user.Email.split('@')[0]);
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

    // Loading screen e Not Authenticated (invariati)
    if (isLoading || isAuthenticated === null) { /* ... codice invariato ... */ }
    if (isAuthenticated === false) { /* ... codice invariato ... */ }

    // --- FUNZIONI DI CHECKUP ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleNextStep = (e) => {
        e.preventDefault();
        // Aggiungi qui la validazione per lo step 1 se necessario
        if (formData.company_name && formData.industry_sector && formData.company_size) {
            setCurrentStep(2);
        } else {
            alert('Per favore, compila tutti i campi obbligatori (*)');
        }
    };

    const handlePrevStep = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!balanceSheetFile) {
            alert('Per favore, carica un documento di bilancio.');
            return;
        }
        setIsSubmitting(true);
        setCurrentStep(3); // Vai allo step di analisi
        console.log('Form submitted:', { ...formData, file: balanceSheetFile.name });

        // TODO: Implementare invio dati a Supabase (crea sessione) e upload file a Supabase Storage
        // La Supabase Function `process-balance-sheet` si occuperà del resto.
        
        // Simulazione caricamento
        setTimeout(() => {
            setAnalysisResult({ summary: "Analisi completata con successo! Ecco i tuoi risultati..." });
            setIsSubmitting(false);
        }, 5000);
    };
    
    // --- COMPONENTI UI ---
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

    const onDrop = useCallback(acceptedFiles => {
        setBalanceSheetFile(acceptedFiles[0]);
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false
    });

    // RITORNO COMPONENTE PRINCIPALE
    return (
        <>
            <Head>
                {/* ... codice head invariato ... */}
            </Head>

            <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
                <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    {/* ... codice sidebar invariato ... */}
                </aside>

                {isSidebarOpen && <div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
                
                <div className="flex flex-col flex-1 w-0 overflow-hidden">
                    <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                        {/* ... codice header mobile invariato ... */}
                    </header>

                    <main className="relative flex-1 overflow-y-auto focus:outline-none">
                        <div className="py-6 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                            
                            <div className="mb-8">
                                {/* ... codice breadcrumb e titolo pagina invariati ... */}
                                
                                {/* Progress Steps DINAMICO */}
                                <div className="flex items-center justify-center space-x-4 mb-8">
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
                                                    1. Informazioni Azienda
                                                </h3>
                                                {/* ... tutto il form da "Nome Azienda" a "Descrizione Attività" ... */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Qui vanno tutti i tuoi campi input... li ometto per brevità */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Nome Azienda *</label>
                                                        <input type="text" name="company_name" required value={formData.company_name} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="La tua azienda..." />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Partita IVA</label>
                                                        <input type="text" name="vat_number" value={formData.vat_number} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="IT..." />
                                                    </div>
                                                    {/* ... altri campi ... */}
                                                </div>
                                            </div>

                                            <div className="border-t pt-8">
                                                <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center">
                                                    <Icon path={icons.spark} className="w-6 h-6 mr-3 text-blue-600" />
                                                    2. Obiettivi e Sfide
                                                </h3>
                                                {/* ... Textarea per Obiettivi e Sfide ... */}
                                                <div className="space-y-6">
                                                   {/* ... textarea ... */}
                                                </div>
                                            </div>

                                            <div className="border-t pt-8">
                                                <div className="flex justify-end">
                                                    <button type="button" onClick={handleNextStep}
                                                        className="flex items-center space-x-3 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                                        <span>Avanti</span>
                                                        {/* Icona freccia a destra */}
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
                                                    3. Carica il Bilancio
                                                </h3>
                                                <div {...getRootProps()} className={`mt-4 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}>
                                                    <div className="space-y-1 text-center">
                                                        <Icon path={icons.file} className="mx-auto h-12 w-12 text-slate-400" />
                                                        <div className="flex text-sm text-slate-600">
                                                            <p className="pl-1">{balanceSheetFile ? `File selezionato: ${balanceSheetFile.name}` : 'Trascina qui il tuo bilancio in PDF o clicca per selezionarlo'}</p>
                                                        </div>
                                                        <p className="text-xs text-slate-500">PDF fino a 10MB</p>
                                                    </div>
                                                    <input {...getInputProps()} />
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
                                                        <Icon path={icons.spark} className="w-5 h-5" />
                                                        <span>Avvia Analisi AI</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* --- STEP 3: ANALISI IN CORSO --- */}
                                    {currentStep === 3 && (
                                        <div className="text-center py-12">
                                            {isSubmitting ? (
                                                <>
                                                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                                    <h3 className="text-xl font-semibold text-slate-900">Analisi in corso...</h3>
                                                    <p className="text-slate-600 mt-2">L'AI sta analizzando i tuoi dati. Potrebbero essere necessari alcuni minuti.</p>
                                                </>
                                            ) : (
                                                <>
                                                    <h3 className="text-2xl font-bold text-green-600">Analisi Completata!</h3>
                                                    <p className="text-slate-700 mt-4">{analysisResult?.summary}</p>
                                                    <Link href="/">
                                                      <a className="mt-8 inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                                          Vai alla Dashboard
                                                      </a>
                                                    </Link>
                                                </>
                                            )}
                                        </div>
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
