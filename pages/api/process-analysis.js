// Crea un nuovo file in: pages/api/process-analysis.js
// Questo file funge da "proxy" sicuro tra il tuo frontend e la Edge Function

export const config = {
    api: {
        bodyParser: false, // Disabilita il parser di default per gestire FormData
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Prendi il token di Outseta dall'header della richiesta
        const outsetaToken = req.headers.authorization;
        if (!outsetaToken) {
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        // 2. Inoltra la richiesta alla tua Edge Function di Supabase
        // Questo nasconde l'URL della funzione e ti permette di usare la service_role_key in modo sicuro
        const supabaseFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-balance-sheet`;

        const response = await fetch(supabaseFunctionUrl, {
            method: 'POST',
            headers: {
                'Authorization': outsetaToken, // Inoltra il token dell'utente
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // La chiave pubblica del tuo progetto
                // Il Content-Type verrà impostato automaticamente da fetch con FormData
            },
            body: req, // Inoltra il corpo della richiesta (FormData)
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || 'Failed to process analysis');
        }

        // 3. Restituisci la risposta della Edge Function al frontend
        res.status(200).json(responseData);

    } catch (error) {
        console.error('API Route Error:', error);
        res.status(500).json({ error: error.message });
    }
}
