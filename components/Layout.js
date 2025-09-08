// components/Layout.js
// VERSIONE AGGIORNATA SENZA MARKETPLACE

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth'; // Importiamo il nostro hook

// Definizioni di Icon e navLinks
const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {path}
    </svg>
);

const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>,
    xbrl: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="m9 15 3-3 3 3"></path></>,
    support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>
};

// NAVIGAZIONE AGGIORNATA SENZA MARKETPLACE
const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard },
    { href: '/profilo', text: 'Profilo', icon: icons.profile },
    { href: 'https://pmiscoutai.vercel.app/check-ai-xbrl', text: 'Check-AI XBRL', icon: icons.xbrl },
    { href: '/calcolatori', text: 'Calcolatori', icon: icons.calculator }
];

export default function Layout({ children, pageTitle }) {
    const { isAuthenticated, isLoading, userName } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const router = useRouter();

    if (isLoading) {
        return (
            <>
                <Head>
                    <title>Caricamento - PMIScout</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                    <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `
                                var o_options = {
                                    domain: 'pmiscout.outseta.com',
                                    load: 'auth,customForm,emailList,leadCapture,nocode,profile,support',
                                    tokenStorage: 'cookie'
                                };
                            `,
                        }}
                    />
                    <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <h2 className="text-xl font-bold text-blue-600 mb-2">PMIScout</h2>
                        <p className="text-slate-600">Verifica dell'autenticazione in corso...</p>
                    </div>
                </div>
            </>
        );
    }

    if (!isAuthenticated) {
        return (
            <>
                <Head>
                    <title>Accesso richiesto - PMIScout</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                    <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
                </Head>
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-blue-600 mb-2">PMIScout</h2>
                        <p className="text-slate-600">Reindirizzamento al login...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head>
                <title>{pageTitle} - PMIScout</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            var o_options = {
                                domain: 'pmiscout.outseta.com',
                                load: 'auth,customForm,emailList,leadCapture,nocode,profile,support',
                                tokenStorage: 'cookie'
                            };
                        `,
                    }}
                />
                <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
            </Head>

            <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
                {/* SIDEBAR SENZA MARKETPLACE */}
                <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-center h-16 border-b">
                            <h1 className="text-2xl font-bold text-blue-600">PMIScout</h1>
                        </div>
                        <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
                            <nav className="flex-1 px-2 pb-4 space-y-1">
                                {navLinks.map((link) => {
                                    const isActive = router.pathname.startsWith(link.href) && (link.href !== '/' || router.pathname === '/');
                                    return (
                                        <Link key={link.text} href={link.href}>
                                            <a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}>
                                                <Icon path={link.icon} className={`w-6 h-6 mr-3 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                                                {link.text}
                                            </a>
                                        </Link>
                                    );
                                })}
                            </nav>

                            {/* Status utente */}
                            <div className="px-2 py-3 border-t border-slate-200">
                                <div className="flex items-center px-2 py-2 text-xs text-slate-500">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                    Connesso come {userName || 'Utente'}
                                </div>
                            </div>

                            {/* Supporto */}
                            <div className="px-2 py-4 border-t">
                                <a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group transition-colors">
                                    <Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />
                                    Supporto
                                </a>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Overlay mobile */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />
                )}

                <div className="flex flex-col flex-1 w-0 overflow-hidden">
                    {/* Header mobile */}
                    <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                        <button 
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                            className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors" 
                            aria-label="Apri menu"
                        >
                            <Icon path={icons.menu} />
                        </button>
                        <h1 className="text-xl font-bold text-blue-600">{pageTitle || 'PMIScout'}</h1>
                        <div className="w-8" />
                    </header>

                    {/* Main content */}
                    <main className="relative flex-1 overflow-y-auto focus:outline-none">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
}
