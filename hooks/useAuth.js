// hooks/useAuth.js
import { useState, useEffect } from 'react';

/**
 * Custom Hook per gestire lo stato di autenticazione con Outseta.
 * Centralizza la logica per renderla riutilizzabile e pulita.
 */
export const useAuth = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuthentication = () => {
            // Controlla che Outseta e la funzione getUser siano disponibili
            if (typeof window !== 'undefined' && window.Outseta?.getUser) {
                window.Outseta.getUser()
                    .then(userData => {
                        if (userData && userData.Email) {
                            // Utente trovato e valido
                            setIsAuthenticated(true);
                            setUser(userData);
                        } else {
                            // Utente non trovato, reindirizza al login
                            setIsAuthenticated(false);
                            setUser(null);
                            window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
                        }
                    })
                    .catch(() => {
                        // In caso di errore, considera l'utente non autenticato
                        setIsAuthenticated(false);
                        setUser(null);
                    })
                    .finally(() => {
                        // In ogni caso, il caricamento è terminato
                        setIsLoading(false);
                    });
            } else {
                // Se Outseta non è ancora caricato, riprova tra poco
                setTimeout(checkAuthentication, 100);
            }
        };

        checkAuthentication();
    }, []); // L'array vuoto [] assicura che l'effetto venga eseguito solo una volta

    return { isAuthenticated, user, isLoading };
};
