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
          scheduleNextStep(); // Pianifica il prossimo step
        }, step.duration);
        timeouts.push(timeout);
      }
    };

    // Avvio iniziale con un piccolo ritardo per la percezione dell'utente
    const initialTimeout = setTimeout(() => {
        setProgress(5);
        setMessage('Inizializzazione del motore di analisi...');
        scheduleNextStep();
    }, 500);
    timeouts.push(initialTimeout);


    // Funzione di cleanup: se il componente viene "smontato" (perché i dati sono pronti),
    // tutti i timer futuri vengono cancellati per evitare aggiornamenti di stato non necessari.
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []); // L'array vuoto assicura che l'effetto parta solo una volta

  return (
    <div className="flex flex-col items-center justify-center h-full p-10 bg-white rounded-xl shadow-lg border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Analisi in Corso</h2>
      <p className="text-slate-600 mb-8 text-center max-w-md h-10">{message}</p>
      
      <div className="w-full max-w-lg bg-slate-200 rounded-full h-4 overflow-hidden">
        <div 
          className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-linear" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <div className="mt-4 text-xl font-bold text-blue-600">{progress}%</div>
      
      <div className="mt-12 text-sm text-slate-500 text-center">
        <p>Questo processo può richiedere fino a 60 secondi.</p>
        <p>La pagina si aggiornerà automaticamente al completamento.</p>
      </div>
    </div>
  );
};

export default AnalysisProgress;

