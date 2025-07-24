// /pages/checkup.js
// Versione con import corretti

import { useState } from 'react';
import { useRouter } from 'next/router';
// --- MODIFICA QUI ---
// Abbiamo separato le importazioni: 'api' dal suo file e 'ProtectedPage' dal suo.
import { api } from '../utils/api';
import { ProtectedPage } from '../utils/ProtectedPage';
// --- FINE MODIFICA ---

export default function CheckupPage() {
  return (
    <ProtectedPage>
      {(user) => <CheckupForm user={user} />}
    </ProtectedPage>
  );
}

function CheckupForm({ user }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Dati del form
  const [formData, setFormData] = useState({
    company_name: '',
    industry_sector: '',
    company_size: '',
    main_challenges: '',
    business_goals: ''
  });
  const [file, setFile] = useState(null);

  // Gestione submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      alert('Carica un documento');
      return;
    }

    setLoading(true);
    
    try {
      // La chiamata API ora usa la funzione corretta che gestisce FormData
      const result = await api.processCheckup(user.id, formData, file);
      
      // Redirect ai risultati
      router.push(`/analisi/${result.sessionId}`);
      
    } catch (error) {
      alert('Errore: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">
          Check-UP AI per {user.name}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          {step === 1 ? (
            // Step 1: Dati azienda
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Dati Azienda</h2>
              
              <input
                type="text"
                placeholder="Nome Azienda *"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                className="w-full p-3 border rounded-lg"
              />

              <select
                required
                value={formData.industry_sector}
                onChange={(e) => setFormData({...formData, industry_sector: e.target.value})}
                className="w-full p-3 border rounded-lg"
              >
                <option value="">Seleziona Settore *</option>
                <option value="Commercio">Commercio</option>
                <option value="Servizi">Servizi</option>
                <option value="Manifatturiero">Manifatturiero</option>
                <option value="Tech">Tecnologia</option>
              </select>

              <select
                required
                value={formData.company_size}
                onChange={(e) => setFormData({...formData, company_size: e.target.value})}
                className="w-full p-3 border rounded-lg"
              >
                <option value="">Dimensione Azienda *</option>
                <option value="micro">Micro (1-9)</option>
                <option value="piccola">Piccola (10-49)</option>
                <option value="media">Media (50-249)</option>
              </select>

              <textarea
                placeholder="Principali sfide (opzionale)"
                value={formData.main_challenges}
                onChange={(e) => setFormData({...formData, main_challenges: e.target.value})}
                className="w-full p-3 border rounded-lg"
                rows="3"
              />

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"
              >
                Avanti →
              </button>
            </div>
          ) : (
            // Step 2: Upload file
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Carica Bilancio</h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="mb-4"
                />
                {file && (
                  <p className="text-green-600 font-medium">
                    ✓ {file.name} caricato
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-300 text-gray-700 p-3 rounded-lg"
                >
                  ← Indietro
                </button>
                
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Elaborazione...' : '🚀 Avvia Analisi'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
