import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// ===================================================================
// ===         COMPONENTE RIUTILIZZABILE DEL CALCOLATORE           ===
// ===================================================================
const FondoGaranziaCalculator = () => {
    // --- GESTIONE DELLO STATO CON REACT ---
    const [currentStep, setCurrentStep] = useState(1);
    const [results, setResults] = useState(null); // null = form attivo, object = risultati visibili

    // Stato per tutti i campi del form
    const [formData, setFormData] = useState({
        formaGiuridica: 'srl',
        dataCostituzione: '',
        settoreAteco: 'industria',
        impresaFemminile: false,
        impresaGiovanile: false,
        importo: '',
        durata: '',
        finalita: 'investimento',
        fatturato: 0,
        ebitda: 0,
        pfn: 0,
        patrimonioNetto: 0,
        oneriFinanziari: 0,
        hasFallimento: false,
        hasPregiudizievoleGrave: false,
    });

    const [formErrors, setFormErrors] = useState({});

    // --- FUNZIONI DI GESTIONE ---

    const handleInputChange = (e) => {
        const { id, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : value,
        }));
    };

    const validateStep = (step) => {
        const errors = {};
        if (step === 1) {
            if (!formData.dataCostituzione) errors.dataCostituzione = true;
        }
        if (step === 2) {
            if (!formData.importo) errors.importo = true;
            if (!formData.durata) errors.durata = true;
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const nextStep = (step) => {
        if (validateStep(currentStep)) {
            setCurrentStep(step);
            window.scrollTo(0, 0);
        }
    };

    const prevStep = (step) => {
        setCurrentStep(step);
        window.scrollTo(0, 0);
    };

    const resetCalculator = () => {
        setResults(null);
        setCurrentStep(1);
        setFormData({ /* reset initial state */ });
    };
    
    // --- LOGICA DI CALCOLO (ADATTATA DAL TUO SCRIPT) ---
    const coverageTable = { /* ... la tua tabella di copertura ... */ };

    const estimateCreditClass = (isStartup, data) => { /* ... la tua funzione di stima ... */ };
    
    const getCoveragePercentage = (classeDiMerito, finalita, durataMesi) => { /* ... la tua funzione di copertura ... */ };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const dataCostituzione = new Date(formData.dataCostituzione);
        const oggi = new Date();
        const anniAttivita = (oggi - dataCostituzione) / (1000 * 60 * 60 * 24 * 365.25);
        const isStartup = anniAttivita <= 3;
        
        const numericData = {
            settore: formData.settoreAteco,
            importo: parseFloat(formData.importo) || 0,
            durata: parseInt(formData.durata) || 0,
            finalita: formData.finalita,
            fatturato: parseFloat(formData.fatturato) || 0,
            ebitda: parseFloat(formData.ebitda) || 0,
            pfn: parseFloat(formData.pfn) || 0,
            patrimonioNetto: parseFloat(formData.patrimonioNetto) || 0,
            oneriFinanziari: parseFloat(formData.oneriFinanziari) || 0
        };

        let { class: classeDiMerito, notes: classNotes } = estimateCreditClass(isStartup, numericData);
        let finalNotes = [classNotes];

        if (formData.hasFallimento) {
            classeDiMerito = 5;
            finalNotes.push("La presenza di procedure concorsuali determina la non ammissibilità.");
        } else if (formData.hasPregiudizievoleGrave) {
            const classeOriginale = classeDiMerito;
            classeDiMerito = Math.min(5, classeDiMerito + 2); // Declassamento
            finalNotes.push(`La presenza di eventi pregiudizievoli gravi ha causato un declassamento da classe ${classeOriginale} a ${classeDiMerito}.`);
        }

        const coveragePercentage = getCoveragePercentage(classeDiMerito, numericData.finalita, numericData.durata);
        const importoGarantito = numericData.importo * (coveragePercentage / 100);

        setResults({
            classe: classeDiMerito,
            percentuale: coveragePercentage,
            importoGarantito: importoGarantito,
            notes: finalNotes.join(' ')
        });
        window.scrollTo(0, 0);
    };

    // --- JSX (HTML CONVERTITO PER REACT) ---
    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg">
             {/* Stili CSS custom incapsulati con JSX-Styled */}
             <style jsx>{`
                .step-indicator { transition: all 0.3s ease; }
                .step-indicator.active { background-color: #2563eb; color: white; border-color: #2563eb; }
                .step-indicator.completed { background-color: #16a34a; color: white; border-color: #16a34a; }
                .form-section { display: none; }
                .form-section.active { display: block; animation: fadeIn 0.5s ease-in-out; }
                .result-card { border-left-width: 4px; }
                .result-card-green { border-color: #16a34a; }
                .result-card-red { border-color: #dc2626; }
                .tooltip { position: relative; display: inline-block; }
                .tooltip .tooltiptext { visibility: hidden; width: 220px; background-color: #555; color: #fff; text-align: center; border-radius: 6px; padding: 5px; position: absolute; z-index: 1; bottom: 125%; left: 50%; margin-left: -110px; opacity: 0; transition: opacity 0.3s; }
                .tooltip:hover .tooltiptext { visibility: visible; opacity: 1; }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
             `}</style>
             
            {!results ? (
                <>
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Simulatore Garanzia MCC</h1>
                        <p className="mt-2 text-lg text-gray-600">Verifica l'ammissibilità e stima la copertura del Fondo.</p>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex items-center justify-center space-x-4 md:space-x-8 mb-10">
                        {[1, 2, 3].map((step, index, arr) => (
                            <React.Fragment key={step}>
                                <div className={`step-indicator flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold text-lg ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}>
                                    {step}
                                </div>
                                {index < arr.length - 1 && <div className="flex-1 h-1 bg-gray-200"></div>}
                            </React.Fragment>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Sezione 1: Dati Impresa */}
                        <div className={`form-section ${currentStep === 1 ? 'active' : ''}`}>
                             {/* ... I tuoi campi del form per la sezione 1 ... */}
                             {/* Esempio per un campo: */}
                             <label htmlFor="data-costituzione" className="block text-sm font-medium text-gray-700 mb-1">Data di Costituzione</label>
                             <input type="date" id="data-costituzione" value={formData.dataCostituzione} onChange={handleInputChange} required className={`w-full p-3 border rounded-lg shadow-sm ${formErrors.dataCostituzione ? 'border-red-500' : 'border-gray-300'}`} />
                            
                             <div className="mt-8 text-right">
                                <button type="button" onClick={() => nextStep(2)} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700">Prosegui &rarr;</button>
                            </div>
                        </div>

                        {/* Sezione 2: Dati Finanziamento */}
                        <div className={`form-section ${currentStep === 2 ? 'active' : ''}`}>
                            {/* ... I tuoi campi del form per la sezione 2 ... */}
                            <div className="mt-8 flex justify-between">
                                <button type="button" onClick={() => prevStep(1)} className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-300">&larr; Indietro</button>
                                <button type="button" onClick={() => nextStep(3)} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700">Prosegui &rarr;</button>
                            </div>
                        </div>

                        {/* Sezione 3: Dati Economici */}
                        <div className={`form-section ${currentStep === 3 ? 'active' : ''}`}>
                            {/* ... I tuoi campi del form per la sezione 3 ... */}
                            <div className="mt-8 flex justify-between">
                                <button type="button" onClick={() => prevStep(2)} className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-300">&larr; Indietro</button>
                                <button type="submit" className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700">Calcola Risultato</button>
                            </div>
                        </div>
                    </form>
                </>
            ) : (
                // --- SEZIONE RISULTATI ---
                <div>
                     <h2 className="text-2xl font-semibold mb-6 text-center">Risultato della Simulazione</h2>
                     {/* ... Il tuo HTML dei risultati, ora come JSX ... */}
                     <div className="mt-6 text-center">
                        <button onClick={resetCalculator} className="bg-gray-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600">Nuova Simulazione</button>
                    </div>
                </div>
            )}
            
            {/* ... il tuo footer con le avvertenze ... */}

        </div>
    );
};


// ===================================================================
// ===       PAGINA PRINCIPALE CHE USA IL COMPONENTE               ===
// ===================================================================
export default function SimulazioneFondoGaranziaPage() {
    // La logica di autenticazione e layout della pagina rimane qui
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // ... la tua logica di autenticazione Outseta ...
        const checkAuth = () => { if (window.Outseta) { /*...*/ } };
        checkAuth();
    }, []);

    if (isLoading || !isAuthenticated) {
        return <div className="flex items-center justify-center min-h-screen">Caricamento e verifica autenticazione...</div>;
    }

    return (
        <>
            <Head>
                <title>Simulazione Fondo Garanzia - PMIScout</title>
                <meta name="description" content="Simulatore professionale per il Fondo di Garanzia MCC." />
            </Head>
            {/* Qui includi la tua layout comune (es. Sidebar, Header) */}
            <div className="relative flex min-h-screen bg-slate-50">
                {/* <Sidebar /> */}
                <main className="flex-1">
                    <div className="py-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center mb-6">
                            <Link href="/calcolatori">
                                <a className="text-slate-500 hover:text-slate-800 mr-3 p-2 rounded-full hover:bg-slate-200">&larr;</a>
                            </Link>
                            {/* Non serve un titolo qui perché è già dentro il componente calcolatore */}
                        </div>
                        
                        {/* IL COMPONENTE DEL CALCOLATORE VIENE INSERITO QUI */}
                        <FondoGaranziaCalculator />

                    </div>
                </main>
            </div>
        </>
    );
}
