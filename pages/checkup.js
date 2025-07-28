// /pages/checkup.js
// Check-UP AI Azienda - UI/UX Migliorata
// Mantiene tutta la logica esistente con design moderno

import { useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';

// --- Componente Wrapper (INVARIATO) ---
export default function CheckupPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI Azienda - PMIScout</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
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

// --- Componente Principale del Form (NUOVO DESIGN) ---
function CheckupForm({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // Form data
  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [pdfFile, setPdfFile] = useState(null);

  // --- Icone SVG (stesse della dashboard) ---
  const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {path}
    </svg>
  );

  const icons = {
    building: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12h4"/><path d="M6 16h4"/><path d="M16 12h2"/><path d="M16 16h2"/><path d="M6 22h12"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    arrow: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    file: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></>,
    sparkles: <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
  };

  // --- Gestione Drag & Drop ---
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
        setError('');
      } else {
        setError('Formato file non supportato. Carica solo file PDF.');
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setPdfFile(file);
        setError('');
      } else {
        setError('Formato file non supportato. Carica solo file PDF.');
      }
    }
  };

  // --- Submit Handler (MANTIENE LA LOGICA ESISTENTE) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validazione minima
    if (!companyName.trim()) {
      setError('Il nome azienda è obbligatorio');
      return;
    }
    if (!pdfFile) {
      setError('È necessario caricare un file PDF');
      return;
    }
    if (pdfFile.size > 5 * 1024 * 1024) { // 5MB
      setError('Il file PDF deve essere massimo 5MB');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Prepara FormData per l'upload
      const formData = new FormData();
      formData.append('companyName', companyName);
      formData.append('vatNumber', vatNumber);
      formData.append('pdfFile', pdfFile);

      // Chiama API estesa
      const result = await api.startCheckup(formData);
      
      // Redirect ai risultati
      window.location.href = `/analisi/${result.sessionId}`;
      
    } catch (err) {
      console.error('Errore durante l\'avvio del checkup:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Utility per formattare dimensione file ---
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <img 
              src="https://www.pmiscout.eu/wp-content/uploads/2025/07/Logo_Pmi_Scout_favicon.jpg" 
              alt="PMIScout Logo" 
              className="w-10 h-10 rounded-full"
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Check-UP AI Azienda</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Ottieni un'analisi completa e approfondita della tua azienda grazie alla nostra intelligenza artificiale avanzata
          </p>
        </div>
      </div>

      {/* Indicatore progresso */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-medium">
              1
            </div>
            <span className="ml-2 text-sm font-medium text-blue-600">Informazioni Azienda</span>
          </div>
          <div className="flex-1 mx-4 h-0.5 bg-slate-200">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{width: '50%'}}></div>
          </div>
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 bg-slate-200 text-slate-500 rounded-full text-sm font-medium">
              2
            </div>
            <span className="ml-2 text-sm font-medium text-slate-500">Risultati</span>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Form Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
            <div className="flex items-center">
              <Icon path={icons.building} className="w-8 h-8 mr-3" />
              <div>
                <h2 className="text-xl font-semibold">Dati Aziendali</h2>
                <p className="text-blue-100 mt-1">
                  Ciao, {user.name}. Inserisci le informazioni della tua azienda
                </p>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <Icon path={icons.info} className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Errore</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-6" onSubmit={handleSubmit}>
              {/* Nome Azienda */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome Azienda *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 pl-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Es. Mario Rossi S.r.l."
                    required
                  />
                  <Icon path={icons.building} className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                </div>
              </div>

              {/* Partita IVA */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Partita IVA <span className="text-slate-400">(opzionale)</span>
                </label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Es. 12345678901"
                />
              </div>

              {/* Upload PDF */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bilancio o Documento Aziendale *
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : pdfFile 
                        ? 'border-green-400 bg-green-50' 
                        : 'border-slate-300 hover:border-slate-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                  
                  {pdfFile ? (
                    <div className="text-center">
                      <Icon path={icons.check} className="w-12 h-12 text-green-600 mx-auto mb-3" />
                      <p className="text-sm font-medium text-green-800">{pdfFile.name}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {formatFileSize(pdfFile.size)} • PDF
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPdfFile(null);
                        }}
                        className="text-xs text-green-700 hover:text-green-800 mt-2 underline"
                      >
                        Rimuovi file
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Icon path={icons.upload} className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-slate-700">
                        Trascina il file qui o clicca per selezionare
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Formato supportato: PDF (massimo 5MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Icon path={icons.info} className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">Come funziona l'analisi?</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      La nostra AI analizzerà i documenti caricati per fornirti insights dettagliati su: 
                      performance finanziarie, opportunità di crescita, ottimizzazioni possibili e raccomandazioni strategiche.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={loading || !companyName.trim() || !pdfFile}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Icon path={icons.sparkles} className="w-5 h-5 mr-2" />
                    Avvia Check-UP AI
                    <Icon path={icons.arrow} className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            🔒 I tuoi dati sono al sicuro. L'analisi avviene in completa sicurezza e privacy.
          </p>
        </div>

        {/* Features Preview */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-white rounded-lg border border-slate-200">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Icon path={icons.check} className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Analisi Veloce</h3>
            <p className="text-sm text-slate-600">Risultati in pochi minuti grazie all'AI avanzata</p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-lg border border-slate-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Icon path={icons.sparkles} className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Insights Dettagliati</h3>
            <p className="text-sm text-slate-600">Raccomandazioni personalizzate per la tua azienda</p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-lg border border-slate-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Icon path={icons.file} className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Report Completo</h3>
            <p className="text-sm text-slate-600">Documento PDF scaricabile con tutti i dettagli</p>
          </div>
        </div>
      </div>
    </div>
  );
}
