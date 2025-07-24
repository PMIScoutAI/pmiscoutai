// /pages/checkup.js
// Versione finale con UI completa e caricamento script corretto

import { useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';

// --- Componente Wrapper ---
export default function CheckupPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI - PMIScout</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
      </Head>
      {/* Uso di next/script per caricare Outseta in modo sicuro */}
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
  const [formData, setFormData] = useState({
    company_name: '',
    industry_sector: '',
    company_size: '',
  });
  const [file, setFile] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
    },
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.startCheckupProcess(formData, file);
      router.push(`/analisi/${result.sessionId}`);
    } catch (err) {
      console.error('Checkup failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
      {/* Sidebar (puoi aggiungere il contenuto qui) */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
           <div className="flex items-center justify-center h-16 bg-white border-b border-r">
              <Link href="/" className="text-2xl font-bold text-blue-600">
                PMIScout
              </Link>
            </div>
            {/* ... Navigazione ... */}
        </div>
      </aside>

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900">Check-UP AI Azienda</h1>
              <p className="text-slate-600 mt-2">Analisi bilancio con intelligenza artificiale</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-lg">
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-slate-700">Nome Azienda *</label>
                <input type="text" id="company_name" required className="w-full p-3 mt-1 border rounded-lg" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="industry_sector" className="block text-sm font-medium text-slate-700">Settore *</label>
                <input type="text" id="industry_sector" required className="w-full p-3 mt-1 border rounded-lg" value={formData.industry_sector} onChange={(e) => setFormData({ ...formData, industry_sector: e.target.value })} />
              </div>
              <div>
                <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700">Carica il bilancio (PDF, max 5MB)</label>
                <div {...getRootProps()} className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 ${isDragActive ? 'border-blue-500' : 'border-slate-300'} border-dashed rounded-md cursor-pointer`}>
                  <input {...getInputProps()} />
                  <div className="space-y-1 text-center">
                    <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {file ? (
                      <p className="text-sm text-green-600 mt-2">✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                    ) : (
                      <p className="text-sm text-slate-600">{isDragActive ? 'Rilascia il file qui...' : 'Trascina un file o clicca per selezionare'}</p>
                    )}
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-center text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
              <button type="submit" disabled={loading || !file} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400">
                {loading ? 'Elaborazione...' : '🚀 Avvia Analisi AI'}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
