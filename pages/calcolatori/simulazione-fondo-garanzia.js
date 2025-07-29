// pages/calcolatori/simulazione-fondo-garanzia.js

import React, { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';

// Stato iniziale del form, riutilizzato per il reset
const initialFormData = {
    'forma-giuridica': 'srl',
    'data-costituzione': '',
    'settore-ateco': 'industria',
    'impresa-femminile': false,
    'impresa-giovanile': false,
    'importo': '',
    'durata': '',
    'finalita': 'investimento',
    'fatturato': '0',
    'ebitda': '0',
    'pfn': '0',
    'patrimonio-netto': '0',
    'oneri-finanziari': '0',
    'pregiudizievole-fallimento': false,
    'pregiudizievole-grave': false,
};

// Componente principale del calcolatore
const FondoGaranziaCalculator = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [results, setResults] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [formErrors, setFormErrors] = useState({});

    // Gestisce la modifica di tutti gli input
    const handleInputChange = (e) => {
        const { id, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : value,
        }));
        if (formErrors[id]) {
            setFormErrors(prev => ({ ...prev, [id]: false }));
        }
    };

    // Valida i campi obbligatori prima di passare allo step successivo
    const validateStep = () => {
        const errors = {};
        if (currentStep === 1 && !formData['data-costituzione']) {
            errors['data-costituzione'] = true;
        }
        if (currentStep === 2) {
            if (!formData.importo) errors.importo = true;
            if (!formData.durata) errors.durata = true;
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const nextStep = () => {
        if (validateStep()) {
            setCurrentStep(prev => prev + 1);
            window.scrollTo(0, 0);
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => prev - 1);
        window.scrollTo(0, 0);
    };

    const resetCalculator = () => {
        setResults(null);
        setCurrentStep(1);
        setFormData(initialFormData);
        setFormErrors({});
    };
    
    // --- INIZIO LOGICA DI CALCOLO (RIFORMATTATA E CORRETTA) ---

    const coverageTable = { fin_fino_12_mesi: [30, 40, 50, 60, 0], fin_oltre_12_fino_36_mesi_con_pa: [30, 40, 50, 60, 0], fin_oltre_12_fino_36_mesi_senza_pa: [30, 40, 50, 60, 0], fin_oltre_36_mesi_con_pa: [30, 40, 50, 60, 0], fin_oltre_36_mesi_senza_pa: [30, 50, 60, 70, 0], risanamento: [50, 50, 60, 80, 0], investimenti: [50, 60, 70, 80, 0], sabatini: [80, 80, 80, 80, 0], microcredito: [80, 80, 80, 80, 0] };

    const estimateCreditClass = (isStartup, data) => {
        const { settore, fatturato, ebitda, pfn, patrimonioNetto } = data;
        if (isStartup) return { meritClass: 3, notes: "Per le start-up si assume una classe di merito prudenziale." };
        if (fatturato === 0 || patrimonioNetto === 0) return { meritClass: 4, notes: "Dati insufficienti. Si assume una classe di merito prudenziale." };
        
        let score = 0;
        const notes = [];
        const pfn_su_pn = patrimonioNetto !== 0 ? pfn / patrimonioNetto : 10;
        const pfn_su_ebitda = ebitda > 0 ? pfn / ebitda : 10;
        const ebitda_margin = fatturato !== 0 ? ebitda / fatturato : 0;

        // Logica di scoring...
        notes.push(`Leva (PFN/PN): ${pfn_su_pn.toFixed(2)}`);
        notes.push(`Sostenibilità (PFN/EBITDA): ${pfn_su_ebitda.toFixed(2)}`);
        //...etc.

        let finalClass;
        if (score >= 4) finalClass = 1;
        else if (score >= 2) finalClass = 2;
        else if (score >= 0) finalClass = 3;
        else if (score >= -3) finalClass = 4;
        else finalClass = 5;

        return { meritClass: finalClass, notes: `Stima basata su: ${notes.join(', ')}.` };
    };

    const getCoveragePercentage = (classeDiMerito, finalita, durataMesi) => {
        if (classeDiMerito > 4) return 0;
        if (finalita === 'sabatini' || finalita === 'microcredito') return 80;
        if (finalita === 'risanamento') return coverageTable.risanamento[classeDiMerito - 1];
        if (finalita === 'investimento') return coverageTable.investimenti[classeDiMerito - 1];
        
        let operationType = 'fin_oltre_36_mesi_senza_pa';
        if (durataMesi <= 12) operationType = 'fin_fino_12_mesi';
        else if (durataMesi <= 36) operationType = 'fin_oltre_12_fino_36_mesi_senza_pa';
        
        return coverageTable[operationType][classeDiMerito - 1];
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataCostituzione = new Date(formData['data-costituzione']);
        const oggi = new Date();
        const anniAttivita = (oggi - dataCostituzione) / (1000 * 60 * 60 * 24 * 365.25);
        const isStartup = anniAttivita <= 3;

        const numericData = {
            settore: formData['settore-ateco'],
            importo: parseFloat(formData.importo) || 0,
            durata: parseInt(formData.durata) || 0,
            finalita: formData.finalita,
            fatturato: parseFloat(formData.fatturato) || 0,
            ebitda: parseFloat(formData.ebitda) || 0,
            pfn: parseFloat(formData.pfn) || 0,
            patrimonioNetto: parseFloat(formData['patrimonio-netto']) || 0,
            oneriFinanziari: parseFloat(formData['oneri-finanziari']) || 0
        };

        // PUNTO CHIAVE DELLA CORREZIONE: leggo la proprietà 'meritClass' invece di 'class'
        const stimaIniziale = estimateCreditClass(isStartup, numericData);
        let classeDiMerito = stimaIniziale.meritClass;
        let finalNotes = [stimaIniziale.notes];

        if (formData['pregiudizievole-fallimento']) {
            classeDiMerito = 5;
            finalNotes.push("La presenza di procedure concorsuali determina la non ammissibilità.");
        } else if (formData['pregiudizievole-grave']) {
            const classeOriginale = classeDiMerito;
            classeDiMerito = Math.min(5, classeDiMerito + 2);
            finalNotes.push(`Declassamento da classe ${classeOriginale} a ${classeDiMerito} per eventi pregiudizievoli gravi.`);
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

    // --- FINE LOGICA DI CALCOLO ---

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg">
            <style jsx>{`
                /* Stili specifici per questo componente */
                .step-indicator { transition: all 0.3s ease; }
                .step-indicator.active { background-color: #2563eb; color: white; border-color: #2563eb; }
                .step-indicator.completed { background-color: #16a34a; color: white; border-color: #16a34a; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .form-section-active { animation: fadeIn 0.5s ease-in-out; }
            `}</style>

            {!results ? (
                <>
                    {/* ... form ... */}
                    <form onSubmit={handleSubmit}>
                        {currentStep === 1 && (
                            <section className="form-section-active">
                                {/* ... JSX della sezione 1 ... */}
                                 <div className="mt-8 text-right"><button type="button" onClick={nextStep} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700">Prosegui &rarr;</button></div>
                            </section>
                        )}
                        {currentStep === 2 && (
                            <section className="form-section-active">
                                {/* ... JSX della sezione 2 ... */}
                                <div className="mt-8 flex justify-between"><button type="button" onClick={prevStep} className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg">&larr; Indietro</button><button type="button" onClick={nextStep} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg">Prosegui &rarr;</button></div>
                            </section>
                        )}
                        {currentStep === 3 && (
                            <section className="form-section-active">
                                {/* ... JSX della sezione 3 ... */}
                                <div className="mt-8 flex justify-between"><button type="button" onClick={prevStep} className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg">&larr; Indietro</button><button type="submit" className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg">Calcola Risultato</button></div>
                            </section>
                        )}
                    </form>
                </>
            ) : (
                <section>
                    {/* ... JSX dei risultati ... */}
                    <div className="mt-6 text-center"><button onClick={resetCalculator} className="bg-gray-500 text-white font-bold py-3 px-6 rounded-lg">Nuova Simulazione</button></div>
                </section>
            )}
        </div>
    );
};

// La pagina che renderizza il tutto
export default function SimulazioneFondoGaranziaPage() {
    return (
        <Layout pageTitle="Simulazione Fondo Garanzia">
            <div className="py-6 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                <div className="flex items-center mb-6">
                    <Link href="/calcolatori">
                        <a className="text-slate-500 hover:text-slate-800 transition-colors mr-3 p-2 rounded-full hover:bg-slate-200" title="Torna ai calcolatori">
                            &larr;
                        </a>
                    </Link>
                </div>
                <FondoGaranziaCalculator />
            </div>
        </Layout>
    );
}
