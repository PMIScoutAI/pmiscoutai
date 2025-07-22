import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
// L'import di supabase qui non è più necessario per il submit, 
// ma potrebbe servire per altre funzionalità in futuro.
// import { supabase } from '../utils/supabaseClient'; 

export default function CheckupPage() {
    // STATI (invariati)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter(); 
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        company_name: '',
        vat_number: '',
        industry_sector: '',
        company_size: '',
        // ... tutti gli altri campi del form
    });
    const [balanceSheetFile, setBalanceSheetFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- LOGICA DI AUTENTICAZIONE (semplificata, non serve più sync) ---
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

    // --- FUNZIONE DI SUBMIT (COMPLETAMENTE NUOVA) ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!balanceSheetFile) {
            alert('Per favore, carica un documento di bilancio.');
            return;
        }
        setIsSubmitting(true);

        try {
            // 1. Ottieni il token di accesso da Outseta per autenticare la chiamata
            const outsetaToken = await window.Outseta.getAccessToken();
            if (!outsetaToken) {
                throw new Error("Token di autenticazione non trovato. Prova a ricaricare la pagina.");
            }

            // 2. Prepara i dati da inviare
            // Usiamo FormData per inviare sia i dati JSON che il file
            const submissionData = new FormData();
            submissionData.append('formData', JSON.stringify(formData));
            submissionData.append('file', balanceSheetFile);

            // 3. Chiama la nostra Edge Function sicura
            const response = await fetch('/api/process-analysis', { // Useremo un API Route di Next.js come proxy
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${outsetaToken}`
                },
                body: submissionData,
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'Errore del server');
            }

            const result = await response.json();
            const { sessionId } = result;

            // 4. Reindirizza l'utente alla pagina di analisi
            router.push(`/analisi/${sessionId}`);

        } catch (error) {
            console.error("Errore durante l'avvio dell'analisi:", error);
            alert(`Si è verificato un errore: ${error.message}. Riprova più tardi.`);
            setIsSubmitting(false);
        }
    };
    
    // ... (tutto il resto del codice JSX per la UI rimane invariato)
    // ... (handleInputChange, handleNextStep, onDrop, icone, ecc.)
    
    // Il return() con il JSX della pagina rimane lo stesso di prima
    return (
        <>
            {/* ... Il tuo JSX completo qui ... */}
        </>
    );
}
