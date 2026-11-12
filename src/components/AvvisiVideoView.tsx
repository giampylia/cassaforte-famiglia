import React, { useState, useRef } from 'react';
import {
  Tv,
  Upload,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Check,
  X,
  Play,
  Pause,
  ExternalLink,
  Sliders,
  MoveUp,
  MoveDown,
  Eye,
  Info,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VideoNotice } from '../data/initialData';

export const AvvisiVideoView: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    isCDMember,
    videoNotices,
    addVideoNotice,
    updateVideoNotice,
    deleteVideoNotice,
    reorderVideoNotices,
    publicUrl,
  } = useApp();

  const [isUploading, setIsUploading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form stato nuovo avviso
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMonthDate = new Date();
  nextMonthDate.setDate(nextMonthDate.getDate() + 30);
  const nextMonthStr = nextMonthDate.toISOString().slice(0, 10);

  const [title, setTitle] = useState('');
  const [tickerText, setTickerText] = useState('');
  const [durationSec, setDurationSec] = useState<number>(7); // Preimpostato 7 secondi
  const [transition, setTransition] = useState<'dissolvenza' | 'scorrimento' | 'zoom'>('dissolvenza'); // Preimpostato dissolvenza
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextMonthStr);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  // Editing stato
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTicker, setEditTicker] = useState('');
  const [editDuration, setEditDuration] = useState(7);
  const [editTransition, setEditTransition] = useState<'dissolvenza' | 'scorrimento' | 'zoom'>('dissolvenza');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  // Player anteprima
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const monitorUrl = publicUrl ? `${publicUrl}/monitor` : `${window.location.origin}/monitor`;

  // Controllo autorizzazioni: solo Super Admin (7726 / role admin) o membri con CD Sì
  const canAccess = isSuperAdmin || isCDMember || currentUser?.role === 'admin';

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-600 mb-2" />
          <h2 className="text-lg font-bold">Accesso Riservato</h2>
          <p className="text-sm mt-1 text-rose-700">
            Questa sezione è riservata all&apos;Amministratore e ai componenti del Consiglio Direttivo (CD).
          </p>
        </div>
      </div>
    );
  }

  // Gestione caricamento file immagine / PDF
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFormMsg(null);
    setSelectedFileName(file.name);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        setPreviewImage(base64Data);

        // Upload sul server nella cartella /public/uploads/avvisi
        try {
          const resp = await fetch('/api/upload-avviso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileData: base64Data,
            }),
          });
          const data = await resp.json();
          if (data && data.ok && data.url) {
            setUploadedImageUrl(data.url);
            setFormMsg({
              type: 'success',
              text: `✓ File caricato con successo nella cartella avvisi: ${data.fileName}`,
            });
          } else {
            // Fallback con base64 diretto se server offline
            setUploadedImageUrl(base64Data);
          }
        } catch {
          setUploadedImageUrl(base64Data);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setFormMsg({ type: 'error', text: `Errore caricamento file: ${err.message}` });
      setIsUploading(false);
    }
  };

  const handleSubmitNewNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = uploadedImageUrl || previewImage;
    if (!finalUrl) {
      setFormMsg({ type: 'error', text: 'Seleziona un\'immagine orizzontale o un file PDF da allegare.' });
      return;
    }
    if (!title.trim()) {
      setFormMsg({ type: 'error', text: 'Inserisci un titolo o descrizione per l\'avviso.' });
      return;
    }

    const ok = await addVideoNotice({
      title: title.trim(),
      imageUrl: finalUrl,
      tickerText: tickerText.trim() || title.trim(),
      durationSec: Math.max(3, durationSec || 7),
      transition,
      startDate: startDate || todayStr,
      endDate: endDate || nextMonthStr,
      isActive: true,
      orderIndex: videoNotices.length,
    });

    if (ok) {
      setTitle('');
      setTickerText('');
      setDurationSec(7);
      setTransition('dissolvenza');
      setPreviewImage(null);
      setUploadedImageUrl(null);
      setSelectedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFormMsg({ type: 'success', text: '✓ Avviso video salvato e pronto per la proiezione sul monitor!' });
      setTimeout(() => setFormMsg(null), 4000);
    }
  };

  const handleStartEdit = (notice: VideoNotice) => {
    setEditingId(notice.id);
    setEditTitle(notice.title);
    setEditTicker(notice.tickerText);
    setEditDuration(notice.durationSec);
    setEditTransition(notice.transition);
    setEditStartDate(notice.startDate);
    setEditEndDate(notice.endDate);
  };

  const handleSaveEdit = (id: string) => {
    updateVideoNotice(id, {
      title: editTitle.trim(),
      tickerText: editTicker.trim(),
      durationSec: Math.max(3, editDuration || 7),
      transition: editTransition,
      startDate: editStartDate,
      endDate: editEndDate,
    });
    setEditingId(null);
    setFormMsg({ type: 'success', text: '✓ Modifiche all\'avviso salvate.' });
    setTimeout(() => setFormMsg(null), 3000);
  };

  const handleMoveOrder = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= videoNotices.length) return;
    const copy = [...videoNotices];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;
    reorderVideoNotices(copy);
  };

  // Verifica se un avviso è attualmente valido rispetto alla data odierna
  const isNoticeCurrentlyActive = (notice: VideoNotice) => {
    if (!notice.isActive) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (notice.startDate && notice.startDate > today) return false;
    if (notice.endDate && notice.endDate < today) return false;
    return true;
  };

  const activeNoticesList = videoNotices.filter((n) => isNoticeCurrentlyActive(n));

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {/* HEADER PRINCIPALE E LINK PROIEZIONE MONITOR */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-5 sm:p-7 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-200">
              <Tv className="h-3.5 w-3.5" />
              <span>Regia Monitor Sala d&apos;Attesa</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
              Avvisi Video & News Ticker
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Carica immagini orizzontali (JPG, PNG, GIF, PDF) da trasmettere in rotazione continua sullo schermo della sala d&apos;attesa con banda scorrevole (news ticker), transizione a dissolvenza e periodo di programmazione.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setPreviewIndex(0);
                setPreviewModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold transition"
            >
              <Eye className="h-4 w-4" />
              <span>Anteprima Schermo</span>
            </button>

            <a
              href="/monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 px-4 py-2.5 text-xs sm:text-sm font-bold shadow-md transition active:scale-95"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Apri Link Monitor (/monitor)</span>
            </a>
          </div>
        </div>

        {/* BARRA STATISTICHE RAPIDE */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/20 text-xs sm:text-sm">
          <div>
            <span className="text-emerald-200 block text-xs">Totale Avvisi</span>
            <strong className="text-lg text-white font-bold">{videoNotices.length}</strong>
          </div>
          <div>
            <span className="text-emerald-200 block text-xs">Attualmente in Onda</span>
            <strong className="text-lg text-emerald-300 font-bold">{activeNoticesList.length}</strong>
          </div>
          <div>
            <span className="text-emerald-200 block text-xs">Durata Predefinita</span>
            <strong className="text-lg text-white font-bold">7 secondi</strong>
          </div>
          <div>
            <span className="text-emerald-200 block text-xs">Transizione Standard</span>
            <strong className="text-lg text-white font-bold">Dissolvenza</strong>
          </div>
        </div>
      </div>

      {/* FEEDBACK MESSAGGIO */}
      {formMsg && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-4 text-sm font-medium border transition ${
            formMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {formMsg.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <span>{formMsg.text}</span>
        </div>
      )}

      {/* MODULO CARICAMENTO NUOVO AVVISO */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Aggiungi Nuovo Avviso per il Monitor
              </h2>
              <p className="text-xs text-slate-500">
                Allega un&apos;immagine orizzontale o un documento PDF da trasmettere
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 font-medium">
            Formato 16:9 consigliato
          </span>
        </div>

        <form onSubmit={handleSubmitNewNotice} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* AREA CARICAMENTO FILE */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Immagine Orizzontale (JPG, PNG, GIF, PDF) *
              </label>

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition ${
                  previewImage
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-slate-50'
                }`}
                style={{ minHeight: '190px' }}
              >
                {previewImage ? (
                  <div className="w-full space-y-2">
                    <img
                      src={previewImage}
                      alt="Anteprima"
                      className="mx-auto max-h-36 rounded-xl object-contain border border-slate-200 shadow-xs"
                    />
                    <p className="text-xs font-semibold text-emerald-800 truncate">
                      {selectedFileName || 'File pronto per il caricamento'}
                    </p>
                    <span className="inline-block text-[11px] text-slate-500 underline">
                      Clicca per cambiare file
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="mx-auto h-8 w-8 text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {isUploading ? 'Caricamento in corso...' : 'Clicca per scegliere l\'immagine'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        File JPG, PNG, GIF o PDF (salvati automaticamente nella cartella avvisi)
                      </p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* CAMPI DETTAGLIO */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Titolo / Oggetto Avviso *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Es. Iscrizioni Corsi A.A. 2026/2027"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  News Ticker (Banda Scorrevole in Basso sullo Schermo) *
                </label>
                <textarea
                  rows={2}
                  value={tickerText}
                  onChange={(e) => setTickerText(e.target.value)}
                  placeholder="Testo scorrevole trasmesso in basso mentre è visibile quest'immagine..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none resize-none"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Se vuoto, verrà utilizzato il titolo come testo della banda scorrevole.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Transizione
                  </label>
                  <select
                    value={transition}
                    onChange={(e) => setTransition(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="dissolvenza">Dissolvenza (Standard)</option>
                    <option value="scorrimento">Scorrimento Orizzontale</option>
                    <option value="zoom">Zoom Delicato</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Durata (Secondi)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Standard: 7 secondi</p>
                </div>
              </div>

              {/* DATE TRASMISSIONE */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Dal Giorno (Inizio)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Al Giorno (Fine)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUploading || !previewImage}
              className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-md transition ${
                previewImage
                  ? 'bg-emerald-700 hover:bg-emerald-800 cursor-pointer active:scale-95'
                  : 'bg-slate-300 cursor-not-allowed opacity-70'
              }`}
            >
              <Tv className="h-4 w-4" />
              <span>Salva e Programma sul Monitor</span>
            </button>
          </div>
        </form>
      </div>

      {/* ELENCO DEGLI AVVISI PROGRAMMATI */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Avvisi Video in Archivio ({videoNotices.length})
            </h2>
            <p className="text-xs text-slate-500">
              Ordinamento sequenza, modifica parametri e attivazione/disattivazione rapida
            </p>
          </div>
        </div>

        {videoNotices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
            Nessun avviso video attualmente caricato. Utilizza il modulo sopra per caricare la prima immagine orizzontale.
          </div>
        ) : (
          <div className="space-y-3">
            {videoNotices.map((notice, idx) => {
              const inWave = isNoticeCurrentlyActive(notice);
              const isEditing = editingId === notice.id;

              return (
                <div
                  key={notice.id}
                  className={`rounded-2xl border p-4 transition ${
                    notice.isActive
                      ? inWave
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-200 bg-white'
                      : 'border-slate-200 bg-slate-50 opacity-70'
                  }`}
                >
                  {isEditing ? (
                    /* MODALITÀ MODIFICA RIGA */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Titolo</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">News Ticker</label>
                          <input
                            type="text"
                            value={editTicker}
                            onChange={(e) => setEditTicker(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Transizione</label>
                          <select
                            value={editTransition}
                            onChange={(e) => setEditTransition(e.target.value as any)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          >
                            <option value="dissolvenza">Dissolvenza</option>
                            <option value="scorrimento">Scorrimento</option>
                            <option value="zoom">Zoom</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Durata (sec)</label>
                          <input
                            type="number"
                            value={editDuration}
                            onChange={(e) => setEditDuration(Number(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Inizio</label>
                          <input
                            type="date"
                            value={editStartDate}
                            onChange={(e) => setEditStartDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700">Fine</label>
                          <input
                            type="date"
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(notice.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold"
                        >
                          <Check className="h-3.5 w-3.5" /> Salva
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-200 text-slate-700 px-3 py-1.5 text-xs font-semibold"
                        >
                          <X className="h-3.5 w-3.5" /> Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* VISUALIZZAZIONE SCHEDA AVVISO */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* LATO SINISTRO: ANTEPRIMA MINIATURA + INFO */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Miniatura Immagine */}
                        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                          <img
                            src={notice.imageUrl}
                            alt={notice.title}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[9px] font-bold text-white">
                            {notice.durationSec}s
                          </span>
                        </div>

                        {/* Testi e Badge */}
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {notice.title}
                            </span>
                            {inWave ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800 animate-pulse">
                                ● IN ONDA
                              </span>
                            ) : notice.isActive ? (
                              <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                                Programmato
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                Disattivato
                              </span>
                            )}
                          </div>

                          {/* Banda scorrevole anteprima */}
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="font-semibold text-emerald-800 shrink-0">Ticker:</span>
                            <span className="italic truncate text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              &ldquo;{notice.tickerText}&rdquo;
                            </span>
                          </div>

                          {/* Parametri tecnici */}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Dal {notice.startDate || '—'} al {notice.endDate || '—'}
                            </span>
                            <span>·</span>
                            <span>Transizione: {notice.transition}</span>
                            <span>·</span>
                            <span>Durata: {notice.durationSec}s</span>
                          </div>
                        </div>
                      </div>

                      {/* LATO DESTRO: AZIONI RAPIDE */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {/* Sposta su / giù ordinamento */}
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveOrder(idx, 'up')}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          title="Sposta prima"
                        >
                          <MoveUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === videoNotices.length - 1}
                          onClick={() => handleMoveOrder(idx, 'down')}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          title="Sposta dopo"
                        >
                          <MoveDown className="h-4 w-4" />
                        </button>

                        {/* Attiva / Disattiva */}
                        <button
                          type="button"
                          onClick={() => updateVideoNotice(notice.id, { isActive: !notice.isActive })}
                          className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                            notice.isActive
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {notice.isActive ? 'Attivo' : 'Pausa'}
                        </button>

                        {/* Modifica */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(notice)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          title="Modifica parametri"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Elimina */}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Vuoi davvero eliminare l'avviso "${notice.title}"?`)) {
                              deleteVideoNotice(notice.id);
                            }
                          }}
                          className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 cursor-pointer"
                          title="Elimina avviso"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALE ANTEPRIMA SCHERMO MONITOR */}
      {previewModalOpen && activeNoticesList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
          <div className="relative w-full max-w-5xl rounded-3xl overflow-hidden bg-slate-950 border-4 border-emerald-500 shadow-2xl flex flex-col aspect-video max-h-[85vh]">
            {/* Header simulazione monitor */}
            <div className="flex items-center justify-between px-6 py-3 bg-emerald-900/90 border-b border-white/20 text-white text-xs sm:text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Tv className="h-4 w-4 text-emerald-400" />
                <span>Simulazione Monitor Sala d&apos;Attesa — Università della Terza Età</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-lg bg-white/20 p-1 text-white hover:bg-white/30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Immagine avviso */}
            <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden m-3 rounded-2xl border-4 border-white shadow-lg">
              <img
                src={activeNoticesList[previewIndex]?.imageUrl}
                alt={activeNoticesList[previewIndex]?.title}
                className="w-full h-full object-cover transition-all duration-700 ease-in-out"
              />
            </div>

            {/* News Ticker Banda Scorrevole in Basso */}
            <div className="relative bg-black/90 border-t-2 border-emerald-400 py-3 px-4 overflow-hidden whitespace-nowrap">
              <div className="animate-marquee inline-block font-bold text-white text-base sm:text-xl tracking-wide">
                {activeNoticesList[previewIndex]?.tickerText}
              </div>
            </div>

            {/* Controlli player anteprima */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950 border-t border-white/10 text-white text-xs">
              <span>
                Slide {previewIndex + 1} di {activeNoticesList.length} · Durata:{' '}
                {activeNoticesList[previewIndex]?.durationSec}s
              </span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewIndex(
                      (prev) => (prev - 1 + activeNoticesList.length) % activeNoticesList.length
                    )
                  }
                  className="rounded px-2.5 py-1 bg-white/15 hover:bg-white/25"
                >
                  ◀ Precedente
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewIndex((prev) => (prev + 1) % activeNoticesList.length)
                  }
                  className="rounded px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 font-bold"
                >
                  Successiva ▶
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvvisiVideoView;
