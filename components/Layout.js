// components/Layout.js
import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth'; // Importiamo il nostro hook

// Definizioni di Icon e navLinks
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = { dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>, profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>, search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>, calculator: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="12" y1="10" x2="12" y2="18" /><line x1="8" y1="14" x2="16" y2="14" /></>, marketplace: <><path d="M12 2H6.5C4.5 2 3 3.5 3 5.5V18.5C3 20.5 4.5 22 6.5 22H17.5C19.5 22 21 20.5 21 18.5V12L12 2Z" /><path d="M12 2V12H21" /><path d="M15 22V18C15 16.9 15.9 16 17 16H19" /></>, menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></> };
const navLinks = [ { href: '/', text: 'Dashboard', icon: icons.dashboard }, { href: '/profilo', text: 'Profilo', icon: icons.profile }, { href: '#', text: 'Ricerca AI', icon: icons.search }, { href: '/calcolatori', text: 'Calcolatori', icon: icons.calculator }, { href: '#', text: 'Marketplace', icon: icons.marketplace }];

export default function Layout({ children, pageTitle }) {
    const { isAuthenticated, isLoading } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const router = useRouter();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <h2 className="text-xl font-bold text-blue-600">PMIScout</h2>
                    <p className="text-slate-600">Verifica in corso...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <div className="flex items-center justify-center min-h-screen bg-slate-50"><p>Reindirizzamento al login...</p></div>;
    }

    return (
        <>
            <Head>
                <title>{pageTitle} - PMIScout</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
                {/* ERRORE CORRETTO QUI: 'pmiscout.outseta.com' tutto minuscolo */}
                <script dangerouslySetInnerHTML={{ __html: ` var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,profile,support', tokenStorage: 'cookie' }; ` }} />
                <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
            </Head>

            <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
                <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-center h-16 border-b"><h1 className="text-2xl font-bold text-blue-600">PMIScout</h1></div>
                        <nav className="flex-1 px-2 py-5 space-y-1">
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
                    </div>
                </aside>

                <div className="flex flex-col flex-1 w-0 overflow-hidden">
                    <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-500" aria-label="Apri menu"><Icon path={icons.menu} /></button>
                        <h1 className="text-xl font-bold text-blue-600">{pageTitle}</h1>
                        <div className="w-8" />
                    </header>
                    <main className="relative flex-1 overflow-y-auto focus:outline-none">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
}
