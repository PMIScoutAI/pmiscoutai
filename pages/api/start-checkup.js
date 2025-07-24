// /pages/checkup.js - Versione UI migliorata con scelta del prompt
import { useState } from 'react';
import { useRouter } from 'next/router';
import { ProtectedPage } from '../utils/ProtectedPage';
import { useDropzone } from 'react-dropzone';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';

export default function CheckupPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI - PMIScout</title>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      <ProtectedPage>
        {(user) => <CheckupForm user={user} />}
      </ProtectedPage>
    </>
  );
}

function CheckupForm({ user }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '', vat_number: '', industry_sector: '', ateco_code: '', company_size: '', employee_count: '',
    location_city: '', location_region: '', website_url: '', description: '', revenue_range: '', main_challenges: '', business_goals: '',
    prompt_name: 'FINANCIAL_ANALYSIS_V1'
  });
  const [file, setFile] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setError('');
      }
    },
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    maxSize: 5 * 1024 * 1024
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Carica un documento PDF.');
    if (!formData.company_name || !formData.industry_sector || !formData.company_size) return setError('Compila tutti i campi obbligatori (*).');
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('formData', JSON.stringify(formData));
      form.append('file', file);
      form.append('outsetaToken', window?.Outseta?.user?.accessToken || '');
      form.append('promptName', formData.prompt_name);

      const response = await fetch('/api/start-checkup', {
        method: 'POST',
        body: form
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error('La risposta del server non è un JSON valido: ' + text);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il checkup');
      }

      router.push(`/analisi/${data.sessionId}`);
    } catch (err) {
      console.error('Errore invio:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800">
      <main className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-700 mb-2">Check-UP AI Azienda</h1>
          <p className="text-slate-600 text-lg">Analisi bilancio con intelligenza artificiale</p>
        </div>

        <div className="bg-white shadow-md border border-slate-200 rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-blue-600 mb-4">1. Informazioni Azienda</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input label="Nome Azienda *" name="company_name" value={formData.company_name} onChange={handleInputChange} required />
                    <Input label="Partita IVA" name="vat_number" value={formData.vat_number} onChange={handleInputChange} />
                    <Select label="Settore *" name="industry_sector" value={formData.industry_sector} onChange={handleInputChange} required options={["Commercio", "Informatica", "Consulenza"]} />
                    <Select label="Dimensione *" name="company_size" value={formData.company_size} onChange={handleInputChange} required options={["micro", "piccola", "media"]} />
                    <Select label="Tipo di Analisi AI *" name="prompt_name" value={formData.prompt_name} onChange={handleInputChange} required options={["FINANCIAL_ANALYSIS_V1", "STRATEGIC_SCORECARD", "GROWTH_OPPORTUNITIES"]} />
                  </div>
                </div>
                <div className="text-right">
                  <button type="button" onClick={() => setStep(2)} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition">Avanti</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-blue-600 mb-4">2. Carica il bilancio</h2>
                  <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}>
                    <input {...getInputProps()} />
                    {file ? (
                      <p className="text-green-600">✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                    ) : (
                      <p className="text-slate-500">Trascina qui il PDF o clicca per selezionarlo (max 5MB)</p>
                    )}
                  </div>
                </div>
                {error && <p className="text-center text-red-600 bg-red-100 py-2 px-4 rounded-lg">{error}</p>}
                <div className="flex justify-between">
                  <button type="button" onClick={() => setStep(1)} className="bg-slate-200 text-slate-700 px-5 py-3 rounded-lg font-medium hover:bg-slate-300 transition">Indietro</button>
                  <button type="submit" disabled={!file || loading} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                    {loading ? <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span> : <span>🚀</span>}
                    {loading ? 'Invio...' : 'Avvia Analisi AI'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

function Input({ label, name, value, onChange, required = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

function Select({ label, name, value, onChange, required = false, options = [] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">-- Seleziona --</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
