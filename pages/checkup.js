// /pages/checkup.js - Versione aggiornata e completata per la nuova architettura
import { useState } from 'react';
import { useRouter } from 'next/router';
import { ProtectedPage } from '../utils/ProtectedPage';
import { api } from '../utils/api';
import { useDropzone } from 'react-dropzone';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';

// --- Componente Wrapper ---
export default function CheckupPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI - PMIScout</title>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script
        id="outseta-script"
        src="https://cdn.outseta.com/outseta.min.js"
        strategy="beforeInteractive"
      />
      <ProtectedPage>
        {(user) => <CheckupForm user={user} />}
      </ProtectedPage>
    </>
  );
}

// --- Componente Principale del Form ---
function CheckupForm({ user }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dati del form
  const [formData, setFormData] = useState({
    company_name: '',
    vat_number: '',
    industry_sector: '',
    ateco_code: '',
    company_size: '',
    employee_count: '',
    location_city: '',
    location_region: '',
    website_url: '',
    description: '',
    revenue_range: '',
    main_challenges: '',
    business_goals: ''
  });
  const [file, setFile] = useState(null);

  // Gestione drag & drop
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setError(''); // Pulisce l'errore se un file valido viene caricato
      }
    },
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  // Gestione submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Per favore, carica un documento di bilancio.');
      return;
    }
    if (!formData.company_name || !formData.industry_sector || !formData.company_size) {
      setError('Per favore, compila tutti i campi obbligatori (*).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Chiama la funzione corretta dal nostro file api.js
      const result = await api.startCheckupProcess(formData, file);
      // Successo! Redirect alla pagina dei risultati
      router.push(`/analisi/${result.sessionId}`);
    } catch (err) {
      console.error('Errore durante l\'invio:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Gestione input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Icone SVG
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
    building: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18H6Z" /><path d="M6 12h12" /><path d="M6 16h12" /><path d="M10 6h4" /><path d="M10 10h4" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    spark: <><path d="M12 3v6l4-4-4-4" /><path d="M12 21v-6l-4 4 4 4" /><path d="M3 12h6l-4-4 4-4" /><path d="M21 12h-6l4 4-4 4" /></>,
    file: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></>
  };
  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
    { href: '/profile', text: 'Profilo', icon: icons.profile, active: false },
  ];

  return (
    <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
      {/* Sidebar */}
      <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 border-b">
            <Link href="/">
              <a className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">PMIScout</a>
            </Link>
          </div>
          <nav className="flex-1 px-2 py-5 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.text} href={link.href}>
                <a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${link.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                  <Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />
                  {link.text}
                </a>
              </Link>
            ))}
          </nav>
          <div className="px-2 py-3 border-t border-slate-200">
            <div className="flex items-center px-2 py-2 text-xs text-slate-500">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Connesso come {user.name}
            </div>
          </div>
        </div>
      </aside>
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-10 bg-black bg-opacity-50 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      {/* Main content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-4 bg-white border-b md:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors">
            <Icon path={icons.menu} />
          </button>
          <Link href="/"><a className="text-xl font-bold text-blue-600">PMIScout</a></Link>
          <div className="w-8" />
        </header>
        <main className="relative flex-1 overflow-y-auto focus:outline-none">
          <div className="py-6 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Icon path={icons.spark} className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Check-UP AI Azienda</h1>
                  <p className="text-lg text-slate-600">Analisi approfondita con intelligenza artificiale</p>
                </div>
              </div>
              {/* Progress indicator */}
              <div className="flex items-center justify-center space-x-4 mt-8">
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Icon path={icons.building} className="w-4 h-4" />
                  <span>Dati Azienda</span>
                </div>
                <div className={`w-8 h-px transition-colors ${step >= 2 ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Icon path={icons.upload} className="w-4 h-4" />
                  <span>Documenti</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {step === 1 ? (
                  // Step 1: Dati azienda
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center">
                      <Icon path={icons.building} className="w-6 h-6 mr-3 text-blue-600" />
                      Informazioni Azienda
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nome Azienda *</label>
                        <input type="text" name="company_name" required value={formData.company_name} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="La tua azienda..." />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Partita IVA</label>
                        <input type="text" name="vat_number" value={formData.vat_number} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="IT..." />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Settore di Attività *</label>
                        <select name="industry_sector" required value={formData.industry_sector} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="">Seleziona settore...</option>
                          <option value="Commercio">Commercio</option>
                          <option value="Informatica">Informatica e Software</option>
                          <option value="Consulenza">Consulenza</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Dimensione Azienda *</label>
                        <select name="company_size" required value={formData.company_size} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="">Seleziona dimensione...</option>
                          <option value="micro">Micro (1-9 dipendenti)</option>
                          <option value="piccola">Piccola (10-49 dipendenti)</option>
                          <option value="media">Media (50-249 dipendenti)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setStep(2)} className="flex items-center space-x-3 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                        <span>Avanti</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  // Step 2: Upload file
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center">
                      <Icon path={icons.upload} className="w-6 h-6 mr-3 text-blue-600" />
                      Carica il Bilancio
                    </h2>
                    <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}>
                      <input {...getInputProps()} />
                      <Icon path={icons.file} className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                      {file ? (
                        <div>
                          <p className="text-green-600 font-medium mb-2">✓ File selezionato: {file.name}</p>
                          <p className="text-sm text-slate-500">Dimensione: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-slate-600 mb-2">{isDragActive ? 'Rilascia il file qui' : 'Trascina qui il tuo bilancio in PDF o clicca per selezionarlo'}</p>
                          <p className="text-xs text-slate-500">PDF fino a 5MB</p>
                        </div>
                      )}
                    </div>
                    {error && <p className="text-sm text-center text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
                    <div className="flex justify-between">
                      <button type="button" onClick={() => setStep(1)} className="px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                        Indietro
                      </button>
                      <button type="submit" disabled={!file || loading} className="flex items-center space-x-3 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed">
                        {loading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <Icon path={icons.spark} className="w-5 h-5" />
                        )}
                        <span>{loading ? 'Invio in corso...' : 'Avvia Analisi AI'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
