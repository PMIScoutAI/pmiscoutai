// /pages/analisi-hd/[sessionId].js
// Pagina dinamica per visualizzare lo stato e i risultati dell'analisi.
// VERSIONE FINALE con dashboard integrata e fix di robustezza applicati.

import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { ProtectedPageHd } from '../../utils/ProtectedPageHd'; // Assicurati che il percorso sia corretto

// --- Componente Wrapper (FIX: Passa le props da getServerSideProps) ---
export default function AnalisiHdPageWrapper(props) {
  return (
    <>
      <Head>
        <title>Risultati Analisi - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{` 
          body { font-family: 'Inter', sans-serif; } 
          @media print {
            body { background-color: white; }
            .no-print { display: none !important; }
            .print-container {
              width: 100%;
              max-width: 100%;
              padding: 0;
              margin: 0;
            }
            .print-card {
              box-shadow: none;
              border: 1px solid #e2e8f0;
            }
          }
        `}</style>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">{`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}</Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      <ProtectedPageHd>
        {(user) => (
          <AnalisiHdPageLayout user={user}>
            {/* Le props (sessionData, error) vengono passate qui */}
            <AnalisiHdPage {...props} />
          </AnalisiHdPageLayout>
        )}
      </ProtectedPageHd>
    </>
  );
}

// --- Icone (invariato) ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></>,
  check: <><polyline points="20 6 9 17 4 12"></polyline></>,
  clock: <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></>,
  trendingUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></>,
  target: <><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></>,
  thumbsUp: <><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a2 2 0 0 1 3 3.88z"></path></>,
  thumbsDown: <><path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a2 2 0 0 1-3-3.88z"></path></>,
  lightbulb: <><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.09 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></>,
  flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></>,
  printer: <><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></>
};

// --- Layout della Pagina (invariato) ---
function AnalisiHdPageLayout({ user, children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navLinks = [
        { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
        { href: '/checkup-hd', text: 'Check-UP AI HD', icon: icons.zap, active: true },
        { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: false },
        { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    ];
    return (
        <div className="relative flex min-h-screen bg-slate-100 text-slate-800">
        <aside className={`no-print absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
            <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b">
                <img src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" alt="Logo PMIScout" className="h-8 w-auto" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x40/007BFF/FFFFFF?text=PMIScout'; }}/>
            </div>
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
                <nav className="flex-1 px-2 pb-4 space-y-1">
                {navLinks.map((link) => (
                    // FIX: Rimosso <a> figlio da <Link>
                    <Link key={link.text} href={link.href} className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ link.active ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}>
                        <Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />
                        {link.text}
                    </Link>
                ))}
                </nav>
                <div className="px-2 py-4 border-t">
                    <a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group">
                        <Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />Supporto
                    </a>
                </div>
            </div>
            </div>
        </aside>
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
            <main className="relative flex-1 overflow-y-auto focus:outline-none">
                <div className="py-8 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 print-container">
                    {children}
                </div>
            </main>
        </div>
        </div>
    );
}

// --- Componente Logico (invariato) ---
function AnalisiHdPage({ sessionData, error }) {
  const router = useRouter();

  useEffect(() => {
    if (sessionData && (sessionData.status === 'indexing' || sessionData.status === 'processing')) {
      const interval = setInterval(() => { router.replace(router.asPath); }, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionData, router]);

  if (error) {
    return <StatusDisplay icon={icons.alert} title="Errore" message={error} color="red" isInsideLayout={true} />;
  }

  if (!sessionData) {
     return <StatusDisplay icon={icons.clock} title="Caricamento..." message="Recupero dei dati della sessione in corso." color="blue" isInsideLayout={true} />;
  }

  switch (sessionData?.status) {
    case 'indexing':
    case 'processing':
      return <StatusDisplay icon={icons.clock} title="Analisi in corso..." message="Il tuo documento è in fase di analisi. La pagina si aggiornerà automaticamente non appena i risultati saranno pronti." color="blue" isInsideLayout={true} />;
    case 'completed':
      return <ResultsDisplay session={sessionData} />;
    case 'failed':
      return <StatusDisplay icon={icons.alert} title="Analisi Fallita" message={sessionData.error_message || "Si è verificato un errore sconosciuto."} color="red" isInsideLayout={true} />;
    default:
      return <StatusDisplay icon={icons.alert} title="Stato Sconosciuto" message="Lo stato della sessione di analisi non è riconoscibile." color="yellow" isInsideLayout={true} />;
  }
}

// --- Componenti di Visualizzazione ---

// FIX: Mappatura statica dei colori per evitare problemi con Tailwind Purge
const colorMap = {
    bg: { red: 'bg-red-100', blue: 'bg-blue-100', yellow: 'bg-yellow-100', green: 'bg-green-100', purple: 'bg-purple-100' },
    text: { red: 'text-red-600', blue: 'text-blue-600', yellow: 'text-yellow-600', green: 'text-green-600', purple: 'text-purple-600' },
};

const StatusDisplay = ({ icon, title, message, color, isInsideLayout }) => {
    const content = (
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md mx-auto">
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${colorMap.bg[color] || 'bg-slate-100'}`}>
                <Icon path={icon} className={`h-6 w-6 ${colorMap.text[color] || 'text-slate-600'}`} />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-800">{title}</h2>
            <p className="mt-2 text-slate-600">{message}</p>
            <Link href="/checkup-hd" className="mt-6 inline-block px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              Torna indietro
            </Link>
        </div>
    );
    if (isInsideLayout) return content;
    return <div className="flex items-center justify-center min-h-screen bg-slate-50">{content}</div>;
};

const ResultsDisplay = ({ session }) => {
  // FIX: Parsing sicuro del JSON se è una stringa
  let analysis = session.final_analysis;
  if (typeof analysis === 'string') {
    try { analysis = JSON.parse(analysis); } catch { analysis = null; }
  }

  if (!analysis) {
    return <StatusDisplay icon={icons.alert} title="Dati non disponibili" message="L'analisi è completata ma il report finale non è leggibile." color="yellow" isInsideLayout={true} />;
  }
  
  // FIX: Destructuring robusto per evitare crash con dati mancanti o malformati
  const { health_score = 0, summary = "Riepilogo non disponibile." } = analysis;
  const key_metrics_container = (analysis.key_metrics && typeof analysis.key_metrics === 'object') ? (analysis.key_metrics.key_metrics || analysis.key_metrics) : {};
  const { crescita_fatturato_perc = { label: "Crescita Fatturato (%)", value: null }, roe = { label: "ROE (%)", value: null } } = key_metrics_container;
  const detailed_swot_container = key_metrics_container.detailed_swot || analysis.detailed_swot || {};
  const { strengths = [], weaknesses = [], opportunities = [], threats = [] } = detailed_swot_container;
  const recommendations = key_metrics_container.recommendations || analysis.recommendations || [];

  return (
    <>
        <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Report Analisi Finanziaria</h1>
                <p className="mt-1 text-slate-600">Sessione: {session.id}</p>
            </div>
            <div className="flex space-x-2 mt-4 sm:mt-0">
                <button onClick={() => window.print()} className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                    <Icon path={icons.printer} className="w-5 h-5 mr-2" />
                    Stampa Report
                </button>
                <Link href="/checkup-hd" className="inline-block px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
                    Esegui un'altra analisi
                </Link>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <SummaryCard summary={summary} />
                <SwotCard strengths={strengths} weaknesses={weaknesses} opportunities={opportunities} threats={threats} />
                <RecommendationsCard recommendations={recommendations} />
            </div>
            <div className="space-y-6">
                <HealthScoreGauge score={health_score} />
                <MetricCard title={crescita_fatturato_perc.label} value={crescita_fatturato_perc.value} unit="%" icon={icons.trendingUp} />
                <MetricCard title={roe.label} value={roe.value} unit="%" icon={icons.target} />
            </div>
        </div>
    </>
  );
};

// --- Componenti Helper per la Dashboard ---
const Card = ({ children, className }) => <div className={`bg-white p-6 rounded-lg shadow-sm print-card ${className}`}>{children}</div>;
const SummaryCard = ({ summary }) => (<Card><h2 className="text-xl font-semibold text-slate-800 mb-3">Riepilogo Esecutivo</h2><p className="text-slate-600 leading-relaxed">{summary}</p></Card>);

const MetricCard = ({ title, value, unit, icon }) => {
    // FIX: Gestione robusta di valori non numerici
    const num = typeof value === 'number' ? value : (value != null ? Number(value) : null);
    const hasValue = Number.isFinite(num);

    return (
        <Card>
            <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-full mr-4"><Icon path={icon} className="w-6 h-6 text-purple-600" /></div>
                <div>
                    <p className="text-sm text-slate-500">{title}</p>
                    <p className="text-3xl font-bold text-slate-900">
                        {hasValue ? num.toLocaleString('it-IT') : 'N/D'}
                        {hasValue && unit ? <span className="text-xl font-medium text-slate-500 ml-1">{unit}</span> : null}
                    </p>
                </div>
            </div>
        </Card>
    );
};

const SwotCard = ({ strengths, weaknesses, opportunities, threats }) => (<Card><h2 className="text-xl font-semibold text-slate-800 mb-4">Analisi SWOT</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-6"><SwotList title="Punti di Forza" items={strengths} icon={icons.thumbsUp} color="green" /><SwotList title="Punti di Debolezza" items={weaknesses} icon={icons.thumbsDown} color="red" /><SwotList title="Opportunità" items={opportunities} icon={icons.lightbulb} color="blue" /><SwotList title="Minacce" items={threats} icon={icons.flag} color="yellow" /></div></Card>);
const SwotList = ({ title, items, icon, color }) => (<div><div className={`flex items-center ${colorMap.text[color] || 'text-slate-600'} mb-2`}><Icon path={icon} className="w-5 h-5 mr-2" /><h3 className="font-semibold">{title}</h3></div><ul className="space-y-1 list-disc list-inside text-slate-600 text-sm">{items && items.length > 0 ? items.map((item, index) => <li key={index}>{item}</li>) : <li>N/D</li>}</ul></div>);
const RecommendationsCard = ({ recommendations }) => (<Card><h2 className="text-xl font-semibold text-slate-800 mb-3">Raccomandazioni</h2><ul className="space-y-2 list-disc list-inside text-slate-600">{recommendations && recommendations.length > 0 ? recommendations.map((rec, index) => <li key={index}>{rec}</li>) : <li>N/D</li>}</ul></Card>);

// --- FUNZIONE SERVER-SIDE ---
export async function getServerSideProps(context) {
  const { sessionId } = context.params;
  // FIX: Usare una variabile non-public per la chiave di servizio
  const supabase = createClient(
    process.env.SUPABASE_URL, // Usare la variabile server-side
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data: sessionData, error } = await supabase
      .from('checkup_sessions_hd')
      .select(`*, analysis_results_hd(final_analysis)`)
      .eq('id', sessionId)
      .single();

    if (error) throw new Error(`Sessione non trovata: ${error.message}`);
    
    // FIX: Accesso sicuro alla relazione
    const finalData = { 
        ...sessionData, 
        final_analysis: sessionData?.analysis_results_hd?.[0]?.final_analysis ?? null 
    };
    delete finalData.analysis_results_hd;

    return { props: { sessionData: finalData } };
  } catch (error) {
    console.error("Errore in getServerSideProps:", error.message);
    return { props: { error: error.message, sessionData: null } };
  }
}
