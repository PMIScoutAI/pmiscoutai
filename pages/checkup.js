import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
// NOTA: Il client supabase non è più necessario per il submit, 
// ma potrebbe servire per altre funzionalità della pagina.
// import { supabase } from '../utils/supabaseClient'; 

export default function CheckupPage() {
    // STATI PRINCIPALI
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    // STATI DEL FORM
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        company_name: '',
        industry_sector: '',
        company_size: '',
        // Aggiungi qui altri campi se vuoi passarli al backend
    });
    const [balanceSheetFile, setBalanceSheetFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    // --- LOGICA DI AUTENTICAZIONE (SEMPLIFICATA) ---
    useEffect(() => {
        const verifyAuth = () => {
            if (typeof window !== 'undefined' && window.Outseta) {
                window.Outseta.getUser()
                    .then(user => {
                        if (user && user.Uid) {
                            setUserName(user.FirstName || user.Email.split('@')[0]);
                            setIsLoading(false);
                        } else {
                            // Reindirizza al login se l'utente non è autenticato
                            const returnUrl = encodeURIComponent(window.location.href);
                            window.location.href = `https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=${returnUrl}`;
                        }
                    })
                    .catch(() => {
                        window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login';
                    });
            } else {
                setTimeout(verifyAuth, 100); // Riprova se Outseta non è ancora caricato
            }
        };
        verifyAuth();
    }, []);

    // --- GESTIONE INPUT FORM ---
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

    const handlePrevStep = () => setCurrentStep(prev => prev - 1);

    // --- NUOVA FUNZIONE DI SUBMIT CHE CHIAMA LA EDGE FUNCTION ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!balanceSheetFile) {
            alert('Per favore, carica un documento di bilancio.');
            return;
        }
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // 1. Ottieni il token di accesso da Outseta. Questo è il nostro "pass" per il backend.
            const accessToken = await window.Outseta.getAccessToken();
            if (!accessToken) {
                throw new Error("Impossibile ottenere il token di accesso. Effettua nuovamente il login.");
            }

            // 2. Prepara i dati del form per l'invio
            const submissionData = new FormData();
            submissionData.append('formData', JSON.stringify(formData));
            submissionData.append('file', balanceSheetFile, balanceSheetFile.name);

            // 3. Chiama la tua Edge Function con l'URL corretto
            const response = await fetch(`https://oddjoobuvlyycycocuel.supabase.co/functions/v1/process-balance-sheet`, {
                method: 'POST',
                headers: {
                    // Passa il token per l'autenticazione
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: submissionData,
            });
            
            const result = await response.json();

            if (!response.ok) {
                // Se la risposta non è OK, l'errore viene dal backend
                throw new Error(result.error || 'Si è verificato un errore sconosciuto.');
            }

            // 4. Se tutto va a buon fine, reindirizza alla pagina del report
            console.log('🎉 Processo completato! Redirect alla sessione:', result.sessionId);
            router.push(`/analisi/${result.sessionId}`);

        } catch (error) {
            console.error("💥 Errore durante l'invio:", error);
            setSubmitError(error.message);
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
    
    // Il resto del tuo componente (icone, UI, etc.) rimane invariato...
    // Per brevità, ho omesso la parte JSX che è molto lunga e non necessita modifiche.
    // Devi solo assicurarti che il form chiami `handleSubmit` e che mostri `submitError` se presente.

    // Esempio di come mostrare l'errore nel tuo JSX, da inserire prima del pulsante di submit
    const renderSubmitError = () => {
        if (!submitError) return null;
        return (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                <strong className="font-bold">Errore: </strong>
                <span className="block sm:inline">{submitError}</span>
            </div>
        );
    };

    // --- RITORNO DEL COMPONENTE PRINCIPALE ---
    // Includi qui il tuo JSX esistente. Assicurati che il form abbia `onSubmit={handleSubmit}`
    // e che i pulsanti gestiscano correttamente `isSubmitting`.
    // Aggiungi `renderSubmitError()` nel punto appropriato del form (es. prima dei pulsanti).
    return (
        // ... Il tuo JSX completo va qui ...
        // Esempio del pulsante di submit modificato:
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
            {/* ... resto del JSX ... */}
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* ... step 1 ... */}
                {currentStep === 2 && (
                    <>
                    {/* ... dropzone ... */}
                    {renderSubmitError()} 
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
                                    // <Icon path={icons.spark} className="w-5 h-5" />
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v6l4-4-4-4M12 21v-6l-4 4 4 4M3 12h6l-4-4 4-4M21 12h-6l4 4-4 4"></path></svg>
                                )}
                                <span>{isSubmitting ? 'Invio in corso...' : 'Avvia Analisi AI'}</span>
                            </button>
                        </div>
                    </div>
                    </>
                )}
            </form>
            {/* ... resto del JSX ... */}
        </>
    );
}
