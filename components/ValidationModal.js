// /components/ValidationModal.js
// VERSIONE SEMPLIFICATA: Mostra solo i 6 campi chiave per la validazione.

import React, { useState, useEffect } from 'react';

// Definiamo le icone direttamente qui per semplicità
const Icon = ({ path, className = 'w-6 h-6' }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg> );
const icons = {
  check: <><path d="M20 6 9 17l-5-5" /></>,
  x: <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></>,
};

export default function ValidationModal({ isOpen, onClose, initialData, onConfirm }) {
  const [formData, setFormData] = useState(initialData || {});

  useEffect(() => {
    setFormData(initialData || {});
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(formData);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-3xl transform transition-all max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Verifica i Dati Chiave</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <Icon path={icons.x} />
          </button>
        </div>
        <p className="text-slate-600 mb-6">
          Controlla i 6 valori più importanti estratti dall'IA. Correggi eventuali errori prima di continuare.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* --- ANNO CORRENTE --- */}
            <div className="space-y-4">
               <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Anno Corrente</h3>
               <InputField label="Fatturato (Valore Produzione)" name="fatturato_anno_corrente" value={formData.fatturato_anno_corrente || ''} onChange={handleChange} />
               <InputField label="Utile d'Esercizio" name="utile_esercizio_anno_corrente" value={formData.utile_esercizio_anno_corrente || ''} onChange={handleChange} />
               <InputField label="Patrimonio Netto" name="patrimonio_netto_anno_corrente" value={formData.patrimonio_netto_anno_corrente || ''} onChange={handleChange} />
            </div>

            {/* --- ANNO PRECEDENTE --- */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Anno Precedente</h3>
                <InputField label="Fatturato (Valore Produzione)" name="fatturato_anno_precedente" value={formData.fatturato_anno_precedente || ''} onChange={handleChange} />
                <InputField label="Utile d'Esercizio" name="utile_esercizio_anno_precedente" value={formData.utile_esercizio_anno_precedente || ''} onChange={handleChange} />
                <InputField label="Patrimonio Netto" name="patrimonio_netto_anno_precedente" value={formData.patrimonio_netto_anno_precedente || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Annulla
            </button>
            <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center">
              <Icon path={icons.check} className="w-5 h-5 mr-2" />
              Conferma e Avvia Analisi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Componente di aiuto per gli input (invariato)
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
        placeholder="N/D"
      />
    </div>
  );
}
