// hooks/useAuth.js
import { useState } from 'react';

export const useAuth = () => {
    console.log('🔍 useAuth: Hook chiamato - MODALITÀ DEBUG');
    
    // BYPASS COMPLETO PER TEST - RIMUOVI IN PRODUZIONE
    return {
        isAuthenticated: true,
        user: { Email: 'test@test.com', FirstName: 'Test' },
        isLoading: false
    };
};
