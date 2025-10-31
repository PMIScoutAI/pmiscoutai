// /pages/api/piano-economico/[sessionId]/export-xlsx.js
// Export Piano Economico a Excel

import xlsx from 'xlsx';

const formatCurrency = (value) => {
  if (!value && value !== 0) return null;
  return value;
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
    // ============================================
    // CREAZIONE WORKBOOK
    // ============================================

    const workbook = xlsx.utils.book_new();

    // ============================================
    // FOGLIO 1: CONTO ECONOMICO
    // ============================================

    const ceData = [
      ['CONTO ECONOMICO TRIENNALE', '', '', '', ''],
      ['VOCE', 'Anno 0', 'Anno 1', 'Anno 2', 'Anno 3'],
      ['Ricavi',
        formatCurrency(planData.anno0.ricavi),
        formatCurrency(planData.anno1.ricavi),
        formatCurrency(planData.anno2.ricavi),
        formatCurrency(planData.anno3.ricavi)
      ],
      ['Costi per Personale',
        -formatCurrency(planData.anno0.costiPersonale),
        -formatCurrency(planData.anno1.costiPersonale),
        -formatCurrency(planData.anno2.costiPersonale),
        -formatCurrency(planData.anno3.costiPersonale)
      ],
      ['Materie Prime',
        -formatCurrency(planData.anno0.materiePrime),
        -formatCurrency(planData.anno1.materiePrime),
        -formatCurrency(planData.anno2.materiePrime),
        -formatCurrency(planData.anno3.materiePrime)
      ],
      ['Servizi',
        -formatCurrency(planData.anno0.servizi),
        -formatCurrency(planData.anno1.servizi),
        -formatCurrency(planData.anno2.servizi),
        -formatCurrency(planData.anno3.servizi)
      ],
      ['Godimento Beni di Terzi',
        -formatCurrency(planData.anno0.godimento),
        -formatCurrency(planData.anno1.godimento),
        -formatCurrency(planData.anno2.godimento),
        -formatCurrency(planData.anno3.godimento)
      ],
      ['Oneri Diversi di Gestione',
        -formatCurrency(planData.anno0.oneriDiversi),
        -formatCurrency(planData.anno1.oneriDiversi),
        -formatCurrency(planData.anno2.oneriDiversi),
        -formatCurrency(planData.anno3.oneriDiversi)
      ],
      ['EBITDA',
        formatCurrency(planData.anno0.ebitda),
        formatCurrency(planData.anno1.ebitda),
        formatCurrency(planData.anno2.ebitda),
        formatCurrency(planData.anno3.ebitda)
      ],
      ['Ammortamenti',
        -formatCurrency(planData.anno0.ammortamenti),
        -formatCurrency(planData.anno1.ammortamenti),
        -formatCurrency(planData.anno2.ammortamenti),
        -formatCurrency(planData.anno3.ammortamenti)
      ],
      ['EBIT',
        formatCurrency(planData.anno0.ebit),
        formatCurrency(planData.anno1.ebit),
        formatCurrency(planData.anno2.ebit),
        formatCurrency(planData.anno3.ebit)
      ],
      ['Oneri Finanziari',
        -formatCurrency(planData.anno0.oneriFinanziari),
        -formatCurrency(planData.anno1.oneriFinanziari),
        -formatCurrency(planData.anno2.oneriFinanziari),
        -formatCurrency(planData.anno3.oneriFinanziari)
      ],
      ['Utile Netto',
        formatCurrency(planData.anno0.utileNetto),
        formatCurrency(planData.anno1.utileNetto),
        formatCurrency(planData.anno2.utileNetto),
        formatCurrency(planData.anno3.utileNetto)
      ]
    ];

    const ceSheet = xlsx.utils.aoa_to_sheet(ceData);
    ceSheet['!cols'] = [
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 }
    ];
    xlsx.utils.book_append_sheet(workbook, ceSheet, 'Conto Economico');

    // ============================================
    // FOGLIO 2: MARGINI
    // ============================================

    const marginiData = [
      ['ANALISI MARGINI %', '', '', '', ''],
      ['MARGINE', 'Anno 0', 'Anno 1', 'Anno 2', 'Anno 3'],
      ['EBITDA %',
        planData.anno0.margineEbitda,
        planData.anno1.margineEbitda,
        planData.anno2.margineEbitda,
        planData.anno3.margineEbitda
      ],
      ['EBIT %',
        planData.anno0.margineEbit,
        planData.anno1.margineEbit,
        planData.anno2.margineEbit,
        planData.anno3.margineEbit
      ],
      ['Utile Netto %',
        planData.anno0.margineNetto,
        planData.anno1.margineNetto,
        planData.anno2.margineNetto,
        planData.anno3.margineNetto
      ]
    ];

    const marginiSheet = xlsx.utils.aoa_to_sheet(marginiData);
    marginiSheet['!cols'] = [
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 }
    ];
    xlsx.utils.book_append_sheet(workbook, marginiSheet, 'Margini');

    // ============================================
    // FOGLIO 3: KPI
    // ============================================

    const kpiData = [
      ['KPI PRINCIPALI', ''],
      ['Metrica', 'Valore'],
      ['CAGR Ricavi (3Y)', `${planData.kpi.cagr_ricavi}%`],
      ['EBITDA Margin (media)', `${planData.kpi.margine_ebitda_medio}%`],
      ['Leverage Y3', `${planData.kpi.leverage_y3.toFixed(2)}x`],
      ['Interest Coverage Y3', `${planData.kpi.interest_coverage_y3.toFixed(2)}x`],
      ['ROE Y3', `${planData.kpi.roe_y3}%`],
      ['ROI Y3', `${planData.kpi.roi_y3}%`],
      ['Assessment', planData.kpi.breakeven_assessment]
    ];

    const kpiSheet = xlsx.utils.aoa_to_sheet(kpiData);
    kpiSheet['!cols'] = [
      { wch: 30 },
      { wch: 30 }
    ];
    xlsx.utils.book_append_sheet(workbook, kpiSheet, 'KPI');

    // ============================================
    // FOGLIO 4: SENSIBILITÀ
    // ============================================

    const sensibilita = [
      ['ANALISI SENSIBILITÀ ANNO 3', '', '', ''],
      ['SCENARIO', 'Ricavi', 'EBITDA', 'Margine EBITDA %'],
      ['Downside (-10%)',
        formatCurrency(planData.sensibilita.ricavi_minus10.ricavi),
        formatCurrency(planData.sensibilita.ricavi_minus10.ebitda),
        planData.sensibilita.ricavi_minus10.margine_ebitda
      ],
      ['Base',
        formatCurrency(planData.sensibilita.ricavi_baseline.ricavi),
        formatCurrency(planData.sensibilita.ricavi_baseline.ebitda),
        planData.sensibilita.ricavi_baseline.margine_ebitda
      ],
      ['Upside (+10%)',
        formatCurrency(planData.sensibilita.ricavi_plus10.ricavi),
        formatCurrency(planData.sensibilita.ricavi_plus10.ebitda),
        planData.sensibilita.ricavi_plus10.margine_ebitda
      ]
    ];

    const sensibiliteSheet = xlsx.utils.aoa_to_sheet(sensibilita);
    sensibiliteSheet['!cols'] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 }
    ];
    xlsx.utils.book_append_sheet(workbook, sensibiliteSheet, 'Sensibilità');

    // ============================================
    // FOGLIO 5: ASSUNZIONI
    // ============================================

    const assunzioniData = [
      ['ASSUNZIONI DEL PIANO'],
      [''],
      ['Parametro', 'Valore'],
      ['Tasso di Crescita Annuo', `${planData.growth_rate_applied}%`],
      ['Inflazione Personale', '2.0%'],
      ['Aliquota IRES', '24.0%'],
      ['Aliquota IRAP', '3.9%'],
      ['Ammortamenti', 'Costanti (no capex aggiuntivo)'],
      ['Oneri Finanziari', 'Stabili (no nuovo debito)'],
      ['Margini di Costo', 'Stabili in % sui ricavi'],
      [''],
      ['FATTORI DI RISCHIO'],
      [''],
      ['- Variabilità della domanda di mercato'],
      ['- Volatilità prezzi materie prime'],
      ['- Efficienza operativa mantenuta'],
      ['- Stabilità condizioni macroeconomiche'],
      [''],
      ['VALUTAZIONE COMPLESSIVA'],
      [''],
      ['Assessment', planData.kpi.breakeven_assessment],
      [planData.kpi.breakeven_assessment === 'SOSTENIBILE' ? 'Piano finanziariamente equilibrato' : 
       planData.kpi.breakeven_assessment === 'MONITORARE' ? 'Monitoraggio trimestrale consigliato' :
       'Revisione urgente necessaria', '']
    ];

    const assunzioniSheet = xlsx.utils.aoa_to_sheet(assunzioniData);
    assunzioniSheet['!cols'] = [
      { wch: 50 },
      { wch: 20 }
    ];
    xlsx.utils.book_append_sheet(workbook, assunzioniSheet, 'Assunzioni');

    // ============================================
    // GENERA FILE
    // ============================================

    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // ============================================
    // RESPONSE
    // ============================================

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Piano-Economico-${planData.companyName}.xlsx"`);

    res.send(excelBuffer);

  } catch (error) {
    console.error('Errore export Excel:', error);
    return res.status(500).json({
      error: 'Errore durante la generazione dell\'Excel',
      details: error.message
    });
  }
}
