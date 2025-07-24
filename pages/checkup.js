// /pages/checkup.js
// Versione completa con script Outseta e UI

import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';

// --- Icone e componenti helper ---
const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {path}
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
// Spostiamo qui l'Head per caricarlo insieme a ProtectedPage
export default function CheckupPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI - PMIScout</title>
        {/* --- SCRIPT OUTSETA (FONDAMENTALE) --- */}
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{ __html: "var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };" }} />
        <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
      </Head>
      <ProtectedPage>
        {(user) => <CheckupPage user={user} />}
      </ProtectedPage>
    </>
  );
}

// --- Componente Principale della Pagina ---
// Ora non ha più bisogno di contenere l'Head
function CheckupPage({ user }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Dati del form
  const [formData, setFormData] = useState({
    company_name: '',
    industry_sector: '',
    company_size: '',
    main_challenges: '',
    business_goals: ''
  });
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Carica un documento');
      return;
    }
    setLoading(true);
    try {
      const result = await api.processCheckup(user.id, formData, file);
      router.push(`/analisi/${result.sessionId}`);
    } catch (error) {
      alert('Errore: ' + error.message);
      setLoading(false);
    }
  };

  return (
      <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
        {/* Sidebar */}
        <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Contenuto Sidebar */}
        </aside>
        
        {/* Main content */}
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
              <Icon path={icons.menu} />
            </button>
            <Link href="/"><a className="text-xl font-bold text-blue-600">PMIScout</a></Link>
            <div className="w-8" />
          </header>

          <main className="relative flex-1 overflow-y-auto focus:outline-none">
            <div className="py-6 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Check-UP AI Azienda</h1>
              <p className="text-lg text-slate-600 mb-8">Analisi approfondita della tua azienda con intelligenza artificiale</p>

              <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-8">
                {step === 1 ? (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center"><Icon path={icons.building} className="w-6 h-6 mr-3 text-blue-600" /> Dati Azienda</h2>
                    <input
                      type="text" placeholder="Nome Azienda *" required
                      value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                      className="w-full p-3 border rounded-lg"
                    />
                    <select
                      required value={formData.industry_sector} onChange={(e) => setFormData({...formData, industry_sector: e.target.value})}
                      className="w-full p-3 border rounded-lg"
                    >
                      <option value="">Seleziona Settore *</option>
                      <option value="Commercio">Commercio</option>
                      <option value="Servizi">Servizi</option>
                    </select>
                    <button type="button" onClick={() => setStep(2)} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">
                      Avanti →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center"><Icon path={icons.upload} className="w-6 h-6 mr-3 text-blue-600" /> Carica Bilancio</h2>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} className="mb-4" />
                      {file && <p className="text-green-600 font-medium">✓ {file.name} caricato</p>}
                    </div>
                    <div className="flex gap-4">
                      <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-200 text-gray-800 p-3 rounded-lg">
                        ← Indietro
                      </button>
                      <button type="submit" disabled={!file || loading} className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
