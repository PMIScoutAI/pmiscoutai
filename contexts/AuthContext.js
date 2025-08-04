// /contexts/AuthContext.js
// Questo è il cuore del nuovo sistema di autenticazione.
// Gestisce lo stato di login per tutta l'applicazione.

import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [outsetaToken, setOutsetaToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Aspetta che Outseta sia pronto nel browser
      if (typeof window === 'undefined' || !window.Outseta) {
        setTimeout(initializeAuth, 100);
        return;
      }

      try {
        // 2. Prende il token di login da Outseta
        const token = window.Outseta.getAuthToken();
        if (!token) {
          // Se non c'è token, l'utente non è loggato con Outseta. Finito.
          setIsLoading(false);
          return;
        }
        setOutsetaToken(token);

        // 3. Chiama la nostra Edge Function su Supabase per ottenere il "Pass VIP" (JWT)
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-supabase-jwt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // 4. Usa il "Pass VIP" per fare il login sicuro in Supabase
        const { error: signInError } = await supabase.auth.signInWithJwt(data.custom_jwt);
        if (signInError) throw signInError;

        // 5. Recupera i dati dell'utente da Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
        }

      } catch (error) {
        console.error("Errore durante l'inizializzazione dell'autenticazione:", error);
        // In caso di errore, resetta tutto per sicurezza
        setUser(null);
        await supabase.auth.signOut();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Questa parte tiene sincronizzato lo stato di login
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    user,
    outsetaToken, // Lo passiamo per le API che ancora lo usano
    isLoading,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Questo è un "helper" per accedere facilmente ai dati di login da qualsiasi pagina
export const useAuth = () => {
  return useContext(AuthContext);
};
