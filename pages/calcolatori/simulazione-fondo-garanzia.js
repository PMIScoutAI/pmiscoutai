// pages/calcolatori/simulazione-fondo-garanzia.js
// VERSIONE AGGIORNATA - Ottobre 2024
// Conforme a documentazione ufficiale MCC

import React, { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';

// ============================================
// CONFIGURAZIONE INIZIALE
// ============================================

const initialFormData = {
    'forma-giuridica': 'srl',
    'data-costituzione': '',
    'settore-ateco': 'industria',
    'impresa-femminile': false,
    'impresa-giovanile': false,
    'importo': '',
    'durata': '',
    'finalita': 'investimento',
    'tipo-garanzia': 'diretta', // NUOVO: distinzione diretta vs riassicurazione
    'fatturato': '0',
    'ebitda': '0',
    'pfn': '0',
    'patrimonio-netto': '0',
    'oneri-finanziari': '0',
    'pregiudizievole-fallimento': false,
    'pregiudizievole-grave': false,
    'cr-pulita': null, // NUOVO: checkbox CR
};

// ============================================
// TABELLE COPERTURE UFFICIALI MCC 2024
// ============================================

const coverageTablesOfficial = {
    diretta: {
        liquidita_12m: [null, 40, 50, 60, null], // Classe 1 = non ammissibile
        liquidita_12_36m_senza_pa: [30, 40, 50, 60, null],
        liquidita_oltre_36m_senza_pa: [30, 30, 50, 60, null],
        investimenti: [50, 60, 70, 80, null],
        risanamento: [50, 50, 60, 80, null],
        sabatini: [80, 80, 80, 80, null],
        microcredito: [80, 80, 80, 80, null]
    },
    riassicurazione: {
        liquidita_12m: [null, 40, 50, 60, null],
        liquidita_12_36m_senza_pa: [30, 40, 50, 60, null],
        liquidita_oltre_36m_senza_pa: [30, 30, 50, 60, null],
        investimenti: [50, 60, 64, 64, null], // Max 64% per riassicurazione
        risanamento: [50, 50, 60, 64, null],
        sabatini: [64, 64, 64, 64, null],
        microcredito: [64, 64, 64, 64, null]
    }
};

// ============================================
// COMPONENTI UI
// ============================================

const DisclaimerBoxProfessional = () => (
    <div className="mb-8">
        {/* Banner Rosso Alert */}
        <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-r-lg mb-4">
            <div className="flex items-start">
                <svg className="w-6 h-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>
                </svg>
                <div>
                    <h3 className="font-bold text-lg text-red-800 mb-2">
                        ⚠️ STRUMENTO DI PRE-SCREENING - NON VINCOLANTE
                    </h3>
                    <p className="text-sm text-red-700 font-medium mb-3">
                        Questo calcolatore fornisce una <strong>stima algoritmica preliminare</strong> che <u>NON sostituisce</u> la valutazione ufficiale del Fondo di Garanzia MCC.
                    </p>
                </div>
            </div>
        </div>

        {/* Box Limitazioni Critiche */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-5 rounded-r-lg">
            <h4 className="font-bold text-yellow-900 mb-3 text-base">
                📊 Cosa NON include questo simulatore:
            </h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm text-yellow-800">
                <div className="flex items-start">
                    <span className="text-yellow-600 mr-2 font-bold">❌</span>
                    <div>
                        <strong>Centrale Rischi (CR)</strong><br/>
                        <span className="text-xs">Peso 40% del rating. Sconfinamenti/insoluti possono declassare di 2-3 livelli.</span>
                    </div>
                </div>
                <div className="flex items-start">
                    <span className="text-yellow-600 mr-2 font-bold">❌</span>
                    <div>
                        <strong>Analisi Trend Biennale</strong><br/>
                        <span className="text-xs">Crescita/decrescita ricavi ed EBITDA negli ultimi 2 anni.</span>
                    </div>
                </div>
                <div className="flex items-start">
                    <span className="text-yellow-600 mr-2 font-bold">❌</span>
                    <div>
                        <strong>Protesti Cambiari</strong><br/>
                        <span className="text-xs">Protesti ultimi 24 mesi causano esclusione automatica.</span>
                    </div>
                </div>
                <div className="flex items-start">
                    <span className="text-yellow-600 mr-2 font-bold">❌</span>
                    <div>
                        <strong>Credit Bureau (CRIF/Experian)</strong><br/>
                        <span className="text-xs">Ritardi pagamenti fornitori/utilities possono penalizzare.</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Link Portale Ufficiale */}
        <div className="mt-4 bg-blue-50 border border-blue-300 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-900 mb-2">
                Per la <strong>valutazione ufficiale e vincolante</strong>:
            </p>
            <a 
                href="https://www.fondidigaranzia.it" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
                🔗 Portale Ufficiale MCC - fondidigaranzia.it
                <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                </svg>
            </a>
        </div>
    </div>
);

const StepReminder = () => (
    <div className="bg-orange-100 border-l-4 border-orange-500 p-3 mb-6 text-xs">
        <p className="text-orange-800">
            <strong>⚠️ Promemoria:</strong> Questo è uno strumento di <u>pre-qualificazione</u>. 
            La Centrale Rischi (non analizzata qui) può modificare significativamente il risultato finale.
        </p>
    </div>
);

// FAQ SECTION COMPONENT
const FAQSection = () => {
    const [openIndex, setOpenIndex] = useState(null);

    const faqs = [
        {
            question: "Perché il risultato reale MCC potrebbe essere diverso?",
            answer: `Il rating ufficiale MCC si basa su 3 moduli:
      
1. **Modulo Economico-Finanziario** (40% peso) - Bilanci ultimi 2 anni
2. **Modulo Andamentale** (40% peso) - Centrale Rischi + Credit Bureau
3. **Eventi Pregiudizievoli** (20% peso) - Protesti, sofferenze, procedure

Questo simulatore analizza principalmente il modulo 1, con una stima parziale del modulo 3.
Il **modulo andamentale è ASSENTE**, ma è determinante per il rating finale.`
        },
        {
            question: "Come può la Centrale Rischi modificare la classe?",
            answer: `**Esempi pratici di declassamento:**

📉 **Scenario A - Sconfinamenti frequenti:**
- Stima simulatore: Classe 2 (70% copertura investimenti)
- Con sconfinamenti CR >5% negli ultimi 6 mesi: **Classe 4** (80%)

📉 **Scenario B - Rate insolute:**
- Stima simulatore: Classe 3 (70% copertura)
- Con 2+ rate insolute ultimi 12 mesi: **Classe 5 (ESCLUSO)**

✅ **Scenario C - CR pulita:**
- Stima simulatore: Classe 3
- Con CR perfetta (no sconfinamenti, regolarità pagamenti): possibile **Classe 2** (upgrade)`
        },
        {
            question: "Cosa sono gli 'Eventi Pregiudizievoli' non verificati?",
            answer: `Il simulatore verifica solo:
- ✅ Procedure concorsuali
- ✅ Ipoteche giudiziarie/Pignoramenti

**Non verifica (ma MCC lo fa):**
- ❌ Protesti cambiari ultimi 24 mesi → **ESCLUSIONE AUTOMATICA**
- ❌ Sofferenze bancarie attive → Declassamento 2-3 livelli
- ❌ Ritardi pagamenti PA >90 giorni → +1 classe
- ❌ Crediti verso soci per versamenti non effettuati → Penalizzazione PN`
        },
        {
            question: "Quando posso fidarmi della stima?",
            answer: `La stima è **più affidabile** se:

✅ L'impresa ha Centrale Rischi **completamente pulita** (verifica con la tua banca)
✅ Nessun protesto negli ultimi 24 mesi
✅ Bilanci regolarmente depositati e in linea con dichiarazioni fiscali
✅ Nessuna sofferenza bancaria in essere
✅ Pagamenti PA regolari (se applicabile)

In questi casi, la stima può avvicinarsi al rating reale (±1 classe).`
        },
        {
            question: "Cosa devo fare prima di presentare domanda ufficiale?",
            answer: `**Checklist pre-domanda:**

1. 📞 **Contatta la tua banca** per:
   - Visura Centrale Rischi ultimi 6 mesi
   - Verifica posizione andamentale
   
2. 🏢 **Verifica Camera Commercio**:
   - Visura protesti (ultimi 24 mesi)
   - Situazione procedure concorsuali
   
3. 📊 **Prepara documentazione**:
   - Ultimi 2 bilanci depositati (o dichiarazioni fiscali)
   - Business plan (se start-up <3 anni)
   - Planimetria investimento (se richiesto)

4. 🔗 **Accedi al portale**: https://www.fondidigaranzia.it`
        }
    ];

    return (
        <div className="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"/>
                </svg>
                Domande Frequenti - Gap tra Stima e Rating Reale
            </h3>
            
            <div className="space-y-3">
                {faqs.map((faq, index) => (
                    <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <button
                            onClick={() => setOpenIndex(openIndex === index ? null : index)}
                            className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                        >
                            <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                            <svg 
                                className={`w-5 h-5 text-gray-500 transform transition-transform flex-shrink-0 ${openIndex === index ? 'rotate-180' : ''}`}
                                fill="currentColor" 
                                viewBox="0 0 20 20"
                            >
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                            </svg>
                        </button>
                        {openIndex === index && (
                            <div className="p-4 pt-0 text-sm text-gray-700 whitespace-pre-line border-t border-gray-100 bg-gray-50">
                                {faq.answer}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// CHECKLIST DOCUMENTI COMPONENT
const DocumentChecklistComponent = ({ formData }) => {
    const isStartup = formData['data-costituzione'] && 
        ((new Date() - new Date(formData['data-costituzione'])) / (1000*60*60*24*365.25)) <= 3;

    return (
        <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-300">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"/>
                </svg>
                📋 Documenti Necessari per Domanda Ufficiale MCC
            </h3>

            <div className="bg-white rounded-lg p-5 shadow-sm">
                <p className="text-sm text-gray-700 mb-4">
                    Prima di procedere con la domanda ufficiale, assicurati di avere:
                </p>

                {/* Documenti Comuni */}
                <div className="mb-6">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">TUTTI</span>
                        Documentazione Base
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                            <span className="mr-3">📄</span>
                            <span><strong>Visura Camerale</strong> aggiornata (max 3 mesi)</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-3">🏦</span>
                            <span><strong>Visura Centrale Rischi</strong> ultimi 6 mesi (richiedila alla tua banca)</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-3">⚖️</span>
                            <span><strong>Certificato Protesti</strong> (ultimi 24 mesi)</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-3">💳</span>
                            <span><strong>IBAN</strong> aziendale per erogazione finanziamento</span>
                        </li>
                    </ul>
                </div>

                {/* Documenti Specifici per Start-Up */}
                {isStartup ? (
                    <div className="mb-6 bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <h4 className="font-bold text-purple-900 mb-3 flex items-center">
                            <span className="bg-purple-200 text-purple-900 px-2 py-1 rounded text-xs mr-2">START-UP</span>
                            Documentazione Aggiuntiva (&lt;3 anni attività)
                        </h4>
                        <ul className="space-y-2 text-sm text-purple-900">
                            <li className="flex items-start">
                                <span className="mr-3">📊</span>
                                <span><strong>Business Plan</strong> redatto su modello MCC 
                                    <a href="https://www.fondidigaranzia.it" target="_blank" rel="noopener" className="text-purple-600 hover:underline ml-2">(Scarica Allegato 7)</a>
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-3">📈</span>
                                <span><strong>Bilancio Previsionale</strong> (3-5 anni)
                                    <a href="https://www.fondidigaranzia.it" target="_blank" rel="noopener" className="text-purple-600 hover:underline ml-2">(Scarica Template)</a>
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-3">👥</span>
                                <span><strong>CV Soci/Amministratori</strong> con esperienza settoriale</span>
                            </li>
                        </ul>
                    </div>
                ) : (
                    <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-bold text-blue-900 mb-3 flex items-center">
                            <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs mr-2">IMPRESE OPERATIVE</span>
                            Documentazione Bilanci
                        </h4>
                        <ul className="space-y-2 text-sm text-blue-900">
                            <li className="flex items-start">
                                <span className="mr-3">📚</span>
                                <span><strong>Ultimi 2 Bilanci depositati</strong> (se contabilità ordinaria)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-3">📋</span>
                                <span><strong>Ultime 2 Dichiarazioni Fiscali</strong> (Modello Redditi + IVA)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-3">💰</span>
                                <span><strong>Situazione Patrimoniale</strong> aggiornata (se richiesta)</span>
                            </li>
                        </ul>
                    </div>
                )}

                {/* Documenti per Investimenti */}
                {formData.finalita === 'investimento' && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 className="font-bold text-green-900 mb-3 flex items-center">
                            <span className="bg-green-200 text-green-900 px-2 py-1 rounded text-xs mr-2">INVESTIMENTI</span>
                            Documentazione Progetto
                        </h4>
                        <ul className="space-y-2 text-sm text-green-900">
                            <li className="flex items-start">
                                <span className="mr-3">🏗️</span>
                                <span><strong>Preventivi fornitori</strong> (almeno 2 comparabili)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-3">📐</span>
                                <span><strong>Planimetria/Progetto tecnico</strong> (se immobili/ristrutturazioni)</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-3">📝</span>
                                <span><strong>Relazione tecnica</strong> investimento (descrizione dettagliata)</span>
                            </li>
                        </ul>
                    </div>
                )}
            </div>

            {/* Link Utili */}
            <div className="mt-4 flex flex-wrap gap-2">
                <a href="https://www.fondidigaranzia.it" target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                    📄 Modulistica MCC
                </a>
                <a href="https://www.fondidigaranzia.it" target="_blank" rel="noopener noreferrer" className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                    🔍 Guida alla compilazione
                </a>
            </div>
        </div>
    );
};

// ============================================
// LOGICA DI CALCOLO AGGIORNATA
// ============================================

const estimateCreditClass = (isStartup, data) => {
    const { settore, fatturato, ebitda, pfn, patrimonioNetto, oneriFinanziari } = data;

    if (isStartup) {
        return { 
            meritClass: 3, 
            notes: "Start-up (<3 anni): la valutazione ufficiale richiede Business Plan (Allegato 7) e bilancio previsionale. Si assume classe prudenziale 3." 
        };
    }

    if (fatturato === 0 || patrimonioNetto === 0) {
        return { 
            meritClass: 4, 
            notes: "Dati economici insufficienti per una stima precisa. Si assume classe prudenziale 4. Per valutazione accurata è necessario fornire bilanci completi ultimi 2 anni." 
        };
    }

    let score = 0;
    const notes = [];

    // Calcolo ratios
    const pfn_su_pn = patrimonioNetto !== 0 ? pfn / patrimonioNetto : 10;
    const pfn_su_ebitda = ebitda > 0 ? pfn / ebitda : 10;
    const ebitda_margin = fatturato !== 0 ? ebitda / fatturato : 0;
    const coverage_ratio = oneriFinanziari > 0 ? ebitda / oneriFinanziari : Infinity;

    // Scoring per settore
    switch (settore) {
        case 'industria':
        case 'servizi':
            // Leva finanziaria
            if (pfn_su_pn < 2) score += 2; 
            else if (pfn_su_pn > 5) score -= 2; 
            else score -= 1;
            notes.push(`Leva finanziaria (PFN/PN): ${pfn_su_pn.toFixed(2)}`);
            
            // Sostenibilità debito
            if (pfn_su_ebitda < 3) score += 2; 
            else if (pfn_su_ebitda > 6) score -= 2; 
            else score -= 1;
            notes.push(`Sostenibilità debito (PFN/EBITDA): ${pfn_su_ebitda.toFixed(2)}`);
            
            // Redditività
            if (ebitda_margin > 0.1) score += 2; 
            else if (ebitda_margin < 0.03) score -= 2; 
            else score += 1;
            notes.push(`Margine operativo (EBITDA%): ${(ebitda_margin * 100).toFixed(1)}%`);
            break;

        case 'commercio':
            if (pfn_su_pn < 3) score += 2; 
            else if (pfn_su_pn > 6) score -= 2; 
            else score -= 1;
            notes.push(`Leva finanziaria (PFN/PN): ${pfn_su_pn.toFixed(2)}`);
            
            if (pfn_su_ebitda < 4) score += 2; 
            else if (pfn_su_ebitda > 7) score -= 2; 
            else score -= 1;
            notes.push(`Sostenibilità debito (PFN/EBITDA): ${pfn_su_ebitda.toFixed(2)}`);
            
            if (ebitda_margin > 0.05) score += 2; 
            else if (ebitda_margin < 0.01) score -= 2; 
            else score += 1;
            notes.push(`Margine operativo (EBITDA%): ${(ebitda_margin * 100).toFixed(1)}%`);
            break;

        case 'edilizia':
        case 'immobiliare':
            if (pfn_su_pn < 1.5) score += 2; 
            else if (pfn_su_pn > 4) score -= 2; 
            else score -= 1;
            notes.push(`Leva finanziaria (PFN/PN): ${pfn_su_pn.toFixed(2)}`);
            
            const pn_su_fatturato = fatturato !== 0 ? patrimonioNetto / fatturato : 0;
            if (pn_su_fatturato > 0.3) score += 2; 
            else if (pn_su_fatturato < 0.1) score -= 2; 
            else score += 1;
            notes.push(`Solidità patrimoniale (PN/Fatturato): ${pn_su_fatturato.toFixed(2)}`);
            
            if (ebitda_margin > 0.12) score += 2; 
            else if (ebitda_margin < 0.05) score -= 2; 
            else score += 1;
            notes.push(`Margine operativo (EBITDA%): ${(ebitda_margin * 100).toFixed(1)}%`);
            break;
    }

    // Coverage Ratio (nuovo controllo)
    if (oneriFinanziari > 0) {
        if (coverage_ratio < 1.5) {
            score -= 2;
            notes.push(`⚠️ Coverage Ratio critico: ${coverage_ratio.toFixed(2)} (<1.5)`);
        } else if (coverage_ratio > 4) {
            score += 1;
            notes.push(`Coverage Ratio ottimo: ${coverage_ratio.toFixed(2)}`);
        }
    }

    // Penalità situazioni critiche
    if (patrimonioNetto < 0) { 
        score -= 3; 
        notes.push("⚠️ Patrimonio Netto negativo (forte penalità)"); 
    }
    if (ebitda < 0) { 
        score -= 3; 
        notes.push("⚠️ EBITDA negativo (forte penalità)"); 
    }

    // Determinazione classe finale
    let finalClass;
    if (score >= 4) finalClass = 1;
    else if (score >= 2) finalClass = 2;
    else if (score >= 0) finalClass = 3;
    else if (score >= -3) finalClass = 4;
    else finalClass = 5;
    
    return { 
        meritClass: finalClass, 
        notes: notes.join(' | '),
        score: score // Per debug
    };
};

const getCoveragePercentage = (classeDiMerito, finalita, durataMesi, tipoGaranzia) => {
    if (classeDiMerito > 4 || classeDiMerito < 1) return null; // Non ammissibile
    
    const tables = coverageTablesOfficial[tipoGaranzia] || coverageTablesOfficial.diretta;
    
    // Casi speciali con copertura fissa
    if (finalita === 'sabatini') return tables.sabatini[classeDiMerito - 1];
    if (finalita === 'microcredito') return tables.microcredito[classeDiMerito - 1];
    if (finalita === 'risanamento') return tables.risanamento[classeDiMerito - 1];
    if (finalita === 'investimento') return tables.investimenti[classeDiMerito - 1];
    
    // Finanziamenti liquidità (durata-dipendente)
    if (durataMesi <= 12) {
        return tables.liquidita_12m[classeDiMerito - 1];
    } else if (durataMesi <= 36) {
        return tables.liquidita_12_36m_senza_pa[classeDiMerito - 1];
    } else {
        return tables.liquidita_oltre_36m_senza_pa[classeDiMerito - 1];
    }
};

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

const FondoGaranziaCalculator = () => {
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [results, setResults] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [formErrors, setFormErrors] = useState({});
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (currentStep === 3) {
            if (formData['cr-pulita'] === null) {
                errors['cr-pulita'] = true;
            }
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
        setDisclaimerAccepted(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!disclaimerAccepted || !user) return;
        
        setIsSubmitting(true);

        // Calcolo risultati
        const dataCostituzione = new Date(formData['data-costituzione']);
        const oggi = new Date();
        const anniAttivita = (oggi - dataCostituzione) / (1000 * 60 * 60 * 24 * 365.25);
        const isStartup = anniAttivita <= 3;

        const numericData = {
            settore: formData['settore-ateco'],
            importo: parseFloat(formData.importo) || 0,
            durata: parseInt(formData.durata) || 0,
            finalita: formData.finalita,
            tipoGaranzia: formData['tipo-garanzia'],
            fatturato: parseFloat(formData.fatturato) || 0,
            ebitda: parseFloat(formData.ebitda) || 0,
            pfn: parseFloat(formData.pfn) || 0,
            patrimonioNetto: parseFloat(formData['patrimonio-netto']) || 0,
            oneriFinanziari: parseFloat(formData['oneri-finanziari']) || 0
        };

        const stimaIniziale = estimateCreditClass(isStartup, numericData);
        let classeDiMerito = stimaIniziale.meritClass;
        let finalNotes = [stimaIniziale.notes];
        let warnings = [];

        // Gestione eventi pregiudizievoli
        if (formData['pregiudizievole-fallimento']) {
            classeDiMerito = 5;
            finalNotes.push("🚫 Presenza procedure concorsuali: NON AMMISSIBILE");
        } else if (formData['pregiudizievole-grave']) {
            const classeOriginale = classeDiMerito;
            classeDiMerito = Math.min(5, classeDiMerito + 2);
            finalNotes.push(`⚠️ Eventi pregiudizievoli: declassamento da classe ${classeOriginale} a ${classeDiMerito}`);
        }

        // Warning CR non verificata
        if (formData['cr-pulita'] === false || formData['cr-pulita'] === null) {
            warnings.push("⚠️ ATTENZIONE: Centrale Rischi non verificata. Con sconfinamenti o insoluti la classe può peggiorare di 2-3 livelli.");
        }

        // Calcolo copertura
        const coveragePercentage = getCoveragePercentage(
            classeDiMerito, 
            numericData.finalita, 
            numericData.durata,
            numericData.tipoGaranzia
        );

        const importoGarantito = coveragePercentage !== null 
            ? numericData.importo * (coveragePercentage / 100) 
            : 0;

        // Verifica limiti
        if (numericData.importo > 5000000) {
            warnings.push("⚠️ Importo superiore a €5M: potrebbe superare il limite massimo per singola impresa.");
        }

        const simulationResults = {
            meritClass: classeDiMerito,
            percentuale: coveragePercentage || 0,
            importoGarantito: importoGarantito,
            notes: finalNotes.join(' | '),
            warnings: warnings,
            tipoGaranzia: numericData.tipoGaranzia,
            isStartup: isStartup
        };

        // Salvataggio tramite API
        try {
            const response = await fetch('/api/save-simulation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: user,
                    inputs: formData,
                    outputs: simulationResults,
                }),
            });

            if (!response.ok) {
                throw new Error('Errore salvataggio API');
            }
            console.log('Simulazione salvata con successo!');

        } catch (error) {
            console.error('Errore API:', error.message);
        } finally {
            setResults(simulationResults);
            setIsSubmitting(false);
            window.scrollTo(0, 0);
        }
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg">
            <style jsx>{`
                .step-indicator { transition: all 0.3s ease; }
                .step-indicator.active { background-color: #2563eb; color: white; border-color: #2563eb; }
                .step-indicator.completed { background-color: #16a34a; color: white; border-color: #16a34a; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .form-section-active { animation: fadeIn 0.5s ease-in-out; }
                .tooltip { position: relative; display: inline-block; cursor: help; }
                .tooltip .tooltiptext { 
                    visibility: hidden; 
                    width: 220px; 
                    background-color: #555; 
                    color: #fff; 
                    text-align: center; 
                    border-radius: 6px; 
                    padding: 5px; 
                    position: absolute; 
                    z-index: 1; 
                    bottom: 125%; 
                    left: 50%; 
                    margin-left: -110px; 
                    opacity: 0; 
                    transition: opacity 0.3s; 
                }
                .tooltip:hover .tooltiptext { visibility: visible; opacity: 1; }
            `}</style>

            {!results ? (
                <>
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Check Preliminare Ammissibilità Fondo MCC</h1>
                        <p className="mt-2 text-lg text-gray-600">Pre-screening indicativo per Fondo di Garanzia PMI</p>
                        <p className="mt-1 text-sm text-gray-500 italic">Aggiornato a Ottobre 2024</p>
                    </div>

                    {currentStep === 1 && <DisclaimerBoxProfessional />}

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center space-x-4 md:space-x-8 mb-10">
                        {[1, 2, 3].map((step, index) => (
                            <React.Fragment key={step}>
                                <div className={`step-indicator flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold text-lg ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : 'bg-white text-gray-400 border-gray-300'}`}>
                                    {step}
                                </div>
                                {index < 2 && <div className="flex-1 h-1 bg-gray-200"></div>}
                            </React.Fragment>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* STEP 1: Dati Impresa */}
                        {currentStep === 1 && (
                            <section className="form-section-active">
                                <StepReminder />
                                <h2 className="text-2xl font-semibold mb-6 text-center">Fase 1: Dati dell'Impresa</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="forma-giuridica" className="block text-sm font-medium text-gray-700 mb-1">
                                            Forma Giuridica
                                        </label>
                                        <select 
                                            id="forma-giuridica" 
                                            value={formData['forma-giuridica']} 
                                            onChange={handleInputChange} 
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="srl">SRL / Società di Capitali</option>
                                            <option value="persone">Società di Persone / Ditta Individuale</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="data-costituzione" className="block text-sm font-medium text-gray-700 mb-1">
                                            Data di Costituzione *
                                        </label>
                                        <input 
                                            type="date" 
                                            id="data-costituzione" 
                                            value={formData['data-costituzione']} 
                                            onChange={handleInputChange} 
                                            required 
                                            className={`w-full p-3 border rounded-lg shadow-sm ${formErrors['data-costituzione'] ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label htmlFor="settore-ateco" className="block text-sm font-medium text-gray-700 mb-1">
                                            Settore ATECO
                                        </label>
                                        <select 
                                            id="settore-ateco" 
                                            value={formData['settore-ateco']} 
                                            onChange={handleInputChange} 
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="industria">Industria</option>
                                            <option value="commercio">Commercio</option>
                                            <option value="servizi">Servizi</option>
                                            <option value="edilizia">Edilizia</option>
                                            <option value="immobiliare">Immobiliare</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <fieldset className="mt-2">
                                            <legend className="text-sm font-medium text-gray-700">Caratteristiche Impresa (opzionale)</legend>
                                            <div className="mt-2 space-y-2">
                                                <div className="flex items-center">
                                                    <input 
                                                        id="impresa-femminile" 
                                                        type="checkbox" 
                                                        checked={formData['impresa-femminile']} 
                                                        onChange={handleInputChange} 
                                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor="impresa-femminile" className="ml-3 block text-sm text-gray-800">
                                                        Impresa Femminile
                                                    </label>
                                                </div>
                                                <div className="flex items-center">
                                                    <input 
                                                        id="impresa-giovanile" 
                                                        type="checkbox" 
                                                        checked={formData['impresa-giovanile']} 
                                                        onChange={handleInputChange} 
                                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <label htmlFor="impresa-giovanile" className="ml-3 block text-sm text-gray-800">
                                                        Impresa Giovanile
                                                    </label>
                                                </div>
                                            </div>
                                        </fieldset>
                                    </div>
                                </div>

                                <div className="mt-8 text-right">
                                    <button 
                                        type="button" 
                                        onClick={nextStep} 
                                        className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Prosegui &rarr;
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* STEP 2: Dati Finanziamento */}
                        {currentStep === 2 && (
                            <section className="form-section-active">
                                <StepReminder />
                                <h2 className="text-2xl font-semibold mb-6 text-center">Fase 2: Dati del Finanziamento</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="importo" className="block text-sm font-medium text-gray-700 mb-1">
                                            Importo Richiesto (€) *
                                        </label>
                                        <input 
                                            type="number" 
                                            id="importo" 
                                            placeholder="Es. 50000" 
                                            value={formData.importo} 
                                            onChange={handleInputChange} 
                                            required 
                                            className={`w-full p-3 border rounded-lg shadow-sm ${formErrors.importo ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="durata" className="block text-sm font-medium text-gray-700 mb-1">
                                            Durata (mesi) *
                                        </label>
                                        <input 
                                            type="number" 
                                            id="durata" 
                                            placeholder="Es. 60" 
                                            value={formData.durata} 
                                            onChange={handleInputChange} 
                                            required 
                                            className={`w-full p-3 border rounded-lg shadow-sm ${formErrors.durata ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label htmlFor="finalita" className="block text-sm font-medium text-gray-700 mb-1">
                                            Finalità del Finanziamento
                                        </label>
                                        <select 
                                            id="finalita" 
                                            value={formData.finalita} 
                                            onChange={handleInputChange} 
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="investimento">Investimenti</option>
                                            <option value="liquidita">Liquidità / Capitale Circolante</option>
                                            <option value="risanamento">Risanamento Finanziario</option>
                                            <option value="sabatini">Investimenti Nuova Sabatini / PMI Innovative</option>
                                            <option value="microcredito">Microcredito / Start-up Innovative</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                        <label htmlFor="tipo-garanzia" className="block text-sm font-medium text-gray-700 mb-2">
                                            Tipo di Garanzia
                                        </label>
                                        <select 
                                            id="tipo-garanzia" 
                                            value={formData['tipo-garanzia']} 
                                            onChange={handleInputChange}
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="diretta">Garanzia Diretta (importo &lt; €2,5M - Coperture maggiori)</option>
                                            <option value="riassicurazione">Riassicurazione/Controgaranzia (tramite Confidi)</option>
                                        </select>
                                        <p className="text-xs text-gray-600 mt-2">
                                            💡 <strong>Garanzia Diretta:</strong> richiesta direttamente dalla banca a MCC, coperture più alte.
                                            <br/>
                                            💡 <strong>Riassicurazione:</strong> tramite Confidi o altro intermediario, coperture leggermente inferiori.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-between">
                                    <button 
                                        type="button" 
                                        onClick={prevStep} 
                                        className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
                                    >
                                        &larr; Indietro
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={nextStep} 
                                        className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Prosegui &rarr;
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* STEP 3: Dati Economici */}
                        {currentStep === 3 && (
                            <section className="form-section-active">
                                <StepReminder />
                                <h2 className="text-2xl font-semibold mb-4 text-center">Fase 3: Dati Economici e Pregiudizievoli</h2>
                                <p className="text-center text-gray-600 mb-6">
                                    Inserisci i dati dell'ultimo bilancio. Se sei una start-up (&lt;3 anni), lascia 0.
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="fatturato" className="block text-sm font-medium text-gray-700 mb-1">
                                            Ricavi / Fatturato Annuo (€)
                                        </label>
                                        <input 
                                            type="number" 
                                            id="fatturato" 
                                            value={formData.fatturato} 
                                            onChange={handleInputChange} 
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="ebitda" className="block text-sm font-medium text-gray-700 mb-1">
                                            EBITDA (MOL) (€)
                                        </label>
                                        <input 
                                            type="number" 
                                            id="ebitda" 
                                            value={formData.ebitda} 
                                            onChange={handleInputChange} 
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="pfn" className="block text-sm font-medium text-gray-700 mb-1">
                                            Posizione Finanziaria Netta (€) 
                                            <span className="tooltip text-gray-400 ml-1">
                                                (?)
                                                <span className="tooltiptext">Totale Debiti Finanziari - Liquidità</span>
                                            </span>
                                        </label>
                                        <input 
                                            type="number" 
                                            id="pfn" 
                                            value={formData.pfn} 
                                            onChange={handleInputChange} 
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="patrimonio-netto" className="block text-sm font-medium text-gray-700 mb-1">
                                            Patrimonio Netto (€)
                                        </label>
                                        <input 
                                            type="number" 
                                            id="patrimonio-netto" 
                                            value={formData['patrimonio-netto']} 
                                            onChange={handleInputChange} 
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label htmlFor="oneri-finanziari" className="block text-sm font-medium text-gray-700 mb-1">
                                            Oneri Finanziari Annui (€)
                                        </label>
                                        <input 
                                            type="number" 
                                            id="oneri-finanziari" 
                                            value={formData['oneri-finanziari']} 
                                            onChange={handleInputChange} 
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm"
                                        />
                                    </div>
                                </div>

                                <hr className="my-8" />

                                {/* Centrale Rischi */}
                                <div className="bg-indigo-50 border-l-4 border-indigo-500 p-5 rounded-r-lg mb-6">
                                    <h3 className="text-lg font-semibold text-indigo-900 mb-3">🏦 Centrale Rischi (CR)</h3>
                                    <p className="text-sm text-indigo-800 mb-3">
                                        La Centrale Rischi ha <strong>peso 40%</strong> nel rating MCC ma non può essere analizzata da questo simulatore.
                                    </p>
                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <input 
                                                type="radio" 
                                                id="cr-pulita-si" 
                                                name="cr-pulita"
                                                checked={formData['cr-pulita'] === true}
                                                onChange={() => setFormData(prev => ({...prev, 'cr-pulita': true}))}
                                                className={`h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500 ${formErrors['cr-pulita'] ? 'border-red-500' : ''}`}
                                            />
                                            <label htmlFor="cr-pulita-si" className="ml-3 block text-sm text-gray-800">
                                                ✅ <strong>L'impresa ha CR pulita</strong> (no sconfinamenti/insoluti ultimi 6 mesi)
                                            </label>
                                        </div>
                                        <div className="flex items-center">
                                            <input 
                                                type="radio" 
                                                id="cr-pulita-no" 
                                                name="cr-pulita"
                                                checked={formData['cr-pulita'] === false}
                                                onChange={() => setFormData(prev => ({...prev, 'cr-pulita': false}))}
                                                className={`h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500 ${formErrors['cr-pulita'] ? 'border-red-500' : ''}`}
                                            />
                                            <label htmlFor="cr-pulita-no" className="ml-3 block text-sm text-gray-800">
                                                ⚠️ <strong>CR presenta criticità</strong> o non so verificare
                                            </label>
                                        </div>
                                    </div>
                                    {formErrors['cr-pulita'] && (
                                        <p className="text-red-600 text-xs mt-2">⚠️ Selezionare un'opzione per procedere</p>
                                    )}
                                </div>

                                <hr className="my-8" />

                                <h3 className="text-xl font-semibold mb-4 text-center">Eventi Pregiudizievoli</h3>
                                <fieldset>
                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <input 
                                                id="pregiudizievole-fallimento" 
                                                type="checkbox" 
                                                checked={formData['pregiudizievole-fallimento']} 
                                                onChange={handleInputChange} 
                                                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                            />
                                            <label htmlFor="pregiudizievole-fallimento" className="ml-3 block text-sm text-gray-800">
                                                Presenza di procedure concorsuali (Fallimento, Liquidazione, Concordato)
                                            </label>
                                        </div>
                                        <div className="flex items-center">
                                            <input 
                                                id="pregiudizievole-grave" 
                                                type="checkbox" 
                                                checked={formData['pregiudizievole-grave']} 
                                                onChange={handleInputChange} 
                                                className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                            />
                                            <label htmlFor="pregiudizievole-grave" className="ml-3 block text-sm text-gray-800">
                                                Presenza di Ipoteca Giudiziale o Pignoramento
                                            </label>
                                        </div>
                                    </div>
                                </fieldset>

                                {/* Disclaimer Finale */}
                                <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-300">
                                    <div className="flex items-start">
                                        <input 
                                            id="disclaimer-accepted" 
                                            type="checkbox" 
                                            checked={disclaimerAccepted} 
                                            onChange={(e) => setDisclaimerAccepted(e.target.checked)} 
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                                        />
                                        <label htmlFor="disclaimer-accepted" className="ml-3 block text-sm text-gray-800">
                                            Dichiaro di aver letto e compreso le <strong>avvertenze e limitazioni</strong> dello strumento, 
                                            consapevole che il risultato è una <u>stima preliminare non vincolante</u> e che la 
                                            <strong> Centrale Rischi (non analizzata) può modificare significativamente il rating finale</strong>.
                                        </label>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-between">
                                    <button 
                                        type="button" 
                                        onClick={prevStep} 
                                        className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
                                    >
                                        &larr; Indietro
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={!disclaimerAccepted || isSubmitting} 
                                        className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                    >
                                        {isSubmitting && (
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        )}
                                        {isSubmitting ? 'Elaborazione...' : 'Calcola Risultato'}
                                    </button>
                                </div>
                            </section>
                        )}
                    </form>
                </>
            ) : (
                <>
                    {/* RISULTATI */}
                    <section className="form-section-active">
                        <h2 className="text-2xl font-semibold mb-6 text-center">Risultato della Pre-Qualificazione</h2>
                        
                        {/* Alert Tipo Garanzia */}
                        <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 p-3 text-sm text-blue-800">
                            <strong>Tipo Garanzia:</strong> {results.tipoGaranzia === 'diretta' ? 'Garanzia Diretta' : 'Riassicurazione/Controgaranzia'}
                        </div>

                        {/* Box Ammissibilità */}
                        <div className={`border-l-4 ${results.percentuale > 0 ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'} p-6 rounded-lg shadow-md mb-6 text-center`}>
                            <p className={`text-2xl font-bold ${results.percentuale > 0 ? 'text-green-600' : 'text-red-600'} flex items-center justify-center`}>
                                {results.percentuale > 0 ? '✅ Ammissibilità Indicativa: POSITIVA' : '🚫 Ammissibilità Indicativa: NEGATIVA'}
                            </p>
                        </div>

                        {/* Warnings CR */}
                        {results.warnings && results.warnings.length > 0 && (
                            <div className="mb-6 bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
                                <h4 className="font-bold text-orange-900 mb-2">⚠️ Avvertenze Importanti</h4>
                                <ul className="text-sm text-orange-800 space-y-1">
                                    {results.warnings.map((warning, idx) => (
                                        <li key={idx}>{warning}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Metriche Risultato */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-6">
                            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                                <p className="text-sm text-gray-500">Classe di Merito Stimata</p>
                                <p className="text-3xl font-bold text-blue-600">{results.meritClass}</p>
                                <p className="text-xs text-gray-500 mt-1">(Range: 1-5, dove 5=escluso)</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                                <p className="text-sm text-gray-500">Copertura Massima Stimata</p>
                                <p className="text-3xl font-bold text-blue-600">{results.percentuale}%</p>
                                <p className="text-xs text-gray-500 mt-1">% sull'importo finanziamento</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                                <p className="text-sm text-gray-500">Importo Garantito Stimato</p>
                                <p className="text-3xl font-bold text-blue-600">
                                    {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(results.importoGarantito)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Esposizione MCC</p>
                            </div>
                        </div>

                        {/* Note Valutazione */}
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mb-6">
                            <h4 className="font-bold text-gray-800 mb-2">📝 Note sulla Valutazione</h4>
                            <p className="text-sm text-gray-700">{results.notes}</p>
                        </div>

                        {/* Pulsanti Azione */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button 
                                onClick={resetCalculator} 
                                className="bg-gray-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                🔄 Nuova Simulazione
                            </button>
                            <a 
                                href="https://www.fondidigaranzia.it" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors text-center inline-flex items-center justify-center"
                            >
                                🚀 Vai al Portale Ufficiale MCC
                            </a>
                        </div>
                    </section>

                    {/* FAQ SECTION */}
                    <FAQSection />

                    {/* CHECKLIST DOCUMENTI */}
                    <DocumentChecklistComponent formData={formData} />
                </>
            )}

            {/* Footer */}
            <footer id="disclaimer" className="text-center mt-8 text-sm text-gray-500 border-t pt-6">
                <h3 className="font-semibold text-base text-gray-700 mb-2">Avvertenze Finali</h3>
                <p className="mb-2">
                    Questo strumento fornisce una <strong>stima algoritmica preliminare</strong> basata sui dati forniti 
                    e sulle tabelle ufficiali MCC aggiornate a Ottobre 2024.
                </p>
                <p className="mb-2">
                    La valutazione <u>NON include</u>: Centrale Rischi (40% del rating), analisi trend biennale, 
                    protesti cambiari, Credit Bureau. Questi fattori possono modificare significativamente il risultato.
                </p>
                <p className="text-xs text-gray-400">
                    La decisione finale sull'ammissione e sulla percentuale di copertura è di esclusiva competenza di 
                    <strong> MCC S.p.A.</strong> (Gestore del Fondo) e della banca/confidi proponente.
                </p>
            </footer>
        </div>
    );
};

// ============================================
// EXPORT PAGINA
// ============================================

export default function SimulazioneFondoGaranziaPage() {
    return (
        <Layout pageTitle="Check Preliminare Ammissibilità Fondo MCC">
            <div className="py-6 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                <div className="flex items-center mb-6">
                    <Link href="/check-banche">
                        <a className="text-slate-500 hover:text-slate-800 transition-colors mr-3 p-2 rounded-full hover:bg-slate-200" title="Torna indietro">
                            &larr;
                        </a>
                    </Link>
                </div>
                <FondoGaranziaCalculator />
            </div>
        </Layout>
    );
}
