// hooks/useAuth.js
import { useState, useEffect } from 'react';

/**
 * Custom Hook per gestire lo stato di autenticazione con Outseta.
 * Centralizza la logica per renderla riutilizzabile e pulita in tutta l'applicazione.
 */
export const useAuth = () => {
    // Stato per sapere se l'utente è autenticato (null = controllo in corso)
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    // Stato per memorizzare i dati dell'utente una volta autenticato
    const [user, setUser] = useState(null);
    // Stato per mostrare un caricamento mentre si verifica l'autenticazione
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuthentication = () => {
            // Controlla che lo script di Outseta sia stato caricato e la funzione getUser sia disponibile
            if (typeof window !== 'undefined' && window.Outseta?.getUser) {
                window.Outseta.getUser()
                    .then(userData => {
                        // Se Outseta restituisce un utente con un'email, l'autenticazione è valida
                        if (userData && userData.Email) {
                            setIsAuthenticated(true);
                            setUser(userData);
                        } else {
                            // Altrimenti, l'utente non è autenticato
                            setIsAuthenticated(false);
                            setUser(null);
                            // Reindirizza l'utente alla pagina di login di Outseta
                            window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
                        }
                    })
                    .catch(() => {
                        // In caso di qualsiasi errore, consideriamo l'utente non autenticato
                        setIsAuthenticated(false);
                        setUser(null);
                    })
                    .finally(() => {
                        // In ogni caso (successo o errore), il processo di verifica è terminato
                        setIsLoading(false);
                    });
            } else {
                // Se lo script di Outseta non è ancora pronto, attende 100ms e riprova
                setTimeout(checkAuthentication, 100);
            }
        };

        checkAuthentication();
    }, []); // L'array di dipendenze vuoto [] assicura che questo controllo venga eseguito solo una volta, al caricamento del componente.

    // L'hook restituisce lo stato attuale, che può essere usato da qualsiasi componente
    return { isAuthenticated, user, isLoading };
};
