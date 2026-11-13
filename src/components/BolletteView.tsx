import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Plus,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Printer,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Save,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ElectricBill,
  calculateElectricBillSplit,
  SplitResult,
} from '../data/bolletteData';
import {
  getAcademicYear,
  getCurrentAcademicYear,
  formatAcademicYear,
  getAvailableAcademicYears,
} from '../utils/academicYear';

declare global {
  interface Window {
    XLSX?: any;
    jspdf?: any;
  }
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatKwh(val: number): string {
  return new Intl.NumberFormat('it-IT', {
    maximumFractionDigits: 1,
  }).format(val || 0) + ' kWh';
}

function formatMonthLabel(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatMonthShort(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('it-IT', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const BolletteView: React.FC = () => {
  const {
    electricBills,
    saveElectricBill,
    deleteElectricBill,
    getUserSectionPermission,
    isSuperAdmin,
  } = useApp();

  const permission = getUserSectionPermission('bollette');
  const canEdit = isSuperAdmin || permission === 'edit';

  const currentAA = useMemo(() => getCurrentAcademicYear(), []);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(currentAA);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal stato creazione / modifica
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<ElectricBill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Campi form
  const [formMonthDate, setFormMonthDate] = useState('');
  const [formConsumoFattura, setFormConsumoFattura] = useState<number>(0);
  const [formConsumoQu3, setFormConsumoQu3] = useState<number>(0);
  const [formKwF1, setFormKwF1] = useState<number>(0);
  const [formKwF2, setFormKwF2] = useState<number>(0);
  const [formKwF3, setFormKwF3] = useState<number>(0);

  // Componenti costo
  const [formQfissaComm, setFormQfissaComm] = useState<number>(0);
  const [formQenergiaF0, setFormQenergiaF0] = useState<number>(0);
  const [formMaggiorPrezzo, setFormMaggiorPrezzo] = useState<number>(0);
  const [formCorrVendita, setFormCorrVendita] = useState<number>(0);
  const [formOneriDisp, setFormOneriDisp] = useState<number>(0);
  const [formPerditeRete, setFormPerditeRete] = useState<number>(0);
  const [formCapacitaPicco, setFormCapacitaPicco] = useState<number>(0);
  const [formCorrCapacita, setFormCorrCapacita] = useState<number>(0);
  const [formQfissaRete, setFormQfissaRete] = useState<number>(0);
  const [formQpotenzaRete, setFormQpotenzaRete] = useState<number>(0);
  const [formQenergiaRete, setFormQenergiaRete] = useState<number>(0);
  const [formAsosQfissa, setFormAsosQfissa] = useState<number>(0);
  const [formArimQfissa, setFormArimQfissa] = useState<number>(0);
  const [formAsosQenergia, setFormAsosQenergia] = useState<number>(0);
  const [formArimQenergia, setFormArimQenergia] = useState<number>(0);
  const [formAsosQpotenza, setFormAsosQpotenza] = useState<number>(0);
  const [formArimQpotenza, setFormArimQpotenza] = useState<number>(0);
  const [formReattivaF3, setFormReattivaF3] = useState<number>(0);
  const [formAccise, setFormAccise] = useState<number>(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Caricamento script esterni per Excel e PDF
  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.async = true;
      document.head.appendChild(script);
    }
    if (!window.jspdf) {
      const scriptPdf = document.createElement('script');
      scriptPdf.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      scriptPdf.async = true;
      scriptPdf.onload = () => {
        const scriptAutoTable = document.createElement('script');
        scriptAutoTable.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        scriptAutoTable.async = true;
        document.head.appendChild(scriptAutoTable);
      };
      document.head.appendChild(scriptPdf);
    }
  }, []);

  // Anni accademici disponibili
  const availableAcademicYears = useMemo(() => {
    const dates = electricBills.map((b) => b.month_date);
    return getAvailableAcademicYears(dates, true);
  }, [electricBills]);

  const countByAcademicYear = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of electricBills) {
      const aa = getAcademicYear(b.month_date);
      map[aa] = (map[aa] || 0) + 1;
    }
    return map;
  }, [electricBills]);

  // Bollette filtrate per Anno Accademico
  const aaScopedBills = useMemo(() => {
    if (selectedAcademicYear === 'all') return electricBills;
    return electricBills.filter((b) => getAcademicYear(b.month_date) === selectedAcademicYear);
  }, [electricBills, selectedAcademicYear]);

  // Bollette filtrate per ricerca
  const filteredBills = useMemo(() => {
    return aaScopedBills
      .filter((b) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const mLabel = formatMonthLabel(b.month_date).toLowerCase();
        return b.month_date.includes(q) || mLabel.includes(q);
      })
      .sort((a, b) => (b.month_date || '').localeCompare(a.month_date || ''));
  }, [aaScopedBills, searchQuery]);

  // Statistiche riepilogative periodo
  const aaSummaryStats = useMemo(() => {
    let totFatture = 0;
    let totQu3 = 0;
    let totAlveas = 0;
    let totKwhFattura = 0;
    let totKwhQu3 = 0;

    for (const bill of aaScopedBills) {
      const split = calculateElectricBillSplit(bill);
      const effTot = bill.totale_bolletta || split.totaleBolletta;
      const effQu3 = bill.importo_qu3 || split.importoQu3;
      const effAlveas = bill.importo_alveas || split.importoAlveas;

      totFatture += effTot;
      totQu3 += effQu3;
      totAlveas += effAlveas;
      totKwhFattura += Number(bill.consumo_fattura || 0);
      totKwhQu3 += Number(bill.consumo_qu3_kw || 0);
    }

    return {
      count: aaScopedBills.length,
      totFatture: Math.round(totFatture * 100) / 100,
      totQu3: Math.round(totQu3 * 100) / 100,
      totAlveas: Math.round(totAlveas * 100) / 100,
      totKwhFattura: Math.round(totKwhFattura * 10) / 10,
      totKwhQu3: Math.round(totKwhQu3 * 10) / 10,
      percQu3: totFatture > 0 ? Math.round((totQu3 / totFatture) * 100) : 0,
      percAlveas: totFatture > 0 ? Math.round((totAlveas / totFatture) * 100) : 0,
    };
  }, [aaScopedBills]);

  // Calcolo dinamico nel form di inserimento/modifica
  const liveFormSplit: SplitResult = useMemo(() => {
    return calculateElectricBillSplit({
      consumo_fattura: Number(formConsumoFattura) || 0,
      consumo_qu3_kw: Number(formConsumoQu3) || 0,
      kw_f1: Number(formKwF1) || 0,
      kw_f2: Number(formKwF2) || 0,
      kw_f3: Number(formKwF3) || 0,
      quota_fissa_commercializzazione: Number(formQfissaComm) || 0,
      quota_energia_f0: Number(formQenergiaF0) || 0,
      maggior_prezzo_energia: Number(formMaggiorPrezzo) || 0,
      corrispettivo_servizio_vendita: Number(formCorrVendita) || 0,
      oneri_dispacciamento: Number(formOneriDisp) || 0,
      perdite_rete: Number(formPerditeRete) || 0,
      capacita_picco: Number(formCapacitaPicco) || 0,
      corrispettivo_capacita: Number(formCorrCapacita) || 0,
      quota_fissa_rete: Number(formQfissaRete) || 0,
      quota_potenza_rete: Number(formQpotenzaRete) || 0,
      quota_energia_rete: Number(formQenergiaRete) || 0,
      asos_quota_fissa: Number(formAsosQfissa) || 0,
      arim_quota_fissa: Number(formArimQfissa) || 0,
      asos_quota_energia: Number(formAsosQenergia) || 0,
      arim_quota_energia: Number(formArimQenergia) || 0,
      asos_quota_potenza: Number(formAsosQpotenza) || 0,
      arim_quota_potenza: Number(formArimQpotenza) || 0,
      reattiva_f3_capacitiva: Number(formReattivaF3) || 0,
      accise_imposta_erariale: Number(formAccise) || 0,
    });
  }, [
    formConsumoFattura, formConsumoQu3, formKwF1, formKwF2, formKwF3,
    formQfissaComm, formQenergiaF0, formMaggiorPrezzo, formCorrVendita, formOneriDisp,
    formPerditeRete, formCapacitaPicco, formCorrCapacita, formQfissaRete, formQpotenzaRete,
    formQenergiaRete, formAsosQfissa, formArimQfissa, formAsosQenergia, formArimQenergia,
    formAsosQpotenza, formArimQpotenza, formReattivaF3, formAccise
  ]);

  const resetForm = () => {
    setEditingBill(null);
    setFormMonthDate(new Date().toISOString().slice(0, 10));
    setFormConsumoFattura(0);
    setFormConsumoQu3(0);
    setFormKwF1(0);
    setFormKwF2(0);
    setFormKwF3(0);
    setFormQfissaComm(0);
    setFormQenergiaF0(0);
    setFormMaggiorPrezzo(0);
    setFormCorrVendita(0);
    setFormOneriDisp(0);
    setFormPerditeRete(0);
    setFormCapacitaPicco(0);
    setFormCorrCapacita(0);
    setFormQfissaRete(0);
    setFormQpotenzaRete(0);
    setFormQenergiaRete(0);
    setFormAsosQfissa(0);
    setFormArimQfissa(0);
    setFormAsosQenergia(0);
    setFormArimQenergia(0);
    setFormAsosQpotenza(0);
    setFormArimQpotenza(0);
    setFormReattivaF3(0);
    setFormAccise(0);
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (b: ElectricBill) => {
    setEditingBill(b);
    setFormMonthDate(b.month_date);
    setFormConsumoFattura(b.consumo_fattura || 0);
    setFormConsumoQu3(b.consumo_qu3_kw || 0);
    setFormKwF1(b.kw_f1 || 0);
    setFormKwF2(b.kw_f2 || 0);
    setFormKwF3(b.kw_f3 || 0);
    setFormQfissaComm(b.quota_fissa_commercializzazione || 0);
    setFormQenergiaF0(b.quota_energia_f0 || 0);
    setFormMaggiorPrezzo(b.maggior_prezzo_energia || 0);
    setFormCorrVendita(b.corrispettivo_servizio_vendita || 0);
    setFormOneriDisp(b.oneri_dispacciamento || 0);
    setFormPerditeRete(b.perdite_rete || 0);
    setFormCapacitaPicco(b.capacita_picco || 0);
    setFormCorrCapacita(b.corrispettivo_capacita || 0);
    setFormQfissaRete(b.quota_fissa_rete || 0);
    setFormQpotenzaRete(b.quota_potenza_rete || 0);
    setFormQenergiaRete(b.quota_energia_rete || 0);
    setFormAsosQfissa(b.asos_quota_fissa || 0);
    setFormArimQfissa(b.arim_quota_fissa || 0);
    setFormAsosQenergia(b.asos_quota_energia || 0);
    setFormArimQenergia(b.arim_quota_energia || 0);
    setFormAsosQpotenza(b.asos_quota_potenza || 0);
    setFormArimQpotenza(b.arim_quota_potenza || 0);
    setFormReattivaF3(b.reattiva_f3_capacitiva || 0);
    setFormAccise(b.accise_imposta_erariale || 0);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMonthDate) {
      showToast('Inserisci il mese di riferimento.');
      return;
    }

    const payload: Partial<ElectricBill> = {
      id: editingBill ? editingBill.id : `bill-${Date.now()}`,
      month_date: formMonthDate,
      month_end_date: formMonthDate,
      consumo_fattura: Number(formConsumoFattura),
      consumo_qu3_kw: Number(formConsumoQu3),
      kw_f1: Number(formKwF1),
      kw_f2: Number(formKwF2),
      kw_f3: Number(formKwF3),
      quota_fissa_commercializzazione: Number(formQfissaComm),
      quota_energia_f0: Number(formQenergiaF0),
      maggior_prezzo_energia: Number(formMaggiorPrezzo),
      corrispettivo_servizio_vendita: Number(formCorrVendita),
      oneri_dispacciamento: Number(formOneriDisp),
      perdite_rete: Number(formPerditeRete),
      capacita_picco: Number(formCapacitaPicco),
      corrispettivo_capacita: Number(formCorrCapacita),
      quota_fissa_rete: Number(formQfissaRete),
      quota_potenza_rete: Number(formQpotenzaRete),
      quota_energia_rete: Number(formQenergiaRete),
      asos_quota_fissa: Number(formAsosQfissa),
      arim_quota_fissa: Number(formArimQfissa),
      asos_quota_energia: Number(formAsosQenergia),
      arim_quota_energia: Number(formArimQenergia),
      asos_quota_potenza: Number(formAsosQpotenza),
      arim_quota_potenza: Number(formArimQpotenza),
      reattiva_f3_capacitiva: Number(formReattivaF3),
      accise_imposta_erariale: Number(formAccise),
      importo_alveas: liveFormSplit.importoAlveas,
      importo_qu3: liveFormSplit.importoQu3,
      totale_bolletta: liveFormSplit.totaleBolletta,
    };

    await saveElectricBill(payload);
    setIsModalOpen(false);
    showToast(editingBill ? 'Bolletta aggiornata con successo!' : 'Nuova bolletta salvata!');
  };

  const handleDelete = async (id: string) => {
    await deleteElectricBill(id);
    setDeletingId(null);
    showToast('Bolletta eliminata.');
  };

  // Esportazione Excel
  const handleExportExcel = () => {
    if (!window.XLSX) {
      alert('Libreria Excel in caricamento, riprova tra qualche istante.');
      return;
    }
    const wb = window.XLSX.utils.book_new();

    const data = aaScopedBills.map((b) => {
      const split = calculateElectricBillSplit(b);
      return {
        Mese: formatMonthLabel(b.month_date),
        'Anno Accademico': `A.A. ${getAcademicYear(b.month_date)}`,
        'Totale Fattura (€)': b.totale_bolletta || split.totaleBolletta,
        'Quota Qu3 (€)': b.importo_qu3 || split.importoQu3,
        'Quota Alveas (€)': b.importo_alveas || split.importoAlveas,
        'Consumo Qu3 (kWh)': b.consumo_qu3_kw || 0,
        'Consumo Totale (kWh)': b.consumo_fattura || (b.kw_f1 + b.kw_f2 + b.kw_f3) || 0,
        'F1 (kWh)': b.kw_f1 || 0,
        'F2 (kWh)': b.kw_f2 || 0,
        'F3 (kWh)': b.kw_f3 || 0,
        'Imponibile Qu3 (€)': split.imponibileQu3,
        'IVA Qu3 (€)': split.ivaQu3,
        'Imponibile Alveas (€)': split.imponibileAlveas,
        'IVA Alveas (€)': split.ivaAlveas,
      };
    });

    const ws = window.XLSX.utils.json_to_sheet(data);
    window.XLSX.utils.book_append_sheet(wb, ws, 'Ripartizione Bollette');

    const aaSlug = selectedAcademicYear === 'all' ? 'tutti_gli_anni' : `AA_${selectedAcademicYear.replace('/', '_')}`;
    const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    window.XLSX.writeFile(wb, `bollette_elettriche_${aaSlug}_${dateSuffix}.xlsx`);
    showToast('Report Excel esportato con successo!');
  };

  // Esportazione PDF Ufficiale di Ripartizione per una Bolletta
  const handleExportSingleBillPdf = (bill: ElectricBill) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Libreria PDF in caricamento, riprova tra qualche istante.');
      return;
    }

    const doc = new window.jspdf.jsPDF();
    const split = calculateElectricBillSplit(bill);
    const monthName = formatMonthLabel(bill.month_date);

    // Intestazione
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(6, 78, 59);
    doc.text('Università della Terza Età di Quartu Sant\'Elena APS', 14, 15);

    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(`Prospetto Ripartizione Spese Energetiche — Sede`, 14, 23);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Periodo di Competenza: ${monthName} (A.A. ${getAcademicYear(bill.month_date)}) · Ripartizione tra ALVEAS e QU3`,
      14,
      29
    );

    // Tabella Consumi e Ripartizione
    const head = [['Voce di Costo / Tariffa', 'Fattura Totale (€)', 'Quota Alveas (€)', 'Quota Qu3 (€)']];
    const body = split.details.map((d) => [
      d.label,
      formatEuro(d.totale),
      formatEuro(d.alveas),
      formatEuro(d.qu3),
    ]);

    body.push(
      ['Totale Imponibile', formatEuro(split.totaleImponibile), formatEuro(split.imponibileAlveas), formatEuro(split.imponibileQu3)],
      ['IVA 22%', formatEuro(split.totaleIva), formatEuro(split.ivaAlveas), formatEuro(split.ivaQu3)],
      ['TOTALE BOLLETTA', formatEuro(split.totaleBolletta), formatEuro(split.importoAlveas), formatEuro(split.importoQu3)]
    );

    (doc as any).autoTable({
      startY: 34,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Riquadro Firme
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text(`Quartu Sant'Elena, lì ${new Date().toLocaleDateString('it-IT')}`, 14, finalY);

    doc.text('Firma per Alveas: ___________________________', 14, finalY + 12);
    doc.text('Firma per Qu3 APS: ___________________________', 120, finalY + 12);

    doc.save(`Ripartizione_Bolletta_${monthName.replace(/\s+/g, '_')}.pdf`);
    showToast(`PDF generato per ${monthName}!`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900 text-white px-5 py-3 shadow-2xl flex items-center gap-3 text-sm animate-bounce">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. TESTATA PRINCIPALE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
            <Zap className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Bollette e Consumi Elettrici
            </h1>
            <p className="text-sm text-slate-500">
              Ripartizione spese energetiche della Sede tra Alveas e Qu3 (sub-contatore kWh)
            </p>
          </div>
        </div>

        {/* Pulsanti Azione in alto */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-95 shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Esporta Excel</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-95 shadow-md"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Nuova Bolletta</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. SELETTORE ANNO ACCADEMICO */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white p-4 sm:p-5 rounded-3xl shadow-md border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span>Filtro Anno Accademico</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            Ogni anno accademico decorre dal <strong>1° Luglio</strong> al <strong>30 Giugno</strong> dell&apos;anno successivo.
          </p>
        </div>

        {/* Pulsanti Rapidi Anno Accademico */}
        <div className="flex items-center gap-2 flex-wrap">
          {availableAcademicYears.map((ay) => {
            const isCurrent = ay === currentAA;
            const isSelected = selectedAcademicYear === ay;
            const count = countByAcademicYear[ay] || 0;
            return (
              <button
                key={ay}
                type="button"
                onClick={() => setSelectedAcademicYear(ay)}
                className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-300'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
              >
                <span>A.A. {ay}</span>
                {isCurrent && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-400 text-emerald-950'
                    }`}
                  >
                    In corso
                  </span>
                )}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-emerald-600/50 text-slate-950' : 'bg-white/20 text-white'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedAcademicYear('all')}
            className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              selectedAcademicYear === 'all'
                ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-300'
                : 'bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10'
            }`}
          >
            <span>Tutti gli Anni</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                selectedAcademicYear === 'all' ? 'bg-emerald-600/50 text-slate-950' : 'bg-white/20 text-white'
              }`}
            >
              {electricBills.length}
            </span>
          </button>
        </div>
      </div>

      {/* 3. QUADRO ECONOMICO E PERCENTUALI DI RIPARTIZIONE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Box 1: Spesa Totale Fatture */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Spesa Elettrica Totale
          </span>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {formatEuro(aaSummaryStats.totFatture)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {aaSummaryStats.count} bollette · {formatKwh(aaSummaryStats.totKwhFattura)}
            </p>
          </div>
        </div>

        {/* Box 2: Quota Qu3 */}
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            Quota di Carico Qu3
          </span>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-900">
              {formatEuro(aaSummaryStats.totQu3)}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5 font-medium">
              {aaSummaryStats.percQu3}% del totale · {formatKwh(aaSummaryStats.totKwhQu3)}
            </p>
          </div>
        </div>

        {/* Box 3: Quota Alveas */}
        <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
            Quota di Carico Alveas
          </span>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-extrabold text-sky-900">
              {formatEuro(aaSummaryStats.totAlveas)}
            </p>
            <p className="text-xs text-sky-700 mt-0.5 font-medium">
              {aaSummaryStats.percAlveas}% del totale
            </p>
          </div>
        </div>

        {/* Box 4: Rapporto Consumi */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Sub-contatore Qu3
          </span>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {formatKwh(aaSummaryStats.totKwhQu3)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              su {formatKwh(aaSummaryStats.totKwhFattura)} complessivi
            </p>
          </div>
        </div>
      </div>

      {/* 4. BARRA DI RICERCA */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per mese, anno (es. Maggio, 2026)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>
        <span className="text-xs text-slate-500 hidden sm:inline">
          {filteredBills.length} bollette trovate
        </span>
      </div>

      {/* 5. ELENCO SCHEDE BOLLETTE */}
      <div className="space-y-3">
        {filteredBills.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Nessuna bolletta trovata per i criteri selezionati.
          </div>
        ) : (
          filteredBills.map((bill) => {
            const isExpanded = expandedId === bill.id;
            const split = calculateElectricBillSplit(bill);
            const effTot = bill.totale_bolletta || split.totaleBolletta;
            const effQu3 = bill.importo_qu3 || split.importoQu3;
            const effAlveas = bill.importo_alveas || split.importoAlveas;

            return (
              <div
                key={bill.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition overflow-hidden"
              >
                {/* Header card cliccabile */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : bill.id)}
                  className="p-4 sm:p-5 flex items-start justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 capitalize">
                        {formatMonthLabel(bill.month_date)}
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        A.A. {getAcademicYear(bill.month_date)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5 text-xs text-slate-600 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        Qu3: <strong className="text-emerald-800">{formatKwh(bill.consumo_qu3_kw)}</strong>
                      </span>
                      <span>
                        Fattura: <strong className="text-slate-800">{formatKwh(bill.consumo_fattura)}</strong>
                      </span>
                      <span className="text-slate-400">
                        (F1: {bill.kw_f1} · F2: {bill.kw_f2} · F3: {bill.kw_f3})
                      </span>
                    </div>
                  </div>

                  {/* Risultato sintetico quote */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-medium">Totale Fattura</p>
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {formatEuro(effTot)}
                      </p>
                    </div>

                    <div className="text-right bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        Quota Qu3
                      </p>
                      <p className="text-sm sm:text-base font-extrabold text-emerald-700">
                        {formatEuro(effQu3)}
                      </p>
                    </div>

                    <div className="text-right bg-sky-50 border border-sky-200 rounded-xl px-3 py-1.5 hidden md:block">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
                        Quota Alveas
                      </p>
                      <p className="text-sm sm:text-base font-extrabold text-sky-700">
                        {formatEuro(effAlveas)}
                      </p>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Dettaglio Espandibile */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
                    {/* Pulsanti azioni rapide */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportSingleBillPdf(bill)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
                        >
                          <Printer className="h-3.5 w-3.5 text-rose-600" />
                          <span>Stampa Prospetto PDF</span>
                        </button>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(bill)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-emerald-700" />
                            <span>Modifica</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(bill.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold shadow-xs transition"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                            <span>Elimina</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Tabella analitica delle componenti */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Componente di Spesa</th>
                            <th className="p-2.5 text-center">Criterio Ripartizione</th>
                            <th className="p-2.5 text-right">Totale Fattura (€)</th>
                            <th className="p-2.5 text-right text-sky-800 bg-sky-50/50">Alveas (€)</th>
                            <th className="p-2.5 text-right text-emerald-800 bg-emerald-50/50">Qu3 (€)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {split.details.map((d, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-sans text-slate-800">{d.label}</td>
                              <td className="p-2 text-center font-sans">
                                {d.type === 'fissa_50_50' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                    50% / 50%
                                  </span>
                                )}
                                {d.type === 'energia_kwh' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                    Proporzionale kWh
                                  </span>
                                )}
                                {d.type === 'alveas_100' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">
                                    100% Alveas
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-right">{formatEuro(d.totale)}</td>
                              <td className="p-2 text-right text-sky-700 bg-sky-50/30">{formatEuro(d.alveas)}</td>
                              <td className="p-2 text-right text-emerald-700 bg-emerald-50/30 font-semibold">{formatEuro(d.qu3)}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100/80 font-bold text-slate-900 border-t border-slate-200">
                            <td className="p-2.5 font-sans" colSpan={2}>Subtotale Imponibile</td>
                            <td className="p-2.5 text-right">{formatEuro(split.totaleImponibile)}</td>
                            <td className="p-2.5 text-right text-sky-800 bg-sky-50">{formatEuro(split.imponibileAlveas)}</td>
                            <td className="p-2.5 text-right text-emerald-800 bg-emerald-50">{formatEuro(split.imponibileQu3)}</td>
                          </tr>
                          <tr className="bg-slate-100/80 font-bold text-slate-900">
                            <td className="p-2.5 font-sans" colSpan={2}>IVA 22%</td>
                            <td className="p-2.5 text-right">{formatEuro(split.totaleIva)}</td>
                            <td className="p-2.5 text-right text-sky-800 bg-sky-50">{formatEuro(split.ivaAlveas)}</td>
                            <td className="p-2.5 text-right text-emerald-800 bg-emerald-50">{formatEuro(split.ivaQu3)}</td>
                          </tr>
                          <tr className="bg-emerald-900 text-white font-extrabold text-xs sm:text-sm">
                            <td className="p-3 font-sans" colSpan={2}>TOTALE GENERALE COMPETENZA</td>
                            <td className="p-3 text-right">{formatEuro(split.totaleBolletta)}</td>
                            <td className="p-3 text-right bg-emerald-950 text-sky-300">{formatEuro(split.importoAlveas)}</td>
                            <td className="p-3 text-right bg-emerald-950 text-emerald-300">{formatEuro(split.importoQu3)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 6. MODALE ELIMINAZIONE */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold">Conferma Eliminazione</h3>
            </div>
            <p className="text-sm text-slate-600">
              Sei sicuro di voler eliminare questa bolletta? L&apos;azione è irreversibile.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                Elimina Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODALE NUOVA / MODIFICA BOLLETTA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto my-auto animate-scaleUp">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {editingBill ? 'Modifica Bolletta Energetica' : 'Nuova Bolletta Energetica'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
              {/* Dati Generali & Consumi kWh */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  1. Periodo e Letture Consumo (kWh)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mese di Riferimento *
                    </label>
                    <input
                      type="date"
                      required
                      value={formMonthDate}
                      onChange={(e) => setFormMonthDate(e.target.value)}
                      className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Consumo Sub-contatore Qu3 (kWh) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={formConsumoQu3 || ''}
                      onChange={(e) => setFormConsumoQu3(Number(e.target.value))}
                      placeholder="es. 99.2"
                      className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Consumo Totale Fattura (kWh) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={formConsumoFattura || ''}
                      onChange={(e) => setFormConsumoFattura(Number(e.target.value))}
                      placeholder="es. 1133"
                      className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                {/* Fasce F1, F2, F3 */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">F1 (kWh)</label>
                    <input
                      type="number"
                      step="1"
                      value={formKwF1 || ''}
                      onChange={(e) => setFormKwF1(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">F2 (kWh)</label>
                    <input
                      type="number"
                      step="1"
                      value={formKwF2 || ''}
                      onChange={(e) => setFormKwF2(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">F3 (kWh)</label>
                    <input
                      type="number"
                      step="1"
                      value={formKwF3 || ''}
                      onChange={(e) => setFormKwF3(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Componenti di Spesa in Fattura */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  2. Importi Voci di Costo in Fattura (€)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-0.5">Quota Fissa Commercializzazione</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formQfissaComm || ''}
                      onChange={(e) => setFormQfissaComm(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Quota Energia F0</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formQenergiaF0 || ''}
                      onChange={(e) => setFormQenergiaF0(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Maggior Prezzo Energia</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formMaggiorPrezzo || ''}
                      onChange={(e) => setFormMaggiorPrezzo(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Corrispettivo Servizio Vendita</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formCorrVendita || ''}
                      onChange={(e) => setFormCorrVendita(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Oneri Dispacciamento</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formOneriDisp || ''}
                      onChange={(e) => setFormOneriDisp(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Perdite di Rete</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formPerditeRete || ''}
                      onChange={(e) => setFormPerditeRete(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Quota Fissa Trasporto Rete</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formQfissaRete || ''}
                      onChange={(e) => setFormQfissaRete(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Quota Potenza Trasporto Rete</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formQpotenzaRete || ''}
                      onChange={(e) => setFormQpotenzaRete(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Quota Energia Trasporto Rete</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formQenergiaRete || ''}
                      onChange={(e) => setFormQenergiaRete(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">ASOS Quota Fissa</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formAsosQfissa || ''}
                      onChange={(e) => setFormAsosQfissa(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">ARIM Quota Fissa</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formArimQfissa || ''}
                      onChange={(e) => setFormArimQfissa(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">ASOS Quota Energia</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formAsosQenergia || ''}
                      onChange={(e) => setFormAsosQenergia(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">ARIM Quota Energia</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formArimQenergia || ''}
                      onChange={(e) => setFormArimQenergia(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">ASOS Quota Potenza</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formAsosQpotenza || ''}
                      onChange={(e) => setFormAsosQpotenza(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">ARIM Quota Potenza</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formArimQpotenza || ''}
                      onChange={(e) => setFormArimQpotenza(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Accise e Imposta Erariale</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formAccise || ''}
                      onChange={(e) => setFormAccise(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Energia Reattiva F3 (Alveas)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formReattivaF3 || ''}
                      onChange={(e) => setFormReattivaF3(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Corrispettivo Capacità (Alveas)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formCorrCapacita || ''}
                      onChange={(e) => setFormCorrCapacita(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 p-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Ripartizione Calcolata in Tempo Reale */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    3. Anteprima Ripartizione Calcolata
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    Totale Bolletta: {formatEuro(liveFormSplit.totaleBolletta)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                    <p className="text-slate-500">Competenza Qu3 (APS)</p>
                    <p className="text-base font-extrabold text-emerald-700">
                      {formatEuro(liveFormSplit.importoQu3)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Imponibile: {formatEuro(liveFormSplit.imponibileQu3)} + IVA 22%
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-sky-200">
                    <p className="text-slate-500">Competenza Alveas</p>
                    <p className="text-base font-extrabold text-sky-700">
                      {formatEuro(liveFormSplit.importoAlveas)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Imponibile: {formatEuro(liveFormSplit.imponibileAlveas)} + IVA 22%
                    </p>
                  </div>
                </div>
              </div>

              {/* Pulsanti Azione Modal */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Save className="h-4 w-4" />
                  <span>Salva Bolletta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
