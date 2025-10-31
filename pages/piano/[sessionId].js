// /pages/piano/[sessionId].js
// VERSIONE 3.1 - SENZA GRAFICI RECHARTS + FIX GODIMENTO + RIGHE VUOTE NASCOSTE
// Focus: Tabelle + KPI + PDF Export (No problemi di rendering)

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { api } from '../../utils/api';
import { ProtectedPage } from '../../utils/ProtectedPage';
import Layout from '../../components/Layout';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const PianoPageComponent = dynamic(
  () => Promise.resolve(PianoPage),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Elaborazione piano economico...</p>
        </div>
      </div>
    )
  }
);

export default function PianoPageWrapper() {
  return (
    <>
      <Head>
        <title>Risultati Piano Economico - PMIScout</title>
        <meta name="description" content="Visualizza il tuo piano economico generato con AI." />
      </Head>

      <Script id="outseta-options" strategy="beforeInteractive">
        {`var o_options = { domain: 'pmiscout.outseta.com', load: 'auth', tokenStorage: 'cookie' };`}
      </Script>
      <Script
        id="outseta-script"
        src="https://cdn.outseta.com/outseta.min.js"
        strategy="beforeInteractive"
      ></Script>

      <ProtectedPage>
        <Layout pageTitle="Risultati Piano Economico">
          <PianoPageComponent />
        </Layout>
      </ProtectedPage>
    </>
  );
}

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

function PianoPage() {
  const router = useRouter();
  const { sessionId } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('riepilogo');
  const [exportingPdf, setExportingPdf] = useState(false);

  // ============================================
  // CARICA DATI
  // ============================================

  useEffect(() => {
    if (!sessionId) return;

    const fetchData = async () => {
      try {
        console.log(`📥 Caricamento dati sessione: ${sessionId}`);
        
        const generateRes = await api.post(`/piano-economico/${sessionId}/generate`);
        
        if (generateRes.data.success) {
          setData(generateRes.data.data);
          console.log('✅ Dati caricati:', generateRes.data.data);
        } else {
          setError('Errore nel caricamento dei dati');
        }
      } catch (err) {
        console.error('💥 Errore:', err);
        setError(
          err.response?.data?.error ||
          err.message ||
          'Impossibile caricare il piano economico'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  // ============================================
  // GENERA PDF
  // ============================================

  const exportPDF = async () => {
    if (!data) return;

    setExportingPdf(true);

    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 10;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138);
      doc.text('Piano Economico AI', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 10;
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text(`${data.anno0?.company_name || 'Azienda'}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 12;

      // ===== SEZIONE 1: RIEPILOGO ANNO 0 =====
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('1. ANNO 0 (BASELINE)', 15, yPosition);

      yPosition += 8;
      const anno0 = data.anno0;
      const anno0Table = [
        ['Ricavi', formatCurrency(anno0.ricavi)],
        ['Costi Personale', formatCurrency(anno0.costiPersonale)],
        ['Materie Prime', formatCurrency(anno0.materiePrime)],
        ['Servizi', formatCurrency(anno0.servizi)],
        ['EBITDA', formatCurrency(anno0.ebitda)],
        ['Margine EBITDA', `${(anno0.ebitda / anno0.ricavi * 100).toFixed(1)}%`],
        ['EBIT', formatCurrency(anno0.ebit)],
        ['Utile Netto', formatCurrency(anno0.utile)]
      ];

      doc.autoTable({
        startY: yPosition,
        head: [['Voce', 'Importo']],
        body: anno0Table,
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 60, halign: 'right' } },
        margin: { left: 15, right: 15 }
      });

      yPosition = doc.lastAutoTable.finalY + 10;

      // ===== SEZIONE 2: PROIEZIONE 3 ANNI =====
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 15;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('2. PROIEZIONE TRIENNALE', 15, yPosition);

      yPosition += 8;

      const projectionTable = [
        [
          'Voce',
          `Anno 1`,
          `Anno 2`,
          `Anno 3`
        ],
        [
          'Ricavi',
          formatCurrency(data.anno1.ricavi),
          formatCurrency(data.anno2.ricavi),
          formatCurrency(data.anno3.ricavi)
        ],
        [
          'EBITDA',
          formatCurrency(data.anno1.ebitda),
          formatCurrency(data.anno2.ebitda),
          formatCurrency(data.anno3.ebitda)
        ],
        [
          'Margine EBITDA',
          `${data.anno1.margineEbitda.toFixed(1)}%`,
          `${data.anno2.margineEbitda.toFixed(1)}%`,
          `${data.anno3.margineEbitda.toFixed(1)}%`
        ],
        [
          'EBIT',
          formatCurrency(data.anno1.ebit),
          formatCurrency(data.anno2.ebit),
          formatCurrency(data.anno3.ebit)
        ],
        [
          'Utile Netto',
          formatCurrency(data.anno1.utileNetto),
          formatCurrency(data.anno2.utileNetto),
          formatCurrency(data.anno3.utileNetto)
        ],
        [
          'Margine Netto',
          `${data.anno1.margineNetto.toFixed(1)}%`,
          `${data.anno2.margineNetto.toFixed(1)}%`,
          `${data.anno3.margineNetto.toFixed(1)}%`
        ]
      ];

      doc.autoTable({
        startY: yPosition,
        head: [projectionTable[0]],
        body: projectionTable.slice(1),
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 40, halign: 'right' },
          2: { cellWidth: 40, halign: 'right' },
          3: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: 15, right: 15 }
      });

      yPosition = doc.lastAutoTable.finalY + 10;

      // ===== SEZIONE 3: KPI =====
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 15;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('3. KPI BANCABILI', 15, yPosition);

      yPosition += 8;

      const kpiTable = [
        ['KPI', 'Valore', 'Interpretazione'],
        ['CAGR Ricavi (3 anni)', `${data.kpi.cagr_ricavi}%`, data.kpi.cagr_ricavi > 5 ? 'Buono' : 'Moderato'],
        ['Leverage (D/EBITDA)', `${data.kpi.leverage_y3.toFixed(2)}x`, data.kpi.leverage_y3 < 2 ? 'Sostenibile' : 'Monitorare'],
        ['Interest Coverage', `${data.kpi.interest_coverage_y3.toFixed(1)}x`, data.kpi.interest_coverage_y3 > 2 ? 'Coperto' : 'Stretto'],
        ['Margine EBITDA Medio', `${data.kpi.margine_ebitda_medio.toFixed(1)}%`, 'Nella media'],
        ['ROE (Year 3)', `${data.kpi.roe_y3.toFixed(1)}%`, 'Rendimento equity'],
        ['Assessment', data.kpi.breakeven_assessment, '']
      ];

      doc.autoTable({
        startY: yPosition,
        head: [kpiTable[0]],
        body: kpiTable.slice(1),
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 40, halign: 'right' },
          2: { cellWidth: 60 }
        },
        margin: { left: 15, right: 15 }
      });

      yPosition = doc.lastAutoTable.finalY + 10;

      // ===== SEZIONE 4: NARRATIVE =====
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 15;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('4. NARRATIVE STRATEGICA', 15, yPosition);

      yPosition += 8;
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      const narrative = data.narrative || 'Narrative non disponibile';
      const narrativeLines = doc.splitTextToSize(narrative, pageWidth - 30);

      doc.text(narrativeLines, 15, yPosition);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Generato da PMIScout | ${new Date().toLocaleDateString('it-IT')}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );

      doc.save(`piano-economico-${sessionId.substring(0, 8)}.pdf`);
      console.log('✅ PDF scaricato');
    } catch (err) {
      console.error('❌ Errore export PDF:', err);
      alert('Errore durante la generazione del PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Elaborazione piano economico...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 mx-auto max-w-6xl px-4">
        <div className="p-6 bg-red-50 text-red-800 border border-red-200 rounded-lg">
          <p className="font-bold">❌ Errore</p>
          <p className="mt-2">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-8 mx-auto max-w-6xl px-4">
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p>Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 mx-auto max-w-7xl px-4">
      {/* ===== HEADER ===== */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Piano Economico</h1>
            <p className="text-slate-600 mt-1">Proiezione triennale con AI</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportPDF}
              disabled={exportingPdf}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition"
            >
              {exportingPdf ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Export...
                </>
              ) : (
                <>
                  ⬇️ PDF
                </>
              )}
            </button>
            <button
              onClick={() => router.push('/piano-economico')}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
            >
              ← Nuovo Piano
            </button>
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'riepilogo', label: '📊 Riepilogo' },
          { id: 'numeri', label: '💰 Numeri Dettagli' },
          { id: 'kpi', label: '🏦 KPI Bancabili' },
          { id: 'sensibilita', label: '⚠️ Sensibilità' },
          { id: 'narrative', label: '📝 Narrative' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== CONTENUTO TABS ===== */}

      {/* TAB: RIEPILOGO */}
      {activeTab === 'riepilogo' && (
        <div className="space-y-6">
          {/* Metriche Top */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="CAGR Ricavi"
              value={`${data.kpi.cagr_ricavi}%`}
              subtitle="3 anni"
              color="blue"
            />
            <MetricCard
              label="Ricavi Y3"
              value={formatCurrency(data.anno3.ricavi)}
              subtitle={`+${((data.anno3.ricavi / data.anno0.ricavi - 1) * 100).toFixed(1)}% vs Y0`}
              color="green"
            />
            <MetricCard
              label="EBITDA Medio"
              value={`${data.kpi.margine_ebitda_medio.toFixed(1)}%`}
              subtitle="Margine 3 anni"
              color="purple"
            />
            <MetricCard
              label="Leverage Y3"
              value={`${data.kpi.leverage_y3.toFixed(2)}x`}
              subtitle={data.kpi.breakeven_assessment}
              color={data.kpi.leverage_y3 < 1.5 ? 'green' : data.kpi.leverage_y3 < 2.5 ? 'yellow' : 'red'}
            />
          </div>

          {/* Tabella Trend Principali */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Voce</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 0</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 1</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 2</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <TableRow label="Ricavi" v0={data.anno0.ricavi} v1={data.anno1.ricavi} v2={data.anno2.ricavi} v3={data.anno3.ricavi} bold />
                <TableRow label="EBITDA" v0={data.anno0.ebitda} v1={data.anno1.ebitda} v2={data.anno2.ebitda} v3={data.anno3.ebitda} bold highlight />
                <TableRow label="Utile Netto" v0={data.anno0.utile} v1={data.anno1.utileNetto} v2={data.anno2.utileNetto} v3={data.anno3.utileNetto} bold highlight />
              </tbody>
            </table>
          </div>

          {/* Margini */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Margine</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 0</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 1</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 2</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <TableRow label="% EBITDA" v0={data.anno0.ebitda / data.anno0.ricavi * 100} v1={data.anno1.margineEbitda} v2={data.anno2.margineEbitda} v3={data.anno3.margineEbitda} pct />
                <TableRow label="% EBIT" v0={data.anno0.ebit / data.anno0.ricavi * 100} v1={data.anno1.margineEbit} v2={data.anno2.margineEbit} v3={data.anno3.margineEbit} pct />
                <TableRow label="% Netto" v0={data.anno0.utile / data.anno0.ricavi * 100} v1={data.anno1.margineNetto} v2={data.anno2.margineNetto} v3={data.anno3.margineNetto} pct />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: NUMERI DETTAGLI */}
      {activeTab === 'numeri' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Voce</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 0</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 1</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 2</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <TableRow label="Ricavi" v0={data.anno0.ricavi} v1={data.anno1.ricavi} v2={data.anno2.ricavi} v3={data.anno3.ricavi} bold />
                <TableRow label="Costi Personale" v0={data.anno0.costiPersonale} v1={data.anno1.costiPersonale} v2={data.anno2.costiPersonale} v3={data.anno3.costiPersonale} />
                <TableRow label="Materie Prime" v0={data.anno0.materiePrime} v1={data.anno1.materiePrime} v2={data.anno2.materiePrime} v3={data.anno3.materiePrime} />
                <TableRow label="Servizi" v0={data.anno0.servizi} v1={data.anno1.servizi} v2={data.anno2.servizi} v3={data.anno3.servizi} />
                <TableRow label="Costi Godimento Terzi" v0={data.anno0.godimento} v1={data.anno1.godimento} v2={data.anno2.godimento} v3={data.anno3.godimento} />
                <TableRow label="Oneri Diversi" v0={data.anno0.oneriDiversi} v1={data.anno1.oneriDiversi} v2={data.anno2.oneriDiversi} v3={data.anno3.oneriDiversi} />
                <TableRow label="EBITDA" v0={data.anno0.ebitda} v1={data.anno1.ebitda} v2={data.anno2.ebitda} v3={data.anno3.ebitda} bold highlight />
                <TableRow label="Ammortamenti" v0={data.anno0.ammortamenti} v1={data.anno1.ammortamenti} v2={data.anno2.ammortamenti} v3={data.anno3.ammortamenti} />
                <TableRow label="EBIT" v0={data.anno0.ebit} v1={data.anno1.ebit} v2={data.anno2.ebit} v3={data.anno3.ebit} bold highlight />
                <TableRow label="Oneri Finanziari" v0={data.anno0.oneriFinanziari} v1={data.anno1.oneriFinanziari} v2={data.anno2.oneriFinanziari} v3={data.anno3.oneriFinanziari} />
                <TableRow label="EBT" v0={data.anno0.ebit - data.anno0.oneriFinanziari} v1={data.anno1.ebit - data.anno1.oneriFinanziari} v2={data.anno2.ebit - data.anno2.oneriFinanziari} v3={data.anno3.ebit - data.anno3.oneriFinanziari} />
                <TableRow label="Imposte" v0={0} v1={data.anno1.utileNetto ? (data.anno1.ebit - data.anno1.oneriFinanziari - data.anno1.utileNetto) : 0} v2={data.anno2.utileNetto ? (data.anno2.ebit - data.anno2.oneriFinanziari - data.anno2.utileNetto) : 0} v3={data.anno3.utileNetto ? (data.anno3.ebit - data.anno3.oneriFinanziari - data.anno3.utileNetto) : 0} />
                <TableRow label="Utile Netto" v0={data.anno0.utile} v1={data.anno1.utileNetto} v2={data.anno2.utileNetto} v3={data.anno3.utileNetto} bold highlight />
              </tbody>
            </table>
          </div>

          {/* Margini */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Margine</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 0</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 1</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 2</th>
                  <th className="px-6 py-3 text-right font-semibold">Anno 3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <TableRow label="% EBITDA" v0={data.anno0.ebitda / data.anno0.ricavi * 100} v1={data.anno1.margineEbitda} v2={data.anno2.margineEbitda} v3={data.anno3.margineEbitda} pct />
                <TableRow label="% EBIT" v0={data.anno0.ebit / data.anno0.ricavi * 100} v1={data.anno1.margineEbit} v2={data.anno2.margineEbit} v3={data.anno3.margineEbit} pct />
                <TableRow label="% Netto" v0={data.anno0.utile / data.anno0.ricavi * 100} v1={data.anno1.margineNetto} v2={data.anno2.margineNetto} v3={data.anno3.margineNetto} pct />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: KPI */}
      {activeTab === 'kpi' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiBox
              title="CAGR Ricavi (3 anni)"
              value={`${data.kpi.cagr_ricavi}%`}
              description="Crescita annua composta"
              color="blue"
            />
            <KpiBox
              title="Margine EBITDA Medio"
              value={`${data.kpi.margine_ebitda_medio.toFixed(1)}%`}
              description="Media anni 1-3"
              color="purple"
            />
            <KpiBox
              title="Leverage (D/EBITDA) Y3"
              value={`${data.kpi.leverage_y3.toFixed(2)}x`}
              description="Sostenibilità debito"
              color={data.kpi.leverage_y3 < 1.5 ? 'green' : data.kpi.leverage_y3 < 2.5 ? 'yellow' : 'red'}
            />
            <KpiBox
              title="Interest Coverage Y3"
              value={`${data.kpi.interest_coverage_y3.toFixed(1)}x`}
              description="Copertura oneri finanziari"
              color={data.kpi.interest_coverage_y3 > 2 ? 'green' : 'yellow'}
            />
            <KpiBox
              title="ROE (Y3)"
              value={`${data.kpi.roe_y3.toFixed(1)}%`}
              description="Rendimento del patrimonio netto"
              color="indigo"
            />
            <KpiBox
              title="ROI (Y3)"
              value={`${data.kpi.roi_y3.toFixed(1)}%`}
              description="Rendimento dell'attivo"
              color="cyan"
            />
          </div>

          {/* Assessment */}
          <div className={`rounded-lg p-6 ${
            data.kpi.breakeven_assessment === 'SOSTENIBILE'
              ? 'bg-green-50 border border-green-200'
              : data.kpi.breakeven_assessment === 'MONITORARE'
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Assessment Complessivo</h3>
            <p className={`text-lg font-semibold ${
              data.kpi.breakeven_assessment === 'SOSTENIBILE'
                ? 'text-green-700'
                : data.kpi.breakeven_assessment === 'MONITORARE'
                ? 'text-yellow-700'
                : 'text-red-700'
            }`}>
              {data.kpi.breakeven_assessment}
            </p>
            <p className="text-sm text-slate-600 mt-2">
              {data.kpi.breakeven_assessment === 'SOSTENIBILE'
                ? 'Il piano presenta una struttura finanziaria stabile e affidabile per operazioni di finanziamento.'
                : data.kpi.breakeven_assessment === 'MONITORARE'
                ? 'Il piano è realizzabile ma richiede monitoraggio attento dei KPI e controllo costi.'
                : 'Il piano presenta rischi significativi. Si consiglia revisione delle ipotesi.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB: SENSIBILITÀ */}
      {activeTab === 'sensibilita' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-600">
            Analisi dell'impatto di variazioni ±10% sui ricavi rispetto allo scenario base (anno 3).
          </p>

          {/* Tabella Sensibilità */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Scenario</th>
                  <th className="px-6 py-3 text-right font-semibold">Ricavi</th>
                  <th className="px-6 py-3 text-right font-semibold">EBITDA</th>
                  <th className="px-6 py-3 text-right font-semibold">% EBITDA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-semibold text-slate-900">-10% Ricavi</td>
                  <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(data.sensibilita.ricavi_minus10.ricavi)}</td>
                  <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(data.sensibilita.ricavi_minus10.ebitda)}</td>
                  <td className="px-6 py-3 text-right text-slate-600">{data.sensibilita.ricavi_minus10.margine_ebitda.toFixed(1)}%</td>
                </tr>
                <tr className="bg-blue-50 hover:bg-blue-100">
                  <td className="px-6 py-3 font-bold text-blue-900">Base (Scenario)</td>
                  <td className="px-6 py-3 text-right font-semibold text-blue-900">{formatCurrency(data.sensibilita.ricavi_baseline.ricavi)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-blue-900">{formatCurrency(data.sensibilita.ricavi_baseline.ebitda)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-blue-900">{data.sensibilita.ricavi_baseline.margine_ebitda.toFixed(1)}%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-semibold text-slate-900">+10% Ricavi</td>
                  <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(data.sensibilita.ricavi_plus10.ricavi)}</td>
                  <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(data.sensibilita.ricavi_plus10.ebitda)}</td>
                  <td className="px-6 py-3 text-right text-slate-600">{data.sensibilita.ricavi_plus10.margine_ebitda.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">📌 Interpretazione:</span> L'EBITDA varia in proporzione ai ricavi. Se i ricavi calano del 10%, l'EBITDA diminuisce di circa <strong>{((1 - data.sensibilita.ricavi_minus10.ebitda / data.sensibilita.ricavi_baseline.ebitda) * 100).toFixed(1)}%</strong>.
            </p>
          </div>
        </div>
      )}

      {/* TAB: NARRATIVE */}
      {activeTab === 'narrative' && (
        <div className="bg-white rounded-lg shadow p-8 prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-sm md:text-base">
            {data.narrative}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPONENTI HELPER
// ============================================

function MetricCard({ label, value, subtitle, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900'
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-xs mt-1 opacity-70">{subtitle}</p>
    </div>
  );
}

function KpiBox({ title, value, description, color }) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    purple: 'border-purple-200 bg-purple-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    red: 'border-red-200 bg-red-50',
    indigo: 'border-indigo-200 bg-indigo-50',
    cyan: 'border-cyan-200 bg-cyan-50'
  };

  return (
    <div className={`border ${colorClasses[color]} rounded-lg p-6`}>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
      <p className="text-xs text-slate-500 mt-2">{description}</p>
    </div>
  );
}

function TableRow({ label, v0, v1, v2, v3, bold = false, highlight = false, pct = false }) {
  // Nascondi righe completamente vuote (tutti i valori 0 o null)
  const allZero = !v0 && !v1 && !v2 && !v3;
  if (allZero) return null;

  const format = pct ? (v) => `${v?.toFixed(1) || '0'}%` : formatCurrency;
  const bgClass = highlight ? 'bg-blue-50' : '';
  const fontClass = bold ? 'font-bold text-slate-900' : 'text-slate-600';

  return (
    <tr className={bgClass}>
      <td className={`px-6 py-3 text-left ${fontClass}`}>{label}</td>
      <td className={`px-6 py-3 text-right ${fontClass}`}>{format(v0)}</td>
      <td className={`px-6 py-3 text-right ${fontClass}`}>{format(v1)}</td>
      <td className={`px-6 py-3 text-right ${fontClass}`}>{format(v2)}</td>
      <td className={`px-6 py-3 text-right ${fontClass}`}>{format(v3)}</td>
    </tr>
  );
}

// ============================================
// UTILITY
// ============================================

function formatCurrency(value) {
  if (value === undefined || value === null) return '€ 0';
  return `€ ${Math.round(value).toLocaleString('it-IT')}`;
}
