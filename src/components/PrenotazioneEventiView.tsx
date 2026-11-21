import React, { useState, useMemo, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileDown,
  FileSpreadsheet,
  Trash2,
  Edit3,
  X,
  CreditCard,
  Mail,
  Phone,
  UserCheck,
  ChevronDown,
  ArrowUpRight,
  Info,
  Layers,
  Sparkles,
  Printer,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Evento,
  TipoAttivitaEvento,
  PrenotazioneEvento,
  calcolaPostiOccupatiConfermati,
  calcolaPostiResiduiOnline,
  calcolaPostiInAttesa,
  calcolaStatoLiveEvento,
  getEventoDate,
  getEventoTipoId,
  getEventoPostiOnline,
  getEventoPostiTotali,
  getEventoPostiAttesa,
  getEventoCosto,
  getEventoRichiedePagamento,
} from '../data/eventiData';
import { exportCsv, exportOfficialPdf, ASSOCIATION_LOGO_URL } from '../utils/soundAndPdf';
import { isCdMemberProfile } from '../data/initialData';

// Caricamento dinamico di SheetJS per Excel nativo (.xlsx)
let xlsxPromise: Promise<any> | null = null;
function loadSheetJS(): Promise<any> {
  if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = (err) => {
      xlsxPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return xlsxPromise;
}

// Generatore Ricevuta PDF Singola Prenotazione
async function downloadPrenotazionePdf(prenotazione: PrenotazioneEvento, evento: Evento) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsPdfLib = (window as any).jspdf?.jsPDF || (window as any).jsPDF;
  if (!jsPdfLib) {
    // Prova a caricare jsPDF dinamicamente se non presente
    await new Promise<void>((resolve, reject) => {
      if (document.querySelector('script[src*="jspdf"]')) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (window as any).jspdf?.jsPDF || (window as any).jsPDF;
  if (!Ctor) {
    alert('Impossibile generare la ricevuta PDF in questo momento.');
    return;
  }

  const doc = new Ctor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Intestazione
  doc.setFillColor(15, 61, 46);
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('UNIVERSITÀ DELLA TERZA ETÀ DI QUARTU S. ELENA', 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(209, 250, 229);
  doc.text('RICEVUTA UFFICIALE DI PRENOTAZIONE EVENTO', 14, 25);

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`Codice: ${prenotazione.booking_code || prenotazione.id}`, pageWidth - 14, 25, { align: 'right' });

  // Corpo Ricevuta
  let y = 50;

  // Riquadro Dati Evento
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 44, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 61, 46);
  doc.text(evento.titolo, 20, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const evDate = getEventoDate(evento);
  const dataStr = !isNaN(evDate.getTime())
    ? evDate.toLocaleString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  doc.text(`Data e Ora: ${dataStr}`, 20, y + 18);
  doc.text(`Luogo: ${evento.luogo}`, 20, y + 26);
  doc.text(`Anno Accademico: ${evento.anno_accademico}`, 20, y + 34);

  y += 54;

  // Riquadro Dettagli Socio & Posti
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, y, pageWidth - 28, 56, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('TITOLARE DELLA PRENOTAZIONE', 20, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Socio: ${prenotazione.socio_nominativo} (Tessera N° ${prenotazione.socio_tessera})`, 20, y + 18);
  if (prenotazione.socio_email) {
    doc.text(`Email: ${prenotazione.socio_email}`, 20, y + 25);
  }
  if (prenotazione.socio_telefono) {
    doc.text(`Telefono: ${prenotazione.socio_telefono}`, 20, y + 32);
  }

  if (prenotazione.num_posti === 2) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`2° Ospite / Coniuge: ${prenotazione.ospite_nominativo || 'Accompagnatore'} ${prenotazione.ospite_tessera ? `(Tessera ${prenotazione.ospite_tessera})` : ''}`, 20, y + 42);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 61, 46);
  doc.text(`Posti Totali Prenotati: ${prenotazione.num_posti}`, pageWidth - 20, y + 18, { align: 'right' });

  y += 66;

  // Box Stato e Pagamento
  const isWaiting = prenotazione.stato === 'lista_attesa';
  doc.setDrawColor(isWaiting ? 245 : 16, isWaiting ? 158 : 185, isWaiting ? 11 : 129);
  doc.setFillColor(isWaiting ? 254 : 236, isWaiting ? 243 : 253, isWaiting ? 199 : 245);
  doc.roundedRect(14, y, pageWidth - 28, 30, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(isWaiting ? 146 : 6, isWaiting ? 64 : 95, isWaiting ? 14 : 70);
  doc.text(
    isWaiting
      ? `STATO: IN LISTA D'ATTESA (Posizione #${prenotazione.posizione_attesa || 1})`
      : 'STATO: PRENOTAZIONE CONFERMATA ✓',
    20,
    y + 11
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const quotaText =
    (prenotazione.quota_totale || 0) > 0
      ? `Quota dovuta: € ${(prenotazione.quota_totale || 0).toFixed(2)} (${
          prenotazione.stato_pagamento === 'pagato'
            ? 'Regolarmente Saldata'
            : 'Da saldare e confermare presso la segreteria'
        })`
      : 'Quota: Evento Gratuito';
  doc.text(quotaText, 20, y + 21);

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Ricevuta generata il ${new Date().toLocaleString('it-IT')} · Conserva questa ricevuta o mostrala all'ingresso dell'evento.`,
    14,
    doc.internal.pageSize.getHeight() - 12
  );

  doc.save(`Ricevuta_Prenotazione_${prenotazione.booking_code || 'Q3'}.pdf`);
}

export const PrenotazioneEventiView: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    isCDMember,
    isSegreteriaMember,
    getUserSectionPermission,
    eventiTipologie,
    eventi,
    eventiPrenotazioni,
    saveEvento,
    deleteEvento,
    saveTipoAttivita,
    deleteTipoAttivita,
    prenotaEvento,
    annullaPrenotazione,
    modificaPrenotazione,
    aggiornaStatoPagamentoPrenotazione,
    promuoviDaListaAttesa,
    profiles,
  } = useApp();

  // REGOLA: Solo i componenti del CD (Consiglio Direttivo) possono inserire eventi, vedere tutte le prenotazioni e report
  const isCD = Boolean(
    isSuperAdmin ||
      currentUser?.role === 'admin' ||
      isCDMember ||
      isCdMemberProfile(currentUser) ||
      currentUser?.id === 'admin-2406' ||
      currentUser?.member_number === '2406'
  );
  const canManage = isCD;

  // Stato filtri
  const [selectedTipoId, setSelectedTipoId] = useState<string>('ALL');
  const [selectedAnno, setSelectedAnno] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyMyBookings, setFilterOnlyMyBookings] = useState(false);

  // Timer per aggiornamento real-time dei countdown ogni secondo
  const [, setClockTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Modali
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvento, setEditingEvento] = useState<Partial<Evento> | null>(null);

  const [showTipologieModal, setShowTipologieModal] = useState(false);
  const [newTipoNome, setNewTipoNome] = useState('');
  const [newTipoColore, setNewTipoColore] = useState('#2563eb');
  const [newTipoDesc, setNewTipoDesc] = useState('');

  const [bookingEvento, setBookingEvento] = useState<Evento | null>(null);
  const [bookingNumPosti, setBookingNumPosti] = useState<1 | 2>(1);
  const [bookingOspiteNome, setBookingOspiteNome] = useState('');
  const [bookingOspiteTessera, setBookingOspiteTessera] = useState('');
  const [bookingEmail, setBookingEmail] = useState('');
  const [bookingTelefono, setBookingTelefono] = useState('');
  const [bookingNote, setBookingNote] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Modale modifica prenotazione (socio)
  const [editingBooking, setEditingBooking] = useState<{
    prenotazione: PrenotazioneEvento;
    evento: Evento;
  } | null>(null);
  const [editBookingNumPosti, setEditBookingNumPosti] = useState<1 | 2>(1);
  const [editBookingOspiteNome, setEditBookingOspiteNome] = useState('');
  const [editBookingOspiteTessera, setEditBookingOspiteTessera] = useState('');
  const [editBookingEmail, setEditBookingEmail] = useState('');
  const [editBookingTelefono, setEditBookingTelefono] = useState('');
  const [editBookingNote, setEditBookingNote] = useState('');
  const [editBookingLoading, setEditBookingLoading] = useState(false);

  const [confirmedBookingResult, setConfirmedBookingResult] = useState<{
    prenotazione: PrenotazioneEvento;
    evento: Evento;
  } | null>(null);

  // Drawer / Elenco Ospiti
  const [guestListEvento, setGuestListEvento] = useState<Evento | null>(null);
  const [guestSearch, setGuestSearch] = useState('');
  // Modale Report Ingressi & Lista d'Attesa (Esclusivo per componenti CD)
  const [reportEvento, setReportEvento] = useState<Evento | null>(null);

  // Trova profilo corrente per email/telefono
  const currentMemberProfile = useMemo(() => {
    if (!currentUser) return null;
    return profiles.find(
      (p) =>
        p.member_number === currentUser.member_number ||
        p.id === currentUser.id
    );
  }, [currentUser, profiles]);

  // Prepara anni accademici unici
  const anniAccademici = useMemo(() => {
    const set = new Set<string>();
    eventi.forEach((e) => {
      if (e.anno_accademico) set.add(e.anno_accademico);
    });
    return Array.from(set).sort().reverse();
  }, [eventi]);

  // Filtra eventi
  const filteredEventi = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return eventi.filter((ev) => {
      const tipoId = getEventoTipoId(ev);
      if (selectedTipoId !== 'ALL' && tipoId !== selectedTipoId) return false;
      if (selectedAnno !== 'ALL' && ev.anno_accademico !== selectedAnno) return false;
      if (filterOnlyMyBookings) {
        const hasMine = eventiPrenotazioni.some(
          (p) =>
            p.evento_id === ev.id &&
            p.socio_tessera === currentUser?.member_number &&
            p.stato !== 'annullata'
        );
        if (!hasMine) return false;
      }
      if (q) {
        const matchTitle = ev.titolo.toLowerCase().includes(q);
        const matchLuogo = ev.luogo.toLowerCase().includes(q);
        const matchDesc = ev.descrizione?.toLowerCase().includes(q);
        if (!matchTitle && !matchLuogo && !matchDesc) return false;
      }
      return true;
    });
  }, [eventi, selectedTipoId, selectedAnno, filterOnlyMyBookings, searchQuery, eventiPrenotazioni, currentUser]);

  // Calcola quante prenotazioni attive ha il socio corrente
  const myTotalActiveBookings = useMemo(() => {
    if (!currentUser?.member_number) return 0;
    return eventiPrenotazioni.filter(
      (p) => p.socio_tessera === currentUser.member_number && p.stato !== 'annullata'
    ).length;
  }, [eventiPrenotazioni, currentUser]);

  // Apertura modale di prenotazione
  const handleOpenBookingModal = (evento: Evento) => {
    setBookingEvento(evento);
    setBookingNumPosti(1);
    setBookingOspiteNome('');
    setBookingOspiteTessera('');
    setBookingEmail(currentMemberProfile?.email || '');
    setBookingTelefono(currentMemberProfile?.phone || '');
    setBookingNote('');
  };

  // Invio prenotazione
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingEvento || !currentUser) return;

    if (bookingNumPosti === 2 && !bookingOspiteNome.trim()) {
      alert('Inserisci il nome e cognome del secondo ospite/coniuge.');
      return;
    }

    setBookingLoading(true);
    try {
      const res = await prenotaEvento({
        evento_id: bookingEvento.id,
        socio_id: currentUser.id,
        socio_tessera: currentUser.member_number,
        socio_nominativo: currentUser.full_name || `Socio ${currentUser.member_number}`,
        socio_email: bookingEmail.trim() || undefined,
        socio_telefono: bookingTelefono.trim() || undefined,
        num_posti: bookingNumPosti,
        ospite_nominativo: bookingNumPosti === 2 ? bookingOspiteNome.trim() : undefined,
        ospite_tessera: bookingNumPosti === 2 ? bookingOspiteTessera.trim() || undefined : undefined,
        note_staff: bookingNote.trim() || undefined,
      });

      if (!res.ok) {
        alert(res.message || 'Impossibile completare la prenotazione.');
        return;
      }

      // Trova la prenotazione appena salvata
      const savedPrenotazione = eventiPrenotazioni.find(
        (p) => p.evento_id === bookingEvento.id && p.socio_tessera === currentUser.member_number
      ) || {
        id: `pren-now`,
        evento_id: bookingEvento.id,
        socio_id: currentUser.id,
        socio_tessera: currentUser.member_number,
        socio_nominativo: currentUser.full_name,
        socio_email: bookingEmail.trim(),
        num_posti: bookingNumPosti,
        ospite_nominativo: bookingOspiteNome.trim(),
        ospite_tessera: bookingOspiteTessera.trim(),
        stato: res.stato,
        posizione_attesa: res.posizioneAttesa,
        stato_pagamento: getEventoCosto(bookingEvento) > 0 ? 'da_pagare_in_sede' : 'gratuito',
        quota_totale: getEventoCosto(bookingEvento) * bookingNumPosti,
        booking_code: `Q3-${bookingEvento.id.slice(-4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setConfirmedBookingResult({
        prenotazione: savedPrenotazione,
        evento: bookingEvento,
      });
      setBookingEvento(null);
    } catch (err: any) {
      alert(`Errore: ${err?.message || 'Errore durante la prenotazione'}`);
    } finally {
      setBookingLoading(false);
    }
  };

  // Modifica della propria prenotazione da parte del socio
  const handleOpenEditBooking = (pren: PrenotazioneEvento, ev: Evento) => {
    setEditingBooking({ prenotazione: pren, evento: ev });
    setEditBookingNumPosti(pren.num_posti);
    setEditBookingOspiteNome(pren.ospite_nominativo || '');
    setEditBookingOspiteTessera(pren.ospite_tessera || '');
    setEditBookingEmail(pren.socio_email || currentMemberProfile?.email || '');
    setEditBookingTelefono(pren.socio_telefono || currentMemberProfile?.phone || '');
    setEditBookingNote(pren.note_staff || '');
  };

  const handleSaveEditBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    setEditBookingLoading(true);
    try {
      const res = await modificaPrenotazione(editingBooking.prenotazione.id, {
        num_posti: editBookingNumPosti,
        ospite_nominativo: editBookingNumPosti === 2 ? editBookingOspiteNome.trim() : undefined,
        ospite_tessera: editBookingNumPosti === 2 ? editBookingOspiteTessera.trim() : undefined,
        socio_email: editBookingEmail.trim() || undefined,
        socio_telefono: editBookingTelefono.trim() || undefined,
        note_staff: editBookingNote.trim() || undefined,
      });
      if (!res.ok) {
        alert(res.message || 'Errore durante la modifica della prenotazione.');
      } else {
        setEditingBooking(null);
      }
    } finally {
      setEditBookingLoading(false);
    }
  };

  // Apertura modale nuovo/modifica evento
  const handleOpenEditEvento = (evento?: Evento) => {
    if (evento) {
      const d = getEventoDate(evento);
      const dataOraStr = !isNaN(d.getTime()) ? d.toISOString().slice(0, 16) : '';
      setEditingEvento({
        ...evento,
        tipo_attivita_id: getEventoTipoId(evento),
        data_ora_evento: evento.data_ora_evento || dataOraStr,
        totale_posti: getEventoPostiTotali(evento),
        posti_prenotabili_online: getEventoPostiOnline(evento),
        limite_lista_attesa: getEventoPostiAttesa(evento),
        costo_biglietto: getEventoCosto(evento),
        richiede_pagamento_sede: getEventoRichiedePagamento(evento),
      });
    } else {
      const now = new Date();
      const inTwoWeeks = new Date(now.getTime() + 14 * 86400000);
      const closeDate = new Date(inTwoWeeks.getTime() - 24 * 3600000);
      setEditingEvento({
        titolo: '',
        tipo_attivita_id: eventiTipologie[0]?.id || 'cinema',
        luogo: 'Sede Sociale - Aula Magna',
        descrizione: '',
        anno_accademico: '2026/2027',
        data_ora_evento: inTwoWeeks.toISOString().slice(0, 16),
        apertura_prenotazioni: now.toISOString().slice(0, 16),
        chiusura_prenotazioni: closeDate.toISOString().slice(0, 16),
        totale_posti: 60,
        posti_prenotabili_online: 50,
        max_posti_per_socio: 2,
        limite_lista_attesa: 15,
        costo_biglietto: 0,
        richiede_pagamento_sede: false,
      });
    }
    setShowEventModal(true);
  };

  // Salvataggio evento da form
  const handleSaveEventoForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvento || !editingEvento.titolo?.trim()) {
      alert('Inserisci il titolo dell\'evento.');
      return;
    }
    await saveEvento(editingEvento);
    setShowEventModal(false);
    setEditingEvento(null);
  };

  // Creazione nuova tipologia
  const handleAddTipologia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTipoNome.trim()) return;
    await saveTipoAttivita({
      nome: newTipoNome.trim(),
      colore: newTipoColore,
      descrizione: newTipoDesc.trim(),
      icona: 'Ticket',
    });
    setNewTipoNome('');
    setNewTipoDesc('');
  };

  // Esporta elenco ospiti in Excel nativo (.xlsx)
  const handleExportGuestsExcel = async (evento: Evento) => {
    const list = eventiPrenotazioni.filter((p) => p.evento_id === evento.id && p.stato !== 'annullata');
    const XLSX = await loadSheetJS();

    const data = list.map((p, idx) => ({
      Prog: idx + 1,
      Codice: p.booking_code || p.id,
      Tessera: p.socio_tessera,
      Nominativo: p.socio_nominativo,
      Email: p.socio_email || '',
      Telefono: p.socio_telefono || '',
      Posti: p.num_posti,
      Ospite_Nominativo: p.ospite_nominativo || '',
      Ospite_Tessera: p.ospite_tessera || '',
      Stato: p.stato === 'confermata' ? 'Confermata' : `In attesa (${p.posizione_attesa || 1})`,
      Pagamento: p.stato_pagamento === 'pagato' ? 'Pagato' : p.stato_pagamento === 'gratuito' ? 'Gratuito' : 'Da pagare in sede',
      Quota_Euro: p.quota_totale || 0,
      Data_Prenotazione: new Date(p.created_at).toLocaleString('it-IT'),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ospiti');
    XLSX.writeFile(wb, `Elenco_Ospiti_${evento.titolo.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  // Esporta foglio presenze PDF per l'evento con netta separazione tra confermati e lista d'attesa
  const handleExportGuestsPdf = (evento: Evento) => {
    const list = eventiPrenotazioni.filter((p) => p.evento_id === evento.id && p.stato !== 'annullata');
    const confermati = list.filter((p) => p.stato === 'confermata');
    const inAttesaList = list
      .filter((p) => p.stato === 'lista_attesa')
      .sort((a, b) => (a.posizione_attesa || 0) - (b.posizione_attesa || 0));

    const totalPostiConfermati = confermati.reduce((acc, p) => acc + p.num_posti, 0);
    const totalPostiAttesa = inAttesaList.reduce((acc, p) => acc + p.num_posti, 0);

    const body: (string | number)[][] = [];

    // Righe Confermati
    confermati.forEach((p, idx) => {
      body.push([
        idx + 1,
        p.socio_tessera,
        p.socio_nominativo,
        p.ospite_nominativo ? `${p.ospite_nominativo} ${p.ospite_tessera ? `(Tess. ${p.ospite_tessera})` : ''}` : '-',
        p.num_posti,
        'CONFERMATO',
        p.stato_pagamento === 'pagato' ? 'Pagato' : p.stato_pagamento === 'gratuito' ? 'Gratuito' : 'Da Pagare',
        '', // Spazio firma a penna
      ]);
    });

    // Righe Lista d'Attesa
    if (inAttesaList.length > 0) {
      body.push([
        '---',
        '---',
        '=== LISTA D\'ATTESA (IN ORDINE DI PRIORITÀ) ===',
        '---',
        '---',
        '---',
        '---',
        '---',
      ]);
      inAttesaList.forEach((p, idx) => {
        body.push([
          `#${p.posizione_attesa || idx + 1}`,
          p.socio_tessera,
          `${p.socio_nominativo}${p.socio_telefono ? ` (Tel: ${p.socio_telefono})` : ''}`,
          p.ospite_nominativo || '-',
          p.num_posti,
          'IN ATTESA',
          p.stato_pagamento === 'pagato' ? 'Pagato' : p.stato_pagamento === 'gratuito' ? 'Gratuito' : 'Da Pagare',
          '',
        ]);
      });
    }

    exportOfficialPdf({
      title: `Foglio Ingressi & Attesa: ${evento.titolo}`,
      subtitle: `Data: ${getEventoDate(evento).toLocaleDateString('it-IT')} · Luogo: ${evento.luogo || 'Sede Sociale'} · Confermati: ${totalPostiConfermati}/${getEventoPostiTotali(evento)} · In Attesa: ${totalPostiAttesa} posti`,
      head: ['N°', 'Tessera', 'Nominativo', '2° Ospite', 'Posti', 'Stato', 'Pagamento', 'Firma Presenza'],
      body,
      fileName: `Foglio_Ingressi_${evento.titolo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      landscape: true,
    });
  };

  // Stampa Ufficiale Foglio Ingressi & Lista d'Attesa per il giorno dell'evento (Esclusivo per il CD)
  const handlePrintEventReport = (evento: Evento) => {
    if (!canManage) return;

    const prenotazioniEvento = eventiPrenotazioni.filter(
      (p) => p.evento_id === evento.id && p.stato !== 'annullata'
    );
    const confermati = prenotazioniEvento.filter((p) => p.stato === 'confermata');
    const inAttesaList = prenotazioniEvento
      .filter((p) => p.stato === 'lista_attesa')
      .sort((a, b) => (a.posizione_attesa || 0) - (b.posizione_attesa || 0));

    const totaleCapienza = getEventoPostiTotali(evento);
    const postiConfermati = confermati.reduce((acc, p) => acc + p.num_posti, 0);
    const postiInAttesa = inAttesaList.reduce((acc, p) => acc + p.num_posti, 0);
    const d = getEventoDate(evento);
    const dataOraStr = !isNaN(d.getTime())
      ? d.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : evento.data_evento || '';
    const quotaStr = (getEventoCosto(evento) || 0) > 0 ? `€ ${Number(getEventoCosto(evento)).toFixed(2)} a persona` : 'Ingresso Gratuito';
    const stampatoIl = new Date().toLocaleString('it-IT');

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Impossibile aprire la finestra di stampa. Verifica se il browser blocca i pop-up.');
      return;
    }

    const confermatiRowsHtml = confermati.length > 0
      ? confermati.map((p, idx) => {
          const quotaDovuta = p.quota_totale ? `€ ${p.quota_totale.toFixed(2)}` : (p.stato_pagamento === 'gratuito' ? 'Gratuito' : '—');
          const pagBadge = p.stato_pagamento === 'pagato'
            ? `<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;">PAGATO</span>`
            : p.stato_pagamento === 'gratuito'
            ? `<span style="background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;font-weight:600;font-size:10px;">GRATUITO</span>`
            : `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;">DA SALDARE</span>`;

          return `
            <tr>
              <td style="text-align:center;font-weight:bold;color:#475569;">${idx + 1}</td>
              <td style="font-family:monospace;font-size:10.5px;color:#334155;">${p.booking_code || p.id.slice(0, 8)}</td>
              <td style="font-weight:bold;text-align:center;">${p.socio_tessera}</td>
              <td style="font-weight:600;color:#0f172a;">${p.socio_nominativo}</td>
              <td style="color:#475569;">${p.ospite_nominativo ? `${p.ospite_nominativo} ${p.ospite_tessera ? `(Tess. ${p.ospite_tessera})` : ''}` : '—'}</td>
              <td style="text-align:center;font-weight:bold;color:#065f46;">${p.num_posti}</td>
              <td style="text-align:center;">${pagBadge} <div style="font-size:9.5px;color:#64748b;margin-top:2px;">${quotaDovuta}</div></td>
              <td style="text-align:center;width:125px;border-left:2px solid #cbd5e1;">
                <div style="height:28px;border:1px dashed #94a3b8;border-radius:4px;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9.5px;">
                  [  ] Firma / Spunta
                </div>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;font-style:italic;">Nessuna prenotazione confermata per questo evento.</td></tr>`;

    const attesaRowsHtml = inAttesaList.length > 0
      ? inAttesaList.map((p, idx) => {
          const priorita = p.posizione_attesa || (idx + 1);
          const contatti = [
            p.socio_telefono ? `<strong>📞 ${p.socio_telefono}</strong>` : '',
            p.socio_email ? `✉️ ${p.socio_email}` : ''
          ].filter(Boolean).join('<br/>') || '—';

          return `
            <tr>
              <td style="text-align:center;font-weight:bold;color:#b45309;background:#fffbeb;font-size:12px;">#${priorita}</td>
              <td style="font-weight:bold;text-align:center;">${p.socio_tessera}</td>
              <td style="font-weight:600;color:#0f172a;">${p.socio_nominativo}</td>
              <td style="text-align:center;font-weight:bold;color:#b45309;">${p.num_posti}</td>
              <td style="font-size:10px;color:#1e293b;line-height:1.3;">${contatti}</td>
              <td style="font-size:10px;color:#475569;">${p.note_staff || '—'}</td>
              <td style="text-align:center;width:130px;border-left:2px solid #fcd34d;">
                <div style="height:28px;border:1px dashed #d97706;border-radius:4px;background:#fffbeb;display:flex;align-items:center;justify-content:center;color:#b45309;font-size:9.5px;">
                  [  ] Ammesso all'ingresso
                </div>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="7" style="text-align:center;padding:14px;color:#64748b;font-style:italic;">Nessun socio attualmente in lista d'attesa.</td></tr>`;

    printWin.document.open();
    printWin.document.write(`<!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8" />
        <title>Controllo Ingressi & Attesa - ${evento.titolo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 10mm 10mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 10px;
            font-size: 11px;
            background: #fff;
          }
          .header {
            display: flex;
            align-items: center;
            gap: 14px;
            border-bottom: 2.5px solid #065f46;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .header img {
            width: 55px;
            height: 55px;
            object-fit: contain;
          }
          .header-text { flex: 1; }
          .header-assoc {
            font-size: 11.5px;
            font-weight: bold;
            color: #065f46;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .header h1 {
            font-size: 16px;
            margin: 2px 0;
            color: #0f172a;
          }
          .header p {
            margin: 0;
            font-size: 9.5px;
            color: #64748b;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 10px;
            margin-bottom: 12px;
          }
          .meta-box { font-size: 10px; }
          .meta-box .lbl { color: #64748b; font-weight: 500; display: block; margin-bottom: 1px; }
          .meta-box .val { font-size: 11.5px; font-weight: 700; color: #0f172a; }
          
          .section-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #065f46;
            color: #fff;
            padding: 6px 10px;
            border-radius: 6px 6px 0 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            margin-top: 10px;
          }
          .section-title.amber {
            background: #b45309;
            margin-top: 18px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 8px;
          }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 700;
            text-align: left;
            padding: 5px 6px;
            border: 1px solid #cbd5e1;
            font-size: 9.5px;
            text-transform: uppercase;
          }
          td {
            padding: 5px 6px;
            border: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          tbody tr:nth-child(even) {
            background: #f8fafc;
          }
          .summary-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 10.5px;
            font-weight: 600;
            color: #065f46;
            margin-bottom: 6px;
          }
          .footer-sigs {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 18px;
            margin-top: 24px;
            padding-top: 8px;
            border-top: 1px solid #cbd5e1;
            page-break-inside: avoid;
          }
          .sig-box { text-align: center; font-size: 10px; color: #475569; }
          .sig-line { border-bottom: 1px solid #64748b; height: 32px; margin-bottom: 4px; }
          .watermark {
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            margin-top: 14px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background:#065f46;color:#fff;padding:8px 12px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
          <span><strong>Stampa Foglio Controllo Ingressi</strong> · Formato ottimizzato per foglio A4</span>
          <button onclick="window.print()" style="background:#fff;color:#065f46;border:none;padding:6px 14px;font-weight:bold;border-radius:6px;cursor:pointer;">Stampa Ora</button>
        </div>

        <div class="header">
          <img id="assoc-logo" src="${ASSOCIATION_LOGO_URL}" alt="Logo UTE Quartu S. Elena" />
          <div class="header-text">
            <div class="header-assoc">Università della Terza Età di Quartu S. Elena — APS</div>
            <h1>FOGLIO DI CONTROLLO INGRESSI EVENTO & LISTA D'ATTESA</h1>
            <p>Documento ufficiale ad uso esclusivo del Consiglio Direttivo e dei Responsabili dell'Accoglienza</p>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-box"><span class="lbl">Evento:</span><span class="val">${evento.titolo}</span></div>
          <div class="meta-box"><span class="lbl">Data & Orario:</span><span class="val">${dataOraStr}</span></div>
          <div class="meta-box"><span class="lbl">Luogo:</span><span class="val">${evento.luogo || 'Sede Sociale'}</span></div>
          <div class="meta-box"><span class="lbl">Quota Biglietto:</span><span class="val">${quotaStr}</span></div>
        </div>

        <div class="section-title">
          <span>1. PARTECIPANTI PRENOTATI & CONFERMATI (Ammessi all'ingresso)</span>
          <span style="font-size:9.5px;font-weight:normal;">Posti Assegnati: ${postiConfermati} / ${totaleCapienza}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:26px;text-align:center;">N°</th>
              <th style="width:75px;">Codice</th>
              <th style="width:50px;text-align:center;">Tess.</th>
              <th>Socio Intestatario</th>
              <th>2° Ospite / Coniuge</th>
              <th style="width:38px;text-align:center;">Posti</th>
              <th style="width:85px;text-align:center;">Quota</th>
              <th style="width:125px;text-align:center;">Spazio Firma / Check-in</th>
            </tr>
          </thead>
          <tbody>
            ${confermatiRowsHtml}
          </tbody>
        </table>

        <div class="summary-bar">
          <span>Riepilogo Confermati: ${confermati.length} prenotazioni per un totale di ${postiConfermati} posti</span>
          <span>Posti Disponibili Residui: ${Math.max(0, totaleCapienza - postiConfermati)}</span>
        </div>

        <div class="section-title amber">
          <span>2. LISTA D'ATTESA (In ordine di priorità per subentri/rinunce)</span>
          <span style="font-size:9.5px;font-weight:normal;">Totale in Attesa: ${postiInAttesa} posti</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:45px;text-align:center;">Priorità</th>
              <th style="width:50px;text-align:center;">Tess.</th>
              <th>Socio Richiedente</th>
              <th style="width:38px;text-align:center;">Posti</th>
              <th style="width:180px;">Contatto Telefonico / Email</th>
              <th>Note Richiesta</th>
              <th style="width:130px;text-align:center;">Ammissione all'Ingresso</th>
            </tr>
          </thead>
          <tbody>
            ${attesaRowsHtml}
          </tbody>
        </table>

        <div class="footer-sigs">
          <div class="sig-box">
            <div class="sig-line"></div>
            Data e Ora Controllo
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            Firma Responsabile Accoglienza CD
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            Firma Membro Consiglio Direttivo
          </div>
        </div>

        <div class="watermark">
          Generato da Portale Q3 il ${stampatoIl} · Riservato al Consiglio Direttivo UTE Quartu S. Elena
        </div>

        <script>
          (function() {
            var img = document.getElementById('assoc-logo');
            var printed = false;
            function triggerPrint() {
              if (printed) return;
              printed = true;
              setTimeout(function() { window.print(); }, 150);
            }
            if (img && !img.complete) {
              img.onload = triggerPrint;
              img.onerror = triggerPrint;
              setTimeout(triggerPrint, 1200);
            } else {
              window.onload = triggerPrint;
            }
          })();
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* HEADER DELLA SEZIONE */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <Ticket className="h-6 w-6 text-emerald-200" />
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Prenotazione Eventi</h1>
              </div>
              <p className="text-emerald-100 text-sm max-w-2xl">
                Partecipa a Cinema, Gite naturalistiche, Conferenze e agli eventi esclusivi dell'Università della Terza Età.
              </p>
            </div>

            {/* Azioni Staff & Le mie prenotazioni */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterOnlyMyBookings(!filterOnlyMyBookings)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition backdrop-blur-xs ${
                  filterOnlyMyBookings
                    ? 'bg-amber-400 text-slate-900 shadow-sm'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>Le mie Prenotazioni {myTotalActiveBookings > 0 && `(${myTotalActiveBookings})`}</span>
              </button>

              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowTipologieModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition backdrop-blur-xs"
                    title="Aggiungi o modifica le tipologie di eventi (Cinema, Gite, Conferenze...)"
                  >
                    <Layers className="h-4 w-4 text-emerald-200" />
                    <span className="hidden sm:inline">Tipologie</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditEvento()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white text-emerald-900 hover:bg-emerald-50 transition shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Nuovo Evento</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BARRA FILTRI E RICERCA */}
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          {/* Categorie Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedTipoId('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedTipoId === 'ALL'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tutte le Attività
            </button>
            {eventiTipologie.map((tipo) => {
              const isSelected = selectedTipoId === tipo.id;
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => setSelectedTipoId(tipo.id)}
                  style={{
                    backgroundColor: isSelected ? tipo.colore : 'white',
                    color: isSelected ? '#ffffff' : '#334155',
                    borderColor: isSelected ? tipo.colore : '#e2e8f0',
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition shadow-2xs"
                >
                  {tipo.nome}
                </button>
              );
            })}
          </div>

          {/* Anno Accademico & Ricerca */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {anniAccademici.length > 1 && (
              <select
                value={selectedAnno}
                onChange={(e) => setSelectedAnno(e.target.value)}
                className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-2xs focus:outline-none focus:border-emerald-600"
              >
                <option value="ALL">Tutti gli Anni</option>
                {anniAccademici.map((anno) => (
                  <option key={anno} value={anno}>
                    A.A. {anno}
                  </option>
                ))}
              </select>
            )}

            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca evento, luogo..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-emerald-600 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FEEDBACK NESSUN RISULTATO */}
        {filteredEventi.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            <Ticket className="h-12 w-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">Nessun evento disponibile con questi filtri</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {filterOnlyMyBookings
                ? 'Non hai ancora effettuato alcuna prenotazione. Disattiva il filtro "Le mie prenotazioni" per vedere tutti gli eventi disponibili.'
                : 'Prova a modificare i filtri per visualizzare altri eventi in calendario.'}
            </p>
          </div>
        )}

        {/* GRIGLIA EVENTI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEventi.map((evento) => {
            const tipo = eventiTipologie.find((t) => t.id === getEventoTipoId(evento)) || {
              id: 'generic',
              nome: 'Attività',
              colore: '#10b981',
            };

            const liveState = calcolaStatoLiveEvento(evento, eventiPrenotazioni);
            const postiOccupati = calcolaPostiOccupatiConfermati(evento.id, eventiPrenotazioni);
            const postiResidui = calcolaPostiResiduiOnline(evento, eventiPrenotazioni);
            const inAttesa = calcolaPostiInAttesa(evento.id, eventiPrenotazioni);
            const maxAttesa = getEventoPostiAttesa(evento);
            const attesaResidua = Math.max(0, maxAttesa - inAttesa);
            const postiOnlineTot = getEventoPostiOnline(evento);
            const costoBiglietto = getEventoCosto(evento);
            const richiedePagamento = getEventoRichiedePagamento(evento);

            // Verifica se l'utente corrente è già prenotato
            const myBooking = currentUser?.member_number
              ? eventiPrenotazioni.find(
                  (p) =>
                    p.evento_id === evento.id &&
                    p.socio_tessera === currentUser.member_number &&
                    p.stato !== 'annullata'
                )
              : null;

            // Formattazione data evento
            const dataEventoObj = getEventoDate(evento);
            const isValidDate = !isNaN(dataEventoObj.getTime());
            const giornoSettimana = isValidDate ? dataEventoObj.toLocaleDateString('it-IT', { weekday: 'short' }) : '';
            const giornoMese = isValidDate ? dataEventoObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
            const orario = isValidDate ? dataEventoObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
            const annoEvento = isValidDate ? dataEventoObj.getFullYear() : '';

            const isSoldOut = postiResidui <= 0 && attesaResidua <= 0;
            const isWaitingListMode = postiResidui <= 0 && attesaResidua > 0;

            return (
              <div
                key={evento.id}
                className={`rounded-3xl border bg-white shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden relative ${
                  myBooking ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
                }`}
              >
                {/* HEADER DELLA CARD CON TIPOLOGIA E BADGE LIVE */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      style={{ backgroundColor: `${tipo.colore}15`, color: tipo.colore, borderColor: `${tipo.colore}30` }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
                    >
                      <Ticket className="h-3.5 w-3.5" />
                      {tipo.nome}
                    </span>

                    {/* Badge Stato Live */}
                    {liveState.stato === 'non_aperto' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock className="h-3 w-3 text-amber-600 animate-pulse" />
                        Apre tra {liveState.countdown}
                      </span>
                    )}

                    {liveState.stato === 'aperto' && (
                      <>
                        {isSoldOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Posti Esauriti
                          </span>
                        ) : isWaitingListMode ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Lista d'Attesa Attiva
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Prenotazioni Aperte
                          </span>
                        )}
                      </>
                    )}

                    {liveState.stato === 'chiuso' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                        Prenotazioni Chiuse
                      </span>
                    )}
                  </div>

                  {/* TITOLO EVENTO */}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 line-clamp-2">{evento.titolo}</h3>
                    {evento.descrizione && (
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">{evento.descrizione}</p>
                    )}
                  </div>

                  {/* INFO DETTAGLIATE: DATA, ORA, LUOGO, COSTO */}
                  <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span className="font-semibold text-slate-800 capitalize">
                        {giornoSettimana} {giornoMese} {annoEvento}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-medium text-slate-700">{orario}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span className="truncate">{evento.luogo}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span className="font-semibold text-slate-800">
                          {costoBiglietto > 0 ? `€ ${costoBiglietto.toFixed(2)}` : 'Gratuito'}
                        </span>
                        {richiedePagamento && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Pagamento in sede
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-500 font-medium">
                        Max {evento.max_posti_per_socio === 2 ? '2 posti (anche coniuge)' : '1 posto'}
                      </span>
                    </div>
                  </div>

                  {/* BARRA DISPONIBILITÀ POSTI RESIDUI ONLINE */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Disponibilità Online:</span>
                      <span className={postiResidui > 0 ? 'text-emerald-700' : 'text-amber-700'}>
                        {postiResidui > 0 ? `${postiResidui} su ${postiOnlineTot} liberi` : 'Posti online esauriti'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          postiResidui > 0 ? 'bg-emerald-600' : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((postiOccupati / (postiOnlineTot || 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>

                    {/* Indicatore Lista d'attesa */}
                    {maxAttesa > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span>Lista d'attesa capienza: {maxAttesa}</span>
                        <span>{inAttesa > 0 ? `${inAttesa} persone in attesa` : 'Nessuno in attesa'}</span>
                      </div>
                    )}
                  </div>

                  {/* BOX NOTIFICA SE IL SOCIO HA GIÀ PRENOTATO */}
                  {myBooking && (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                            <span>La tua prenotazione: {myBooking.num_posti} {myBooking.num_posti === 1 ? 'posto' : 'posti'}</span>
                          </div>
                          <p className="text-[11px] text-emerald-800">
                            Codice: <span className="font-mono font-bold">{myBooking.booking_code || myBooking.id}</span>
                          </p>
                          {myBooking.stato === 'lista_attesa' && (
                            <span className="inline-block mt-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              In lista d'attesa (#Posizione {myBooking.posizione_attesa || 1})
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => downloadPrenotazionePdf(myBooking, evento)}
                          className="p-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition"
                          title="Scarica Ricevuta Ufficiale PDF"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-emerald-200">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditBooking(myBooking, evento)}
                            className="text-[11px] text-emerald-800 hover:text-emerald-950 font-semibold hover:underline"
                          >
                            Modifica prenotazione
                          </button>
                          <span className="text-emerald-300">·</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Sei sicuro di voler disdire questa prenotazione?')) {
                                annullaPrenotazione(myBooking.id);
                              }
                            }}
                            className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold hover:underline"
                          >
                            Disdici prenotazione
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => downloadPrenotazionePdf(myBooking, evento)}
                          className="text-[11px] text-emerald-800 font-semibold hover:underline flex items-center gap-1"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          <span>Scarica Ricevuta PDF</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* FOOTER CON BOTTONI AZIONE */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Sezione Staff: Visualizza Elenco Ospiti */}
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setGuestListEvento(evento);
                          setGuestSearch('');
                        }}
                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                        title="Visualizza Elenco Ospiti & Check-in"
                      >
                        <Users className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setReportEvento(evento)}
                        className="p-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                        title="Report Ingressi & Stampa Lista d'Attesa (Solo CD)"
                      >
                        <Printer className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditEvento(evento)}
                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                        title="Modifica Evento"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Sei sicuro di voler eliminare l'evento "${evento.titolo}"?`)) {
                            deleteEvento(evento.id);
                          }
                        }}
                        className="p-2 rounded-xl border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 transition shadow-2xs"
                        title="Elimina Evento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Bottone Prenota Posto per il socio */}
                  {!myBooking && (
                    <div className="flex-1 text-right">
                      {liveState.stato === 'aperto' && !isSoldOut ? (
                        <button
                          type="button"
                          onClick={() => handleOpenBookingModal(evento)}
                          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xs transition ${
                            isWaitingListMode
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-emerald-700 hover:bg-emerald-800'
                          }`}
                        >
                          <Ticket className="h-4 w-4" />
                          <span>{isWaitingListMode ? "Entra in Lista d'Attesa" : 'Prenota Posto'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-200 text-slate-500 cursor-not-allowed"
                        >
                          {liveState.stato === 'non_aperto'
                            ? 'Prenotazione non aperta'
                            : isSoldOut
                            ? 'Posti Esauriti'
                            : 'Prenotazioni Chiuse'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODALE DI PRENOTAZIONE */}
      {bookingEvento && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 my-8">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Modulo di Prenotazione
                </span>
                <h3 className="text-lg font-bold text-slate-900">{bookingEvento.titolo}</h3>
              </div>
              <button
                type="button"
                onClick={() => setBookingEvento(null)}
                className="p-1 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Avviso Lista d'Attesa se posti ordinari finiti */}
            {calcolaPostiResiduiOnline(bookingEvento, eventiPrenotazioni) <= 0 && (
              <div className="rounded-2xl bg-amber-50 border border-amber-300 p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Attenzione: I posti online ordinari sono esauriti!</span>
                  <p className="mt-0.5">
                    Completando la richiesta verrai inserito nella <strong>Lista d'Attesa ufficiale</strong> (posizione #
                    {calcolaPostiInAttesa(bookingEvento.id, eventiPrenotazioni) + 1}). Verrai ricontattato in caso di disdette.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmBooking} className="space-y-3.5">
              {/* Dati Socio Titolare */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Titolare prenotazione:</span>
                  <span className="font-bold text-slate-800">
                    Tessera N° {currentUser?.member_number}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {currentUser?.full_name || `Socio ${currentUser?.member_number}`}
                </div>
              </div>

              {/* Email di notifica */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Email per Ricevuta e Conferma *
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={bookingEmail}
                    onChange={(e) => setBookingEmail(e.target.value)}
                    placeholder="la-tua-email@esempio.it"
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Ti invieremo la ricevuta in PDF con il riepilogo a questo indirizzo.
                </p>
              </div>

              {/* Telefono opzionale */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Telefono / Cellulare (opzionale)
                </label>
                <div className="relative">
                  <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={bookingTelefono}
                    onChange={(e) => setBookingTelefono(e.target.value)}
                    placeholder="340 1234567"
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Selezione Numero Posti (1 o 2 se consentito) */}
              {bookingEvento.max_posti_per_socio === 2 && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Quanti posti desideri prenotare?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBookingNumPosti(1)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        bookingNumPosti === 1
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      1 Posto (Solo per me)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingNumPosti(2)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        bookingNumPosti === 2
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      2 Posti (Io + Coniuge/Ospite)
                    </button>
                  </div>
                </div>
              )}

              {/* Dati del 2° Ospite se selezionati 2 posti */}
              {bookingNumPosti === 2 && (
                <div className="rounded-2xl bg-amber-50/50 border border-amber-200 p-3 space-y-2.5">
                  <span className="text-xs font-bold text-amber-950 block">
                    Dati del Coniuge / 2° Accompagnatore
                  </span>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">
                      Nome e Cognome Coniuge *
                    </label>
                    <input
                      type="text"
                      required
                      value={bookingOspiteNome}
                      onChange={(e) => setBookingOspiteNome(e.target.value)}
                      placeholder="Nome e Cognome"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">
                      N° Tessera se anche lui/lei è socio/a (opzionale)
                    </label>
                    <input
                      type="text"
                      value={bookingOspiteTessera}
                      onChange={(e) => setBookingOspiteTessera(e.target.value)}
                      placeholder="es. 125"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Riepilogo Quota / Pagamento */}
              <div className="rounded-2xl bg-slate-100 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Totale da Saldate:</span>
                  <span>
                    {getEventoCosto(bookingEvento) > 0
                      ? `€ ${(getEventoCosto(bookingEvento) * bookingNumPosti).toFixed(2)}`
                      : 'Gratuito'}
                  </span>
                </div>
                {getEventoCosto(bookingEvento) > 0 && (
                  <p className="text-[11px] text-slate-600">
                    Il pagamento verrà regolarizzato presso la segreteria dell'associazione.
                  </p>
                )}
              </div>

              {/* Azioni Modale */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBookingEvento(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  {bookingLoading ? (
                    <span>Registrazione in corso...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Conferma Prenotazione</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA AVVENUTA PRENOTAZIONE CON RICEVUTA PDF */}
      {confirmedBookingResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-xl border border-emerald-100 my-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">Prenotazione Registrata!</h3>
              <p className="text-xs text-slate-600">
                La tua richiesta per <strong>{confirmedBookingResult.evento.titolo}</strong> è stata acquisita con successo.
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-1 text-xs">
              <div className="text-slate-500">Codice di Prenotazione Ufficiale:</div>
              <div className="text-lg font-mono font-bold text-emerald-900 tracking-wider">
                {confirmedBookingResult.prenotazione.booking_code || confirmedBookingResult.prenotazione.id}
              </div>
              <div className="text-[11px] text-emerald-800 pt-1">
                Stato:{' '}
                {confirmedBookingResult.prenotazione.stato === 'confermata' ? (
                  <strong className="text-emerald-900">Confermata ✓</strong>
                ) : (
                  <strong className="text-amber-800">
                    In Lista d'Attesa (#{confirmedBookingResult.prenotazione.posizione_attesa || 1})
                  </strong>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Una copia della ricevuta è stata inviata all'indirizzo email indicato. Puoi anche scaricarla subito in formato PDF:
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  downloadPrenotazionePdf(
                    confirmedBookingResult.prenotazione,
                    confirmedBookingResult.evento
                  )
                }
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                <span>Scarica Ricevuta Ufficiale PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmedBookingResult(null)}
                className="w-full py-2 px-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE MODIFICA PRENOTAZIONE (Socio) */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-xl border border-slate-100 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Modifica la tua Prenotazione
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingBooking.evento.titolo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBooking} className="space-y-3.5">
              {/* Selezione Numero Posti: 1 o 2 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Numero di Partecipanti
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditBookingNumPosti(1)}
                    className={`p-3 rounded-2xl border text-center transition ${
                      editBookingNumPosti === 1
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm block">1 Posto</span>
                    <span className="text-[11px] text-slate-500 font-normal">Solo per me</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditBookingNumPosti(2)}
                    className={`p-3 rounded-2xl border text-center transition ${
                      editBookingNumPosti === 2
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm block">2 Posti</span>
                    <span className="text-[11px] text-slate-500 font-normal">Con Coniuge/Accompagnatore</span>
                  </button>
                </div>
              </div>

              {/* Dati del 2° Ospite se selezionati 2 posti */}
              {editBookingNumPosti === 2 && (
                <div className="rounded-2xl bg-amber-50/50 border border-amber-200 p-3 space-y-2.5">
                  <span className="text-xs font-bold text-amber-950 block">
                    Dati del Coniuge / 2° Accompagnatore
                  </span>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">
                      Nome e Cognome Coniuge *
                    </label>
                    <input
                      type="text"
                      required
                      value={editBookingOspiteNome}
                      onChange={(e) => setEditBookingOspiteNome(e.target.value)}
                      placeholder="Nome e Cognome"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">
                      N° Tessera se anche lui/lei è socio/a (opzionale)
                    </label>
                    <input
                      type="text"
                      value={editBookingOspiteTessera}
                      onChange={(e) => setEditBookingOspiteTessera(e.target.value)}
                      placeholder="es. 125"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Recapiti socio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700">Email di Contatto</label>
                  <input
                    type="email"
                    value={editBookingEmail}
                    onChange={(e) => setEditBookingEmail(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700">Telefono</label>
                  <input
                    type="tel"
                    value={editBookingTelefono}
                    onChange={(e) => setEditBookingTelefono(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700">Note o Esigenze particolari</label>
                <input
                  type="text"
                  value={editBookingNote}
                  onChange={(e) => setEditBookingNote(e.target.value)}
                  placeholder="Es. allergie alimentari, posto sedia a rotelle..."
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs mt-1"
                />
              </div>

              {/* Riepilogo Quota / Pagamento */}
              <div className="rounded-2xl bg-slate-100 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Totale Quota Prevista:</span>
                  <span>
                    {getEventoCosto(editingBooking.evento) > 0
                      ? `€ ${(getEventoCosto(editingBooking.evento) * editBookingNumPosti).toFixed(2)}`
                      : 'Gratuito'}
                  </span>
                </div>
              </div>

              {/* Azioni Modale */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={editBookingLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  {editBookingLoading ? (
                    <span>Salvataggio in corso...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Salva Modifiche</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / MODALE STAFF: ELENCO PRENOTATI & OSPITI (Solo CD) */}
      {guestListEvento && canManage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 space-y-4 shadow-xl border border-slate-200 my-8 max-h-[90vh] flex flex-col">
            {/* Header Drawer */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Segreteria & Staff · Elenco Iscritti
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">{guestListEvento.titolo}</h3>
                <p className="text-xs text-slate-500">
                  {(() => {
                    const d = getEventoDate(guestListEvento);
                    return !isNaN(d.getTime())
                      ? d.toLocaleDateString('it-IT', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                  })()}{' '}
                  · {guestListEvento.luogo}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGuestListEvento(null)}
                className="p-1 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Statistiche Rapide */}
            {(() => {
              const prenotazioniEvento = eventiPrenotazioni.filter(
                (p) => p.evento_id === guestListEvento.id && p.stato !== 'annullata'
              );
              const confermati = prenotazioniEvento.filter((p) => p.stato === 'confermata');
              const postiConfermati = confermati.reduce((acc, p) => acc + p.num_posti, 0);
              const inAttesaList = prenotazioniEvento.filter((p) => p.stato === 'lista_attesa');
              const postiInAttesa = inAttesaList.reduce((acc, p) => acc + p.num_posti, 0);
              const incassoPrevisto = prenotazioniEvento.reduce((acc, p) => acc + (p.quota_totale || 0), 0);

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-2.5 text-center">
                    <span className="text-[11px] font-medium text-emerald-800">Posti Confermati</span>
                    <div className="text-lg font-bold text-emerald-950">
                      {postiConfermati} / {guestListEvento.totale_posti}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-2.5 text-center">
                    <span className="text-[11px] font-medium text-amber-800">In Lista d'Attesa</span>
                    <div className="text-lg font-bold text-amber-950">{postiInAttesa}</div>
                  </div>
                  <div className="rounded-2xl bg-blue-50 border border-blue-200 p-2.5 text-center">
                    <span className="text-[11px] font-medium text-blue-800">Posti Online Residui</span>
                    <div className="text-lg font-bold text-blue-950">
                      {calcolaPostiResiduiOnline(guestListEvento, eventiPrenotazioni)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-purple-50 border border-purple-200 p-2.5 text-center">
                    <span className="text-[11px] font-medium text-purple-800">Incasso Previsto</span>
                    <div className="text-lg font-bold text-purple-950">€ {incassoPrevisto.toFixed(2)}</div>
                  </div>
                </div>
              );
            })()}

            {/* Barra Ricerca ed Export */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  placeholder="Cerca socio o ospite per nome, tessera..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setReportEvento(guestListEvento)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                  title="Visualizza e Stampa Report Completo Ingressi e Lista d'Attesa"
                >
                  <Printer className="h-4 w-4 text-emerald-700" />
                  <span>Report Ingressi & Attesa</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportGuestsExcel(guestListEvento)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportGuestsPdf(guestListEvento)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <FileDown className="h-4 w-4 text-emerald-700" />
                  <span>PDF Presenze</span>
                </button>
              </div>
            </div>

            {/* Tabella Iscritti */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-3">Codice</th>
                    <th className="p-3">Tessera</th>
                    <th className="p-3">Titolare</th>
                    <th className="p-3">2° Ospite</th>
                    <th className="p-3 text-center">Posti</th>
                    <th className="p-3">Stato</th>
                    <th className="p-3">Pagamento</th>
                    <th className="p-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eventiPrenotazioni
                    .filter((p) => p.evento_id === guestListEvento.id && p.stato !== 'annullata')
                    .filter((p) => {
                      if (!guestSearch.trim()) return true;
                      const q = guestSearch.toLowerCase();
                      return (
                        p.socio_nominativo.toLowerCase().includes(q) ||
                        p.socio_tessera.toLowerCase().includes(q) ||
                        p.ospite_nominativo?.toLowerCase().includes(q) ||
                        p.booking_code?.toLowerCase().includes(q)
                      );
                    })
                    .map((pren) => {
                      return (
                        <tr key={pren.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-mono font-semibold text-emerald-900 whitespace-nowrap">
                            {pren.booking_code || pren.id}
                          </td>
                          <td className="p-3 font-medium whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-bold">
                              {pren.socio_tessera}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-900">
                            <div>{pren.socio_nominativo}</div>
                            {pren.socio_email && (
                              <div className="text-[10px] text-slate-500 font-normal">{pren.socio_email}</div>
                            )}
                          </td>
                          <td className="p-3 text-slate-700">
                            {pren.num_posti === 2 ? (
                              <div>
                                <span className="font-medium">{pren.ospite_nominativo}</span>
                                {pren.ospite_tessera && (
                                  <span className="text-[10px] text-slate-500 block">
                                    Tessera {pren.ospite_tessera}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800">{pren.num_posti}</td>
                          <td className="p-3 whitespace-nowrap">
                            {pren.stato === 'confermata' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Confermato
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                In Attesa (#{pren.posizione_attesa || 1})
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {(guestListEvento.costo_biglietto || 0) <= 0 ? (
                              <span className="text-slate-500">Gratuito</span>
                            ) : (
                              <select
                                value={pren.stato_pagamento}
                                onChange={(e) =>
                                  aggiornaStatoPagamentoPrenotazione(
                                    pren.id,
                                    e.target.value as 'gratuito' | 'da_pagare_in_sede' | 'pagato'
                                  )
                                }
                                className={`text-[11px] font-semibold rounded-lg px-2 py-1 border ${
                                  pren.stato_pagamento === 'pagato'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                <option value="da_pagare_in_sede">Da saldare in sede</option>
                                <option value="pagato">Pagato ✓</option>
                              </select>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap space-x-1">
                            {pren.stato === 'lista_attesa' && (
                              <button
                                type="button"
                                onClick={() => promuoviDaListaAttesa(pren.id)}
                                className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px]"
                                title="Promuovi a Confermato"
                              >
                                Promuovi
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => downloadPrenotazionePdf(pren, guestListEvento)}
                              className="p-1 rounded text-slate-600 hover:bg-slate-200"
                              title="Scarica Ricevuta PDF"
                            >
                              <FileDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Vuoi annullare la prenotazione di ${pren.socio_nominativo}?`)) {
                                  annullaPrenotazione(pren.id);
                                }
                              }}
                              className="p-1 rounded text-rose-600 hover:bg-rose-50"
                              title="Annulla Prenotazione"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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

      {/* MODALE REPORT INGRESSI & LISTA D'ATTESA (ESCLUSIVO PER IL CD) */}
      {reportEvento && canManage && (() => {
        const prenotazioniEvento = eventiPrenotazioni.filter(
          (p) => p.evento_id === reportEvento.id && p.stato !== 'annullata'
        );
        const confermati = prenotazioniEvento.filter((p) => p.stato === 'confermata');
        const inAttesaList = prenotazioniEvento
          .filter((p) => p.stato === 'lista_attesa')
          .sort((a, b) => (a.posizione_attesa || 0) - (b.posizione_attesa || 0));

        const totaleCapienza = getEventoPostiTotali(reportEvento);
        const postiConfermati = confermati.reduce((acc, p) => acc + p.num_posti, 0);
        const postiInAttesa = inAttesaList.reduce((acc, p) => acc + p.num_posti, 0);
        const postiResidui = Math.max(0, totaleCapienza - postiConfermati);

        const d = getEventoDate(reportEvento);
        const dataStr = !isNaN(d.getTime())
          ? d.toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : reportEvento.data_evento || '';

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-6 space-y-5 shadow-2xl border border-slate-200 my-8 max-h-[92vh] flex flex-col">
              {/* Header Modale Report */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
                      Uso Esclusivo CD
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Controllo Ingressi Giorno Evento</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{reportEvento.titolo}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    📅 {dataStr} · 📍 {reportEvento.luogo || 'Sede Sociale'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintEventReport(reportEvento)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-900 shadow-sm transition"
                    title="Stampa foglio per l'accoglienza all'ingresso"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Stampa Foglio Ingressi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportGuestsPdf(reportEvento)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                    title="Scarica PDF"
                  >
                    <FileDown className="h-4 w-4 text-emerald-700" />
                    <span className="hidden sm:inline">PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportGuestsExcel(reportEvento)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                    title="Scarica Excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                    <span className="hidden sm:inline">Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportEvento(null)}
                    className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                    title="Chiudi"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Statistiche Riassuntive */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                  <span className="text-xs font-semibold text-emerald-800">Posti Confermati</span>
                  <div className="text-xl font-bold text-emerald-950 mt-0.5">
                    {postiConfermati} <span className="text-xs text-emerald-700 font-normal">/ {totaleCapienza}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-blue-50 border border-blue-200 p-3 text-center">
                  <span className="text-xs font-semibold text-blue-800">Posti Disponibili</span>
                  <div className="text-xl font-bold text-blue-950 mt-0.5">{postiResidui}</div>
                </div>

                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-center">
                  <span className="text-xs font-semibold text-amber-800">In Lista d'Attesa</span>
                  <div className="text-xl font-bold text-amber-950 mt-0.5">{postiInAttesa}</div>
                </div>

                <div className="rounded-2xl bg-slate-100 border border-slate-200 p-3 text-center">
                  <span className="text-xs font-semibold text-slate-700">Quota Persona</span>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {(getEventoCosto(reportEvento) || 0) > 0 ? `€ ${Number(getEventoCosto(reportEvento)).toFixed(2)}` : 'Gratuito'}
                  </div>
                </div>
              </div>

              {/* Contenuto Scorrevole con le due tabelle */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {/* SEZIONE 1: CONFERMATI */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        1. Persone Prenotate & Confermate ({confermati.length} prenotazioni · {postiConfermati} posti)
                      </h4>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-emerald-900 text-white font-semibold uppercase tracking-wider text-[11px]">
                          <th className="p-2.5 text-center w-10">N°</th>
                          <th className="p-2.5">Codice</th>
                          <th className="p-2.5 text-center">Tessera</th>
                          <th className="p-2.5">Socio Intestatario</th>
                          <th className="p-2.5">2° Ospite / Coniuge</th>
                          <th className="p-2.5 text-center">Posti</th>
                          <th className="p-2.5 text-center">Quota / Pagamento</th>
                          <th className="p-2.5 text-center w-28">Check-in Ingresso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {confermati.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-slate-500 italic">
                              Nessuna prenotazione confermata per questo evento.
                            </td>
                          </tr>
                        ) : (
                          confermati.map((pren, idx) => (
                            <tr key={pren.id} className="hover:bg-slate-50 transition">
                              <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-600 font-medium">
                                {pren.booking_code || pren.id.slice(0, 8)}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-900">
                                {pren.socio_tessera}
                              </td>
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-900">{pren.socio_nominativo}</div>
                                {pren.socio_telefono && (
                                  <div className="text-[10px] text-slate-500">📞 {pren.socio_telefono}</div>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-700">
                                {pren.ospite_nominativo ? (
                                  <div>
                                    <span className="font-medium">{pren.ospite_nominativo}</span>
                                    {pren.ospite_tessera && (
                                      <span className="text-[10px] text-slate-500 block">Tess. {pren.ospite_tessera}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-bold text-emerald-900">
                                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  {pren.num_posti}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                {pren.stato_pagamento === 'pagato' ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    PAGATO (€ {(pren.quota_totale || 0).toFixed(2)})
                                  </span>
                                ) : pren.stato_pagamento === 'gratuito' ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                                    GRATUITO
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                                    DA SALDARE (€ {(pren.quota_totale || 0).toFixed(2)})
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-500 text-[11px] font-medium shadow-2xs">
                                  [ ] Spunta
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SEZIONE 2: LISTA D'ATTESA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        2. Lista d'Attesa — In Ordine di Priorità ({inAttesaList.length} soci in attesa · {postiInAttesa} posti)
                      </h4>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-amber-800 text-white font-semibold uppercase tracking-wider text-[11px]">
                          <th className="p-2.5 text-center w-16">Priorità</th>
                          <th className="p-2.5 text-center">Tessera</th>
                          <th className="p-2.5">Socio Richiedente</th>
                          <th className="p-2.5 text-center">Posti</th>
                          <th className="p-2.5">Contatti (Telefono / Email)</th>
                          <th className="p-2.5">Note Richiesta</th>
                          <th className="p-2.5 text-center w-28">Ammissione</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {inAttesaList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-slate-500 italic">
                              Nessuna prenotazione attualmente in lista d'attesa.
                            </td>
                          </tr>
                        ) : (
                          inAttesaList.map((pren, idx) => (
                            <tr key={pren.id} className="hover:bg-amber-50/40 transition">
                              <td className="p-2.5 text-center font-bold text-amber-700 bg-amber-50/60">
                                #{pren.posizione_attesa || (idx + 1)}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-900">
                                {pren.socio_tessera}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-900">
                                {pren.socio_nominativo}
                              </td>
                              <td className="p-2.5 text-center font-bold text-amber-900">
                                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  {pren.num_posti}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-700">
                                {pren.socio_telefono && (
                                  <div className="font-semibold text-emerald-800">📞 {pren.socio_telefono}</div>
                                )}
                                {pren.socio_email && (
                                  <div className="text-[10px] text-slate-500">✉️ {pren.socio_email}</div>
                                )}
                                {!pren.socio_telefono && !pren.socio_email && (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-600 italic">
                                {pren.note_staff || '—'}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="inline-block px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-bold">
                                  Subentro
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer Modale */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>Foglio predisposto per la verifica all'ingresso da parte del personale del Consiglio Direttivo</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintEventReport(reportEvento)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 text-white font-semibold hover:bg-emerald-900 transition shadow-sm"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Stampa per il giorno dell'evento</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODALE NUOVO / MODIFICA EVENTO */}
      {showEventModal && editingEvento && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingEvento.id ? "Modifica Evento" : "Crea Nuovo Evento"}
              </h3>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="p-1 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEventoForm} className="space-y-3.5 text-xs">
              {/* Titolo e Tipologia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-semibold text-slate-700">Titolo dell'Evento *</label>
                  <input
                    type="text"
                    required
                    value={editingEvento.titolo || ''}
                    onChange={(e) => setEditingEvento({ ...editingEvento, titolo: e.target.value })}
                    placeholder="es. Proiezione Film 'Nuovo Cinema Paradiso'"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Tipologia Attività *</label>
                  <select
                    value={editingEvento.tipo_attivita_id || ''}
                    onChange={(e) => setEditingEvento({ ...editingEvento, tipo_attivita_id: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    {eventiTipologie.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Anno Accademico *</label>
                  <input
                    type="text"
                    required
                    value={editingEvento.anno_accademico || '2026/2027'}
                    onChange={(e) => setEditingEvento({ ...editingEvento, anno_accademico: e.target.value })}
                    placeholder="2026/2027"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* Data Inizio e Luogo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Data e Ora Evento *</label>
                  <input
                    type="datetime-local"
                    required
                    value={editingEvento.data_ora_evento ? editingEvento.data_ora_evento.slice(0, 16) : ''}
                    onChange={(e) => setEditingEvento({ ...editingEvento, data_ora_evento: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Luogo di Svolgimento *</label>
                  <input
                    type="text"
                    required
                    value={editingEvento.luogo || ''}
                    onChange={(e) => setEditingEvento({ ...editingEvento, luogo: e.target.value })}
                    placeholder="Sede Sociale, Cinema Odissea, ecc."
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* Timer Apertura e Chiusura Prenotazioni (Messa in onda) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-emerald-900">
                    Apertura Prenotazioni (Timer di Messa in Onda) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={editingEvento.apertura_prenotazioni ? editingEvento.apertura_prenotazioni.slice(0, 16) : ''}
                    onChange={(e) => setEditingEvento({ ...editingEvento, apertura_prenotazioni: e.target.value })}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Prima di questa data il socio vedrà un countdown in diretta.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-800">Chiusura Prenotazioni *</label>
                  <input
                    type="datetime-local"
                    required
                    value={editingEvento.chiusura_prenotazioni ? editingEvento.chiusura_prenotazioni.slice(0, 16) : ''}
                    onChange={(e) => setEditingEvento({ ...editingEvento, chiusura_prenotazioni: e.target.value })}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* Capienza Posti e Regole */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Posti Totali</label>
                  <input
                    type="number"
                    min="1"
                    value={editingEvento.totale_posti ?? 60}
                    onChange={(e) => setEditingEvento({ ...editingEvento, totale_posti: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Posti Online</label>
                  <input
                    type="number"
                    min="1"
                    value={editingEvento.posti_prenotabili_online ?? 50}
                    onChange={(e) =>
                      setEditingEvento({ ...editingEvento, posti_prenotabili_online: Number(e.target.value) })
                    }
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Max Posti/Socio</label>
                  <select
                    value={editingEvento.max_posti_per_socio ?? 1}
                    onChange={(e) =>
                      setEditingEvento({ ...editingEvento, max_posti_per_socio: Number(e.target.value) as 1 | 2 })
                    }
                    className="w-full h-9 px-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value={1}>1 (Solo socio)</option>
                    <option value={2}>2 (Socio + Coniuge)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Lista Attesa Max</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEvento.limite_lista_attesa ?? 15}
                    onChange={(e) =>
                      setEditingEvento({ ...editingEvento, limite_lista_attesa: Number(e.target.value) })
                    }
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* Costo e Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Costo Biglietto a persona (€)</label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={editingEvento.costo_biglietto ?? 0}
                    onChange={(e) => setEditingEvento({ ...editingEvento, costo_biglietto: Number(e.target.value) })}
                    placeholder="0 per evento gratuito"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(editingEvento.richiede_pagamento_sede)}
                      onChange={(e) =>
                        setEditingEvento({ ...editingEvento, richiede_pagamento_sede: e.target.checked })
                      }
                      className="h-4 w-4 accent-emerald-700 rounded"
                    />
                    <span className="font-semibold text-slate-800">
                      Richiede pagamento / conferma in sede
                    </span>
                  </label>
                </div>
              </div>

              {/* Descrizione */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Descrizione o Programma dell'evento</label>
                <textarea
                  rows={3}
                  value={editingEvento.descrizione || ''}
                  onChange={(e) => setEditingEvento({ ...editingEvento, descrizione: e.target.value })}
                  placeholder="Dettagli sul film, relatore, note logistiche..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              {/* Azioni Form */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs"
                >
                  Salva Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE GESTIONE TIPOLOGIE ATTIVITÀ */}
      {showTipologieModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Gestione Tipologie Attività</h3>
              <button
                type="button"
                onClick={() => setShowTipologieModal(false)}
                className="p-1 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Nuova Tipologia */}
            <form onSubmit={handleAddTipologia} className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2.5 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-700 block">
                + Nuova Tipologia
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nome (es. Spettacoli Teatrali)"
                  value={newTipoNome}
                  onChange={(e) => setNewTipoNome(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white sm:col-span-2"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={newTipoColore}
                    onChange={(e) => setNewTipoColore(e.target.value)}
                    className="h-8 w-10 p-0.5 rounded-lg border border-slate-200 bg-white cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-slate-600">{newTipoColore}</span>
                </div>
              </div>
              <input
                type="text"
                placeholder="Breve descrizione (opzionale)"
                value={newTipoDesc}
                onChange={(e) => setNewTipoDesc(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white"
              />
              <button
                type="submit"
                className="h-8 px-3 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition"
              >
                Aggiungi Tipologia
              </button>
            </form>

            {/* Elenco Tipologie Esistenti */}
            <div className="space-y-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500 block">
                Tipologie Attive ({eventiTipologie.length})
              </span>
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {eventiTipologie.map((tipo) => {
                  const numEventi = eventi.filter((e) => getEventoTipoId(e) === tipo.id).length;
                  return (
                    <div key={tipo.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: tipo.colore }}
                        />
                        <div>
                          <div className="font-bold text-slate-900">{tipo.nome}</div>
                          {tipo.descrizione && (
                            <div className="text-[11px] text-slate-500">{tipo.descrizione}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">{numEventi} eventi</span>
                        {!tipo.is_default && (
                          <button
                            type="button"
                            onClick={() => {
                              if (numEventi > 0) {
                                alert(`Non puoi eliminare questa tipologia perché contiene ${numEventi} eventi associati.`);
                                return;
                              }
                              if (window.confirm(`Vuoi eliminare la tipologia "${tipo.nome}"?`)) {
                                deleteTipoAttivita(tipo.id);
                              }
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Elimina tipologia"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
