// /pages/valuta-pmi.js
// Valuta-PMI: Pagina principale con wizard multi-step
// VERSIONE 4.0 - Solo .xlsx/.xls (no XBRL, no ZIP)

import { useState, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';
import Layout from '../components/Layout';

// Dynamic import per evitare problemi di SSR
const ValutaPmiPageComponent = dynamic(
  () => Promise.resolve(ValutaPmiPage),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Caricamento...</p>
        </div>
      </div>
    )
  }
);

export default function ValutaPmiPageWrapper() {
  return (
    <>
      <Head>
        <title>Valuta-PMI - PMIScout</title>
        <meta name="description" content="Carica il tuo bilancio Excel per avviare una valutazione aziendale professionale con il metodo dei Multipli di Mercato." />
      </Head>

      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script
        id="outseta-script"
        src="https://cdn.outseta.com/outseta.min.js"
        strategy="beforeInteractive"
      ></Script>
      
      <ProtectedPage>
        <Layout pageTitle="Valuta-PMI">
          <ValutaPmiPageComponent />
        </Layout>
      </ProtectedPage>
    </>
  );
}

function ValutaPmiPage() {
  const [file, setFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const router = useRouter();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validExtensions = ['.xls', '.xlsx'];
      const fileName = selectedFile.name.toLowerCase();
      const isValid = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isValid) {
        setError('Formato file non valido. Carica un file Excel (.xls o .xlsx)');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file || !companyName.trim()) {
      setError('Per favore, compila tutti i campi.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyName', companyName);
      
      console.log('📤 Invio file a /api/valuta-pmi/upload...');
      const response = await api.post('/valuta-pmi/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log('✅ Upload completato:', response.data);
      if (response.data.success && response.data.sessionId) {
        router.push(`/valutazione/${response.data.sessionId}`);
      } else {
        throw new Error(response.data.error || 'Errore durante la creazione della sessione di valutazione.');
      }
      
    } catch (err) {
      console.error('💥 Errore upload:', err);
      setError(err.response?.data?.error || err.message || 'Impossibile caricare il file. Verifica che sia un bilancio Excel valido.');
      setLoading(false);
    }
  };

  const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );

  const icons = {
    upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    file: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z",
    lock: "M2 8V4.222a2 2 0 0 1 1.333-1.884l8-3.111a2 2 0 0 1 1.334 0l8 3.11a2 2 0 0 1 1.333 1.885V8M2 8v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8M2 8h20",
    chart: "M3 3v18h18M7 16l4-4 3 3 5-5",
    clock: "M12 6v6l4 2",
    check: "M20 6L9 17l-5-5"
  };

  return (
    <div className="py-8 mx-auto max-w-4xl px-4">
      {/* 🎯 HERO SECTION */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 rounded-2xl p-8 md:p-12 text-white shadow-2xl mb-8">
        {/* Decorazioni sfondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>
        
        {/* Contenuto */}
        <div className="relative z-10 text-center">
          {/* Badge metodologia */}
          <div className="inline-flex items-center px-4 py-2 bg-white/20 rounded-full text-sm font-medium mb-4">
            <span className="mr-2">💎</span>
            Metodo: Multipli di Mercato (EBITDA)
          </div>
          
          {/* Titolo */}
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Valuta PMI</h1>
          <p className="text-lg md:text-xl opacity-90 mb-6 max-w-2xl mx-auto">
            Valutazione aziendale professionale adattata al mercato italiano
          </p>
          
          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-3 text-sm">
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <Icon path={icons.upload} className="w-4 h-4" />
              <span>1. Carica Excel</span>
            </div>
            <div className="w-8 h-0.5 bg-white/30"></div>
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <Icon path={icons.clock} className="w-4 h-4" />
              <span>2. Analisi (2 min)</span>
            </div>
            <div className="w-8 h-0.5 bg-white/30"></div>
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <Icon path={icons.chart} className="w-4 h-4" />
              <span>3. Risultati</span>
            </div>
          </div>
        </div>
      </div>

      {/* ❌ MESSAGGIO ERRORE */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm flex items-start gap-3 shadow-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-semibold">Errore</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* 📝 FORM UPLOAD */}
      <form onSubmit={handleUploadSubmit} className="space-y-6">
        {/* Card principale */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-bold">1</span>
            Dati Azienda
          </h2>

          {/* Nome Azienda */}
          <div className="mb-6">
            <label htmlFor="companyName" className="block text-sm font-semibold text-slate-700 mb-2">
              Nome Azienda <span className="text-red-500">*</span>
            </label>
            <input 
              id="companyName" 
              type="text" 
              value={companyName} 
              onChange={(e) => setCompanyName(e.target.value)} 
              placeholder="Es: Rossi S.R.L." 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
              required 
            />
            <p className="mt-1 text-xs text-slate-500">Inserisci la ragione sociale completa</p>
          </div>

          {/* Upload File */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              File Bilancio Excel (ultimi 1-2 anni) <span className="text-red-500">*</span>
            </label>
            
            <div 
              onClick={() => fileInputRef.current?.click()} 
              className="mt-2 flex flex-col justify-center items-center px-6 py-8 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 bg-slate-50 transition-all group"
            >
              <div className="text-center">
                <div className="mx-auto h-16 w-16 text-slate-400 group-hover:text-blue-500 transition-colors mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600 mb-1">
                  <span className="font-semibold text-blue-600">Clicca per caricare</span> o trascina il file qui
                </p>
                <p className="text-xs text-slate-500">Formati supportati: .xls, .xlsx</p>
                <p className="text-xs text-slate-400 mt-1">Dimensione massima: 10MB</p>
              </div>
            </div>
            
            <input 
              ref={fileInputRef} 
              id="file-upload" 
              name="file-upload" 
              type="file" 
              className="sr-only" 
              onChange={handleFileChange} 
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
            />

            {/* File caricato */}
            {file && (
              <div className="mt-4 flex items-center justify-between px-4 py-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Icon path={icons.file} className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-900">{file.name}</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setFile(null); fileInputRef.current.value = null; }} 
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-green-700 hover:text-green-900 hover:bg-green-100 rounded-lg transition-colors" 
                  aria-label="Rimuovi file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Info Excel */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">💡 Dove trovo il file Excel?</span><br/>
                Esporta il bilancio dal tuo software contabile (Zucchetti, Aruba, etc.) in formato .xls o .xlsx. Assicurati di includere sia lo Stato Patrimoniale che il Conto Economico.
              </p>
            </div>
          </div>
        </div>

        {/* 📊 Card Benefici */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-blue-900 mb-4 flex items-center gap-2">
            <Icon path={icons.check} className="w-5 h-5" />
            Cosa Otterrai
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mt-0.5">✓</div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Fair Market Value</p>
                <p className="text-xs text-blue-700 mt-0.5">Valore di mercato con range conservativo/ottimistico</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mt-0.5">✓</div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Multipli Settoriali</p>
                <p className="text-xs text-blue-700 mt-0.5">Benchmark specifici per 25+ settori italiani</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mt-0.5">✓</div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Metodologia Trasparente</p>
                <p className="text-xs text-blue-700 mt-0.5">Nota metodologica completa e comprensibile</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mt-0.5">✓</div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Report PDF Professionale</p>
                <p className="text-xs text-blue-700 mt-0.5">Pronto da presentare a banche e investitori</p>
              </div>
            </div>
          </div>
        </div>

        {/* 🔒 Privacy notice */}
        <div className="flex items-start gap-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <Icon path={icons.lock} className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-slate-700">Privacy garantita:</span> I tuoi dati sono crittografati e utilizzati esclusivamente per questa valutazione. Non condividiamo informazioni con terze parti.
          </p>
        </div>

        {/* 🚀 Bottone Submit */}
        <button 
          type="submit" 
          disabled={loading || !file || !companyName.trim()} 
          className="w-full flex justify-center items-center px-6 py-4 font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl disabled:shadow-none"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Elaborazione in corso...
            </>
          ) : (
            <>
              <Icon path={icons.chart} className="w-5 h-5 mr-2" />
              Avvia Valutazione
            </>
          )}
        </button>
      </form>

      {/* 📋 Requisiti tecnici */}
      <div className="mt-8 bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">📋 Requisiti File Excel</h3>
        <ul className="text-xs text-slate-600 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Bilanci degli <strong>ultimi 1-2 anni fiscali</strong> (necessari per calcolare crescita ricavi)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Dati finanziari completi: <strong>Ricavi, EBITDA, debiti, liquidità</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Formato standard civilistico italiano: Stato Patrimoniale + Conto Economico</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Esporta dal tuo software contabile in .xls o .xlsx</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>File integro e non corrotto (dimensione max 10MB)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
