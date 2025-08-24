// /pages/check-ai-xbrl.js
// Questa è la pagina dove l'utente carica il file di bilancio.
// 1. Mostra un'interfaccia per selezionare un file.
// 2. Al click del pulsante, carica il file direttamente su Supabase Storage.
// 3. Crea una nuova sessione di analisi nel database.
// 4. Chiama l'API /api/analyze-xbrl per avviare l'analisi in background.
// 5. Reindirizza l'utente alla pagina del report per vedere il progresso in tempo reale.

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // Per generare ID unici

// --- Inizializzazione del Client Supabase (lato client) ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- Componenti Icone ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  uploadCloud: <><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /><path d="M12 15v-6" /><path d="M9 12l3-3 3 3" /></>,
  file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
};

// --- Componente Pagina di Upload ---
export default function CheckAiXbrlPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

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
      setSelectedFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Per favore, seleziona un file prima di procedere.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Genera un ID unico per la sessione e un path per il file
      const sessionId = uuidv4();
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `public/${sessionId}.${fileExt}`;

      // 2. Carica il file su Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('checkup-documents') // Assicurati che il nome del bucket sia corretto
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 3. Crea la sessione nel database
      const { error: sessionError } = await supabase
        .from('checkup_sessions')
        .insert({
          id: sessionId,
          file_path: filePath,
          status: 'pending',
          // user_id: userId, // Se hai l'autenticazione, inserisci l'ID utente
        });

      if (sessionError) throw sessionError;

      // 4. Chiama la tua API per avviare l'analisi in background
      const response = await fetch('/api/analyze-xbrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Errore durante l\'avvio dell\'analisi.');
      }

      // 5. Reindirizza alla pagina di analisi per vedere i risultati
      router.push(`/analisi/${sessionId}`);

    } catch (err) {
      console.error('Errore nel processo di upload e analisi:', err);
      setError(`Si è verificato un errore: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Carica Bilancio per Analisi AI</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <style>{` body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; } `}</style>
      </Head>
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-900">Analisi di Bilancio con AI</h1>
              <p className="mt-2 text-slate-600">Carica il tuo file di bilancio in formato XBRL (file .xlsx) per ricevere un'analisi strategica completa.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <label 
                htmlFor="file-upload" 
                className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${dragActive ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  <Icon path={icons.uploadCloud} className="w-10 h-10 mb-4 text-slate-500" />
                  <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Clicca per caricare</span> o trascina il file</p>
                  <p className="text-xs text-slate-500">File XBRL in formato .xlsx</p>
                </div>
                <input id="file-upload" type="file" className="hidden" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
              </label>

              {selectedFile && (
                <div className="flex items-center justify-center p-3 text-sm text-slate-700 bg-slate-100 rounded-lg">
                  <Icon path={icons.file} className="w-5 h-5 mr-2 text-slate-500" />
                  File selezionato: <span className="font-medium ml-1">{selectedFile.name}</span>
                </div>
              )}

              {error && (
                <div className="flex items-center p-3 text-sm text-red-700 bg-red-100 rounded-lg">
                  <Icon path={icons.alertTriangle} className="w-5 h-5 mr-2" />
                  {error}
                </div>
              )}

              <div>
                <button 
                  type="submit" 
                  disabled={isLoading || !selectedFile}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analisi in corso...
                    </>
                  ) : (
                    'Avvia Analisi AI'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
