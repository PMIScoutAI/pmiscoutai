// /pages/valuta-pmi.js
// Valuta-PMI: Pagina principale con wizard multi-step
// VERSIONE 1.0 - Step 1: Upload XBRL

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
        <meta name="description" content="Valutazione aziendale professionale con metodo Transaction Multiples" />
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

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

function ValutaPmiPage() {
  // State per wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  
  // State per Step 1 (Upload)
  const [file, setFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  
  const fileInputRef = useRef(null);
  const router = useRouter();

  // ============================================
  // STEP 1: Upload XBRL
  // ============================================

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validazione tipo file
      const validExtensions = ['.xbrl', '.xls', '.xlsx', '.zip'];
      const fileName = selectedFile.name.toLowerCase();
      const isValid = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isValid) {
        setError('Formato file non valido. Carica un file XBRL (.xbrl, .xls, .xlsx, .zip)');
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
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      
      console.log('✅ Upload completato:', response.data);
      
      if (response.data.success) {
        setSessionId(response.data.sessionId);
        setUploadResult(response.data.data);
        
        // Mostra preview dati prima di passare a Step 2
        setCurrentStep(1.5); // Step intermedio per review
      } else {
        throw new Error(response.data.error || 'Errore durante l\'upload');
      }
      
    } catch (err) {
      console.error('💥 Errore upload:', err);
      setError(
        err.response?.data?.error || 
        err.message || 
        'Impossibile caricare il file. Verifica che sia un XBRL valido.'
      );
    } finally {
      setLoading(false);
    }
  };

  const proceedToDataEntry = () => {
    setCurrentStep(2);
    // In futuro: router.push(`/valuta-pmi/data-entry?session=${sessionId}`);
  };

  // ============================================
  // UI COMPONENTS
  // ============================================

  const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );

  const icons = {
    upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    file: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z",
    lock: "M2 8V4.222a2 2 0 0 1 1.333-1.884l8-3.111a2 2 0 0 1 1.334 0l8 3.11a2 2 0 0 1 1.333 1.885V8M2 8v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8M2 8h20",
    check: "M20 6L9 17l-5-5",
    chart: "M3 3v18h18M7 16l4-4 3 3 5-5"
  };

  // ============================================
  // WIZARD PROGRESS BAR
  // ============================================

  const steps = [
    { number: 1, label: 'Upload XBRL', status: currentStep >= 1 ? 'completed' : 'pending' },
    { number: 2, label: 'Dati Aziendali', status: currentStep >= 2 ? 'completed' : 'pending' },
    { number: 3, label: 'Riclassificazione', status: currentStep >= 3 ? 'completed' : 'pending' },
    { number: 4, label: 'Valutazione', status: currentStep >= 4 ? 'completed' : 'pending' },
    { number: 5, label: 'Scenario Futuro', status: currentStep >= 5 ? 'completed' : 'pending' }
  ];

  const StepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold
                ${currentStep >= step.number 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-200 text-slate-500'
                }
              `}>
                {currentStep > step.number ? (
                  <Icon path={icons.check} className="w-5 h-5" />
                ) : (
                  step.number
                )}
              </div>
              <span className={`
                mt-2 text-xs font-medium text-center
                ${currentStep >= step.number ? 'text-blue-600' : 'text-slate-500'}
              `}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`
                flex-1 h-1 mx-2
                ${currentStep > step.number ? 'bg-blue-600' : 'bg-slate-200'}
              `} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================
  // RENDER STEP 1: Upload Form
  // ============================================

  const renderUploadStep = () => (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          Valuta la Tua PMI
        </h1>
        <p className="mt-3 text-slate-600">
          Valutazione aziendale professionale con metodo <strong>Transaction Multiples</strong>
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleUploadSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">
            Nome Azienda *
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Es: Rossi S.R.L."
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            File Bilancio XBRL (ultimi 1-2 anni) *
          </label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:border-blue-500 bg-slate-50 transition-colors"
          >
            <div className="space-y-1 text-center">
              <Icon path={icons.upload} className="mx-auto h-12 w-12 text-slate-400" />
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-blue-600">Clicca per caricare</span> o trascina qui
              </p>
              <p className="text-xs text-slate-500">Formati: .xbrl, .xls, .xlsx, .zip (max 10MB)</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            onChange={handleFileChange}
            accept=".xbrl,.xls,.xlsx,.zip,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
          />
        </div>

        {file && (
          <div className="flex items-center justify-between px-4 py-2 text-sm text-green-800 bg-green-100 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Icon path={icons.file} className="w-5 h-5 mr-3 text-green-600" />
              <span className="font-medium">{file.name}</span>
            </div>
            <button 
              type="button"
              onClick={() => setFile(null)}
              className="text-green-900 hover:text-green-700 font-bold"
              aria-label="Rimuovi file"
            >×</button>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            📊 Cosa otterrai:
          </h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>✓ Riclassificazione automatica del bilancio</li>
            <li>✓ Valutazione con multipli di mercato settoriali</li>
            <li>✓ Simulazione scenari futuri (3 anni)</li>
            <li>✓ Export completo in CSV</li>
          </ul>
        </div>

        <div className="flex items-center text-xs text-slate-500">
          <Icon path={icons.lock} className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>I tuoi dati sono crittografati e usati solo per questa valutazione.</span>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-300"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analisi in corso...
            </>
          ) : (
            <>
              <Icon path={icons.chart} className="w-5 h-5 mr-2" />
              Avvia Valutazione
            </>
          )}
        </button>
      </form>
    </>
  );

  // ============================================
  // RENDER STEP 1.5: Preview Dati Estratti
  // ============================================

  const renderDataPreview = () => (
    <>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <Icon path={icons.check} className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">
          Dati Estratti con Successo!
        </h1>
        <p className="mt-2 text-slate-600">
          Ecco i dati principali estratti dal bilancio XBRL
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          📊 {uploadResult?.company_name}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-sm text-slate-600 mb-1">Codice ATECO</div>
            <div className="text-2xl font-bold text-slate-900">
              {uploadResult?.ateco_code || 'N/D'}
            </div>
          </div>
          
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-sm text-slate-600 mb-1">Anni Analizzati</div>
            <div className="text-2xl font-bold text-slate-900">
              {uploadResult?.years?.join(', ') || 'N/D'}
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Ricavi 2024</div>
            <div className="text-2xl font-bold text-blue-900">
              €{uploadResult?.metrics?.ricavi_2024?.toLocaleString('it-IT') || 'N/D'}
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">EBITDA 2024</div>
            <div className="text-2xl font-bold text-blue-900">
              €{uploadResult?.metrics?.ebitda_2024?.toLocaleString('it-IT') || 'N/D'}
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">Patrimonio Netto</div>
            <div className="text-2xl font-bold text-green-900">
              €{uploadResult?.metrics?.patrimonio_netto_2024?.toLocaleString('it-IT') || 'N/D'}
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">PFN (stimata)</div>
            <div className="text-2xl font-bold text-green-900">
              €{uploadResult?.metrics?.pfn_2024?.toLocaleString('it-IT') || 'Da inserire'}
            </div>
          </div>
        </div>

        {uploadResult?.metrics?.debiti_finanziari_auto_detected && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">
              🔍 Debiti Finanziari - Rilevamento Automatico:
            </h3>
            <ul className="text-xs text-amber-800 space-y-1">
              <li>
                {uploadResult.metrics.debiti_finanziari_auto_detected.ml_termine 
                  ? '✓ Debiti M/L termine rilevati' 
                  : '⚠️ Debiti M/L termine non trovati (da inserire manualmente)'}
              </li>
              <li>
                {uploadResult.metrics.debiti_finanziari_auto_detected.breve_termine 
                  ? '✓ Debiti breve termine rilevati' 
                  : '⚠️ Debiti breve termine non trovati (da inserire manualmente)'}
              </li>
            </ul>
          </div>
        )}

        <p className="text-sm text-slate-600 mb-6">
          Nel prossimo step potrai confermare o modificare questi dati e aggiungere eventuali informazioni mancanti.
        </p>

        <button
          onClick={proceedToDataEntry}
          className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-300"
        >
          Prosegui con Data Entry
          <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  );

  // ============================================
  // RENDER STEP 2: Placeholder
  // ============================================

  const renderStep2 = () => (
    <div className="text-center bg-white rounded-lg shadow-md p-12">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
        <span className="text-3xl">📝</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">
        Step 2: Data Entry
      </h2>
      <p className="text-slate-600 mb-6">
        Questa sezione sarà implementata nel prossimo step.<br />
        Qui l'utente potrà confermare/modificare i dati estratti.
      </p>
      <div className="text-sm text-slate-500">
        Session ID: <code className="bg-slate-100 px-2 py-1 rounded">{sessionId}</code>
      </div>
    </div>
  );

  // ============================================
  // RENDER PRINCIPALE
  // ============================================

  return (
    <div className="py-8 mx-auto max-w-4xl px-4">
      <StepIndicator />
      
      {currentStep === 1 && renderUploadStep()}
      {currentStep === 1.5 && renderDataPreview()}
      {currentStep === 2 && renderStep2()}
    </div>
  );
}
