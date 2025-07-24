// utils/api.js - Utility semplificata per chiamare l'unica Edge Function

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Funzione generica per chiamare l'API
export async function callAPI(action, data = {}) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        action: action,
        ...data
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nella chiamata API');
    }

    return response.json();
  } catch (error) {
    console.error(`Errore API [${action}]:`, error);
    throw error;
  }
}

// Funzioni specifiche per ogni operazione
export const api = {
  // Sincronizza utente con Outseta
  syncUser: async (outsetaUser) => {
    return callAPI('sync-user', { outsetaUser });
  },

  // Processa nuovo checkup
  processCheckup: async (userId, formData, file) => {
    // Converti file in base64
    const fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });

    return callAPI('process-checkup', {
      userId,
      formData,
      fileName: file.name,
      fileBase64
    });
  },

  // Recupera risultati analisi
  getAnalysis: async (sessionId) => {
    return callAPI('get-analysis', { sessionId });
  }
};

// Hook React per gestione utente
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function initUser() {
      try {
        // Attendi che Outseta sia caricato
        let attempts = 0;
        while (!window.Outseta && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.Outseta) {
          throw new Error('Outseta non caricato');
        }

        // Ottieni utente da Outseta
        const outsetaUser = await window.Outseta.getUser();
        
        if (!outsetaUser || !outsetaUser.Email) {
          // Non loggato - redirect al login
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
          return;
        }

        // Sincronizza con il nostro backend
        const result = await api.syncUser(outsetaUser);
        
        if (mounted) {
          setUser({
            id: result.userId,
            email: result.email,
            name: result.name,
            outseta: outsetaUser
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Errore inizializzazione utente:', err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    initUser();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading, error };
}

// Componente wrapper per proteggere le pagine
export function ProtectedPage({ children, loadingComponent }) {
  const { user, loading, error } = useUser();

  if (loading) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p>Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p>Errore: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Ricarica
          </button>
        </div>
      </div>
    );
  }

  // Se non c'è utente, verrà fatto redirect automaticamente
  if (!user) return null;

  // Passa l'utente come prop ai children
  return typeof children === 'function' ? children(user) : children;
}
