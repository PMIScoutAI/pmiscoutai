// /pages/analisi/[sessionId].js

// --- Componente Pagina Analisi (VERSIONE CORRETTA) ---
function AnalisiReportPage({ user }) {
  const router = useRouter();
  const { sessionId } = router.query;
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    const fetchAndCheckStatus = async () => {
      if (!sessionId || !user) return;
      try {
        const response = await fetch(`/api/get-session-complete?sessionId=${sessionId}&userId=${user.id}`);
        if (!response.ok) throw new Error('Errore nel recupero dello stato dell\'analisi.');
        const data = await response.json();

        if (data.status === 'completed' || data.status === 'failed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          
          if (data.status === 'completed' && data.analysisData) {
            // La logica di parsing è corretta, la manteniamo.
            const parsedData = Object.keys(data.analysisData).reduce((acc, key) => {
              try {
                acc[key] = typeof data.analysisData[key] === 'string' ? JSON.parse(data.analysisData[key]) : data.analysisData[key];
              } catch (e) { acc[key] = data.analysisData[key]; }
              return acc;
            }, {});
            setAnalysisData(parsedData);
          } else if (data.status === 'failed') {
            setError(data.error_message || 'Si è verificato un errore durante l\'analisi.');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('❌ Errore durante il polling:', err);
        setError(err.message);
        setIsLoading(false);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      }
    };

    if (sessionId && user) {
      fetchAndCheckStatus();
      pollingIntervalRef.current = setInterval(fetchAndCheckStatus, 3000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [sessionId, user]);  

  // Funzione helper per formattare i punti della SWOT analysis
  const formatSwotPoints = (pointsArray) => {
      if (!pointsArray || pointsArray.length === 0) return "Nessuna informazione disponibile.";
      // Usiamo una lista puntata per una migliore leggibilità
      return (
          <ul className="list-disc pl-4 space-y-1">
              {pointsArray.map((item, index) => <li key={index}><strong>{item.point}:</strong> {item.explanation}</li>)}
          </ul>
      );
  };

  const renderContent = () => {
    if (isLoading) return <LoadingState text="Elaborazione del report in corso..." />;
    if (error) return <ErrorState message={error} />;
    if (!analysisData) return <ErrorState message="Nessun dato di analisi trovato." />;
    
    // NOTA: Per far funzionare companyName, assicurati che nel file `analyze-xbrl.js`
    // l'oggetto `resultToSave` includa `companyName` dentro `raw_parsed_data`.
    // Esempio: raw_parsed_data: { metrics, context, companyName }
    const companyName = analysisData.raw_parsed_data?.companyName || 'Azienda Analizzata';
    const swot = analysisData.detailed_swot || {};
    const recommendations = analysisData.recommendations || [];

    return (
      <div className="space-y-8">
        <ReportHeader 
            companyName={companyName} 
            summary={analysisData.summary}
        />
        
        <ComparisonSection chartsData={analysisData.charts_data} />

        {/* SEZIONE SWOT ANALYSIS - CORRETTA */}
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi Strategica SWOT</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnalysisCard title="Punti di Forza" text={formatSwotPoints(swot.strengths)} icon={icons.award} />
                <AnalysisCard title="Punti di Debolezza" text={formatSwotPoints(swot.weaknesses)} icon={icons.alertTriangle} />
                <AnalysisCard title="Opportunità" text={formatSwotPoints(swot.opportunities)} icon={icons.globe} />
                <AnalysisCard title="Minacce" text={formatSwotPoints(swot.threats)} icon={icons.shield} />
            </div>
        </section>
        
        {/* NUOVA SEZIONE RACCOMANDAZIONI */}
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Raccomandazioni dell'AI</h2>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                {recommendations.length > 0 ? (
                    <ul className="list-decimal pl-5 space-y-2 text-slate-700">
                        {recommendations.map((rec, index) => <li key={index} className="leading-relaxed">{rec}</li>)}
                    </ul>
                ) : (
                    <p className="text-slate-500">Nessuna raccomandazione specifica disponibile.</p>
                )}
            </div>
        </section>
        
        <div className="flex justify-center items-center space-x-4 mt-10">
            <button onClick={() => window.print()} className="flex items-center justify-center px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                <Icon path={icons.print} className="w-5 h-5 mr-2" />
                Stampa Report
            </button>
        </div>
      </div>
    );
  };

  return (
    <main className="relative flex-1 overflow-y-auto focus:outline-none">
      <div className="py-8 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </div>
    </main>
  );
}
