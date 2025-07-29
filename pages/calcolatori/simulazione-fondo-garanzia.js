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

// Componente per il disclaimer, per mantenere il codice pulito
const DisclaimerBox = () => (
    <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg text-sm text-yellow-800">
        <h3 className="font-bold text-base mb-2">Avvertenze e Limitazioni del Simulatore</h3>
        <ul className="list-disc list-inside space-y-1">
            <li>Questo strumento fornisce una <strong>stima preliminare e non vincolante</strong> e non costituisce garanzia di ottenimento della garanzia.</li>
            <li>La stima si basa su un modello semplificato che <strong>non include l'analisi andamentale</strong> (Centrale Rischi), parametro determinante nel rating finale.</li>
            <li>La decisione finale sull'ammissione alla garanzia è di <strong>esclusiva competenza del Gestore del Fondo</strong> (MCC S.p.A.) e della banca proponente.</li>
        </ul>
    </div>
);


// Componente principale del calcolatore
const FondoGaranziaCalculator = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [results, setResults] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [formErrors, setFormErrors] = useState({});
    // Nuovo stato per la gestione del disclaimer
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);


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
        setDisclaimerAccepted(false); // Resetta anche il disclaimer
    };
    
    // --- LOGICA DI CALCOLO (COMPLETA E FORMATTATA CORRETTAMENTE) ---
    const coverageTable = { fin_fino_12_mesi: [30, 40, 50, 60, 0], fin_oltre_12_fino_36_mesi_con_pa: [30, 40, 50, 60, 0], fin_oltre_12_fino_36_mesi_senza_pa: [30, 40, 50, 60, 0], fin_oltre_36_mesi_con_pa: [30, 40, 50, 60, 0], fin_oltre_36_mesi_senza_pa: [30, 50, 60, 70, 0], risanamento: [50, 50, 60, 80, 0], investimenti: [50, 60, 70, 80, 0], sabatini: [80, 80, 80, 80, 0], microcredito: [80, 80, 80, 80, 0] };
    
    const estimateCreditClass = (isStartup, data) => {
        const { settore, fatturato, ebitda, pfn, patrimonioNetto } = data;

        if (isStartup) {
            return { meritClass: 3, notes: "Per le start-up, la valutazione si basa sul business plan. Si assume una classe di merito prudenziale." };
        }
        if (fatturato === 0 || patrimonioNetto === 0) {
            return { meritClass: 4, notes: "Dati economici insufficienti per una stima precisa. Si assume una classe di merito prudenziale." };
        }

        let score = 0;
        const notes = [];

        const pfn_su_pn = patrimonioNetto !== 0 ? pfn / patrimonioNetto : 10;
        const pfn_su_ebitda = ebitda > 0 ? pfn / ebitda : 10;
        const ebitda_margin = fatturato !== 0 ? ebitda / fatturato : 0;

        switch (settore) {
            case 'industria':
            case 'servizi':
                if (pfn_su_pn < 2) score += 2; else if (pfn_su_pn > 5) score -= 2; else score -= 1;
                notes.push(`Leva (PFN/PN) di ${pfn_su_pn.toFixed(2)}`);
                if (pfn_su_ebitda < 3) score += 2; else if (pfn_su_ebitda > 6) score -= 2; else score -= 1;
                notes.push(`Sostenibilità Debito (PFN/EBITDA) di ${pfn_su_ebitda.toFixed(2)}`);
                if (ebitda_margin > 0.1) score += 2; else if (ebitda_margin < 0.03) score -= 2; else score += 1;
                notes.push(`Redditività (EBITDA Margin) del ${(ebitda_margin * 100).toFixed(1)}%`);
                break;
            case 'commercio':
                if (pfn_su_pn < 3) score += 2; else if (pfn_su_pn > 6) score -= 2; else score -= 1;
                notes.push(`Leva (PFN/PN) di ${pfn_su_pn.toFixed(2)}`);
                if (pfn_su_ebitda < 4) score += 2; else if (pfn_su_ebitda > 7) score -= 2; else score -= 1;
                notes.push(`Sostenibilità Debito (PFN/EBITDA) di ${pfn_su_ebitda.toFixed(2)}`);
                if (ebitda_margin > 0.05) score += 2; else if (ebitda_margin < 0.01) score -= 2; else score += 1;
                notes.push(`Redditività (EBITDA Margin) del ${(ebitda_margin * 100).toFixed(1)}%`);
                break;
            case 'edilizia':
            case 'immobiliare':
                if (pfn_su_pn < 1.5) score += 2; else if (pfn_su_pn > 4) score -= 2; else score -= 1;
                notes.push(`Leva (PFN/PN) di ${pfn_su_pn.toFixed(2)}`);
                const pn_su_fatturato = fatturato !== 0 ? patrimonioNetto / fatturato : 0;
                if (pn_su_fatturato > 0.3) score += 2; else if (pn_su_fatturato < 0.1) score -= 2; else score += 1;
                notes.push(`Solidità (PN/Fatturato) di ${pn_su_fatturato.toFixed(2)}`);
                if (ebitda_margin > 0.12) score += 2; else if (ebitda_margin < 0.05) score -= 2; else score += 1;
                notes.push(`Redditività (EBITDA Margin) del ${(ebitda_margin * 100).toFixed(1)}%`);
                break;
            default:
                break;
        }

        if (patrimonioNetto < 0) { score -= 3; notes.push("Patrimonio Netto negativo (forte penalità)."); }
        if (ebitda < 0) { score -= 3; notes.push("EBITDA negativo (forte penalità)."); }

        let finalClass;
        if (score >= 4) finalClass = 1; else if (score >= 2) finalClass = 2; else if (score >= 0) finalClass = 3; else if (score >= -3) finalClass = 4; else finalClass = 5;
        
        return { meritClass: finalClass, notes: `Stima basata su: ${notes.join(', ')}.` };
    };
    
    const getCoveragePercentage = (classeDiMerito, finalita, durataMesi) => { if (classeDiMerito > 4) return 0; if (finalita === 'sabatini' || finalita === 'microcredito') return 80; if (finalita === 'risanamento') return coverageTable.risanamento[classeDiMerito - 1]; if (finalita === 'investimento') return coverageTable.investimenti[classeDiMerito - 1]; let operationType = 'fin_oltre_36_mesi_senza_pa'; if (durataMesi <= 12) operationType = 'fin_fino_12_mesi'; else if (durataMesi <= 36) operationType = 'fin_oltre_12_fino_36_mesi_senza_pa'; return coverageTable[operationType][classeDiMerito - 1]; };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!disclaimerAccepted) return; // Sicurezza aggiuntiva
        const dataCostituzione = new Date(formData['data-costituzione']); const oggi = new Date(); const anniAttivita = (oggi - dataCostituzione) / (1000 * 60 * 60 * 24 * 365.25); const isStartup = anniAttivita <= 3;
        const numericData = { settore: formData['settore-ateco'], importo: parseFloat(formData.importo) || 0, durata: parseInt(formData.durata) || 0, finalita: formData.finalita, fatturato: parseFloat(formData.fatturato) || 0, ebitda: parseFloat(formData.ebitda) || 0, pfn: parseFloat(formData.pfn) || 0, patrimonioNetto: parseFloat(formData['patrimonio-netto']) || 0, oneriFinanziari: parseFloat(formData['oneri-finanziari']) || 0 };
        const stimaIniziale = estimateCreditClass(isStartup, numericData); let classeDiMerito = stimaIniziale.meritClass; let finalNotes = [stimaIniziale.notes];
        if (formData['pregiudizievole-fallimento']) { classeDiMerito = 5; finalNotes.push("La presenza di procedure concorsuali determina la non ammissibilità."); } else if (formData['pregiudizievole-grave']) { const classeOriginale = classeDiMerito; classeDiMerito = Math.min(5, classeDiMerito + 2); finalNotes.push(`Declassamento da classe ${classeOriginale} a ${classeDiMerito} per eventi pregiudizievoli gravi.`); }
        const coveragePercentage = getCoveragePercentage(classeDiMerito, numericData.finalita, numericData.durata); const importoGarantito = numericData.importo * (coveragePercentage / 100);
        setResults({ meritClass: classeDiMerito, percentuale: coveragePercentage, importoGarantito: importoGarantito, notes: finalNotes.join(' ') });
        window.scrollTo(0, 0);
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg">
            <style jsx>{`
                /* ... stili ... */
            `}</style>

            {!results ? (
                <>
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Simulatore Garanzia MCC</h1>
                        <p className="mt-2 text-lg text-gray-600">Verifica l'ammissibilità e stima la copertura del Fondo di Garanzia.</p>
                    </div>
                    
                    {/* DISCLAIMER VISIBILE PRIMA DEL FORM */}
                    {currentStep === 1 && <DisclaimerBox />}

                    <div className="flex items-center justify-center space-x-4 md:space-x-8 mb-10">
                        {[1, 2, 3].map((step, index) => (
                            <React.Fragment key={step}>
                                <div className={`step-indicator flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold text-lg ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}>{step}</div>
                                {index < 2 && <div className="flex-1 h-1 bg-gray-200"></div>}
                            </React.Fragment>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                        {currentStep === 1 && (
                            <section> {/* ... form step 1 ... */} </section>
                        )}
                        {currentStep === 2 && (
                             <section> {/* ... form step 2 ... */} </section>
                        )}
                        {currentStep === 3 && (
                            <section>
                                {/* ... campi form step 3 ... */}
                                <hr className="my-8" />
                                <h3 className="text-xl font-semibold mb-4 text-center">Eventi Pregiudizievoli</h3>
                                <fieldset> {/* ... fieldset ... */} </fieldset>

                                {/* CHECKBOX DISCLAIMER OBBLIGATORIA */}
                                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-start">
                                        <input 
                                            id="disclaimer-accepted" 
                                            type="checkbox" 
                                            checked={disclaimerAccepted} 
                                            onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1" 
                                        />
                                        <label htmlFor="disclaimer-accepted" className="ml-3 block text-sm text-gray-800">
                                            Dichiaro di aver letto e compreso le <a href="#disclaimer" className="font-medium text-blue-600 hover:underline">avvertenze e limitazioni</a> dello strumento, consapevole che il risultato è una stima preliminare e non vincolante.
                                        </label>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-between">
                                    <button type="button" onClick={prevStep} className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors">&larr; Indietro</button>
                                    <button 
                                        type="submit" 
                                        disabled={!disclaimerAccepted}
                                        className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Calcola Risultato
                                    </button>
                                </div>
                            </section>
                        )}
                    </form>
                </>
            ) : (
                <section> {/* ... sezione risultati ... */} </section>
            )}
            <footer id="disclaimer" className="text-center mt-8 text-sm text-gray-500 border-t pt-6">
                <h3 className="font-semibold text-base text-gray-700 mb-2">Avvertenze e Limitazioni</h3>
                <p>Questo strumento fornisce una stima preliminare e non vincolante. La valutazione ufficiale del Fondo è più complessa e si basa anche su dati andamentali (Centrale Rischi).</p>
            </footer>
        </div>
    );
};

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
