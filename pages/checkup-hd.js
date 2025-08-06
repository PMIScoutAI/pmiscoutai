// /pages/checkup-hd.js
// Pagina per il nuovo flusso di analisi "High Definition".
// Versione con logica di estrazione dati da PDF.

import ValidationModal from '../components/ValidationModal';
import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { ProtectedPageHd } from '../utils/ProtectedPageHd';

// --- NUOVO: Importiamo la libreria pdf.js ---
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
// --- NUOVO: Dobbiamo dire a pdf.js dove trovare un file di supporto ("worker") ---
// Questo è necessario per farlo funzionare correttamente nel browser.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;


// --- Componente Wrapper (invariato) ---
export default function CheckupHdPageWrapper() {
  return (
    <>
      <Head>
        <title>Check-UP AI HD (Beta) - PMIScout</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
      </Head>
      <Script id="outseta-options" strategy="beforeInteractive">{`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}</Script>
      <Script id="outseta-script" src="https://cdn.outseta.com/outseta.min.js" strategy="beforeInteractive" />
      <ProtectedPageHd>
        {(user, token) => <CheckupHdPageLayout user={user} token={token} />}
      </ProtectedPageHd>
    </>
  );
}

// --- Componenti UI (Icone, etc.) (invariato) ---
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
  checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
  support: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></>,
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></>
};

// --- Layout della Pagina (invariato) ---
function CheckupHdPageLayout({ user, token }) {
    // ... (il codice del layout rimane identico)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navLinks = [
        { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
        { href: '/checkup-hd', text: 'Check-UP AI HD', icon: icons.zap, active: true },
        { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: false },
        { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
    ];

    return (
        <div className="relative flex min-h-screen bg-slate-50 text-slate-800">
        <aside className={`absolute z-20 flex-shrink-0 w-64 h-full bg-white border-r transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${ isSidebarOpen ? 'translate-x-0' : '-translate-x-full' }`}>
            <div className="flex flex-col h-full">
            <div className="flex items-center justify-center h-16 border-b">
                <img src="https://www.pmiscout.eu/wp-content/uploads/2024/07/Logo_Pmi_Scout_favicon.jpg" alt="Logo PMIScout" className="h-8 w-auto" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x40/007BFF/FFFFFF?text=PMIScout'; }}/>
            </div>
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
                <nav className="flex-1 px-2 pb-4 space-y-1">
                {navLinks.map((link) => (
                    <Link key={link.text} href={link.href}><a className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group transition-colors ${ link.active ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' }`}><Icon path={link.icon} className={`w-6 h-6 mr-3 ${link.active ? 'text-white' : 'text-slate-500'}`} />{link.text}</a></Link>
                ))}
                </nav>
                <div className="px-2 py-4 border-t"><a href="mailto:antonio@pmiscout.eu" className="flex items-center px-2 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 group"><Icon path={icons.support} className="w-6 h-6 mr-3 text-slate-500" />Supporto</a></div>
            </div>
            </div>
        </aside>
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
            <main className="relative flex-1 overflow-y-auto focus:outline-none">
            <div className="py-8 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                <div className="pb-6 border-b border-slate-200">
                <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate flex items-center"><Icon path={icons.zap} className="w-8 h-8 mr-3 text-purple-600" />Check-UP AI HD (Beta)</h1>
                <p className="mt-2 text-base text-slate-600">Ciao, <span className="font-semibold">{user.name || user.email}</span>. Carica il bilancio per avviare la nuova analisi ad alta definizione.</p>
                </div>
                <div className="mt-8"><CheckupHdForm token={token} /></div>
            </div>
            </main>
        </div>
        </div>
    );
}


// --- NUOVO: Funzione di aiuto per l'estrazione dei dati dal PDF ---
// Questa è la funzione che contiene la logica "magica".
async function extractFinancialData(pdfFile) {
    // 1. Convertiamo il file in un formato che pdf.js può leggere (ArrayBuffer)
    const arrayBuffer = await pdfFile.arrayBuffer();

    // 2. Carichiamo il PDF
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';

    // 3. Estraiamo il testo da ogni pagina e lo uniamo in un'unica grande stringa
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ');
    }

    // 4. Definiamo cosa cercare. Per ogni voce, abbiamo:
    //    - key: il nome che useremo nel nostro oggetto dati
    //    - labels: un elenco di possibili testi da cercare nel PDF (in minuscolo)
    const searchTerms = [
        { key: 'valore_produzione', labels: ['valore della produzione', 'totale valore produzione', 'a) valore della produzione'] },
        { key: 'ricavi_vendite', labels: ['ricavi delle vendite e delle prestazioni', 'a.1) ricavi delle vendite'] },
        { key: 'costi_produzione', labels: ['costi della produzione', 'totale costi produzione', 'b) costi della produzione'] },
        { key: 'utile_esercizio', labels: ['utile (perdita) dell\'esercizio', 'risultato dell\'esercizio', 'utile dell\'esercizio'] },
        { key: 'patrimonio_netto', labels: ['patrimonio netto', 'totale patrimonio netto', 'a) patrimonio netto'] },
        { key: 'totale_attivo', labels: ['totale attivo', 'totale stato patrimoniale attivo'] },
        { key: 'disponibilita_liquide', labels: ['disponibilità liquide', 'iv - disponibilità liquide'] },
    ];

    const extracted = {};

    // 5. Cerchiamo ogni termine nel testo completo
    // Questa è una logica semplice, si può migliorare molto ma è un ottimo inizio.
    for (const term of searchTerms) {
        for (const label of term.labels) {
            const regex = new RegExp(`${label}\\s*([\\d.,-]+)`, 'i');
            const match = fullText.match(regex);
            if (match && match[1]) {
                extracted[term.key] = match[1].trim();
                break; // Trovato, passiamo al prossimo termine
            }
        }
    }
    
    console.log('Dati estratti:', extracted);
    return extracted;
}


// --- Componente del Form di Upload (CON LE MODIFICHE) ---
function CheckupHdForm({ token }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const fileInputRef = useRef(null);
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [extractedData, setExtractedData] = useState({});

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/pdf') { setError('Il file deve essere in formato PDF.'); setPdfFile(null); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { setError('Il file PDF non deve superare i 10MB.'); setPdfFile(null); return; }
    setError(''); setPdfFile(selectedFile);
  };

  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files && e.dataTransfer.files[0]) { handleFileChange(e.dataTransfer.files[0]); } };

  // --- MODIFICATO: Ora handleSubmit avvia l'estrazione vera e propria! ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim() || !pdfFile) {
      setError('Nome azienda e file PDF sono obbligatori.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // Chiamiamo la nostra nuova funzione per estrarre i dati
      const data = await extractFinancialData(pdfFile);
      setExtractedData(data);
      setIsModalOpen(true);
    } catch (err) {
      console.error("Errore durante l'estrazione del PDF:", err);
      setError("Non è stato possibile leggere il file PDF. Assicurati che non sia protetto o corrotto.");
    } finally {
      // In ogni caso, smettiamo di caricare quando abbiamo finito
      setLoading(false);
    }
  };

  // --- Funzione che verrà chiamata quando si conferma dal popup (INVARIATA PER ORA) ---
  const handleConfirmFromModal = (finalData) => {
    console.log("Dati finali confermati dall'utente:", finalData);
    setIsModalOpen(false);
    alert("Dati confermati! Ora dovremmo inviarli al backend. Controlla la console del browser.");
    // La logica di invio al backend andrà qui nel prossimo passo
  };

  return (
    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={extractedData}
        onConfirm={handleConfirmFromModal}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ... il resto del form rimane identico ... */}
        {error && (<div className="flex items-start p-4 text-sm text-red-700 bg-red-50 rounded-lg"><Icon path={icons.alert} className="w-5 h-5 mr-3 flex-shrink-0" /><div>{error}</div></div>)}
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">Nome Azienda *</label>
          <input id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition" placeholder="Es. Mario Rossi S.r.l." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Bilancio PDF (max 10MB) *</label>
          <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:border-purple-500 hover:bg-slate-50 transition-colors" onClick={() => fileInputRef.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            <div className="text-center">
              <Icon path={icons.upload} className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-purple-600">Carica un file</span> o trascinalo qui</p>
              <p className="text-xs text-slate-500">Formato PDF, dimensione massima 10MB</p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => handleFileChange(e.target.files[0])} className="hidden" required={!pdfFile} />
          {pdfFile && (<div className="mt-3 flex items-center justify-between text-sm bg-green-50 p-3 rounded-lg text-green-800 border border-green-200"><div className="flex items-center"><svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="font-medium">{pdfFile.name}</span></div><button type="button" onClick={() => setPdfFile(null)} className="text-green-900 hover:text-green-700 font-bold" aria-label="Rimuovi file">&times;</button></div>)}
        </div>
        <div className="flex items-center text-xs text-slate-500"><Icon path={icons.lock} className="w-4 h-4 mr-2 flex-shrink-0" /><span>I tuoi dati sono crittografati e usati solo per questa analisi.</span></div>
        <button type="submit" disabled={loading} className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-300">
          {loading ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Elaborazione PDF...</>) : ( 'Avvia Check-UP AI HD' )}
        </button>
      </form>
    </div>
  );
}
