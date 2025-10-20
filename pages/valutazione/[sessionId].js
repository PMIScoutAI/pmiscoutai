// FILE 3: Accordion per pages/valutazione/[sessionId].js
// AGGIUNGI questo codice nel componente ResultsStep, PRIMA del button "Modifica Dati"
// Posiziona DOPO l'ultimo accordion esistente

{/* ✅ NUOVO ACCORDION 4: ANALISI EBITDA % */}
<div className="bg-white rounded-lg shadow-md overflow-hidden">
  <button
    onClick={() => toggleSection('ebitda_margin')}
    className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
  >
    <span className="text-lg font-semibold text-slate-900">📊 Analisi EBITDA %</span>
    <svg 
      className={`w-6 h-6 transform transition-transform ${expandedSection === 'ebitda_margin' ? 'rotate-180' : ''}`} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>
  
  {expandedSection === 'ebitda_margin' && (
    <div className="px-6 pb-6 border-t border-slate-200">
      <div className="mt-4 space-y-4">
        
        {/* EBITDA Margin Attuale */}
        {results.calculation_details.ebitda_margin_informativo?.ebitda_margin_current_pct !== null && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-3">💰 EBITDA Margin Anno {sessionData.years_analyzed?.[1] || 'N'}</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Vostro EBITDA %:</span>
                <span className="text-2xl font-bold text-blue-700">
                  {results.calculation_details.ebitda_margin_informativo.ebitda_margin_current_pct.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Media settore:</span>
                <span className="text-lg font-semibold text-slate-600">
                  {results.calculation_details.ebitda_margin_informativo.ebitda_margin_benchmark_pct.toFixed(1)}%
                </span>
              </div>
              
              <div className="bg-white p-3 rounded flex justify-between items-center">
                <span className="text-slate-700">Delta vs benchmark:</span>
                <span className={`text-lg font-bold ${
                  results.calculation_details.ebitda_margin_informativo.ebitda_margin_delta_vs_benchmark > 0 
                    ? 'text-green-700' 
                    : 'text-red-700'
                }`}>
                  {results.calculation_details.ebitda_margin_informativo.ebitda_margin_delta_vs_benchmark > 0 ? '+' : ''}
                  {results.calculation_details.ebitda_margin_informativo.ebitda_margin_delta_vs_benchmark.toFixed(1)} pp
                </span>
              </div>
            </div>
          </div>
        )}

        {/* EBITDA Margin Trend */}
        {results.calculation_details.ebitda_margin_informativo?.ebitda_margin_previous_pct !== null && (
          <div className="p-4 bg-orange-50 rounded-lg">
            <h4 className="font-semibold text-orange-900 mb-3">📈 Trend EBITDA %</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Anno N-1:</span>
                <span className="font-semibold text-slate-600">
                  {results.calculation_details.ebitda_margin_informativo.ebitda_margin_previous_pct.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-700">Anno N:</span>
                <span className="font-semibold text-slate-600">
                  {results.calculation_details.ebitda_margin_informativo.ebitda_margin_current_pct.toFixed(1)}%
                </span>
              </div>
              
              <div className="bg-white p-3 rounded flex justify-between items-center">
                <span className="text-slate-700">Variazione:</span>
                <span className={`text-lg font-bold ${
                  results.calculation_details.ebitda_margin_informativo.ebitda_margin_trend > 0 
                    ? 'text-green-700' 
                    : results.calculation_details.ebitda_margin_informativo.ebitda_margin_trend < 0
                    ? 'text-red-700'
                    : 'text-slate-700'
                }`}>
                  {results.calculation_details.ebitda_margin_informativo.ebitda_margin_trend > 0 ? '↗️ +' : results.calculation_details.ebitda_margin_informativo.ebitda_margin_trend < 0 ? '↘️ ' : '→ '}
                  {results.calculation_details.ebitda_margin_informativo.ebitda_margin_trend.toFixed(1)} pp
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Assessment Qualitativo */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h4 className="font-semibold text-slate-900 mb-3">💡 Interpretazione</h4>
          
          {results.calculation_details.ebitda_margin_informativo?.ebitda_margin_assessment === 'excellent' && (
            <div className="text-sm text-green-800 space-y-2">
              <p className="font-semibold">✅ Efficienza ECCELLENTE</p>
              <p>La vostra azienda ha un EBITDA % significativamente superiore alla media del settore. Indicate un'operatività molto efficiente e una buona gestione dei costi.</p>
            </div>
          )}
          
          {results.calculation_details.ebitda_margin_informativo?.ebitda_margin_assessment === 'good' && (
            <div className="text-sm text-green-800 space-y-2">
              <p className="font-semibold">✅ Efficienza BUONA</p>
              <p>La vostra azienda ha un EBITDA % leggermente superiore alla media del settore. Gestite bene i costi e l'operatività è sana.</p>
            </div>
          )}
          
          {results.calculation_details.ebitda_margin_informativo?.ebitda_margin_assessment === 'average' && (
            <div className="text-sm text-blue-800 space-y-2">
              <p className="font-semibold">➖ Efficienza MEDIA</p>
              <p>La vostra azienda è allineata alla media del settore. L'operatività è nella norma rispetto ai competitors.</p>
            </div>
          )}
          
          {results.calculation_details.ebitda_margin_informativo?.ebitda_margin_assessment === 'poor' && (
            <div className="text-sm text-orange-800 space-y-2">
              <p className="font-semibold">⚠️ Efficienza RIDOTTA</p>
              <p>La vostra azienda ha un EBITDA % inferiore alla media del settore. Potrebbero esserci margini di miglioramento nella gestione dei costi operativi.</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h4 className="font-semibold text-yellow-900 mb-2">📝 Cosa Significa?</h4>
          <p className="text-sm text-yellow-800 mb-2">
            <strong>EBITDA %</strong> = (EBITDA / Ricavi) × 100
          </p>
          <p className="text-sm text-yellow-800">
            Misura quale percentuale dei vostri ricavi rimane come margine operativo lordo. Un EBITDA % elevato indica che l'azienda produce molto valore operativo da ogni euro di ricavo.
          </p>
        </div>

      </div>
    </div>
  )}
</div>

{/* FINE NUOVO ACCORDION - Il button "Modifica Dati" rimane sotto */}
