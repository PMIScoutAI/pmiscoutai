export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">Benvenuto su PMI Scout AI 🚀</h1>
      <p className="text-slate-700 mb-8">
        Questa è la homepage iniziale. Da qui potrai accedere ai tool per la crescita della tua azienda.
      </p>

      {/* Card Tool: Check-UP AI Azienda */}
      <div className="max-w-md p-6 bg-white border rounded-lg shadow-sm hover:shadow-lg transition">
        <div className="p-3 bg-blue-100 rounded-lg w-fit mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 8V4H8"></path>
            <rect x="4" y="12" width="16" height="8" rx="2"></rect>
            <path d="M2 12h2M20 12h2M12 18v2M12 14v-2"></path>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Check-UP AI Azienda</h2>
        <p className="mt-1 text-sm text-slate-600">
          Analisi approfondita della tua azienda tramite intelligenza artificiale.
        </p>
        <a
          href="/tool/checkup-ai"
          className="inline-block mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800"
        >
          Inizia analisi &rarr;
        </a>
      </div>
    </div>
  );
}
