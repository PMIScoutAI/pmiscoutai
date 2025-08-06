// /components/ValidationModal.js

import React, { useState, useEffect } from 'react';

// Definiamo le icone direttamente qui per semplicità
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  check: <><path d="M20 6 9 17l-5-5" /></>,
  x: <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></>,
};

// Questo è il nostro componente per il popup.
// Riceve delle "istruzioni" dall'esterno (le chiamiamo "props")
// - isOpen: ci dice se il popup deve essere visibile (true/false)
// - onClose: è la funzione da chiamare quando l'utente vuole chiudere il popup
// - initialData: saranno i dati estratti dal PDF che mostreremo
// - onConfirm: è la funzione da chiamare quando l'utente clicca "Conferma"
export default function ValidationModal({ isOpen, onClose, initialData, onConfirm }) {
  
  // Usiamo uno stato interno per gestire i dati del form.
  // Inizialmente, lo popoliamo con i dati estratti dal PDF (initialData).
  const [formData, setFormData] = useState(initialData || {});

  // Questo useEffect si assicura che se i dati iniziali cambiano,
  // il form si aggiorni. Utile per quando l'estrazione finisce.
  useEffect(() => {
    setFormData(initialData || {});
  }, [initialData]);

  // Funzione per aggiornare i dati quando l'utente scrive in un campo
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Funzione per quando il form viene confermato
  const handleSubmit = (e) => {
    e.preventDefault(); // Evita che la pagina si ricarichi
    onConfirm(formData); // Chiama la funzione passata dall'esterno con i dati aggiornati
  };

  // Se "isOpen" è false, non mostriamo nulla.
  if (!isOpen) {
    return null;
  }

  // Se "isOpen" è true, mostriamo il popup.
  // Usiamo Tailwind CSS per lo stile, come nel resto della tua app.
  return (
    // Questo è lo sfondo scuro semi-trasparente
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      
      {/* Questo è il contenitore bianco del popup */}
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-2xl transform transition-all">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Verifica i Dati Estratti</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <Icon path={icons.x} />
          </button>
        </div>
        <p className="text-slate-600 mb-6">
          Controlla i valori che abbiamo estratto dal PDF. Se noti un errore, correggilo manualmente prima di continuare.
        </p>

        {/* Questo è il form vero e proprio */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            
            {/* Elenco dei campi da validare */}
            {/* Nota: 'name' corrisponde alla chiave che useremo per i dati */}
            <InputField label="Totale valore della produzione (A)" name="valore_produzione" value={formData.valore_produzione || ''} onChange={handleChange} />
            <InputField label="Ricavi delle vendite (A1)" name="ricavi_vendite" value={formData.ricavi_vendite || ''} onChange={handleChange} />
            <InputField label="Totale costi della produzione (B)" name="costi_produzione" value={formData.costi_produzione || ''} onChange={handleChange} />
            <InputField label="Utile/Perdita d'esercizio" name="utile_esercizio" value={formData.utile_esercizio || ''} onChange={handleChange} />
            <InputField label="Patrimonio netto" name="patrimonio_netto" value={formData.patrimonio_netto || ''} onChange={handleChange} />
            <InputField label="Totale attivo" name="totale_attivo" value={formData.totale_attivo || ''} onChange={handleChange} />
            <InputField label="Disponibilità liquide" name="disponibilita_liquide" value={formData.disponibilita_liquide || ''} onChange={handleChange} />
            {/* Aggiungi qui altri campi se necessario */}

          </div>

          <div className="mt-8 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Annulla
            </button>
            <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center">
              <Icon path={icons.check} className="w-5 h-5 mr-2" />
              Conferma Dati e Avvia Analisi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Un piccolo componente di aiuto per non ripetere il codice degli input
function InputField({ label, name, value, onChange }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
        placeholder="Nessun dato estratto"
      />
    </div>
  );
}
