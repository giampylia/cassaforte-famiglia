import React, { useState, useMemo, useEffect } from 'react';
import {
  Scale,
  Calendar,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Plus,
  Save,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  PieChart,
  Wallet,
  Activity,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  BilancioEsercizio,
  BilancioConto,
  BilancioPreventivoRow,
  LiquiditaSetting,
  LiquiditaRiga,
  MONTH_COLUMNS,
  calcContoProgressivo,
} from '../data/bilancioData';

declare global {
  interface Window {
    XLSX?: any;
    jspdf?: any;
  }
}

function formatEuro(amount?: number | null): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

let xlsxPromiseBilancio: Promise<any> | null = null;
function loadSheetJsBilancio(): Promise<any> {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxPromiseBilancio) return xlsxPromiseBilancio;
  xlsxPromiseBilancio = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = (e) => {
      xlsxPromiseBilancio = null;
      reject(e);
    };
    document.head.appendChild(script);
  });
  return xlsxPromiseBilancio;
}

export const BilancioView: React.FC = () => {
  const {
    bilanci,
    bilancioConti,
    bilancioPreventivo,
    liquiditaSettings,
    liquiditaRighe,
    saveBilancioConto,
    saveLiquiditaSetting,
    saveLiquiditaRiga,
    deleteLiquiditaRiga,
    getUserSectionPermission,
    isSuperAdmin,
  } = useApp();

  const permission = getUserSectionPermission('bilancio');
  const canEdit = isSuperAdmin || permission === 'edit';

  const [activeTab, setActiveTab] = useState<'consuntivo' | 'preventivo' | 'liquidita'>('consuntivo');

  // --- Consuntivo state ---
  const defaultEsercizio = useMemo(() => {
    const cur = bilanci.find((b) => b.esercizio === '2026/2027');
    return cur ? cur.id : bilanci[0]?.id || '';
  }, [bilanci]);

  const [selectedBilancioId, setSelectedBilancioId] = useState<string>(defaultEsercizio);

  useEffect(() => {
    if (!selectedBilancioId && bilanci.length > 0) {
      const cur = bilanci.find((b) => b.esercizio === '2026/2027') || bilanci[0];
      if (cur) setSelectedBilancioId(cur.id);
    }
  }, [bilanci, selectedBilancioId]);

  const [consuntivoSection, setConsuntivoSection] = useState<'all' | 'conto_economico' | 'stato_patrimoniale'>('all');
  const [consuntivoArea, setConsuntivoArea] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConto, setEditingConto] = useState<BilancioConto | null>(null);

  // --- Preventivo state ---
  const [preventivoYear, setPreventivoYear] = useState<number>(2026);
  const [preventivoSearch, setPreventivoSearch] = useState('');

  // --- Liquidità state ---
  const [liquiditaYear, setLiquiditaYear] = useState<number>(2026);
  const [editingRiga, setEditingRiga] = useState<LiquiditaRiga | null>(null);
  const [isAddingRiga, setIsAddingRiga] = useState(false);
  const [editingSetting, setEditingSetting] = useState<LiquiditaSetting | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Tab 1: Consuntivo calculations
  // --------------------------------------------------------------------------
  const currentEsercizioObj = useMemo(() => {
    return bilanci.find((b) => b.id === selectedBilancioId);
  }, [bilanci, selectedBilancioId]);

  const filteredConti = useMemo(() => {
    return bilancioConti.filter((c) => {
      if (c.bilancio_id !== selectedBilancioId) return false;
      if (consuntivoSection !== 'all' && c.sezione !== consuntivoSection) return false;
      if (consuntivoArea !== 'all' && c.area !== consuntivoArea) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nMatch = (c.numero_conto || '').toLowerCase().includes(q);
        const nameMatch = (c.nome_conto || '').toLowerCase().includes(q);
        const subMatch = (c.sotto_area || '').toLowerCase().includes(q);
        if (!nMatch && !nameMatch && !subMatch) return false;
      }
      return true;
    }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [bilancioConti, selectedBilancioId, consuntivoSection, consuntivoArea, searchQuery]);

  // Aggregates for all accounts of the exercise (regardless of filters)
  const consuntivoTotals = useMemo(() => {
    let totaleAttivo = 0;
    let totalePassivo = 0;
    let totaleRicavi = 0;
    let totaleCosti = 0;
    let totalePreventivoRicavi = 0;
    let totalePreventivoCosti = 0;

    bilancioConti.forEach((c) => {
      if (c.bilancio_id !== selectedBilancioId) return;
      const prog = Number(c.totale_progressivo) || 0;
      const prev = Number(c.preventivo) || 0;

      if (c.area === 'attivo') totaleAttivo += prog;
      else if (c.area === 'passivo') totalePassivo += prog;
      else if (c.area === 'ricavi') {
        totaleRicavi += prog;
        totalePreventivoRicavi += prev;
      } else if (c.area === 'costi') {
        totaleCosti += prog;
        totalePreventivoCosti += prev;
      }
    });

    const avanzo = totaleRicavi - totaleCosti;
    const avanzoPreventivo = totalePreventivoRicavi - totalePreventivoCosti;

    return {
      totaleAttivo,
      totalePassivo,
      totaleRicavi,
      totaleCosti,
      avanzo,
      totalePreventivoRicavi,
      totalePreventivoCosti,
      avanzoPreventivo,
    };
  }, [bilancioConti, selectedBilancioId]);

  // Sotto-aree per raggruppamento
  const groupedContiByArea = useMemo(() => {
    const groups: { [key: string]: BilancioConto[] } = {};
    filteredConti.forEach((c) => {
      const key = `${c.sezione.toUpperCase()} — ${c.area.toUpperCase()}${c.sotto_area ? ` • ${c.sotto_area}` : ''}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return groups;
  }, [filteredConti]);

  // --------------------------------------------------------------------------
  // Tab 2: Preventivo calculations
  // --------------------------------------------------------------------------
  const filteredPreventivo = useMemo(() => {
    return bilancioPreventivo.filter((r) => {
      if (r.anno !== preventivoYear) return false;
      if (preventivoSearch.trim()) {
        const q = preventivoSearch.toLowerCase();
        const nMatch = (r.numero_conto || '').toLowerCase().includes(q);
        const nameMatch = (r.nome_conto || '').toLowerCase().includes(q);
        const subMatch = (r.sotto_area || '').toLowerCase().includes(q);
        if (!nMatch && !nameMatch && !subMatch) return false;
      }
      return true;
    }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [bilancioPreventivo, preventivoYear, preventivoSearch]);

  const preventivoTotals = useMemo(() => {
    let totPrec = 0;
    let totPrev = 0;
    filteredPreventivo.forEach((r) => {
      totPrec += Number(r.anno_precedente) || 0;
      totPrev += Number(r.previsione) || 0;
    });
    return {
      totPrec,
      totPrev,
      diff: totPrev - totPrec,
    };
  }, [filteredPreventivo]);

  // --------------------------------------------------------------------------
  // Tab 3: Liquidità calculations
  // --------------------------------------------------------------------------
  const currentLiquiditaSetting = useMemo(() => {
    return (
      liquiditaSettings.find((s) => s.anno === liquiditaYear) || {
        id: 'default',
        anno: liquiditaYear,
        saldo_iniziale: 348411.93,
        saldo_iniziale_data: '2026-07-01',
        totale_lavori: 0,
      }
    );
  }, [liquiditaSettings, liquiditaYear]);

  const sortedLiquiditaRighe = useMemo(() => {
    return [...liquiditaRighe]
      .filter((r) => r.anno === liquiditaYear)
      .sort((a, b) => (a.periodo_fine || '').localeCompare(b.periodo_fine || ''));
  }, [liquiditaRighe, liquiditaYear]);

  // Flusso progressivo
  const liquiditaWithProgressive = useMemo(() => {
    let currentBalance = Number(currentLiquiditaSetting.saldo_iniziale) || 0;
    let totEntrateAll = 0;
    let totUsciteAll = 0;

    const rows = sortedLiquiditaRighe.map((r) => {
      const entrate =
        (Number(r.rsa) || 0) +
        (Number(r.iscrizioni) || 0) +
        (Number(r.via_pizzetti) || 0) +
        (Number(r.lsc) || 0) +
        (Number(r.eventi) || 0);

      const uscite =
        (Number(r.stipendi) || 0) +
        (Number(r.docenze) || 0) +
        (Number(r.ordinarie) || 0);

      const netto = entrate - uscite;
      currentBalance += netto;
      totEntrateAll += entrate;
      totUsciteAll += uscite;

      return {
        ...r,
        totaleEntrate: entrate,
        totaleUscite: uscite,
        flussoNetto: netto,
        saldoProgressivo: currentBalance,
      };
    });

    return {
      rows,
      totEntrateAll,
      totUsciteAll,
      flussoNettoTotale: totEntrateAll - totUsciteAll,
      saldoFinale: currentBalance,
    };
  }, [sortedLiquiditaRighe, currentLiquiditaSetting]);

  // --------------------------------------------------------------------------
  // Handlers: Save Conto
  // --------------------------------------------------------------------------
  const handleSaveConto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConto) return;
    const progressivo = calcContoProgressivo(editingConto);
    await saveBilancioConto({
      ...editingConto,
      totale_progressivo: progressivo,
    });
    setEditingConto(null);
  };

  // --------------------------------------------------------------------------
  // Handlers: Save Liquidita Riga
  // --------------------------------------------------------------------------
  const handleSaveRiga = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRiga) return;
    await saveLiquiditaRiga({
      ...editingRiga,
      anno: liquiditaYear,
    });
    setEditingRiga(null);
    setIsAddingRiga(false);
  };

  const handleDeleteRiga = async (id: string) => {
    await deleteLiquiditaRiga(id);
    setDeleteConfirmId(null);
  };

  // --------------------------------------------------------------------------
  // Handlers: Save Liquidita Setting
  // --------------------------------------------------------------------------
  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetting) return;
    await saveLiquiditaSetting(editingSetting);
    setEditingSetting(null);
  };

  // --------------------------------------------------------------------------
  // Export Excel: Consuntivo
  // --------------------------------------------------------------------------
  const exportConsuntivoExcel = async () => {
    try {
      const XLSX = await loadSheetJsBilancio();
      const rows: any[] = [];

      rows.push(['UNIVERSITÀ DELLA TERZA ETÀ DI QUARTU SANT\'ELENA APS']);
      rows.push([`BILANCIO ETS E RENDICONTO GESTIONALE — ESERCIZIO ${currentEsercizioObj?.esercizio || selectedBilancioId}`]);
      rows.push([`Esportato il: ${new Date().toLocaleString('it-IT')}`]);
      rows.push([]);

      // Summary
      rows.push(['QUADRO DI SINTESI GESTIONALE']);
      rows.push(['Totale Attivo', consuntivoTotals.totaleAttivo]);
      rows.push(['Totale Passivo', consuntivoTotals.totalePassivo]);
      rows.push(['Totale Ricavi d\'Esercizio', consuntivoTotals.totaleRicavi]);
      rows.push(['Totale Costi d\'Esercizio', consuntivoTotals.totaleCosti]);
      rows.push(['Avanzo / Disavanzo Netto', consuntivoTotals.avanzo]);
      rows.push([]);

      // Detail headers
      rows.push([
        'Codice',
        'Sezione',
        'Area',
        'Sotto-Area',
        'Denominazione Conto',
        'Preventivo',
        'Lug-Ott',
        'Nov',
        'Dic',
        'Gen',
        'Feb',
        'Mar',
        'Apr',
        'Mag',
        'Giu',
        'Totale Progressivo',
      ]);

      filteredConti.forEach((c) => {
        rows.push([
          c.numero_conto || '',
          c.sezione,
          c.area,
          c.sotto_area || '',
          c.nome_conto,
          Number(c.preventivo) || 0,
          Number(c.lug_ott) || 0,
          Number(c.novembre) || 0,
          Number(c.dicembre) || 0,
          Number(c.gennaio) || 0,
          Number(c.febbraio) || 0,
          Number(c.marzo) || 0,
          Number(c.aprile) || 0,
          Number(c.maggio) || 0,
          Number(c.giugno) || 0,
          Number(c.totale_progressivo) || 0,
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Consuntivo');
      XLSX.writeFile(wb, `bilancio_consuntivo_${currentEsercizioObj?.esercizio?.replace('/', '_') || 'q3'}.xlsx`);
    } catch (err) {
      alert('Errore esportazione Excel: ' + (err as Error).message);
    }
  };

  // --------------------------------------------------------------------------
  // Export Excel: Liquidità
  // --------------------------------------------------------------------------
  const exportLiquiditaExcel = async () => {
    try {
      const XLSX = await loadSheetJsBilancio();
      const rows: any[] = [];

      rows.push(['UNIVERSITÀ DELLA TERZA ETÀ DI QUARTU SANT\'ELENA APS']);
      rows.push([`PROIEZIONE FLUSSI DI CASSA E LIQUIDITÀ — ANNO ${liquiditaYear}`]);
      rows.push([`Saldo Iniziale al ${formatDate(currentLiquiditaSetting.saldo_iniziale_data)}: ${formatEuro(currentLiquiditaSetting.saldo_iniziale)}`]);
      rows.push([]);

      rows.push([
        'Periodo Fine',
        'RSA',
        'Iscrizioni',
        'Via Pizzetti',
        'LSC',
        'Eventi',
        'Totale Entrate',
        'Stipendi',
        'Docenze',
        'Ordinarie',
        'Totale Uscite',
        'Flusso Netto',
        'Saldo Progressivo',
      ]);

      liquiditaWithProgressive.rows.forEach((r) => {
        rows.push([
          r.periodo_fine,
          r.rsa,
          r.iscrizioni,
          r.via_pizzetti,
          r.lsc,
          r.eventi,
          r.totaleEntrate,
          r.stipendi,
          r.docenze,
          r.ordinarie,
          r.totaleUscite,
          r.flussoNetto,
          r.saldoProgressivo,
        ]);
      });

      rows.push([]);
      rows.push([
        'TOTALI',
        '', '', '', '', '',
        liquiditaWithProgressive.totEntrateAll,
        '', '', '',
        liquiditaWithProgressive.totUsciteAll,
        liquiditaWithProgressive.flussoNettoTotale,
        liquiditaWithProgressive.saldoFinale,
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Liquidita');
      XLSX.writeFile(wb, `liquidita_flussi_${liquiditaYear}.xlsx`);
    } catch (err) {
      alert('Errore esportazione Excel Liquidità: ' + (err as Error).message);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-28">
      {/* Intestazione Sezione */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-900/20">
              <Scale className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Bilancio & Rendiconto
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                  ETS D.M. 05/03/20
                </span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Consuntivo analitico mensile, preventivo e monitoraggio flussi di liquidità
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur border border-slate-300 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('consuntivo')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'consuntivo'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📑 Consuntivo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preventivo')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'preventivo'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📊 Preventivo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('liquidita')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'liquidita'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            💧 Liquidità
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: CONSUNTIVO                                                    */}
      {/* ==================================================================== */}
      {activeTab === 'consuntivo' && (
        <div className="space-y-6">
          {/* Controls Bar: Esercizio selector, Sezione, Ricerca, Export */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {/* Esercizio */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Esercizio:
                </span>
                <select
                  value={selectedBilancioId}
                  onChange={(e) => setSelectedBilancioId(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {bilanci.map((b) => (
                    <option key={b.id} value={b.id}>
                      Esercizio {b.esercizio} {b.esercizio === '2026/2027' ? '(In corso)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sezione */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={consuntivoSection}
                  onChange={(e) => setConsuntivoSection(e.target.value as any)}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Tutte le Sezioni</option>
                  <option value="conto_economico">Conto Economico (Ricavi / Costi)</option>
                  <option value="stato_patrimoniale">Stato Patrimoniale (Attivo / Passivo)</option>
                </select>
              </div>

              {/* Area */}
              <select
                value={consuntivoArea}
                onChange={(e) => setConsuntivoArea(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tutte le Aree</option>
                <option value="ricavi">Ricavi</option>
                <option value="costi">Costi</option>
                <option value="attivo">Attivo</option>
                <option value="passivo">Passivo</option>
              </select>
            </div>

            {/* Search + Export */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca conto o codice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={exportConsuntivoExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Totale Attivo
                </span>
                <span className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600">
                  <Layers className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {formatEuro(consuntivoTotals.totaleAttivo)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Stato Patrimoniale</div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Totale Passivo
                </span>
                <span className="p-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600">
                  <Layers className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {formatEuro(consuntivoTotals.totalePassivo)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Patrimonio netto e debiti</div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Totale Ricavi
                </span>
                <span className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatEuro(consuntivoTotals.totaleRicavi)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Prev: {formatEuro(consuntivoTotals.totalePreventivoRicavi)}
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Totale Costi
                </span>
                <span className="p-1 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600">
                  <TrendingDown className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400">
                {formatEuro(consuntivoTotals.totaleCosti)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Prev: {formatEuro(consuntivoTotals.totalePreventivoCosti)}
              </div>
            </div>

            <div className="col-span-2 lg:col-span-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Risultato Netto
                </span>
                <span
                  className={`p-1 rounded-lg ${
                    consuntivoTotals.avanzo >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                </span>
              </div>
              <div
                className={`text-lg sm:text-xl font-bold ${
                  consuntivoTotals.avanzo >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {consuntivoTotals.avanzo >= 0 ? '+' : ''}
                {formatEuro(consuntivoTotals.avanzo)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {consuntivoTotals.avanzo >= 0 ? 'Avanzo Gestionale' : 'Disavanzo Gestionale'}
              </div>
            </div>
          </div>

          {/* Accounts Table by Area */}
          <div className="space-y-6">
            {Object.keys(groupedContiByArea).length === 0 ? (
              <div className="bg-white/60 dark:bg-slate-900/60 rounded-2xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800">
                Nessun conto corrisponde ai filtri selezionati.
              </div>
            ) : (
              Object.entries(groupedContiByArea).map(([groupTitle, conti]) => {
                const subtotalProgressivo = conti.reduce((acc, c) => acc + (Number(c.totale_progressivo) || 0), 0);
                const subtotalPreventivo = conti.reduce((acc, c) => acc + (Number(c.preventivo) || 0), 0);

                return (
                  <div
                    key={groupTitle}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                  >
                    {/* Group Header */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 tracking-wide uppercase">
                        {groupTitle}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="text-slate-500">
                          Preventivo: <strong className="text-slate-800 dark:text-slate-200">{formatEuro(subtotalPreventivo)}</strong>
                        </span>
                        <span className="text-slate-500">
                          Progressivo: <strong className="text-emerald-600 dark:text-emerald-400">{formatEuro(subtotalProgressivo)}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-2.5 px-3 font-semibold w-24">Codice</th>
                            <th className="py-2.5 px-3 font-semibold min-w-[200px]">Conto / Descrizione</th>
                            <th className="py-2.5 px-3 font-semibold text-right min-w-[100px]">Preventivo</th>
                            {MONTH_COLUMNS.map((m) => (
                              <th key={m.key} className="py-2.5 px-2 font-semibold text-right min-w-[80px]">
                                {m.shortLabel}
                              </th>
                            ))}
                            <th className="py-2.5 px-3 font-semibold text-right min-w-[110px] bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                              Progressivo
                            </th>
                            {canEdit && (
                              <th className="py-2.5 px-2 font-semibold text-center w-14">Azione</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                          {conti.map((c) => {
                            const prog = Number(c.totale_progressivo) || 0;
                            const hasValues = prog > 0 || (Number(c.preventivo) || 0) > 0;

                            return (
                              <tr
                                key={c.id}
                                className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                                  !hasValues ? 'opacity-60' : ''
                                }`}
                              >
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                  {c.numero_conto || '-'}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                  {c.nome_conto}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.preventivo) ? formatEuro(c.preventivo) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.lug_ott) ? formatEuro(c.lug_ott) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.novembre) ? formatEuro(c.novembre) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.dicembre) ? formatEuro(c.dicembre) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.gennaio) ? formatEuro(c.gennaio) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.febbraio) ? formatEuro(c.febbraio) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.marzo) ? formatEuro(c.marzo) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.aprile) ? formatEuro(c.aprile) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.maggio) ? formatEuro(c.maggio) : '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                  {Number(c.giugno) ? formatEuro(c.giugno) : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold bg-emerald-50/30 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-300">
                                  {prog ? formatEuro(prog) : '-'}
                                </td>
                                {canEdit && (
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setEditingConto({ ...c })}
                                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-emerald-600 transition"
                                      title="Modifica importi mensili"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: PREVENTIVO                                                    */}
      {/* ==================================================================== */}
      {activeTab === 'preventivo' && (
        <div className="space-y-6">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Anno di Riferimento:</span>
              <select
                value={preventivoYear}
                onChange={(e) => setPreventivoYear(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={2026}>Anno 2026 / 2027</option>
                <option value={2025}>Anno 2025 / 2026</option>
              </select>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtra conti preventivo..."
                value={preventivoSearch}
                onChange={(e) => setPreventivoSearch(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* KPI Preventivo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Totale Anno Precedente</span>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                {formatEuro(preventivoTotals.totPrec)}
              </div>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Totale Previsione Anno in Corso</span>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatEuro(preventivoTotals.totPrev)}
              </div>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Differenza Assoluta</span>
              <div
                className={`text-xl font-bold mt-1 ${
                  preventivoTotals.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {preventivoTotals.diff >= 0 ? '+' : ''}
                {formatEuro(preventivoTotals.diff)}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3 font-semibold w-24">Codice</th>
                    <th className="py-2.5 px-3 font-semibold">Descrizione Conto</th>
                    <th className="py-2.5 px-3 font-semibold">Area / Sezione</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Anno Precedente</th>
                    <th className="py-2.5 px-3 font-semibold text-right bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                      Previsione {preventivoYear}
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">Variazione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredPreventivo.map((r) => {
                    const diff = (Number(r.previsione) || 0) - (Number(r.anno_precedente) || 0);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{r.numero_conto || '-'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{r.nome_conto}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {r.sezione} • {r.area}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {Number(r.anno_precedente) ? formatEuro(r.anno_precedente) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold bg-emerald-50/30 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-300">
                          {Number(r.previsione) ? formatEuro(r.previsione) : '-'}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-semibold ${
                            diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}
                        >
                          {diff !== 0 ? (diff > 0 ? `+${formatEuro(diff)}` : formatEuro(diff)) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: LIQUIDITÀ                                                     */}
      {/* ==================================================================== */}
      {activeTab === 'liquidita' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Anno:</span>
              <select
                value={liquiditaYear}
                onChange={(e) => setLiquiditaYear(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={2026}>Anno 2026 / 2027</option>
                <option value={2025}>Anno 2025 / 2026</option>
              </select>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditingSetting({ ...currentLiquiditaSetting })}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  Imposta Saldo Iniziale
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportLiquiditaExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel</span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingRiga(true);
                    setEditingRiga({
                      id: 'new_' + Date.now(),
                      anno: liquiditaYear,
                      periodo_fine: new Date().toISOString().slice(0, 10),
                      rsa: 0,
                      iscrizioni: 0,
                      via_pizzetti: 0,
                      lsc: 0,
                      eventi: 0,
                      stipendi: 0,
                      docenze: 0,
                      ordinarie: 0,
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuovo Periodo</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Liquidità */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Saldo Iniziale</span>
              <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
                {formatEuro(currentLiquiditaSetting.saldo_iniziale)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Al {formatDate(currentLiquiditaSetting.saldo_iniziale_data)}
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Totale Entrate di Cassa</span>
              <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatEuro(liquiditaWithProgressive.totEntrateAll)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">RSA, Iscrizioni, LSC, Eventi</div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Totale Uscite di Cassa</span>
              <div className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                -{formatEuro(liquiditaWithProgressive.totUsciteAll)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Docenze, Stipendi, Ordinarie</div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Saldo Finale Attuale</span>
              <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {formatEuro(liquiditaWithProgressive.saldoFinale)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Disponibilità liquida complessiva</div>
            </div>
          </div>

          {/* Liquidità Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3 font-semibold">Periodo Fine</th>
                    <th className="py-2.5 px-2 font-semibold text-right">RSA</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Iscrizioni</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Via Pizzetti</th>
                    <th className="py-2.5 px-2 font-semibold text-right">LSC</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Eventi</th>
                    <th className="py-2.5 px-3 font-semibold text-right text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                      Tot. Entrate
                    </th>
                    <th className="py-2.5 px-2 font-semibold text-right">Stipendi</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Docenze</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Ordinarie</th>
                    <th className="py-2.5 px-3 font-semibold text-right text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20">
                      Tot. Uscite
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">Flusso Periodo</th>
                    <th className="py-2.5 px-3 font-semibold text-right bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold">
                      Saldo Progressivo
                    </th>
                    {canEdit && <th className="py-2.5 px-2 font-semibold text-center w-20">Azioni</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {liquiditaWithProgressive.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {formatDate(r.periodo_fine)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(r.rsa) ? formatEuro(r.rsa) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(r.iscrizioni) ? formatEuro(r.iscrizioni) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(r.via_pizzetti) ? formatEuro(r.via_pizzetti) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(r.lsc) ? formatEuro(r.lsc) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(r.eventi) ? formatEuro(r.eventi) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                        {formatEuro(r.totaleEntrate)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(r.stipendi) ? formatEuro(r.stipendi) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(r.docenze) ? formatEuro(r.docenze) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(r.ordinarie) ? formatEuro(r.ordinarie) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">
                        {formatEuro(r.totaleUscite)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold ${
                          r.flussoNetto >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {r.flussoNetto >= 0 ? '+' : ''}
                        {formatEuro(r.flussoNetto)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white">
                        {formatEuro(r.saldoProgressivo)}
                      </td>
                      {canEdit && (
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRiga({ ...r });
                                setIsAddingRiga(false);
                              }}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-emerald-600"
                              title="Modifica riga"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(r.id)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-rose-600"
                              title="Elimina riga"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: MODIFICA CONTO CONSUNTIVO                                      */}
      {/* ==================================================================== */}
      {editingConto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingConto(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Modifica Importi Conto
                </h3>
                <p className="text-xs text-slate-500">
                  {editingConto.numero_conto} — {editingConto.nome_conto}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveConto} className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Sezione: <strong>{editingConto.sezione}</strong> • Area: <strong>{editingConto.area}</strong>
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Totale Progressivo:{' '}
                  {formatEuro(calcContoProgressivo(editingConto))}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Budget Preventivo (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingConto.preventivo || ''}
                  onChange={(e) =>
                    setEditingConto({ ...editingConto, preventivo: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MONTH_COLUMNS.map((col) => (
                  <div key={col.key}>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {col.label} (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={(editingConto as any)[col.key] || ''}
                      onChange={(e) =>
                        setEditingConto({
                          ...editingConto,
                          [col.key]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingConto(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Save className="w-4 h-4" />
                  Salva Importi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: NUOVA / MODIFICA RIGA LIQUIDITÀ                                */}
      {/* ==================================================================== */}
      {editingRiga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => {
                setEditingRiga(null);
                setIsAddingRiga(false);
              }}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {isAddingRiga ? 'Nuovo Periodo Liquidità' : 'Modifica Periodo Liquidità'}
            </h3>

            <form onSubmit={handleSaveRiga} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data Fine Periodo
                </label>
                <input
                  type="date"
                  required
                  value={editingRiga.periodo_fine || ''}
                  onChange={(e) => setEditingRiga({ ...editingRiga, periodo_fine: e.target.value })}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                  Entrate (€)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">RSA</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRiga.rsa || ''}
                      onChange={(e) => setEditingRiga({ ...editingRiga, rsa: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Iscrizioni</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRiga.iscrizioni || ''}
                      onChange={(e) =>
                        setEditingRiga({ ...editingRiga, iscrizioni: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Via Pizzetti</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRiga.via_pizzetti || ''}
                      onChange={(e) =>
                        setEditingRiga({ ...editingRiga, via_pizzetti: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">LSC (Lezioni sul Campo)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRiga.lsc || ''}
                      onChange={(e) => setEditingRiga({ ...editingRiga, lsc: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-0.5">Eventi / Altro</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRiga.eventi || ''}
                      onChange={(e) =>
                        setEditingRiga({ ...editingRiga, eventi: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-2">
                  Uscite (€)
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Stipendi</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRiga.stipendi || ''}
                      onChange={(e) =>
                        setEditingRiga({ ...editingRiga, stipendi: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Docenze</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRiga.docenze || ''}
                      onChange={(e) =>
                        setEditingRiga({ ...editingRiga, docenze: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Ordinarie</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRiga.ordinarie || ''}
                      onChange={(e) =>
                        setEditingRiga({ ...editingRiga, ordinarie: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRiga(null);
                    setIsAddingRiga(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Save className="w-4 h-4" />
                  Salva Riga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: IMPOSTAZIONI SALDO INIZIALE LIQUIDITÀ                         */}
      {/* ==================================================================== */}
      {editingSetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingSetting(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Impostazione Saldo Iniziale Liquidità
            </h3>

            <form onSubmit={handleSaveSetting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data di Partenza Saldo
                </label>
                <input
                  type="date"
                  value={editingSetting.saldo_iniziale_data || ''}
                  onChange={(e) =>
                    setEditingSetting({ ...editingSetting, saldo_iniziale_data: e.target.value })
                  }
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Saldo Iniziale Banca / Cassa (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingSetting.saldo_iniziale || ''}
                  onChange={(e) =>
                    setEditingSetting({
                      ...editingSetting,
                      saldo_iniziale: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Totale Fondo Lavori / Straordinari (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingSetting.totale_lavori || ''}
                  onChange={(e) =>
                    setEditingSetting({
                      ...editingSetting,
                      totale_lavori: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSetting(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                >
                  <Save className="w-4 h-4" />
                  Salva Saldo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation modal for delete */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h4 className="font-bold text-base text-slate-900 dark:text-white mb-2">
              Conferma Eliminazione
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Sei sicuro di voler eliminare questa riga di flussi di cassa? L&apos;operazione aggiornerà i progressivi.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRiga(deleteConfirmId)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
