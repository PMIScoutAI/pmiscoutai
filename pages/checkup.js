// --- Componente Principale del Form ---
function CheckupForm({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form data
  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [pdfFile, setPdfFile] = useState(null);

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

  return (
    <main className="flex justify-center items-center min-h-screen bg-slate-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900 text-center">Check-UP AI Azienda</h1>
        <p className="text-slate-600 text-center">
          Ciao, {user.name}. Compila i dati per iniziare l'analisi.
        </p>
        
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome Azienda - Obbligatorio */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nome Azienda *
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Es. Mario Rossi S.r.l."
              required
            />
          </div>

          {/* Partita IVA - Opzionale */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Partita IVA
            </label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Es. 12345678901"
            />
          </div>

          {/* Upload PDF */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bilancio PDF (max 5MB) *
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files[0])}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            {pdfFile && (
              <p className="text-sm text-green-600 mt-1">
                File selezionato: {pdfFile.name}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
          >
            {loading ? 'Avvio analisi in corso...' : 'Avvia Check-UP AI'}
          </button>
        </form>
      </div>
    </main>
  );
}
