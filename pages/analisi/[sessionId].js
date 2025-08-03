// CORREZIONI PRINCIPALI

// 1. Gestione migliorata del caricamento Recharts
const TrendChart = ({ data, dataKey, name, color }) => {
    const [isRechartsLoaded, setIsRechartsLoaded] = useState(false);
    
    useEffect(() => {
        const checkRecharts = () => {
            if (typeof window !== 'undefined' && window.Recharts) {
                setIsRechartsLoaded(true);
            } else {
                // Riprova ogni 100ms fino a quando Recharts non è disponibile
                setTimeout(checkRecharts, 100);
            }
        };
        
        checkRecharts();
    }, []);

    if (!isRechartsLoaded) {
        return (
            <div className="flex items-center justify-center h-64 text-sm text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
                Caricamento grafico...
            </div>
        );
    }

    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = window.Recharts;
    
    // Validazione dati più robusta
    if (!data || (data.previous_year == null && data.current_year == null)) {
        return (
            <div className="flex items-center justify-center h-64 text-sm text-slate-500">
                Nessun dato disponibile per il grafico
            </div>
        );
    }
    
    const chartData = [
        { name: 'Anno Prec.', [dataKey]: Number(data.previous_year) || 0 },
        { name: 'Anno Corr.', [dataKey]: Number(data.current_year) || 0 },
    ];

    // ... resto del componente
};

// 2. Correzione classi Tailwind dinamiche
const SwotSection = ({ swot }) => {
    const swotDetails = {
        strengths: { 
            label: 'Punti di Forza', 
            icon: icons.thumbsUp, 
            classes: 'border-green-500 text-green-600 bg-green-50'
        },
        weaknesses: { 
            label: 'Punti di Debolezza', 
            icon: icons.thumbsDown, 
            classes: 'border-red-500 text-red-600 bg-red-50'
        },
        opportunities: { 
            label: 'Opportunità', 
            icon: icons.target, 
            classes: 'border-blue-500 text-blue-600 bg-blue-50'
        },
        threats: { 
            label: 'Minacce', 
            icon: icons.alertTriangle, 
            classes: 'border-orange-500 text-orange-600 bg-orange-50'
        },
    };

    return (
        <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Analisi SWOT</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(swotDetails).map(key => {
                    const detail = swotDetails[key];
                    const items = swot[key] || [];
                    return (
                        <div key={key} className={`p-6 bg-white rounded-xl shadow-sm border-l-4 ${detail.classes}`}>
                            <div className="flex items-center text-lg font-bold">
                                <Icon path={detail.icon} className="w-6 h-6 mr-3" />
                                {detail.label}
                            </div>
                            <ul className="mt-4 space-y-2 list-disc list-inside text-slate-600 text-sm">
                                {items.length > 0 ? 
                                    items.map((item, idx) => <li key={idx}>{item}</li>) : 
                                    <li>Nessun dato disponibile.</li>
                                }
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

// 3. Gestione errori di rete migliorata
useEffect(() => {
    const fetchSessionData = async () => {
        if (!sessionId || !user) {
            return;
        }

        try {
            console.log('🔄 Caricamento dati completi...');
            
            // Timeout per la richiesta
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondi
            
            const response = await fetch(
                `/api/get-session-complete?sessionId=${sessionId}&userId=${user.id}`, 
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Errore HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            // Validazione dati
            if (!data || typeof data !== 'object') {
                throw new Error('Dati ricevuti non validi');
            }
            
            if (data.user_id !== user.id) {
                throw new Error('Non sei autorizzato a visualizzare questa analisi.');
            }
            
            setSessionData(data);
            
            if (data.analysisData) {
                setAnalysisData(data.analysisData);
                console.log('✅ Dati completi caricati');
            } else if (data.status === 'completed') {
                console.log('⚠️ Sessione completata ma nessun risultato');
            } else if (data.status === 'failed') {
                setError(data.error_message || 'Errore durante l\'analisi.');
            }

        } catch (err) {
            console.error('❌ Errore nel caricamento:', err);
            
            if (err.name === 'AbortError') {
                setError('Timeout: il caricamento sta richiedendo troppo tempo.');
            } else {
                setError(err.message || 'Errore di connessione');
            }
        } finally {
            setIsLoading(false);
        }
    };

    fetchSessionData();
}, [sessionId, user]);

// 4. Caricamento Recharts più affidabile nell'Head
<Head>
    <title>Report Analisi AI - PMIScout</title>
    {/* Altre meta tags */}
    <script src="https://cdn.tailwindcss.com"></script>
    <script 
        src="https://unpkg.com/recharts/umd/Recharts.min.js"
        onLoad="window.rechartsLoaded = true"
        onError="console.error('Errore caricamento Recharts')"
    ></script>
    <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
</Head>

// 5. Validazione dati migliorata per KeyMetricsAndChartsSection
const KeyMetricsAndChartsSection = ({ metrics, chartsData, isLoading }) => {
    const getChartConfig = () => {
        if (!chartsData || typeof chartsData !== 'object') return null;
        
        // Verifica revenue_trend
        if (chartsData.revenue_trend && 
            typeof chartsData.revenue_trend === 'object' &&
            (chartsData.revenue_trend.current_year != null || 
             chartsData.revenue_trend.previous_year != null)) {
            return {
                data: chartsData.revenue_trend,
                title: 'Andamento Fatturato (€)',
                dataKey: 'revenue',
                name: 'Fatturato',
                color: '#3b82f6'
            };
        }
        
        // Verifica total_assets_trend
        if (chartsData.total_assets_trend && 
            typeof chartsData.total_assets_trend === 'object' &&
            (chartsData.total_assets_trend.current_year != null || 
             chartsData.total_assets_trend.previous_year != null)) {
            return {
                data: chartsData.total_assets_trend,
                title: 'Andamento Totale Attività (€)',
                dataKey: 'total_assets',
                name: 'Totale Attività',
                color: '#8b5cf6'
            };
        }
        
        return null;
    };

    // ... resto del componente
};
