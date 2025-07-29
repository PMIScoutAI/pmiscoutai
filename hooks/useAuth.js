// hooks/useAuth.js
import { useState, useEffect } from 'react';

export const useAuth = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 50; // 5 secondi massimo (50 x 100ms)
        
        const checkAuthentication = () => {
            attempts++;
            console.log(`🔍 Tentativo autenticazione ${attempts}/${maxAttempts}`);
            
            // SAFETY: Evita loop infinito se Outseta non si carica
            if (attempts > maxAttempts) {
                console.error('❌ TIMEOUT: Outseta non disponibile dopo 5 secondi');
                console.log('🔄 Procedo senza autenticazione per ora');
                setIsAuthenticated(true); // Temporaneamente bypassa
                setUser({ Email: 'demo@pmiscout.com', FirstName: 'Demo' });
                setIsLoading(false);
                return;
            }
            
            // Controlla se Outseta è disponibile
            if (typeof window !== 'undefined' && window.Outseta?.getUser) {
                console.log('✅ Outseta trovato! Verifico autenticazione...');
                
                window.Outseta.getUser()
                    .then(userData => {
                        console.log('📊 Dati utente ricevuti:', userData);
                        
                        if (userData && userData.Email) {
                            console.log('✅ Utente autenticato:', userData.Email);
                            setIsAuthenticated(true);
                            setUser(userData);
                        } else {
                            console.log('❌ Utente non autenticato');
                            setIsAuthenticated(false);
                            setUser(null);
                            // Per ora non fare redirect automatico
                            console.log('🔄 Redirect al login disabilitato per testing');
                            // window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
                        }
                    })
                    .catch((error) => {
                        console.error('❌ Errore durante getUser():', error);
                        setIsAuthenticated(false);
                        setUser(null);
                    })
                    .finally(() => {
                        console.log('🏁 Controllo autenticazione completato');
                        setIsLoading(false);
                    });
            } else {
                console.log('⏳ Outseta non ancora disponibile, riprovo tra 100ms...');
                setTimeout(checkAuthentication, 100);
            }
        };
        
        checkAuthentication();
    }, []);

    return { isAuthenticated, user, isLoading };
};
