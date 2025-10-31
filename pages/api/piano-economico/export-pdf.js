// /pages/api/piano-economico/[sessionId]/export-pdf.js
// Export Piano Economico a PDF

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const formatCurrency = (value) => {
  if (!value && value !== 0) return '—';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercent = (value) => {
  if (!value && value !== 0) return '—';
  return `${value.toFixed(2)}%`;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' });
  }

  const { sessionId } = req.query;
  const { planData } = req.body;

  if (!planData) {
    return res.status(400).json({ error: 'Dati piano mancanti' });
  }

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // ============================================
    // HEADER
    // ============================================

    doc.setFontSize(24);
    doc.setTextColor(31, 41, 55);
    doc.text('PIANO ECONOMICO TRIENNALE', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128);
    doc.text(`Azienda: ${planData.companyName}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 20, yPosition);
    yPosition += 10;

    // ============================================
    // EXECUTIVE SUMMARY KPI
    // ============================================

    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('EXECUTIVE SUMMARY', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);

    const kpiSummary = [
      ['CAGR Ricavi (3Y)', formatPercent(planData.kpi.cagr_ricavi)],
      ['EBITDA Margin (media)', formatPercent(planData.kpi.margine_ebitda_medio)],
      ['Leverage Y3 (D/EBITDA)', `${planData.kpi.leverage_y3.toFixed(2)}x`],
      ['Interest Coverage Y3', `${planData.kpi.interest_coverage_y3.toFixed(2)}x`],
      ['ROE Y3', formatPercent(planData.kpi.roe_y3)],
      ['ROI Y3', formatPercent(planData.kpi.roi_y3)],
      ['Assessment', planData.kpi.breakeven_assessment]
    ];

    doc.autoTable({
      startY: yPosition,
      head: [['Metrica', 'Valore']],
      body: kpiSummary,
      theme: 'grid',
      headerStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: 55
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 100 },
        1: { halign: 'right', cellWidth: 50 }
      },
      margin: { left: 20, right: 20 }
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    // ============================================
    // CONTO ECONOMICO DETTAGLIATO
    // ============================================

    const cEconomico = [
      ['VOCE', 'Anno 0', 'Anno 1', 'Anno 2', 'Anno 3'],
      ['Ricavi', 
        formatCurrency(planData.anno0.ricavi),
        formatCurrency(planData.anno1.ricavi),
        formatCurrency(planData.anno2.ricavi),
        formatCurrency(planData.anno3.ricavi)
      ],
      ['Costi Personale',
        formatCurrency(-planData.anno0.costiPersonale),
        formatCurrency(-planData.anno1.costiPersonale),
        formatCurrency(-planData.anno2.costiPersonale),
        formatCurrency(-planData.anno3.costiPersonale)
      ],
      ['Materie Prime',
        formatCurrency(-planData.anno0.materiePrime),
        formatCurrency(-planData.anno1.materiePrime),
        formatCurrency(-planData.anno2.materiePrime),
        formatCurrency(-planData.anno3.materiePrime)
      ],
      ['Servizi',
        formatCurrency(-planData.anno0.servizi),
        formatCurrency(-planData.anno1.servizi),
        formatCurrency(-planData.anno2.servizi),
        formatCurrency(-planData.anno3.servizi)
      ],
      ['Godimento Beni',
        formatCurrency(-planData.anno0.godimento),
        formatCurrency(-planData.anno1.godimento),
        formatCurrency(-planData.anno2.godimento),
        formatCurrency(-planData.anno3.godimento)
      ],
      ['Oneri Diversi',
        formatCurrency(-planData.anno0.oneriDiversi),
        formatCurrency(-planData.anno1.oneriDiversi),
        formatCurrency(-planData.anno2.oneriDiversi),
        formatCurrency(-planData.anno3.oneriDiversi)
      ],
      ['EBITDA',
        formatCurrency(planData.anno0.ebitda),
        formatCurrency(planData.anno1.ebitda),
        formatCurrency(planData.anno2.ebitda),
        formatCurrency(planData.anno3.ebitda)
      ],
      ['Ammortamenti',
        formatCurrency(-planData.anno0.ammortamenti),
        formatCurrency(-planData.anno1.ammortamenti),
        formatCurrency(-planData.anno2.ammortamenti),
        formatCurrency(-planData.anno3.ammortamenti)
      ],
      ['EBIT',
        formatCurrency(planData.anno0.ebit),
        formatCurrency(planData.anno1.ebit),
        formatCurrency(planData.anno2.ebit),
        formatCurrency(planData.anno3.ebit)
      ],
      ['Oneri Finanziari',
        formatCurrency(-planData.anno0.oneriFinanziari),
        formatCurrency(-planData.anno1.oneriFinanziari),
        formatCurrency(-planData.anno2.oneriFinanziari),
        formatCurrency(-planData.anno3.oneriFinanziari)
      ],
      ['Utile Netto',
        formatCurrency(planData.anno0.utileNetto),
        formatCurrency(planData.anno1.utileNetto),
        formatCurrency(planData.anno2.utileNetto),
        formatCurrency(planData.anno3.utileNetto)
      ]
    ];

    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('CONTO ECONOMICO TRIENNALE', 20, yPosition);
    yPosition += 8;

    doc.autoTable({
      startY: yPosition,
      head: cEconomico.slice(0, 1),
      body: cEconomico.slice(1),
      theme: 'grid',
      headerStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 55
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      margin: { left: 20, right: 20 }
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    // ============================================
    // MARGINI %
    // ============================================

    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    const margini = [
      ['MARGINE', 'Anno 0', 'Anno 1', 'Anno 2', 'Anno 3'],
      ['EBITDA %',
        formatPercent(planData.anno0.margineEbitda),
        formatPercent(planData.anno1.margineEbitda),
        formatPercent(planData.anno2.margineEbitda),
        formatPercent(planData.anno3.margineEbitda)
      ],
      ['EBIT %',
        formatPercent(planData.anno0.margineEbit),
        formatPercent(planData.anno1.margineEbit),
        formatPercent(planData.anno2.margineEbit),
        formatPercent(planData.anno3.margineEbit)
      ],
      ['Utile Netto %',
        formatPercent(planData.anno0.margineNetto),
        formatPercent(planData.anno1.margineNetto),
        formatPercent(planData.anno2.margineNetto),
        formatPercent(planData.anno3.margineNetto)
      ]
    ];

    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('ANALISI MARGINI', 20, yPosition);
    yPosition += 8;

    doc.autoTable({
      startY: yPosition,
      head: margini.slice(0, 1),
      body: margini.slice(1),
      theme: 'grid',
      headerStyles: {
        fillColor: [139, 92, 246],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: 55
      },
      margin: { left: 20, right: 20 }
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    // ============================================
    // ANALISI DI SENSIBILITÀ
    // ============================================

    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    const sensibilita = [
      ['SCENARIO', 'Ricavi Y3', 'EBITDA Y3', 'Margine EBITDA'],
      ['Downside (-10%)',
        formatCurrency(planData.sensibilita.ricavi_minus10.ricavi),
        formatCurrency(planData.sensibilita.ricavi_minus10.ebitda),
        formatPercent(planData.sensibilita.ricavi_minus10.margine_ebitda)
      ],
      ['Base',
        formatCurrency(planData.sensibilita.ricavi_baseline.ricavi),
        formatCurrency(planData.sensibilita.ricavi_baseline.ebitda),
        formatPercent(planData.sensibilita.ricavi_baseline.margine_ebitda)
      ],
      ['Upside (+10%)',
        formatCurrency(planData.sensibilita.ricavi_plus10.ricavi),
        formatCurrency(planData.sensibilita.ricavi_plus10.ebitda),
        formatPercent(planData.sensibilita.ricavi_plus10.margine_ebitda)
      ]
    ];

    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('ANALISI DI SENSIBILITÀ (Anno 3)', 20, yPosition);
    yPosition += 8;

    doc.autoTable({
      startY: yPosition,
      head: sensibilita.slice(0, 1),
      body: sensibilita.slice(1),
      theme: 'grid',
      headerStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: 55
      },
      margin: { left: 20, right: 20 }
    });

    // ============================================
    // PAGE BREAK & NARRATIVE
    // ============================================

    doc.addPage();

    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('RELAZIONE E ASSUNZIONI', 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    const narrativeLines = doc.splitTextToSize(planData.narrative, pageWidth - 40);
    doc.text(narrativeLines, 20, 35);

    // ============================================
    // OUTPUT
    // ============================================

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Piano-Economico-${planData.companyName}.pdf"`);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Errore export PDF:', error);
    return res.status(500).json({
      error: 'Errore durante la generazione del PDF',
      details: error.message
    });
  }
}
