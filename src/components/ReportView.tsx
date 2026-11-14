import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Wallet,
  Users,
  Calendar,
  Building,
  Compass,
  Zap,
  Scale,
  Download,
  Loader2,
  CheckCircle2,
  Edit2,
  Save,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Teacher,
  INITIAL_TEACHERS,
  exportRegistroCassaXls,
  exportRegistroCassaPdf,
  exportAnagraficaDocentiXls,
  exportAnagraficaDocentiPdf,
  exportPresenzeDocentiXls,
  exportPresenzeDocentiPdf,
  exportSoleminisXls,
  exportSoleminisPdf,
  exportLezioniCampoReportXls,
  exportLezioniCampoReportPdf,
  exportBuoniBenzinaXls,
  exportBuoniBenzinaPdf,
  computeModelloAAttivo,
  computeModelloAPassivo,
  computeModelloBRendiconto,
  recalculateMinisterialTree,
  exportModelliMinisterialiXls,
  exportModelloAPdf,
  exportModelloBPdf,
  LOCATION_LABELS,
} from '../data/reportData';

export const ReportView: React.FC = () => {
  const {
    cassaRecords,
    lezioniCampo,
    lezioniCampoPayments,
    bilanci,
    bilancioConti,
  } = useApp();

  const [teachers] = useState<Teacher[]>(INITIAL_TEACHERS);

  // Stati di caricamento per i download
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // 1. Registro Cassa
  const [cassaPeriodo, setCassaPeriodo] = useState<string>('tutti');
  const [cassaStato, setCassaStato] = useState<string>('tutti');

  // 2. Presenze Docenti
  const [presenzeMese, setPresenzeMese] = useState<string>('2026-11');
  const [presenzeSede, setPresenzeSede] = useState<string>('tutte');

  // 3. Comune di Soleminis
  const [soleminisPeriodo, setSoleminisPeriodo] = useState<string>('tutti');

  // 4. Buoni Benzina
  const [buoniMese, setBuoniMese] = useState<string>('2026-11');

  // 5. Modelli Ministeriali Bilanci
  const availableBilanci = useMemo(() => {
    return bilanci && bilanci.length > 0
      ? bilanci
      : [
          {
            id: 'bil-2026-2027',
            anno_inizio: 2026,
            anno_fine: 2027,
            esercizio: '2026/2027',
            chiuso: false,
            descrizione: 'Esercizio Finanziario Ordinario',
          },
          {
            id: 'bil-2025-2026',
            anno_inizio: 2025,
            anno_fine: 2026,
            esercizio: '2025/2026',
            chiuso: true,
            descrizione: 'Esercizio Finanziario Consuntivato',
          },
        ];
  }, [bilanci]);

  const [selectedBilancioId, setSelectedBilancioId] = useState<string>(
    availableBilanci[0]?.id || 'bil-2026-2027'
  );
  const [ministerialTab, setMinisterialTab] = useState<'A' | 'B'>('A');

  // Valori dell'anno precedente per i modelli ministeriali (salvati in localStorage)
  const [prevYearValues, setPrevYearValues] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('q3_ministerial_prev_year');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Valori seed verosimili per l'esercizio precedente
    return {
      att_impianti: 2850.0,
      att_attrezzature: 1420.0,
      att_altri_beni: 950.0,
      att_cred_tributari: 180.0,
      att_cred_altri: 430.0,
      att_depositi: 24500.0,
      att_cassa: 1250.0,
      pas_fondo_dotazione: 2582.28,
      pas_riserve_utili: 18450.0,
      pas_risultato: 4210.0,
      pas_tfr: 0.0,
      pas_deb_fornitori: 1120.0,
      pas_deb_tributari: 340.0,
      mb_a_materie: 1650.0,
      mb_a_servizi: 38900.0,
      mb_a_godimento: 12500.0,
      mb_a_personale: 0.0,
      mb_a_ammortamenti: 1150.0,
      mb_a_oneri_diversi: 2450.0,
      mb_a_quote: 48900.0,
      mb_a_prestazioni_soci: 8200.0,
      mb_a_liberalita: 1500.0,
      mb_a_cinque_mille: 2150.0,
      mb_a_contributi_enti: 1500.0,
      mb_a_altri_proventi: 350.0,
    };
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValStr, setEditingValStr] = useState<string>('');

  // Conti per il bilancio selezionato
  const activeConti = useMemo(() => {
    return bilancioConti.filter((c) => c.bilancio_id === selectedBilancioId);
  }, [bilancioConti, selectedBilancioId]);

  const attivoItems = useMemo(() => computeModelloAAttivo(activeConti), [activeConti]);
  const passivoItems = useMemo(() => computeModelloAPassivo(activeConti), [activeConti]);
  const rendicontoItems = useMemo(() => computeModelloBRendiconto(activeConti), [activeConti]);

  const recalculatedPrevYear = useMemo(() => {
    return recalculateMinisterialTree(prevYearValues);
  }, [prevYearValues]);

  const handleSavePrevYearValue = (key: string) => {
    const num = parseFloat(editingValStr.replace(',', '.')) || 0;
    const updated = { ...prevYearValues, [key]: num };
    setPrevYearValues(updated);
    try {
      localStorage.setItem('q3_ministerial_prev_year', JSON.stringify(updated));
    } catch {}
    setEditingKey(null);
    showToast('Valore anno precedente aggiornato');
  };

  const handleSaveAllPrevYear = () => {
    try {
      localStorage.setItem('q3_ministerial_prev_year', JSON.stringify(prevYearValues));
      showToast('Tutti i valori dell\'anno precedente sono stati salvati!');
    } catch {
      alert('Errore durante il salvataggio locale');
    }
  };

  // Esecutore con gestione spinner
  const runAction = async (id: string, action: () => Promise<void>, msg: string) => {
    setLoadingAction(id);
    try {
      await action();
      showToast(msg);
    } catch (err: any) {
      alert(`Errore esportazione: ${err?.message || err}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const selectedBilancioObj =
    availableBilanci.find((b) => b.id === selectedBilancioId) || availableBilanci[0];

  const monthOptions = [
    { value: '2026-11', label: 'Novembre 2026' },
    { value: '2026-10', label: 'Ottobre 2026' },
    { value: '2026-09', label: 'Settembre 2026' },
    { value: '2026-06', label: 'Giugno 2026' },
    { value: '2026-05', label: 'Maggio 2026' },
    { value: '2026-04', label: 'Aprile 2026' },
    { value: '2026-03', label: 'Marzo 2026' },
    { value: '2026-02', label: 'Febbraio 2026' },
    { value: '2026-01', label: 'Gennaio 2026' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* HEADER DELLA SEZIONE */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20">
                <FileSpreadsheet className="h-7 w-7 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Report & Statistiche</h1>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-400/30">
                    QUfficio3
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                  Genera e scarica i report in formato nativo Excel (.xlsx) o PDF ufficiale
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICA SUCCESSO */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* CONTENUTO PRINCIPALE */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* GRIGLIA CARDS DEI 7 REPORT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. REGISTRO CASSA */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <Wallet className="h-5 w-5" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Registro Cassa</h3>
              </div>
              <p className="text-xs text-slate-600">
                Esporta i movimenti del registro cassa e rimborsi spese in Excel o PDF con riepilogo Entrate, Spese e Saldo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Periodo</label>
                  <select
                    value={cassaPeriodo}
                    onChange={(e) => setCassaPeriodo(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:bg-white focus:outline-emerald-600"
                  >
                    <option value="tutti">Tutti i periodi</option>
                    {monthOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Stato</label>
                  <select
                    value={cassaStato}
                    onChange={(e) => setCassaStato(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:bg-white focus:outline-emerald-600"
                  >
                    <option value="tutti">Tutti gli stati</option>
                    <option value="approvato">Approvato</option>
                    <option value="in_attesa">In attesa</option>
                    <option value="rifiutato">Rifiutato</option>
                    <option value="bozza">Bozza</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('cassa-xls', () => exportRegistroCassaXls(cassaRecords, cassaPeriodo, cassaStato), 'Report Registro Cassa (XLS) scaricato con successo')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {loadingAction === 'cassa-xls' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                <span>XLS</span>
              </button>

              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('cassa-pdf', () => exportRegistroCassaPdf(cassaRecords, cassaPeriodo, cassaStato), 'Report Registro Cassa (PDF) scaricato con successo')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50 shadow-2xs"
              >
                {loadingAction === 'cassa-pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-rose-600" />}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* 2. ANAGRAFICA DOCENTI */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <Users className="h-5 w-5" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Anagrafica Docenti</h3>
              </div>
              <p className="text-xs text-slate-600">
                Matricola, Cognome Nome, Sede, Contratto, Orario, Tariffa Lorda e Netta per tutti i 77 docenti registrati.
              </p>
              <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Totale Docenti Attivi:</span>
                  <span className="font-bold text-slate-900">{teachers.filter((t) => t.is_active).length} docenti</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Sedi: Quartu, Soleminis, Plurisede</span>
                  <span>Co.Co.Co, P.IVA, Buoni Benzina</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('docenti-xls', () => exportAnagraficaDocentiXls(teachers), 'Anagrafica Docenti (XLS) scaricata')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {loadingAction === 'docenti-xls' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                <span>XLS</span>
              </button>

              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('docenti-pdf', () => exportAnagraficaDocentiPdf(teachers), 'Anagrafica Docenti (PDF) scaricata')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50 shadow-2xs"
              >
                {loadingAction === 'docenti-pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-rose-600" />}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* 3. PRESENZE DOCENTI */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <Calendar className="h-5 w-5" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Presenze Docenti</h3>
              </div>
              <p className="text-xs text-slate-600">
                Dettaglio giorni e ore di docenza per mese con matrice completa giorni 1..31 in Excel e prospetto PDF.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Mese</label>
                  <select
                    value={presenzeMese}
                    onChange={(e) => setPresenzeMese(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:bg-white focus:outline-emerald-600"
                  >
                    {monthOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Sede</label>
                  <select
                    value={presenzeSede}
                    onChange={(e) => setPresenzeSede(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:bg-white focus:outline-emerald-600"
                  >
                    <option value="tutte">Tutte le sedi</option>
                    <option value="quartu">Quartu</option>
                    <option value="soleminis">Soleminis</option>
                    <option value="plurisede">Plurisede</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('presenze-xls', () => exportPresenzeDocentiXls(teachers, presenzeMese, presenzeSede), 'Presenze Docenti (XLS) scaricato')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {loadingAction === 'presenze-xls' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                <span>XLS</span>
              </button>

              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('presenze-pdf', () => exportPresenzeDocentiPdf(teachers, presenzeMese, presenzeSede), 'Presenze Docenti (PDF) scaricato')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50 shadow-2xs"
              >
                {loadingAction === 'presenze-pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-rose-600" />}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* 4. COMUNE DI SOLEMINIS */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <Building className="h-5 w-5" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Comune di Soleminis</h3>
              </div>
              <p className="text-xs text-slate-600">
                Matricola, Cognome Nome, Tipo Contratto, Ore svolte, Lordo orario e Totale Lordo con riga finale calcolata.
              </p>

              <div className="pt-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Periodo Rendicontazione</label>
                <select
                  value={soleminisPeriodo}
                  onChange={(e) => setSoleminisPeriodo(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:bg-white focus:outline-emerald-600"
                >
                  <option value="tutti">Tutti i periodi</option>
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('soleminis-xls', () => exportSoleminisXls(teachers, soleminisPeriodo), 'Report Soleminis (XLS) scaricato')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {loadingAction === 'soleminis-xls' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                <span>XLS</span>
              </button>

              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('soleminis-pdf', () => exportSoleminisPdf(teachers, soleminisPeriodo), 'Report Soleminis (PDF) scaricato')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50 shadow-2xs"
              >
                {loadingAction === 'soleminis-pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-rose-600" />}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* 5. LEZIONI SUL CAMPO */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <Compass className="h-5 w-5" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Lezioni sul Campo</h3>
              </div>
              <p className="text-xs text-slate-600">
                Esporta le escursioni divise per tipologia (Lezioni sul campo, Visite naturalistiche, Visite della domenica) con costi e ricavi.
              </p>
              <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 flex items-center justify-between">
                <span>Escursioni in Archivio:</span>
                <span className="font-bold text-slate-900">{lezioniCampo.length} uscite</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('escursioni-xls', () => exportLezioniCampoReportXls(lezioniCampo, lezioniCampoPayments), 'Report Escursioni (XLS) scaricato')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {loadingAction === 'escursioni-xls' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                <span>XLS</span>
              </button>

              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('escursioni-pdf', () => exportLezioniCampoReportPdf(lezioniCampo, lezioniCampoPayments), 'Report Escursioni (PDF) scaricato')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50 shadow-2xs"
              >
                {loadingAction === 'escursioni-pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-rose-600" />}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* 6. BUONI BENZINA */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <Zap className="h-5 w-5" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Buoni Benzina</h3>
              </div>
              <p className="text-xs text-slate-600">
                Riepilogo e dettaglio buoni benzina per docenti convenzionati con stato di consegna e data.
              </p>

              <div className="pt-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Mese di Riferimento</label>
                <select
                  value={buoniMese}
                  onChange={(e) => setBuoniMese(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:bg-white focus:outline-emerald-600"
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('buoni-xls', () => exportBuoniBenzinaXls(teachers, buoniMese), 'Report Buoni Benzina (XLS) scaricato')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {loadingAction === 'buoni-xls' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                <span>XLS</span>
              </button>

              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction('buoni-pdf', () => exportBuoniBenzinaPdf(teachers, buoniMese), 'Report Buoni Benzina (PDF) scaricato')
                }
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50 shadow-2xs"
              >
                {loadingAction === 'buoni-pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-rose-600" />}
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* 7. MODELLI MINISTERIALI BILANCI ETS */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-800">
                <Scale className="h-6 w-6" />
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">Modelli Ministeriali Bilanci ETS</h3>
              </div>
              <p className="text-xs text-slate-500 max-w-2xl">
                Modello A (Stato Patrimoniale) e Modello B (Rendiconto Gestionale). I valori dell'anno precedente sono
                modificabili sul posto cliccando direttamente sull'importo o salvabili con il pulsante dedicato.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedBilancioId}
                onChange={(e) => setSelectedBilancioId(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-emerald-600"
              >
                {availableBilanci.map((b) => (
                  <option key={b.id} value={b.id}>
                    Esercizio {b.esercizio}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSaveAllPrevYear}
                className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition shadow-xs"
                title="Salva modifiche ai valori anno precedente"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Salva Valori</span>
              </button>
            </div>
          </div>

          {/* TAB SWITCH MODELLO A / MODELLO B */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setMinisterialTab('A')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  ministerialTab === 'A'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Modello A — Stato Patrimoniale
              </button>
              <button
                type="button"
                onClick={() => setMinisterialTab('B')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  ministerialTab === 'B'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Modello B — Rendiconto Gestionale
              </button>
            </div>

            {/* BOTTONI AZIONE PER I MODELLI MINISTERIALI */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  runAction(
                    'ministeriale-xls',
                    () =>
                      exportModelliMinisterialiXls(
                        selectedBilancioObj,
                        attivoItems,
                        passivoItems,
                        rendicontoItems,
                        recalculatedPrevYear
                      ),
                    'Modelli Ministeriali (XLS) scaricati'
                  )
                }
                className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
              >
                {loadingAction === 'ministeriale-xls' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                )}
                <span>Esporta XLS Completo</span>
              </button>

              {ministerialTab === 'A' ? (
                <button
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() =>
                    runAction(
                      'modello-a-pdf',
                      () =>
                        exportModelloAPdf(selectedBilancioObj, attivoItems, passivoItems, recalculatedPrevYear),
                      'Modello A (PDF) scaricato'
                    )
                  }
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition shadow-xs"
                >
                  {loadingAction === 'modello-a-pdf' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  <span>Scarica PDF Modello A</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() =>
                    runAction(
                      'modello-b-pdf',
                      () => exportModelloBPdf(selectedBilancioObj, rendicontoItems, recalculatedPrevYear),
                      'Modello B (PDF) scaricato'
                    )
                  }
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition shadow-xs"
                >
                  {loadingAction === 'modello-b-pdf' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  <span>Scarica PDF Modello B</span>
                </button>
              )}
            </div>
          </div>

          {/* TABELLA RENDICONTO MINISTERIALE ETS */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-900 text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Voce Ministeriale Ufficiale</th>
                    <th className="py-3 px-4 text-right w-40">
                      Esercizio {selectedBilancioObj.esercizio}
                    </th>
                    <th className="py-3 px-4 text-right w-44">
                      Esercizio Precedente (Modificabile)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ministerialTab === 'A' ? (
                    <>
                      <tr className="bg-emerald-50/70 font-bold text-emerald-950">
                        <td colSpan={3} className="py-2.5 px-4 tracking-wide uppercase text-xs">
                          SEZIONE I — ATTIVO
                        </td>
                      </tr>
                      {attivoItems.map((it) => {
                        const isTotal = it.style === 'total';
                        const isSection = it.style === 'section';
                        const isSubsection = it.style === 'subsection';
                        const prevVal = recalculatedPrevYear[it.key] || 0;

                        return (
                          <tr
                            key={it.key}
                            className={`hover:bg-slate-50 transition ${
                              isTotal
                                ? 'bg-amber-50/60 font-bold text-slate-900 border-t-2 border-b-2 border-slate-300'
                                : isSection
                                ? 'font-bold text-slate-900 bg-slate-50/80'
                                : isSubsection
                                ? 'font-semibold text-slate-800'
                                : 'text-slate-600'
                            }`}
                          >
                            <td className="py-2 px-4" style={{ paddingLeft: `${it.indent * 1.5 + 1}rem` }}>
                              {it.label}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-medium">
                              {it.value !== 0
                                ? `€ ${it.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '-'}
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {editingKey === it.key ? (
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <input
                                    type="number"
                                    step="any"
                                    value={editingValStr}
                                    onChange={(e) => setEditingValStr(e.target.value)}
                                    className="w-24 h-7 px-1.5 border border-emerald-500 rounded bg-white text-right text-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSavePrevYearValue(it.key);
                                      if (e.key === 'Escape') setEditingKey(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSavePrevYearValue(it.key)}
                                    className="p-1 rounded bg-emerald-600 text-white"
                                  >
                                    <Save className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKey(it.key);
                                    setEditingValStr(String(prevVal || ''));
                                  }}
                                  className="group inline-flex items-center gap-1 hover:text-emerald-700 hover:underline"
                                  title="Clicca per modificare il valore dell'anno precedente"
                                >
                                  <span>
                                    {prevVal !== 0
                                      ? `€ ${prevVal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : '-'}
                                  </span>
                                  {!isTotal && !isSection && (
                                    <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-slate-400" />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      <tr className="bg-emerald-50/70 font-bold text-emerald-950">
                        <td colSpan={3} className="py-2.5 px-4 tracking-wide uppercase text-xs pt-4">
                          SEZIONE II — PASSIVO E PATRIMONIO NETTO
                        </td>
                      </tr>
                      {passivoItems.map((it) => {
                        const isTotal = it.style === 'total';
                        const isSection = it.style === 'section';
                        const isSubsection = it.style === 'subsection';
                        const prevVal = recalculatedPrevYear[it.key] || 0;

                        return (
                          <tr
                            key={it.key}
                            className={`hover:bg-slate-50 transition ${
                              isTotal
                                ? 'bg-amber-50/60 font-bold text-slate-900 border-t-2 border-b-2 border-slate-300'
                                : isSection
                                ? 'font-bold text-slate-900 bg-slate-50/80'
                                : isSubsection
                                ? 'font-semibold text-slate-800'
                                : 'text-slate-600'
                            }`}
                          >
                            <td className="py-2 px-4" style={{ paddingLeft: `${it.indent * 1.5 + 1}rem` }}>
                              {it.label}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-medium">
                              {it.value !== 0
                                ? `€ ${it.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '-'}
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {editingKey === it.key ? (
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <input
                                    type="number"
                                    step="any"
                                    value={editingValStr}
                                    onChange={(e) => setEditingValStr(e.target.value)}
                                    className="w-24 h-7 px-1.5 border border-emerald-500 rounded bg-white text-right text-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSavePrevYearValue(it.key);
                                      if (e.key === 'Escape') setEditingKey(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSavePrevYearValue(it.key)}
                                    className="p-1 rounded bg-emerald-600 text-white"
                                  >
                                    <Save className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKey(it.key);
                                    setEditingValStr(String(prevVal || ''));
                                  }}
                                  className="group inline-flex items-center gap-1 hover:text-emerald-700 hover:underline"
                                  title="Clicca per modificare il valore dell'anno precedente"
                                >
                                  <span>
                                    {prevVal !== 0
                                      ? `€ ${prevVal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : '-'}
                                  </span>
                                  {!isTotal && !isSection && (
                                    <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-slate-400" />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {rendicontoItems.map((it) => {
                        const isTotal = it.style === 'total';
                        const isSection = it.style === 'section';
                        const isSubsection = it.style === 'subsection';
                        const prevVal = recalculatedPrevYear[it.key] || 0;

                        return (
                          <tr
                            key={it.key}
                            className={`hover:bg-slate-50 transition ${
                              isTotal
                                ? 'bg-amber-50/60 font-bold text-slate-900 border-t-2 border-b-2 border-slate-300'
                                : isSection
                                ? 'font-bold text-slate-900 bg-slate-50/80'
                                : isSubsection
                                ? 'font-semibold text-slate-800'
                                : 'text-slate-600'
                            }`}
                          >
                            <td className="py-2 px-4" style={{ paddingLeft: `${it.indent * 1.5 + 1}rem` }}>
                              {it.label}
                            </td>
                            <td className="py-2 px-4 text-right font-mono font-medium">
                              {it.value !== 0
                                ? `€ ${it.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '-'}
                            </td>
                            <td className="py-2 px-4 text-right font-mono">
                              {editingKey === it.key ? (
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <input
                                    type="number"
                                    step="any"
                                    value={editingValStr}
                                    onChange={(e) => setEditingValStr(e.target.value)}
                                    className="w-24 h-7 px-1.5 border border-emerald-500 rounded bg-white text-right text-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSavePrevYearValue(it.key);
                                      if (e.key === 'Escape') setEditingKey(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSavePrevYearValue(it.key)}
                                    className="p-1 rounded bg-emerald-600 text-white"
                                  >
                                    <Save className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKey(it.key);
                                    setEditingValStr(String(prevVal || ''));
                                  }}
                                  className="group inline-flex items-center gap-1 hover:text-emerald-700 hover:underline"
                                  title="Clicca per modificare il valore dell'anno precedente"
                                >
                                  <span>
                                    {prevVal !== 0
                                      ? `€ ${prevVal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : '-'}
                                  </span>
                                  {!isTotal && !isSection && (
                                    <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-slate-400" />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
