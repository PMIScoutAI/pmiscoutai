// pages/checkup.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase, syncSupabaseAuth } from '../utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export default function CheckupPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [sessionId] = useState(uuidv4());
  const [formData, setFormData] = useState({
    company_name: '',
    vat_number: '',
    industry_sector: '',
    ateco_code: '',
    company_size: '',
    employee_count: '',
    location_city: '',
    location_region: '',
    website_url: '',
    description: '',
    revenue_range: '',
    main_challenges: '',
    business_goals: ''
  });

  // Verifica autenticazione con Outseta e sincronizza con Supabase
  const checkAuthentication = async () => {
    if (typeof window !== 'undefined' && window.Outseta) {
      try {
        const user = await window.Outseta.getUser();
        if (user && user.Email) {
          setIsAuthenticated(true);
          setUserName(user.FirstName || user.Email.split('@')[0]);
          setUserId(user.Uid || user.Email);
          
          // Sincronizza con Supabase
          await syncSupabaseAuth();
          
          setIsLoading(false);
        } else {
          setIsAuthenticated(false);
          setIsLoading(false);
          window.location.href = 'https://pmiscout.outseta.com/auth?widgetMode=login&returnUrl=' + encodeURIComponent(window.location.href);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    } else {
      setTimeout(checkAuthentication, 500);
    }
  };

  useEffect(() => {
    const waitForOutseta = () => {
      if (typeof window !== 'undefined' && window.Outseta) {
        checkAuthentication();
      } else {
        setTimeout(waitForOutseta, 100);
      }
    };
    waitForOutseta();
  }, []);

  // Upload file a Supabase Storage
  const uploadToSupabase = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${sessionId}/${uuidv4()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('balance-sheets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Ottieni URL pubblico
      const { data: { publicUrl } } = supabase.storage
        .from('balance-sheets')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Salva i dati dell'analisi in Supabase
  const saveAnalysisToSupabase = async (balanceSheetUrl) => {
    try {
      const { data, error } = await supabase
        .from('checkup_analyses')
        .insert({
          user_id: userId,
          session_id: sessionId,
          company_data: formData,
          balance_sheet_url: balanceSheetUrl,
          analysis_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  };

  // Chiama la Edge Function per l'analisi
  const callAnalysisFunction = async (analysisId, balanceSheetUrl) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-balance-sheet', {
        body: {
          sessionId,
          companyData: formData,
          balanceSheetUrl,
          analysisId
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Function error:', error);
      throw error;
    }
  };

  // Monitora lo stato dell'analisi
  const pollAnalysisStatus = async (analysisId) => {
    const maxAttempts = 30;
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('checkup_analyses')
          .select('*')
          .eq('id', analysisId)
          .single();

        if (error) throw error;

        if (data.analysis_status === 'completed') {
          return data;
        } else if (data.analysis_status === 'failed') {
          throw new Error('Analisi fallita');
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return checkStatus();
        } else {
          throw new Error('Timeout analisi');
        }
      } catch (error) {
        console.error('Status check error:', error);
        throw error;
      }
    };

    return checkStatus();
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
    } else {
      alert('Per favore carica un file PDF del bilancio');
    }
  };

  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
    } else {
      alert('Per favore carica un file PDF del bilancio');
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Continue to next step
  const handleContinue = () => {
    if (currentStep === 1) {
      if (!formData.company_name || !formData.industry_sector || !formData.company_size) {
        alert('Per favore compila tutti i campi obbligatori');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!uploadedFile) {
        alert('Per favore carica il bilancio prima di continuare');
        return;
      }
      setCurrentStep(3);
      startAnalysis();
    }
  };

  // Start AI Analysis
  const startAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      // 1. Upload del file
      const balanceSheetUrl = await uploadToSupabase(uploadedFile);
      
      // 2. Salva i dati iniziali
      const analysisRecord = await saveAnalysisToSupabase(balanceSheetUrl);
      
      // 3. Avvia l'analisi
      await callAnalysisFunction(analysisRecord.id, balanceSheetUrl);
      
      // 4. Monitora lo stato
      const completedAnalysis = await pollAnalysisStatus(analysisRecord.id);
      
      // 5. Mostra i risultati
      setAnalysisResult({
        summary: "Analisi completata con successo",
        swot: completedAnalysis.swot_analysis,
        financial: completedAnalysis.financial_analysis,
        recommendations: completedAnalysis.recommendations
      });
      
      setIsAnalyzing(false);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Errore durante l\'analisi: ' + error.message);
      setIsAnalyzing(false);
    }
  };

  // Icons (stesso set delle altre pagine)
  const Icon = ({ path, className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {path}
    </svg>
  );

  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    checkup: <><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2M20 12h2M12 18v2M12 14v-2" /></>,
    profile: <><path d="M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3" /><circle cx="12" cy="10" r="3" /><circle cx="12" cy="12" r="10" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    building: <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18H6Z" /><path d="M6 12h12" /><path d="M6 16h12" /><path d="M10 6h4" /><path d="M10 10h4" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    spark: <><path d="M12 3v6l4-4-4-4" /><path d="M12 21v-6l-4 4 4 4" /><path d="M3 12h6l-4-4 4-4" /><path d="M21 12h-6l4 4-4 4" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
    check: <><polyline points="20 6 9 17 4 12" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    loader: <><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></>,
    arrowRight: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  };

  const navLinks = [
    { href: '/', text: 'Dashboard', icon: icons.dashboard, active: false },
    { href: '/checkup', text: 'Check-UP AI', icon: icons.checkup, active: true },
    { href: '/profilo', text: 'Profilo', icon: icons.profile, active: false },
  ];

  // Loading screen
  if (isLoading || isAuthenticated === null) {
    return (
      <>
        <Head>
          <title>Caricamento Check-UP - PMIScout</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <style>{` body { font-family: 'Inter', sans-serif; } `}</style>

          <script dangerouslySetInnerHTML={{
            __html: `var o_options = { domain: 'pmiscout.outseta.com', load: 'auth,nocode,profile,support', tokenStorage: 'cookie' };`,
          }} />
          <script src="https://cdn.outseta.com/outseta.min.js" data-options="o_options"></script>
        </Head>

        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <h2 className="text-xl font-bold text-blue-600 mb-2">PMIScout</h2>
            <p className="text-slate-600">Caricamento Check-UP AI...</p>
          </div>
        </div>
      </>
    );
  }

  // Not authenticated
  if (isAuthenticated === false) {
    return (
      <>
        <Head>
          <title>Accesso Richiesto - PMIScout</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </Head>
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Accesso Richiesto</h2>
            <p className="text-slate-600 mb-6">Devi effettuare il login per accedere al Check-UP AI.</p>
            <a href="https://pmiscout.outseta.com/auth?widgetMode=login" className="inline-block w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Vai al Login
            </a>
          </div>
        </div>
      </>
    );
  }

  // Resto del componente uguale ma con gestione Supabase...
  // [Il resto del JSX rimane lo stesso del componente precedente]
  
  return (
    // ... [Stesso JSX del componente precedente]
    <div>Component JSX here...</div>
  );
}
