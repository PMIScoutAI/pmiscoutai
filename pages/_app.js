// /pages/_app.js
// File principale dell'applicazione - Modificato per usare il nuovo AuthProvider

import { AuthProvider } from '../contexts/AuthContext'; // Importa il nuovo gestore
import '../styles/globals.css';

// Il nome della funzione può essere 'App' o 'MyApp', non fa differenza.
export default function App({ Component, pageProps }) {
  return (
    // Avvolgiamo tutta l'app con l'AuthProvider.
    // In questo modo, ogni pagina avrà accesso allo stato di login in modo sicuro.
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
