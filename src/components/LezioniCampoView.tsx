import React, { useState, useMemo, useEffect } from 'react';
import {
  Compass,
  Plus,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  AlertTriangle,
  Calendar,
  Users,
  MapPin,
  Car,
  UserCheck,
  CheckCircle2,
  Building,
  UtensilsCrossed,
  DollarSign,
  Save,
  X,
  Printer,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Excursion,
  ExcursionType,
  ExcursionPayment,
  ExcursionAdjustment,
  EXCURSION_TYPE_LABELS,
  PAYMENT_CATEGORY_LABELS,
} from '../data/lezioniCampoData';

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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr?: string | null): string {
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

function defaultPaymentRow(category: string): ExcursionPayment {
  return {
    id: `pay-draft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    excursion_id: '',
    category,
    quota_singola_preventivo: 0,
    num_soci_paganti: 0,
    num_gratuita: 0,
    totale_preventivo: 0,
    costi_extra: 0,
    importo_pagato: 0,
    tipo_pagamento: null,
    data_pagamento: null,
  };
}

export const LezioniCampoView: React.FC = () => {
  const {
    excursions,
    excursionPayments,
    excursionAdjustments,
    saveExcursion,
    deleteExcursion,
    saveAdjustments,
    getUserSectionPermission,
    isSuperAdmin,
    currentUser,
  } = useApp();

  const permission = getUserSectionPermission('lezioni_campo');
  const canEdit = isSuperAdmin || permission === 'edit';

  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal stato creazione/modifica
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExcursion, setEditingExcursion] = useState<Excursion | null>(null);

  // Campi form
  const [formType, setFormType] = useState<ExcursionType>('lezione_sul_campo');
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuota, setFormQuota] = useState<number>(0);
  const [formParticipants, setFormParticipants] = useState<number>(0);
  const [formQuotaMezziPropri, setFormQuotaMezziPropri] = useState<number>(0);
  const [formParticipantsMezziPropri, setFormParticipantsMezziPropri] = useState<number>(0);
  const [formDocente, setFormDocente] = useState('');
  const [formNumAccompagnatori, setFormNumAccompagnatori] = useState<number>(0);
  const [formAccompagnatore1, setFormAccompagnatore1] = useState('');
  const [formAccompagnatore2, setFormAccompagnatore2] = useState('');
  const [formNomeHotel, setFormNomeHotel] = useState('');
  const [formNomeRistorante, setFormNomeRistorante] = useState('');

  // Righe di pagamento nel form
  const [formPayments, setFormPayments] = useState<ExcursionPayment[]>([]);
  const [extraVisitePayments, setExtraVisitePayments] = useState<ExcursionPayment[]>([]);

  // Modale eliminazione
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Stato Scritture di Rettifica
  const [adjustmentsList, setAdjustmentsList] = useState<ExcursionAdjustment[]>(excursionAdjustments);
  const [savingAdjustments, setSavingAdjustments] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setAdjustmentsList(excursionAdjustments);
  }, [excursionAdjustments]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Caricamento script esterni per Excel e PDF
  useEffect(() => {
    if (!window.XLSX) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.async = true;
      document.head.appendChild(s);
    }
    if (!window.jspdf) {
      const s1 = document.createElement('script');
      s1.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
      s1.async = true;
      document.head.appendChild(s1);

      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js';
      s2.async = true;
      document.head.appendChild(s2);
    }
  }, []);

  // Calcolo finanziario per escursione
  const calcExcursionFinance = (exc: Excursion, payments: ExcursionPayment[]) => {
    const isLezione = exc.excursion_type === 'lezione_sul_campo';
    const totalRicavi = isLezione
      ? (exc.num_participants || 0) * (exc.quota || 0) +
        (exc.num_participants_mezzi_propri || 0) * (exc.quota_mezzi_propri || 0)
      : 0;

    const totalCosti = payments.reduce((sum, p) => sum + (p.importo_pagato || 0), 0);
    const totalPreventivo = payments.reduce((sum, p) => sum + (p.totale_preventivo || 0) + (p.costi_extra || 0), 0);
    const saldo = totalRicavi - totalCosti;

    return { totalRicavi, totalCosti, totalPreventivo, saldo };
  };

  // Reset del form
  const resetForm = () => {
    setEditingExcursion(null);
    setFormType('lezione_sul_campo');
    setFormName('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDescription('');
    setFormQuota(0);
    setFormParticipants(0);
    setFormQuotaMezziPropri(0);
    setFormParticipantsMezziPropri(0);
    setFormDocente('');
    setFormNumAccompagnatori(0);
    setFormAccompagnatore1('');
    setFormAccompagnatore2('');
    setFormNomeHotel('');
    setFormNomeRistorante('');
    setFormPayments([
      defaultPaymentRow('bus'),
      defaultPaymentRow('ristorante'),
      defaultPaymentRow('visite_lezioni'),
      defaultPaymentRow('hotel'),
    ]);
    setExtraVisitePayments([]);
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (exc: Excursion) => {
    setEditingExcursion(exc);
    setFormType(exc.excursion_type);
    setFormName(exc.name);
    setFormDate(exc.excursion_date);
    setFormDescription(exc.description || '');
    setFormQuota(exc.quota || 0);
    setFormParticipants(exc.num_participants || 0);
    setFormQuotaMezziPropri(exc.quota_mezzi_propri || 0);
    setFormParticipantsMezziPropri(exc.num_participants_mezzi_propri || 0);
    setFormDocente(exc.docente || '');
    setFormNumAccompagnatori(exc.num_accompagnatori || 0);
    setFormAccompagnatore1(exc.accompagnatore_1 || '');
    setFormAccompagnatore2(exc.accompagnatore_2 || '');
    setFormNomeHotel(exc.nome_hotel || '');
    setFormNomeRistorante(exc.nome_ristorante || '');

    const existingPayments = excursionPayments.filter((p) => p.excursion_id === exc.id);
    if (existingPayments.length > 0) {
      const basePayments: ExcursionPayment[] = [];
      const extraVisite: ExcursionPayment[] = [];
      let visiteCount = 0;

      for (const p of existingPayments) {
        if (p.category === 'visite_lezioni') {
          if (visiteCount === 0) {
            basePayments.push(p);
          } else {
            extraVisite.push(p);
          }
          visiteCount++;
        } else {
          basePayments.push(p);
        }
      }

      // Assicurati che le 4 categorie base ci siano
      for (const cat of ['bus', 'ristorante', 'visite_lezioni', 'hotel']) {
        if (!basePayments.find((p) => p.category === cat)) {
          basePayments.push(defaultPaymentRow(cat));
        }
      }

      const order = ['bus', 'ristorante', 'visite_lezioni', 'hotel'];
      basePayments.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

      setFormPayments(basePayments);
      setExtraVisitePayments(extraVisite);
    } else {
      setFormPayments([
        defaultPaymentRow('bus'),
        defaultPaymentRow('ristorante'),
        defaultPaymentRow('visite_lezioni'),
        defaultPaymentRow('hotel'),
      ]);
      setExtraVisitePayments([]);
    }

    setIsModalOpen(true);
  };

  const handlePaymentChange = (
    index: number,
    field: keyof ExcursionPayment,
    val: any,
    isExtra = false
  ) => {
    const list = isExtra ? [...extraVisitePayments] : [...formPayments];
    const item = { ...list[index], [field]: val };

    if (item.category !== 'bus') {
      if (
        field === 'quota_singola_preventivo' ||
        field === 'num_soci_paganti' ||
        field === 'num_gratuita'
      ) {
        const q = field === 'quota_singola_preventivo' ? Number(val) : Number(item.quota_singola_preventivo || 0);
        const n = field === 'num_soci_paganti' ? Number(val) : Number(item.num_soci_paganti || 0);
        item.totale_preventivo = Math.round(q * n * 100) / 100;
      }
    } else {
      if (field === 'quota_singola_preventivo') {
        item.totale_preventivo = Number(val);
      }
    }

    list[index] = item;
    if (isExtra) {
      setExtraVisitePayments(list);
    } else {
      setFormPayments(list);
    }
  };

  const handleAddExtraVisita = () => {
    setExtraVisitePayments((prev) => [...prev, defaultPaymentRow('visite_lezioni')]);
  };

  const handleRemoveExtraVisita = (idx: number) => {
    setExtraVisitePayments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDate) {
      showToast('Compila i campi obbligatori (Nome e Data).');
      return;
    }

    const payloadExcursion: Partial<Excursion> = {
      id: editingExcursion ? editingExcursion.id : undefined,
      name: formName.trim(),
      excursion_type: formType,
      excursion_date: formDate,
      description: formDescription.trim() || null,
      quota: formType === 'lezione_sul_campo' ? Number(formQuota) : 0,
      num_participants: Number(formParticipants),
      quota_mezzi_propri: formType === 'lezione_sul_campo' ? Number(formQuotaMezziPropri) : 0,
      num_participants_mezzi_propri: formType === 'lezione_sul_campo' ? Number(formParticipantsMezziPropri) : 0,
      docente: formDocente.trim() || null,
      num_accompagnatori: Number(formNumAccompagnatori),
      accompagnatore_1: formNumAccompagnatori >= 1 ? formAccompagnatore1.trim() || null : null,
      accompagnatore_2: formNumAccompagnatori >= 2 ? formAccompagnatore2.trim() || null : null,
      nome_hotel: formType === 'lezione_sul_campo' ? formNomeHotel.trim() || null : null,
      nome_ristorante: formType === 'lezione_sul_campo' ? formNomeRistorante.trim() || null : null,
    };

    const allPayments = formType === 'lezione_sul_campo' ? [...formPayments, ...extraVisitePayments] : [];

    await saveExcursion(payloadExcursion, allPayments);
    setIsModalOpen(false);
    showToast(editingExcursion ? 'Escursione aggiornata con successo!' : 'Nuova escursione registrata con successo!');
  };

  const handleDeleteConfirm = async () => {
    if (deletingId) {
      await deleteExcursion(deletingId);
      if (expandedId === deletingId) setExpandedId(null);
      setDeletingId(null);
      showToast('Escursione eliminata.');
    }
  };

  // Gestione modifiche scritture di rettifica
  const handleAdjustmentChange = (id: string, field: keyof ExcursionAdjustment, value: any) => {
    setAdjustmentsList((prev) =>
      prev.map((adj) => (adj.id === id ? { ...adj, [field]: value } : adj))
    );
  };

  const handleSaveAdjustments = async () => {
    setSavingAdjustments(true);
    await saveAdjustments(adjustmentsList);
    setSavingAdjustments(false);
    showToast('Scritture contabili di rettifica salvate con successo!');
  };

  // Filtro escursioni
  const filteredExcursions = useMemo(() => {
    return excursions
      .filter((exc) => {
        if (filterType !== 'all' && exc.excursion_type !== filterType) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = exc.name.toLowerCase().includes(q);
          const matchDocente = (exc.docente || '').toLowerCase().includes(q);
          const matchDate = exc.excursion_date.includes(q);
          return matchName || matchDocente || matchDate;
        }
        return true;
      })
      .sort((a, b) => (b.excursion_date || '').localeCompare(a.excursion_date || ''));
  }, [excursions, filterType, searchQuery]);

  // Esportazione Excel
  const handleExportExcel = () => {
    if (!window.XLSX) {
      alert('Libreria Excel in fase di caricamento, riprova tra qualche istante.');
      return;
    }
    const wb = window.XLSX.utils.book_new();

    // Foglio 1: Lezioni sul Campo
    const lezioni = excursions.filter((e) => e.excursion_type === 'lezione_sul_campo');
    if (lezioni.length > 0) {
      const data = lezioni.map((y) => {
        const pays = excursionPayments.filter((p) => p.excursion_id === y.id);
        const fin = calcExcursionFinance(y, pays);

        const busP = pays.find((p) => p.category === 'bus');
        const ristP = pays.find((p) => p.category === 'ristorante');
        const visP = pays.find((p) => p.category === 'visite_lezioni');
        const hotelP = pays.find((p) => p.category === 'hotel');

        return {
          Nome: y.name,
          Data: formatDateShort(y.excursion_date),
          'Quota (€)': y.quota || 0,
          'N. Partecipanti': y.num_participants || 0,
          'Quota auto pr. (€)': y.quota_mezzi_propri || 0,
          'N. Part. auto pr.': y.num_participants_mezzi_propri || 0,
          Docente: y.docente || '',
          'Bus Prev. (€)': busP?.totale_preventivo || 0,
          'Bus Pagato (€)': busP?.importo_pagato || 0,
          'Ristorante Prev. (€)': ristP?.totale_preventivo || 0,
          'Ristorante Pagato (€)': ristP?.importo_pagato || 0,
          'Visite Prev. (€)': visP?.totale_preventivo || 0,
          'Visite Pagato (€)': visP?.importo_pagato || 0,
          'Hotel Prev. (€)': hotelP?.totale_preventivo || 0,
          'Hotel Pagato (€)': hotelP?.importo_pagato || 0,
          'Totale Costi (€)': fin.totalCosti,
          'Totale Ricavi (€)': fin.totalRicavi,
          'Saldo (€)': fin.saldo,
        };
      });
      const ws = window.XLSX.utils.json_to_sheet(data);
      window.XLSX.utils.book_append_sheet(wb, ws, 'Lezioni sul campo');
    }

    // Foglio 2: Visite Naturalistiche
    const visiteNat = excursions.filter((e) => e.excursion_type === 'visita_naturalistica');
    if (visiteNat.length > 0) {
      const data = visiteNat.map((y) => ({
        Nome: y.name,
        Data: formatDateShort(y.excursion_date),
        'N. Partecipanti': y.num_participants || 0,
        Docente: y.docente || '',
        Accompagnatori: [y.accompagnatore_1, y.accompagnatore_2].filter(Boolean).join(', '),
      }));
      const ws = window.XLSX.utils.json_to_sheet(data);
      window.XLSX.utils.book_append_sheet(wb, ws, 'Visite naturalistiche');
    }

    // Foglio 3: Visite della Domenica
    const visiteDom = excursions.filter((e) => e.excursion_type === 'visita_della_domenica');
    if (visiteDom.length > 0) {
      const data = visiteDom.map((y) => ({
        Nome: y.name,
        Data: formatDateShort(y.excursion_date),
        'N. Partecipanti': y.num_participants || 0,
        Docente: y.docente || '',
        Accompagnatori: [y.accompagnatore_1, y.accompagnatore_2].filter(Boolean).join(', '),
      }));
      const ws = window.XLSX.utils.json_to_sheet(data);
      window.XLSX.utils.book_append_sheet(wb, ws, 'Visite della domenica');
    }

    // Foglio 4: Rettifiche Contabili
    if (excursionAdjustments.length > 0) {
      const data = excursionAdjustments.map((r, i) => ({
        Riga: i + 1,
        Data: formatDateShort(r.entry_date),
        Descrizione: r.description || '',
        'Dare (Costo €)': r.dare || 0,
        'Avere (Ricavo €)': r.avere || 0,
      }));
      const ws = window.XLSX.utils.json_to_sheet(data);
      window.XLSX.utils.book_append_sheet(wb, ws, 'Rettifiche Contabili');
    }

    const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    window.XLSX.writeFile(wb, `lezioni_sul_campo_${dateSuffix}.xlsx`);
    showToast('Report Excel esportato con successo!');
  };

  // Esportazione PDF Riassuntivo Globale
  const handleExportSummaryPdf = () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Libreria PDF in fase di caricamento, riprova tra qualche istante.');
      return;
    }

    const doc = new window.jspdf.jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(6, 78, 59);
    doc.text('Università della Terza Età di Quartu Sant\'Elena', 14, 15);

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('Riepilogo Generale — Lezioni sul Campo ed Escursioni', 14, 23);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} ore ${new Date().toLocaleTimeString('it-IT')}`, 14, 29);

    let totRicavi = 0;
    let totCosti = 0;

    const lezioni = excursions.filter((e) => e.excursion_type === 'lezione_sul_campo');
    for (const l of lezioni) {
      const pays = excursionPayments.filter((p) => p.excursion_id === l.id);
      const fin = calcExcursionFinance(l, pays);
      totRicavi += fin.totalRicavi;
      totCosti += fin.totalCosti;
    }

    const totDareRettifiche = excursionAdjustments.reduce((s, a) => s + (Number(a.dare) || 0), 0);
    const totAvereRettifiche = excursionAdjustments.reduce((s, a) => s + (Number(a.avere) || 0), 0);

    totCosti += totDareRettifiche;
    totRicavi += totAvereRettifiche;
    const saldoNetto = totRicavi - totCosti;

    // Riquadri indicatori in alto
    const boxW = (pageWidth - 28 - 16) / 3;
    const yTop = 34;

    // Box Ricavi
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, yTop, boxW, 16, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(6, 95, 70);
    doc.text('TOTALE RICAVI (incluse rettifiche)', 14 + boxW / 2, yTop + 5, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formatEuro(totRicavi), 14 + boxW / 2, yTop + 12, { align: 'center' });

    // Box Costi
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14 + boxW + 8, yTop, boxW, 16, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(153, 27, 27);
    doc.text('TOTALE COSTI (incluse rettifiche)', 14 + boxW + 8 + boxW / 2, yTop + 5, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(formatEuro(totCosti), 14 + boxW + 8 + boxW / 2, yTop + 12, { align: 'center' });

    // Box Saldo
    const saldoPositivo = saldoNetto >= 0;
    doc.setFillColor(saldoPositivo ? 209 : 254, saldoPositivo ? 250 : 226, saldoPositivo ? 229 : 226);
    doc.roundedRect(14 + (boxW + 8) * 2, yTop, boxW, 16, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(saldoPositivo ? 6 : 153, saldoPositivo ? 95 : 27, saldoPositivo ? 70 : 27);
    doc.text('SALDO NETTO GENERALE', 14 + (boxW + 8) * 2 + boxW / 2, yTop + 5, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text((saldoPositivo ? '+' : '') + formatEuro(saldoNetto), 14 + (boxW + 8) * 2 + boxW / 2, yTop + 12, { align: 'center' });

    // Tabella Escursioni
    const tableRows = lezioni.map((exc) => {
      const pays = excursionPayments.filter((p) => p.excursion_id === exc.id);
      const fin = calcExcursionFinance(exc, pays);
      return [
        exc.name,
        formatDateShort(exc.excursion_date),
        exc.num_participants || 0,
        formatEuro(exc.quota || 0),
        formatEuro(fin.totalRicavi),
        formatEuro(fin.totalCosti),
        (fin.saldo >= 0 ? '+' : '') + formatEuro(fin.saldo),
      ];
    });

    (doc as any).autoTable({
      startY: 56,
      head: [['Nome Escursione', 'Data', 'Part.', 'Quota', 'Totale Ricavi', 'Totale Costi', 'Saldo']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;

    // Sezione Scritture di Rettifica
    if (excursionAdjustments.length > 0 && finalY < 160) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Scritture Contabili di Rettifica', 14, finalY + 10);

      const adjRows = excursionAdjustments
        .filter((a) => (a.dare > 0 || a.avere > 0 || a.description))
        .map((a) => [
          formatDateShort(a.entry_date),
          a.description || '-',
          formatEuro(a.dare || 0),
          formatEuro(a.avere || 0),
        ]);

      (doc as any).autoTable({
        startY: finalY + 13,
        head: [['Data', 'Descrizione Rettifica', 'Dare (Costo €)', 'Avere (Ricavo €)']],
        body: adjRows,
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
        },
      });
    }

    doc.save(`riepilogo_lezioni_campo_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('PDF Riassuntivo scaricato con successo!');
  };

  // Esportazione PDF Singola Escursione
  const handleExportSingleExcursionPdf = (exc: Excursion) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Libreria PDF in fase di caricamento, riprova tra qualche istante.');
      return;
    }

    const doc = new window.jspdf.jsPDF();
    const pays = excursionPayments.filter((p) => p.excursion_id === exc.id);
    const fin = calcExcursionFinance(exc, pays);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(6, 78, 59);
    doc.text('Università della Terza Età di Quartu Sant\'Elena', 14, 15);

    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(`Prospetto Contabile: ${exc.name}`, 14, 23);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Data: ${formatDate(exc.excursion_date)} · Tipologia: ${EXCURSION_TYPE_LABELS[exc.excursion_type]}`, 14, 29);

    // Box Dettagli
    const details = [
      ['Docente / Guida', exc.docente || '-'],
      ['Partecipanti Bus', `${exc.num_participants || 0} soci (quota ${formatEuro(exc.quota)})`],
      ['Partecipanti Auto Propria', `${exc.num_participants_mezzi_propri || 0} soci (quota ${formatEuro(exc.quota_mezzi_propri)})`],
      ['Accompagnatori', [exc.accompagnatore_1, exc.accompagnatore_2].filter(Boolean).join(', ') || 'Nessuno'],
      ['Ristorante', exc.nome_ristorante || '-'],
      ['Hotel', exc.nome_hotel || '-'],
      ['Note / Descrizione', exc.description || '-'],
    ];

    (doc as any).autoTable({
      startY: 34,
      head: [['Dettaglio Escursione', 'Informazioni']],
      body: details,
      theme: 'striped',
      headStyles: { fillColor: [6, 78, 59] },
      styles: { fontSize: 8.5 },
    });

    const startPayY = (doc as any).lastAutoTable.finalY + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Dettaglio Preventivi e Pagamenti Effettuati', 14, startPayY);

    const payRows = pays.map((p) => [
      PAYMENT_CATEGORY_LABELS[p.category] || p.category,
      formatEuro(p.totale_preventivo),
      p.costi_extra > 0 ? formatEuro(p.costi_extra) : '-',
      formatEuro(p.importo_pagato),
      p.tipo_pagamento || '-',
      formatDateShort(p.data_pagamento),
    ]);

    (doc as any).autoTable({
      startY: startPayY + 4,
      head: [['Voce di Spesa', 'Preventivo', 'Costi Extra', 'Importo Pagato', 'Pagamento', 'Data']],
      body: payRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105] },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;

    // Riepilogo Contabile
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, finalY, 182, 22, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Totale Ricavi Quote: ${formatEuro(fin.totalRicavi)}`, 20, finalY + 8);
    doc.text(`Totale Costi Spese: ${formatEuro(fin.totalCosti)}`, 20, finalY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const saldoPos = fin.saldo >= 0;
    doc.setTextColor(saldoPos ? 22 : 185, saldoPos ? 101 : 28, saldoPos ? 52 : 28);
    doc.text(`Saldo Netto: ${saldoPos ? '+' : ''}${formatEuro(fin.saldo)}`, 115, finalY + 12);

    doc.save(`prospetto_${exc.name.replace(/[^a-zA-Z0-9]/g, '_')}_${exc.excursion_date}.pdf`);
    showToast(`PDF generato per ${exc.name}!`);
  };

  // Calcolo totali rettifiche
  const totDare = adjustmentsList.reduce((s, a) => s + (Number(a.dare) || 0), 0);
  const totAvere = adjustmentsList.reduce((s, a) => s + (Number(a.avere) || 0), 0);

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
        <div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-md">
              <Compass className="h-6 w-6 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Lezioni sul Campo
              </h1>
              <p className="text-sm text-slate-500">
                Gestione escursioni, visite guidate, preventivi e scritture di rettifica
              </p>
            </div>
          </div>
        </div>

        {/* Pulsanti Azione in alto */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-95 shadow-xs"
            title="Esporta foglio di calcolo Excel con tutti i dati"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Esporta Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportSummaryPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-95 shadow-xs"
            title="Scarica prospetto PDF generale riassuntivo"
          >
            <FileText className="h-4 w-4 text-rose-600" />
            <span>PDF Riassuntivo</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-95 shadow-md"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Nuova Escursione</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. FILTRI & BARRA DI RICERCA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Tabs per tipologia */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterType === 'all'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tutte ({excursions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('lezione_sul_campo')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterType === 'lezione_sul_campo'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Lezioni sul campo ({excursions.filter((e) => e.excursion_type === 'lezione_sul_campo').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('visita_naturalistica')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterType === 'visita_naturalistica'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Visite naturalistiche ({excursions.filter((e) => e.excursion_type === 'visita_naturalistica').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('visita_della_domenica')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterType === 'visita_della_domenica'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Visite domenica ({excursions.filter((e) => e.excursion_type === 'visita_della_domenica').length})
          </button>
        </div>

        {/* Input ricerca */}
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per nome, data, docente..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>
      </div>

      {/* 3. ELENCO SCHEDE ESCURSIONI */}
      <div className="space-y-3">
        {filteredExcursions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Nessuna escursione trovata con i filtri selezionati.
          </div>
        ) : (
          filteredExcursions.map((exc) => {
            const isExpanded = expandedId === exc.id;
            const payments = excursionPayments.filter((p) => p.excursion_id === exc.id);
            const fin = calcExcursionFinance(exc, payments);
            const isLezione = exc.excursion_type === 'lezione_sul_campo';

            return (
              <div
                key={exc.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition overflow-hidden"
              >
                {/* Intestazione card cliccabile */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : exc.id)}
                  className="p-4 sm:p-5 flex items-start justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 capitalize">
                        {exc.name}
                      </h3>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          exc.excursion_type === 'lezione_sul_campo'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : exc.excursion_type === 'visita_naturalistica'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {EXCURSION_TYPE_LABELS[exc.excursion_type]}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-600 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatDate(exc.excursion_date)}
                      </span>
                      {exc.docente && (
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                          Docente: <strong className="text-slate-800">{exc.docente}</strong>
                        </span>
                      )}
                      {(exc.num_participants || 0) > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {exc.num_participants} partecipanti
                        </span>
                      )}
                      {isLezione && (
                        <span className="inline-flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                          Quota: <strong className="text-slate-800">{formatEuro(exc.quota)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pulsanti azioni rapidi */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEditModal(exc)}
                        className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        title="Modifica escursione"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setDeletingId(exc.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Elimina escursione"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : exc.id)}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition"
                    >
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Dettagli Espansi */}
                {isExpanded && (
                  <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-5 animate-fadeIn">
                    {/* Griglia Dettagli Informazioni */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {isLezione ? (
                        <>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-slate-500 block">Quota bus</span>
                            <span className="font-bold text-slate-900 text-sm">{formatEuro(exc.quota)}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-slate-500 block">Partecipanti bus</span>
                            <span className="font-bold text-slate-900 text-sm">{exc.num_participants || 0}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-slate-500 block">Quota mezzi propri</span>
                            <span className="font-bold text-slate-900 text-sm">{formatEuro(exc.quota_mezzi_propri)}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-slate-500 block">Part. mezzi propri</span>
                            <span className="font-bold text-slate-900 text-sm">{exc.num_participants_mezzi_propri || 0}</span>
                          </div>
                        </>
                      ) : (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block">Totale Partecipanti</span>
                          <span className="font-bold text-slate-900 text-sm">{exc.num_participants || 0}</span>
                        </div>
                      )}

                      {exc.docente && (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2">
                          <span className="text-slate-500 block">Docente / Guida</span>
                          <span className="font-semibold text-slate-900 text-sm">{exc.docente}</span>
                        </div>
                      )}

                      {(exc.num_accompagnatori || 0) > 0 && (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2">
                          <span className="text-slate-500 block">Accompagnatori</span>
                          <span className="font-semibold text-slate-900 text-sm">
                            {[exc.accompagnatore_1, exc.accompagnatore_2].filter(Boolean).join(', ') || exc.num_accompagnatori}
                          </span>
                        </div>
                      )}

                      {exc.nome_ristorante && (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block">Ristorante</span>
                          <span className="font-semibold text-slate-900 text-sm">{exc.nome_ristorante}</span>
                        </div>
                      )}

                      {exc.nome_hotel && (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block">Hotel</span>
                          <span className="font-semibold text-slate-900 text-sm">{exc.nome_hotel}</span>
                        </div>
                      )}

                      {exc.description && (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-4">
                          <span className="text-slate-500 block">Descrizione</span>
                          <p className="text-slate-700 text-xs sm:text-sm mt-0.5 whitespace-pre-line">{exc.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Tabella Preventivi e Spese (se Lezione sul campo) */}
                    {isLezione && payments.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700">
                            Preventivi e Pagamenti Effettuati
                          </h4>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <tr>
                                <th className="py-2.5 px-3">Voce di Spesa</th>
                                <th className="py-2.5 px-3 text-right">Preventivo</th>
                                <th className="py-2.5 px-3 text-right">Costi Extra</th>
                                <th className="py-2.5 px-3 text-right">Importo Pagato</th>
                                <th className="py-2.5 px-3">Pagamento</th>
                                <th className="py-2.5 px-3">Data</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {payments.map((pay) => {
                                const prev = Math.round((pay.totale_preventivo || 0) * 100) / 100;
                                const extra = Math.round((pay.costi_extra || 0) * 100) / 100;
                                const pag = Math.round((pay.importo_pagato || 0) * 100) / 100;
                                const supera = pag > 0 && prev > 0 && Math.round((pag - prev - extra) * 100) / 100 > 0;

                                return (
                                  <tr key={pay.id} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3 font-medium text-slate-800">
                                      {PAYMENT_CATEGORY_LABELS[pay.category] || pay.category}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono">{formatEuro(prev)}</td>
                                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                      {extra > 0 ? formatEuro(extra) : '-'}
                                    </td>
                                    <td
                                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                                        supera ? 'text-rose-600' : 'text-slate-900'
                                      }`}
                                    >
                                      {formatEuro(pag)}
                                      {supera && (
                                        <span className="ml-1 text-[10px] text-rose-500" title="Il pagato supera il preventivo">
                                          ⚠
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 capitalize text-slate-600">
                                      {pay.tipo_pagamento || '-'}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600">
                                      {formatDateShort(pay.data_pagamento)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Riepilogo Costi, Ricavi e Saldo */}
                        <div className="grid grid-cols-3 gap-3 pt-2">
                          <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                            <span className="text-[11px] text-slate-500 font-medium uppercase">Totale Costi</span>
                            <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5">
                              {formatEuro(fin.totalCosti)}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                            <span className="text-[11px] text-slate-500 font-medium uppercase">Totale Ricavi</span>
                            <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5">
                              {formatEuro(fin.totalRicavi)}
                            </p>
                          </div>
                          <div
                            className={`p-3 rounded-2xl border text-center ${
                              fin.saldo >= 0
                                ? 'bg-emerald-50/80 border-emerald-200'
                                : 'bg-rose-50/80 border-rose-200'
                            }`}
                          >
                            <span className="text-[11px] text-slate-600 font-medium uppercase">Saldo Netto</span>
                            <p
                              className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${
                                fin.saldo >= 0 ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {fin.saldo >= 0 ? '+' : ''}
                              {formatEuro(fin.saldo)}
                            </p>
                          </div>
                        </div>

                        {/* Tasto Stampa PDF per questa escursione */}
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleExportSingleExcursionPdf(exc)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer active:scale-95"
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-500" />
                            <span>Stampa Prospetto Escursione (PDF)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. SCRITTURE CONTABILI DI RETTIFICA */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-700" />
              Scritture Contabili di Rettifica (Lezioni sul Campo)
            </h3>
            <p className="text-xs text-slate-500">
              <strong>Dare</strong> = Costo aggiuntivo · <strong>Avere</strong> = Ricavo aggiuntivo (inclusi nel bilancio generale e nei report PDF)
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={handleSaveAdjustments}
              disabled={savingAdjustments}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{savingAdjustments ? 'Salvataggio...' : 'Salva Rettifiche'}</span>
            </button>
          )}
        </div>

        {/* Tabella righe di rettifica */}
        <div className="space-y-2.5">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 px-2">
            <span className="col-span-2">Data</span>
            <span className="col-span-6">Descrizione Rettifica</span>
            <span className="col-span-2 text-right">Dare (Costo €)</span>
            <span className="col-span-2 text-right">Avere (Ricavo €)</span>
          </div>

          {adjustmentsList.map((adj, i) => (
            <div
              key={adj.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/80"
            >
              <div className="sm:col-span-2">
                <span className="sm:hidden text-[10px] text-slate-500 block mb-0.5">Data</span>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={adj.entry_date || ''}
                  onChange={(e) => handleAdjustmentChange(adj.id, 'entry_date', e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 disabled:opacity-75"
                />
              </div>

              <div className="sm:col-span-6">
                <span className="sm:hidden text-[10px] text-slate-500 block mb-0.5">Descrizione</span>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={adj.description || ''}
                  onChange={(e) => handleAdjustmentChange(adj.id, 'description', e.target.value)}
                  placeholder={`Voce di rettifica riga ${i + 1}`}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 disabled:opacity-75"
                />
              </div>

              <div className="sm:col-span-2">
                <span className="sm:hidden text-[10px] text-slate-500 block mb-0.5">Dare (Costo €)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!canEdit}
                  value={adj.dare || ''}
                  onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                  onChange={(e) => handleAdjustmentChange(adj.id, 'dare', Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right font-mono font-medium text-rose-700 disabled:opacity-75"
                />
              </div>

              <div className="sm:col-span-2">
                <span className="sm:hidden text-[10px] text-slate-500 block mb-0.5">Avere (Ricavo €)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!canEdit}
                  value={adj.avere || ''}
                  onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                  onChange={(e) => handleAdjustmentChange(adj.id, 'avere', Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right font-mono font-medium text-emerald-700 disabled:opacity-75"
                />
              </div>
            </div>
          ))}

          {/* Riga Totali */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-2 border-t border-slate-200 font-bold text-xs sm:text-sm px-2">
            <span className="sm:col-span-8 text-slate-700">Totali Rettifiche:</span>
            <span className="sm:col-span-2 text-right font-mono text-rose-600">{formatEuro(totDare)}</span>
            <span className="sm:col-span-2 text-right font-mono text-emerald-600">{formatEuro(totAvere)}</span>
          </div>
        </div>
      </div>

      {/* 5. MODALE CREAZIONE / MODIFICA ESCURSIONE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto my-auto animate-scaleUp">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {editingExcursion ? 'Modifica Escursione' : 'Nuova Escursione'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
              {/* Tipo Escursione */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Tipo Escursione *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as ExcursionType)}
                  className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="lezione_sul_campo">Lezione sul campo</option>
                  <option value="visita_naturalistica">Visita naturalistica</option>
                  <option value="visita_della_domenica">Visita della domenica</option>
                </select>
              </div>

              {/* Nome e Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Nome Escursione *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="es. Orto Botanico, Barumini..."
                    className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Data Escursione *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Descrizione */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Descrizione o Note
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Dettagli sull'itinerario, orario di partenza, raccomandazioni..."
                  className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Quote e Partecipanti per Lezioni sul Campo */}
              {formType === 'lezione_sul_campo' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Quota Bus (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formQuota || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => setFormQuota(Number(e.target.value))}
                      className="w-full text-xs sm:text-sm rounded-lg border border-slate-200 p-2 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">N. Soci Bus</label>
                    <input
                      type="number"
                      min="0"
                      value={formParticipants || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => setFormParticipants(Number(e.target.value))}
                      className="w-full text-xs sm:text-sm rounded-lg border border-slate-200 p-2 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Quota Auto (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formQuotaMezziPropri || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => setFormQuotaMezziPropri(Number(e.target.value))}
                      className="w-full text-xs sm:text-sm rounded-lg border border-slate-200 p-2 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">N. Soci Auto</label>
                    <input
                      type="number"
                      min="0"
                      value={formParticipantsMezziPropri || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => setFormParticipantsMezziPropri(Number(e.target.value))}
                      className="w-full text-xs sm:text-sm rounded-lg border border-slate-200 p-2 bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Numero Partecipanti
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formParticipants || ''}
                    onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                    onChange={(e) => setFormParticipants(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              )}

              {/* Docente e Accompagnatori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Docente / Guida
                  </label>
                  <input
                    type="text"
                    value={formDocente}
                    onChange={(e) => setFormDocente(e.target.value)}
                    placeholder="Nome e cognome docente"
                    className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    N. Accompagnatori (0-2)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    value={formNumAccompagnatori || ''}
                    onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                    onChange={(e) => setFormNumAccompagnatori(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              </div>

              {formNumAccompagnatori >= 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Accompagnatore 1</label>
                    <input
                      type="text"
                      value={formAccompagnatore1}
                      onChange={(e) => setFormAccompagnatore1(e.target.value)}
                      placeholder="Nome accompagnatore 1"
                      className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5"
                    />
                  </div>
                  {formNumAccompagnatori >= 2 && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Accompagnatore 2</label>
                      <input
                        type="text"
                        value={formAccompagnatore2}
                        onChange={(e) => setFormAccompagnatore2(e.target.value)}
                        placeholder="Nome accompagnatore 2"
                        className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Ristorante e Hotel */}
              {formType === 'lezione_sul_campo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Nome Ristorante
                    </label>
                    <input
                      type="text"
                      value={formNomeRistorante}
                      onChange={(e) => setFormNomeRistorante(e.target.value)}
                      placeholder="es. Ristorante Da Mario"
                      className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Nome Hotel
                    </label>
                    <input
                      type="text"
                      value={formNomeHotel}
                      onChange={(e) => setFormNomeHotel(e.target.value)}
                      placeholder="es. Hotel Panorama"
                      className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 p-2.5"
                    />
                  </div>
                </div>
              )}

              {/* Sezione Preventivi e Pagamenti nel Form */}
              {formType === 'lezione_sul_campo' && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Preventivi e Spese
                  </h3>

                  {formPayments.map((pay, idx) => {
                    const isBus = pay.category === 'bus';
                    const superato = (pay.importo_pagato || 0) > (pay.totale_preventivo || 0) + (pay.costi_extra || 0);

                    return (
                      <div
                        key={pay.category}
                        className={`p-3 rounded-2xl border ${
                          superato ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 bg-slate-50'
                        } space-y-2.5`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800">
                            {PAYMENT_CATEGORY_LABELS[pay.category] || pay.category}
                          </span>
                          {superato && (
                            <span className="text-[10px] font-semibold text-rose-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Spesa supera preventivo
                            </span>
                          )}
                        </div>

                        {isBus ? (
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Preventivo (€)</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={pay.quota_singola_preventivo || ''}
                                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                                onChange={(e) =>
                                  handlePaymentChange(idx, 'quota_singola_preventivo', Number(e.target.value))
                                }
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Costi Extra (€)</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={pay.costi_extra || ''}
                                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                                onChange={(e) => handlePaymentChange(idx, 'costi_extra', Number(e.target.value))}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Importo Pagato (€)</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={pay.importo_pagato || ''}
                                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                                onChange={(e) => handlePaymentChange(idx, 'importo_pagato', Number(e.target.value))}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Tipo</span>
                              <select
                                value={pay.tipo_pagamento || ''}
                                onChange={(e) => handlePaymentChange(idx, 'tipo_pagamento', e.target.value || null)}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              >
                                <option value="">-</option>
                                <option value="bonifico">Bonifico</option>
                                <option value="cassa">Cassa</option>
                              </select>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Data Pagamento</span>
                              <input
                                type="date"
                                value={pay.data_pagamento || ''}
                                onChange={(e) => handlePaymentChange(idx, 'data_pagamento', e.target.value || null)}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Quota (€)</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={pay.quota_singola_preventivo || ''}
                                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                                onChange={(e) =>
                                  handlePaymentChange(idx, 'quota_singola_preventivo', Number(e.target.value))
                                }
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">N. Soci Paganti</span>
                              <input
                                type="number"
                                min="0"
                                value={pay.num_soci_paganti || ''}
                                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                                onChange={(e) => handlePaymentChange(idx, 'num_soci_paganti', Number(e.target.value))}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">N. Gratuità</span>
                              <input
                                type="number"
                                min="0"
                                value={pay.num_gratuita || ''}
                                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                                onChange={(e) => handlePaymentChange(idx, 'num_gratuita', Number(e.target.value))}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Totale Preventivo (€)</span>
                              <input
                                type="number"
                                readOnly
                                value={pay.totale_preventivo?.toFixed(2) || '0.00'}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-slate-100 font-mono font-medium"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 block">Costi Extra (€)</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={pay.costi_extra || ''}
                                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                                onChange={(e) => handlePaymentChange(idx, 'costi_extra', Number(e.target.value))}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Importo Pagato (€)</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={pay.importo_pagato || ''}
                                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                                onChange={(e) => handlePaymentChange(idx, 'importo_pagato', Number(e.target.value))}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Tipo</span>
                              <select
                                value={pay.tipo_pagamento || ''}
                                onChange={(e) => handlePaymentChange(idx, 'tipo_pagamento', e.target.value || null)}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                              >
                                <option value="">-</option>
                                <option value="bonifico">Bonifico</option>
                                <option value="cassa">Cassa</option>
                              </select>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Data Pagamento</span>
                              <input
                                type="date"
                                value={pay.data_pagamento || ''}
                                onChange={(e) => handlePaymentChange(idx, 'data_pagamento', e.target.value || null)}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Righe extra Visite/Lezioni */}
                  {extraVisitePayments.map((pay, eIdx) => (
                    <div key={eIdx} className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">
                          Visite/Lezioni Extra #{eIdx + 2}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraVisita(eIdx)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-semibold p-1"
                        >
                          Rimuovi
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Quota (€)</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={pay.quota_singola_preventivo || ''}
                            onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                            onChange={(e) =>
                              handlePaymentChange(eIdx, 'quota_singola_preventivo', Number(e.target.value), true)
                            }
                            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">N. Soci Paganti</span>
                          <input
                            type="number"
                            min="0"
                            value={pay.num_soci_paganti || ''}
                            onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                            onChange={(e) =>
                              handlePaymentChange(eIdx, 'num_soci_paganti', Number(e.target.value), true)
                            }
                            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">N. Gratuità</span>
                          <input
                            type="number"
                            min="0"
                            value={pay.num_gratuita || ''}
                            onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                            onChange={(e) =>
                              handlePaymentChange(eIdx, 'num_gratuita', Number(e.target.value), true)
                            }
                            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Totale Preventivo (€)</span>
                          <input
                            type="number"
                            readOnly
                            value={pay.totale_preventivo?.toFixed(2) || '0.00'}
                            className="w-full p-1.5 rounded-lg border border-slate-200 bg-slate-100 font-mono font-medium"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block">Importo Pagato (€)</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={pay.importo_pagato || ''}
                            onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                            onChange={(e) =>
                              handlePaymentChange(eIdx, 'importo_pagato', Number(e.target.value), true)
                            }
                            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Tipo</span>
                          <select
                            value={pay.tipo_pagamento || ''}
                            onChange={(e) =>
                              handlePaymentChange(eIdx, 'tipo_pagamento', e.target.value || null, true)
                            }
                            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            <option value="">-</option>
                            <option value="bonifico">Bonifico</option>
                            <option value="cassa">Cassa</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-500 block">Data Pagamento</span>
                          <input
                            type="date"
                            value={pay.data_pagamento || ''}
                            onChange={(e) =>
                              handlePaymentChange(eIdx, 'data_pagamento', e.target.value || null, true)
                            }
                            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddExtraVisita}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 p-2 rounded-xl border border-dashed border-emerald-300 hover:bg-emerald-50 transition w-full justify-center"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Aggiungi riga Visite/Lezioni supplementare</span>
                  </button>
                </div>
              )}

              {/* Tasti submit form */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition shadow-md active:scale-95"
                >
                  {editingExcursion ? 'Salva Modifiche' : 'Crea Escursione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODALE CONFERMA ELIMINAZIONE */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="h-6 w-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Elimina Escursione</h3>
                <p className="text-xs text-slate-500">Questa operazione è irreversibile.</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Sei sicuro di voler eliminare questa escursione e tutti i relativi preventivi e pagamenti collegati?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold transition shadow-md"
              >
                Elimina definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
