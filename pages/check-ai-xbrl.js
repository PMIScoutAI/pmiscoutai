// /pages/check-ai-xbrl.js
// Pagina SSR che legge dal DB il risultato dell’analisi (inserito dall’API /api/analyze-xbrl).
// URL: /check-ai-xbrl?sessionId=...  (dopo aver chiamato POST /api/analyze-xbrl?sessionId=...)
// NOTE:
// - Nessun uso di 'xlsx' lato pagina.
// - Nessun handler API importato o usato qui.
// - Usa getServerSideProps per evitare export statico/prerender error.

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

      <main style={{ maxWidth: 960, margin: '40px auto', padding: 20 }}>
        <h1 style={{ marginBottom: 8 }}>Check AI XBRL</h1>
        {sessionId ? (
          <p style={{ color: '#666', marginTop: 0 }}>
            Sessione: <strong>{sessionId}</strong>
          </p>
        ) : (
          <p style={{ color: '#a00' }}>
            Nessun <code>sessionId</code> fornito. Aggiungi <code>?sessionId=...</code> all’URL.
          </p>
        )}

        {error && (
          <div
            style={{
              padding: 16,
              background: '#ffecec',
              border: '1px solid #ff9f9f',
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <strong>Errore:</strong> {error}
          </div>
        )}

        {!error && !analysis && (
          <div
            style={{
              padding: 16,
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            Nessun risultato disponibile. Avvia prima l’analisi tramite l’endpoint
            <code> POST /api/analyze-xbrl?sessionId=...</code> e poi ricarica questa pagina.
          </div>
        )}

        {!error && analysis && (
          <section style={{ marginTop: 20 }}>
            <HeaderCards analysis={analysis} />

            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <Card title="Sintesi">{analysis.raw_ai_response?.summary || 'n.d.'}</Card>
              <Card title="Ricavi">{analysis.raw_ai_response?.revenueAnalysis || 'n.d.'}</Card>
              <Card title="Utile">{analysis.raw_ai_response?.profitAnalysis || 'n.d.'}</Card>
              <Card title="Debiti">{analysis.raw_ai_response?.debtAnalysis || 'n.d.'}</Card>
              <Card title="Mercato">{analysis.raw_ai_response?.marketOutlook || 'n.d.'}</Card>
            </div>

            <details style={{ marginTop: 24 }}>
              <summary style={{ cursor: 'pointer' }}>Dati grezzi</summary>
              <h4>Raw parsed data</h4>
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

function HeaderCards({ analysis }) {
  const Row = ({ label, value }) => (
    <p style={{ margin: '6px 0' }}>
      <strong>{label}:</strong> {value}
    </p>
  );

  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      }}
    >
      <div style={{ padding: 16, background: '#f7f7f7', borderRadius: 8, border: '1px solid #e5e5e5' }}>
        <Row label="Health Score" value={analysis.health_score ?? 'n.d.'} />
        <Row label="Qualità Dati" value={analysis.data_quality || 'n.d.'} />
      </div>
      <div style={{ padding: 16, background: '#f7f7f7', borderRadius: 8, border: '1px solid #e5e5e5' }}>
        <Row label="Sessione" value={analysis.session_id || 'n.d.'} />
        <Row
          label="Completato il"
          value={
            analysis.completed_at
              ? new Date(analysis.completed_at).toLocaleString('it-IT')
              : 'n.d.'
          }
        />
      </div>
    </div>
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

// Forza SSR: nessun pre-render statico, niente errore di prerender.
export async function getServerSideProps(ctx) {
  const { sessionId } = ctx.query || {};
  if (!sessionId) {
    return { props: { sessionId: null, analysis: null, error: null } };
  }

  try {
    // getServerSideProps gira solo sul server → ok usare SERVICE_ROLE_KEY (non viene inviata al client).
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Prende l’ultimo risultato per la sessione
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
