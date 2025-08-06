// /components/ValidationModal.js
// VERSIONE AGGIORNATA con tutti i nuovi campi di input.

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
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-4xl transform transition-all max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Verifica i Dati Estratti</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <Icon path={icons.x} />
          </button>
        </div>
        <p className="text-slate-600 mb-6">
          Controlla i valori estratti. Se noti un errore o un campo vuoto, correggilo manualmente prima di continuare.
        </p>

        <form onSubmit={handleSubmit}>
          {/* --- SEZIONE CONTO ECONOMICO --- */}
          <h3 className="text-lg font-semibold text-slate-700 mt-6 mb-4 border-b pb-2">Conto Economico</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <InputField label="Valore della produzione (A)" name="valore_produzione" value={formData.valore_produzione || ''} onChange={handleChange} />
            <InputField label="Ricavi delle vendite (A.1)" name="ricavi_vendite" value={formData.ricavi_vendite || ''} onChange={handleChange} />
            <InputField label="Costi della produzione (B)" name="costi_produzione" value={formData.costi_produzione || ''} onChange={handleChange} />
            <InputField label="Costi per materie prime" name="costi_materie_prime" value={formData.costi_materie_prime || ''} onChange={handleChange} />
            <InputField label="Costi per servizi" name="costi_servizi" value={formData.costi_servizi || ''} onChange={handleChange} />
            <InputField label="Costi per il personale" name="costi_personale" value={formData.costi_personale || ''} onChange={handleChange} />
            <InputField label="Ammortamenti e svalutazioni" name="ammortamenti" value={formData.ammortamenti || ''} onChange={handleChange} />
            <InputField label="Risultato prima delle imposte" name="risultato_ante_imposte" value={formData.risultato_ante_imposte || ''} onChange={handleChange} />
            <InputField label="Imposte sul reddito" name="imposte_esercizio" value={formData.imposte_esercizio || ''} onChange={handleChange} />
            <InputField label="Utile/Perdita d'esercizio" name="utile_esercizio" value={formData.utile_esercizio || ''} onChange={handleChange} />
          </div>

          {/* --- SEZIONE STATO PATRIMONIALE --- */}
          <h3 className="text-lg font-semibold text-slate-700 mt-8 mb-4 border-b pb-2">Stato Patrimoniale</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <InputField label="Totale Attivo" name="totale_attivo" value={formData.totale_attivo || ''} onChange={handleChange} />
            <InputField label="Totale Immobilizzazioni" name="totale_immobilizzazioni" value={formData.totale_immobilizzazioni || ''} onChange={handleChange} />
            <InputField label="Totale Attivo Circolante" name="totale_attivo_circolante" value={formData.totale_attivo_circolante || ''} onChange={handleChange} />
            <InputField label="Crediti verso Clienti" name="crediti_clienti" value={formData.crediti_clienti || ''} onChange={handleChange} />
            <InputField label="Disponibilità Liquide" name="disponibilita_liquide" value={formData.disponibilita_liquide || ''} onChange={handleChange} />
            <InputField label="Patrimonio Netto" name="patrimonio_netto" value={formData.patrimonio_netto || ''} onChange={handleChange} />
            <InputField label="Totale Debiti" name="debiti" value={formData.debiti || ''} onChange={handleChange} />
            <InputField label="Debiti verso Fornitori" name="debiti_fornitori" value={formData.debiti_fornitori || ''} onChange={handleChange} />
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
