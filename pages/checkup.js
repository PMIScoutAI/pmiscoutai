// /pages/checkup.js
// Versione corretta applicando le best practice di Next.js e React

import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script'; // Importare next/script
import { useRouter } from 'next/router';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';

// --- Icone e componenti helper (con migliorie di accessibilità) ---
const Icon = ({ children, className = '' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        // Aggiunge classi passate senza sovrascrivere quelle di default
        className={`w-6 h-6 ${className}`}
        // Rende l'icona invisibile agli screen reader se è puramente decorativa
        aria-hidden="true"
    >
        {children}
    </svg>
);

const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    building: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18H6Z" /><path d="M6 12h12" /><path d="M10 6h4" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    spark: <><path d="M12 3v6l4-4-4-4" /><path d="M12 21v-6l-4 4 4 4" /><path d="M3 12h6l-4-4 4-4" /><path d="M21 12h-6l4 4-4 4" /></>,
};

// --- Componente Wrapper ---
export default function CheckupPageWrapper() {
    return (
        <>
            <Head>
                <title>Check-UP AI - PMIScout</title>
                {/* TailwindCSS non va caricato via CDN in Next.js,
                    ma configurato tramite postcss e importato in _app.js */}
            </Head>

            {/* Uso di next/script per caricare script di terze parti in modo sicuro */}
            <Script id="outseta-options" strategy="beforeInteractive">
                {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };`}
            </Script>
            <Script
                id="outseta-script"
                src="https://cdn.outseta.com/outseta.min.js"
                strategy="beforeInteractive"
            />

            <ProtectedPage>
                {(user) => <CheckupPage user={user} />}
            </ProtectedPage>
        </>
    );
}

// --- Componente Principale della Pagina ---
function CheckupPage({ user }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [formData, setFormData] = useState({
        company_name: '',
        industry_sector: '',
        company_size: '',
        main_challenges: '',
        business_goals: ''
    });
    const [file, setFile] = useState(null);

    // Validazione per abilitare il pulsante "Avanti"
    const isStep1Valid = formData.company_name.trim() !== '' && formData.industry_sector.trim() !== '' && formData.company_size.trim() !== '';

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        } else {
            setFile(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            alert('Per favore, carica un documento di bilancio.');
            return;
        }
        setLoading(true);
        try {
            const result = await api.processCheckup(user.id, formData, file);
            router.push(`/analisi/${result.sessionId}`);
        } catch (error) {
            // Log dell'errore dettagliato e messaggio utente più sicuro
            console.error("Errore durante l'invio del checkup:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Si è verificato un errore: ${errorMessage}`);
        } finally {
            // Assicura che lo stato di caricamento venga sempre disattivato
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
            {/* Sidebar */}
            <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* ... Contenuto Sidebar ... */}
            </aside>

            {/* Main content */}
            <div className="flex flex-col flex-1 w-0 overflow-hidden">
                <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
                        <Icon>{icons.menu}</Icon>
                    </button>
                    {/* Link corretto senza tag <a> figlio */}
                    <Link href="/" className="text-xl font-bold text-blue-600">
                        PMIScout
                    </Link>
                    <div className="w-8" />
                </header>

                <main className="relative flex-1 overflow-y-auto focus:outline-none">
                    <div className="py-6 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Check-UP AI Azienda</h1>
                        <p className="text-lg text-slate-600 mb-8">Analisi approfondita della tua azienda con intelligenza artificiale</p>

                        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-8">
                            {step === 1 ? (
                                <div className="space-y-6">
                                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                                        <Icon>{icons.building}</Icon>
                                        <span className="ml-3">Dati Azienda</span>
                                    </h2>
                                    <div>
                                        <label htmlFor="company_name" className="block text-sm font-medium text-slate-700 mb-2">Nome Azienda *</label>
                                        <input
                                            id="company_name"
                                            name="company_name"
                                            type="text"
                                            placeholder="La tua S.r.l."
                                            required
                                            value={formData.company_name}
                                            onChange={handleInputChange}
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="industry_sector" className="block text-sm font-medium text-slate-700 mb-2">Settore *</label>
                                        <select
                                            id="industry_sector"
                                            name="industry_sector"
                                            required
                                            value={formData.industry_sector}
                                            onChange={handleInputChange}
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Seleziona un'opzione</option>
                                            <option value="Commercio">Commercio</option>
                                            <option value="Servizi">Servizi</option>
                                            <option value="Manifatturiero">Manifatturiero</option>
                                        </select>
                                    </div>
                                     <div>
                                        <label htmlFor="company_size" className="block text-sm font-medium text-slate-700 mb-2">Dimensione Azienda *</label>
                                        <select
                                            id="company_size"
                                            name="company_size"
                                            required
                                            value={formData.company_size}
                                            onChange={handleInputChange}
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Seleziona un'opzione</option>
                                            <option value="micro">Micro (1-9)</option>
                                            <option value="piccola">Piccola (10-49)</option>
                                            <option value="media">Media (50-249)</option>
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        disabled={!isStep1Valid}
                                        aria-disabled={!isStep1Valid}
                                        className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Avanti →
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                                        <Icon>{icons.upload}</Icon>
                                        <span className="ml-3">Carica Bilancio</span>
                                    </h2>
                                    <div>
                                        <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700 mb-2">Bilancio (formato PDF) *</label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                            <input
                                                id="file-upload"
                                                name="file-upload"
                                                type="file"
                                                accept=".pdf"
                                                required
                                                onChange={handleFileChange}
                                                className="mb-4"
                                            />
                                            {file && <p className="text-green-600 font-medium">✓ {file.name} caricato</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-200 text-gray-800 p-3 rounded-lg hover:bg-gray-300">
                                            ← Indietro
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!file || loading}
                                            aria-disabled={!file || loading}
                                            className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {loading ? 'Elaborazione...' : '🚀 Avvia Analisi'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}
