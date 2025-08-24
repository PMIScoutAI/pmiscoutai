// /pages/check-ai-xbrl.js
// Pagina SSR "pulita": nessun uso di 'xlsx', nessun handler API o res.status.
// Legge dal DB il risultato dell'analisi (inserito dall'API /api/analyze-xbrl).
// URL d’uso: /check-ai-xbrl?sessionId=... (dopo aver chiamato l’API di analisi).

import React from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

export default function CheckAiXbrlPage({ analysis, sessionId, error }) {
  return (
    <>
      <Head>
        <title>Check AI XBRL</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main style={{ maxWidth: 900, margin: '40px auto', padding: 20 }}>
        <h1 style={{ marginBottom: 10 }}>Check AI XBRL</h1>
        {sessionId && (
          <p style={{ color: '#666', marginTop: 0 }}>Sessione: <strong>{sessionId}</strong></p>
        )}

        {error && (
          <div style={{ padding: 16, background: '#ffecec', border: '1px solid #ff9f9f', borderRadius: 8 }}>
            <strong>Errore:</strong> {error}
          </div>
        )}

        {!error && !analysis && (
          <div style={{ padding: 16, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
            Nessun risultato disponibile. Avvia prima l’analisi tramite l’endpoint
            <code> /api/analyze-xbrl?sessionId=...</code> e ricarica questa pagina.
          </div>
        )}

        {!error && analysis && (
          <section style={{ marginTop: 20 }}>
            <h2>Risultato Analisi</h2>
            <div style={{ padding: 16, background: '#f7f7f7', borderRadius: 8, border: '1px solid #e5e5e5' }}>
              <p><strong>Health Score:</strong> {analysis.health_score ?? 'n.d.'}</p>
              <p><strong>Qualità Dati:</strong> {analysis.data_quality || 'n.d.'}</p>
            </div>

            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <Card title="Sintesi">{analysis.raw_ai_response?.summary || 'n.d.'}</Card>
              <Card title="Ricavi">{analysis.raw_ai_response?.revenueAnalysis || 'n.d.'}</Card>
              <Card title="Utile">{analysis.raw_ai_response?.profitAnalysis || 'n.d.'}</Card>
              <Card title="Debiti">{analysis.raw_ai_response?.debtAnalysis || 'n.d.'}</Card>
              <Card title="Mercato">{analysis.raw_ai_response?.marketOutlook || 'n.d.'}</Card>
            </div>

            <details style={{ marginTop: 24 }}>
              <summary style={{ cursor: 'pointer' }}>Dati grezzi</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>
{JSON.stringify(analysis.raw_parsed_data, null, 2)}
              </pre>
              <h4>Charts data</h4>
              <pre style={{ whiteSpace: 'pre-wrap' }}>
{JSON.stringify(analysis.charts_data, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </main>
    </>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ padding: 16, background: 'white', borderRadius: 8, border: '1px solid #e5e5e5' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

// Forza SSR per evitare export statico e problemi di prerender.
export async function getServerSideProps(ctx) {
  const { sessionId } = ctx.query || {};
  if (!sessionId) {
    return { props: { sessionId: null, analysis: null, error: null } };
  }

  try {
    // ATTENZIONE: getServerSideProps gira **solo** sul server.
    // Qui è lecito usare la SERVICE_ROLE_KEY (non raggiunge il client).
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('analysis_results')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { props: { sessionId, analysis: null, error: error.message } };
    }

    return {
      props: {
        sessionId,
        analysis: data || null,
        error: null,
      },
    };
  } catch (e) {
    return { props: { sessionId, analysis: null, error: e.message || 'Errore imprevisto' } };
  }
}
