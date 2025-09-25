import { useState, useEffect } from 'react';

// Definiamo le fasi simulate e la loro durata stimata in millisecondi
const analysisSteps = [
  { progress: 15, message: 'Validazione del file XBRL in corso...', duration: 3000 },
  { progress: 40, message: 'Estrazione dei dati strutturati dal bilancio...', duration: 8000 },
  { progress: 60, message: 'Calcolo degli indicatori finanziari chiave (ROE, ROI...)...', duration: 6000 },
  { progress: 90, message: 'Analisi strategica e SWOT tramite Intelligenza Artificiale...', duration: 15000 },
  // L'ultima fase è più lunga per dare tempo al backend di completare l'analisi
  { progress: 95, message: 'Quasi pronto, finalizzazione e salvataggio del report...', duration: 20000 } 
];

const AnalysisProgress = () => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Avvio del processo di analisi...');

  useEffect(() => {
    let currentStepIndex = 0;
    const timeouts = [];

    const scheduleNextStep = () => {
      if (currentStepIndex < analysisSteps.length) {
        const step = analysisSteps[currentStepIndex];
        const timeout = setTimeout(() => {
          setProgress(step.progress);
          setMessage(step.message);
          currentStepIndex++;
          scheduleNextStep();
        }, step.duration);
        timeouts.push(timeout);
      }
    };
    
    const initialTimeout = setTimeout(() => {
        setProgress(5);
        setMessage('Inizializzazione del motore di analisi...');
        scheduleNextStep();
    }, 500);
    timeouts.push(initialTimeout);

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      {/* Aggiungiamo stili e animazioni direttamente qui per mantenere il componente autonomo */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.6);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 25px rgba(139, 92, 246, 1);
            transform: scale(1.05);
          }
        }
        
        /* NUOVA ANIMAZIONE per il movimento */
        @keyframes patrol {
          0%, 100% {
            transform: translateX(-8px);
          }
          50% {
            transform: translateX(8px);
          }
        }

        .animate-patrol-pulse {
          /* Combiniamo le due animazioni */
          animation: pulse-glow 2.5s infinite ease-in-out, patrol 3s infinite ease-in-out;
        }
      `}</style>
      <div className="flex flex-col items-center justify-center h-full p-10 bg-white rounded-xl shadow-lg border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Analisi in Corso</h2>
        <p className="text-slate-600 mb-8 text-center max-w-md h-10">{message}</p>
        
        <div className="w-full max-w-lg relative pt-4 pb-8">
            {/* Contenitore della barra di progresso */}
            <div className="relative w-full bg-slate-200 rounded-full h-2.5">
                <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-linear" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            {/* Orbita animata */}
            <div 
                className="absolute top-1/2 -mt-1" // Rimuoviamo la traslazione verticale da qui
                style={{ 
                    left: `calc(${progress}% - 10px)`, // Centra l'orbita sulla fine della barra
                    transition: 'left 0.5s ease-out' 
                }}
            >
                <div 
                    className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white animate-patrol-pulse"
                ></div>
            </div>
        </div>
        
        <div className="text-xl font-bold text-blue-600">{progress}%</div>
        
        <div className="mt-12 text-sm text-slate-500 text-center">
            <p>Questo processo può richiedere fino a 60 secondi.</p>
            <p>La pagina si aggiornerà automaticamente al completamento.</p>
        </div>
      </div>
    </>
  );
};

export default AnalysisProgress;

