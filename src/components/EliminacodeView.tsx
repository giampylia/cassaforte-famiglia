import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Monitor,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Bell,
  RotateCcw,
  FileUp,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Check,
  Search,
  Hash,
  User,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { useApp, QueueItem } from '../context/AppContext';

// Caricamento dinamico di PDF.js da CDN per leggere i file PDF direttamente nel browser/telefonino
let pdfJsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(lib);
      } else {
        pdfJsPromise = null;
        reject(new Error('Impossibile inizializzare PDF.js'));
      }
    };
    script.onerror = (err) => {
      pdfJsPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}

// Suono "Din-Don" professionale da tabellone eliminacode + sintesi vocale opzionale
function playQueueCallChime(number: number, name: string, voiceActive: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Prima nota (Mi5 - 659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      // Seconda nota (Do5 - 523.25 Hz) -> classico "Din-Don"
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(523.25, now + 0.28);
      gain2.gain.setValueAtTime(0.38, now + 0.28);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.28);
      osc2.stop(now + 1.05);
    }
  } catch {
    // Ignore audio context restrictions
  }

  if (voiceActive && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const text = name ? `Numero ${number}, ${name}` : `Numero ${number}`;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'it-IT';
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
      }, 650);
    } catch {
      // Ignore speech synthesis errors
    }
  }
}

// Analizza le righe estratte da un PDF (o testo) per ricavare [Numero Progressivo, Nome]
function parseLinesIntoQueueItems(lines: string[]): QueueItem[] {
  const results: QueueItem[] = [];
  const seenNumbers = new Set<number>();

  // Parole di intestazione/piè di pagina da ignorare
  const headerNoise = /^(pagina|page|elenco|lista|universit|quartu|soleminis|data|stampato|totale|prog\.?\s*nome|n[°.]?\s*nome|num\.?\s*cognome|cognome\s+e\s+nome|tessera\s+nome)/i;

  const fallbackUnnumberedNames: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/\u00A0/g, ' ')
      .replace(/[|;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!line || line.length < 2) continue;
    if (headerNoise.test(line)) continue;
    // Ignora date pure (es. 03/11/2026)
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(line)) continue;

    // Caso 1: La riga inizia con un numero progressivo (es. "1 Mario Rossi", "01. Rossi Mario", "N° 12 - Giampiero Pilia", "1 7726 Giampiero Pilia")
    const matchStart = line.match(
      /^(?:n[°º.]?\s*|#\s*)?(\d{1,4})(?:[.)\-:\s]+)(.+)$/i
    );

    if (matchStart) {
      const num = parseInt(matchStart[1], 10);
      let rest = matchStart[2].trim();

      // Se dopo il progressivo c'è anche un numero di tessera o codice (es. "12  7726  Giampiero Pilia"),
      // rimuoviamo eventuale secondo numero iniziale se seguito da un nome alfabetico
      const secondNumMatch = rest.match(/^(\d{1,6})\s+([A-Za-zÀ-ÿ].+)$/);
      let notes: string | undefined;
      if (secondNumMatch) {
        notes = `Tessera ${secondNumMatch[1]}`;
        rest = secondNumMatch[2].trim();
      }

      // Pulisce eventuali numeri di telefono o date a fine riga mantenendo il nome
      rest = rest
        .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '')
        .replace(/^[-–—:.,\s]+|[-–—:.,\s]+$/g, '')
        .trim();

      // Verifica che il nome contenga almeno 2 lettere
      if (num > 0 && /[A-Za-zÀ-ÿ]{2,}/.test(rest) && !headerNoise.test(rest)) {
        if (!seenNumbers.has(num)) {
          seenNumbers.add(num);
          results.push({ number: num, name: rest, notes });
        }
        continue;
      }
    }

    // Caso 2: La riga termina con il numero progressivo (es. "Mario Rossi 12")
    const matchEnd = line.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{2,})\s+(\d{1,4})$/);
    if (matchEnd) {
      const namePart = matchEnd[1].replace(/^[-–—:.,\s]+|[-–—:.,\s]+$/g, '').trim();
      const num = parseInt(matchEnd[2], 10);
      if (num > 0 && !seenNumbers.has(num) && !headerNoise.test(namePart)) {
        seenNumbers.add(num);
        results.push({ number: num, name: namePart });
        continue;
      }
    }

    // Se è una riga di sole lettere (es. elenco di soli nomi e cognomi), la teniamo da parte
    if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{3,}$/.test(line) && line.includes(' ')) {
      fallbackUnnumberedNames.push(line);
    }
  }

  // Se il PDF conteneva numeri progressivi espliciti, li ordiniamo per numero progressivo
  if (results.length > 0) {
    return results.sort((a, b) => a.number - b.number);
  }

  // Altrimenti, se il PDF aveva solo nomi senza numero, assegniamo automaticamente 1, 2, 3...
  return fallbackUnnumberedNames.map((name, idx) => ({
    number: idx + 1,
    name,
  }));
}

interface EliminacodeViewProps {
  forceMonitorMode?: boolean;
}

export const EliminacodeView: React.FC<EliminacodeViewProps> = ({ forceMonitorMode = false }) => {
  const { queueState, updateQueueState, cloudConnected, connectedDevices } = useApp();

  // Modalità visualizzazione: 'remote' (Telecomando da telefonino) oppure 'monitor' (Schermo Gigante in Aula)
  const [viewMode, setViewMode] = useState<'remote' | 'monitor'>(
    forceMonitorMode ? 'monitor' : 'remote'
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [flashActive, setFlashActive] = useState<boolean>(false);
  const [clockStr, setClockStr] = useState<string>(() =>
    new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  );

  // Stato importazione PDF e gestione elenco
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [manualNumber, setManualNumber] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [jumpNumberInput, setJumpNumberInput] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const monitorContainerRef = useRef<HTMLDivElement | null>(null);
  const lastPlayedPulseRef = useRef<number>(queueState.callPulse || 0);

  // Orologio per il monitor d'aula
  useEffect(() => {
    const t = setInterval(() => {
      setClockStr(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Trova il nome associato al numero attualmente chiamato
  const currentItem = useMemo(() => {
    return queueState.items.find((it) => it.number === queueState.currentNumber) || null;
  }, [queueState.items, queueState.currentNumber]);

  const previousItem = useMemo(() => {
    if (queueState.currentNumber <= 1) return null;
    const prevNum = queueState.currentNumber - 1;
    const found = queueState.items.find((it) => it.number === prevNum);
    return {
      number: prevNum,
      name: found?.name || '',
    };
  }, [queueState.items, queueState.currentNumber]);

  const nextItem = useMemo(() => {
    const nextNum = queueState.currentNumber + 1;
    const found = queueState.items.find((it) => it.number === nextNum);
    if (!found && queueState.items.length > 0) {
      // Cerca il primo numero successivo disponibile nella lista PDF
      const higher = queueState.items.find((it) => it.number > queueState.currentNumber);
      if (higher) return higher;
    }
    return {
      number: nextNum,
      name: found?.name || '',
    };
  }, [queueState.items, queueState.currentNumber]);

  // Quando arriva un nuovo impulso di chiamata (callPulse), il monitor lampeggia e riproduce il suono
  useEffect(() => {
    if (!queueState.callPulse || queueState.callPulse === lastPlayedPulseRef.current) return;
    lastPlayedPulseRef.current = queueState.callPulse;
    setFlashActive(true);
    const timer = setTimeout(() => setFlashActive(false), 2600);

    if (viewMode === 'monitor' && soundEnabled) {
      const matched = queueState.items.find((it) => it.number === queueState.currentNumber);
      playQueueCallChime(queueState.currentNumber, matched?.name || '', true);
    }

    return () => clearTimeout(timer);
  }, [queueState.callPulse, queueState.currentNumber, queueState.items, viewMode, soundEnabled]);

  // Comandi Telecomando
  const handleNext = () => {
    updateQueueState((prev) => {
      let nextNum = prev.currentNumber + 1;
      if (prev.items.length > 0) {
        const nextInList = prev.items.find((it) => it.number > prev.currentNumber);
        if (nextInList) {
          nextNum = nextInList.number;
        }
      }
      return {
        ...prev,
        currentNumber: nextNum,
        callPulse: Date.now(),
      };
    });
  };

  const handlePrev = () => {
    updateQueueState((prev) => {
      if (prev.currentNumber <= 1) return prev;
      let prevNum = prev.currentNumber - 1;
      if (prev.items.length > 0) {
        const lowerItems = prev.items.filter((it) => it.number < prev.currentNumber);
        if (lowerItems.length > 0) {
          prevNum = lowerItems[lowerItems.length - 1].number;
        }
      }
      return {
        ...prev,
        currentNumber: Math.max(1, prevNum),
        callPulse: Date.now(),
      };
    });
  };

  const handleRecall = () => {
    updateQueueState((prev) => ({
      ...prev,
      callPulse: Date.now(),
    }));
  };

  const handleSelectSpecificNumber = (num: number) => {
    updateQueueState((prev) => ({
      ...prev,
      currentNumber: Math.max(1, num),
      callPulse: Date.now(),
    }));
  };

  const handleResetToOne = () => {
    const firstNum = queueState.items.length > 0 ? queueState.items[0].number : 1;
    updateQueueState((prev) => ({
      ...prev,
      currentNumber: firstNum,
      callPulse: Date.now(),
    }));
  };

  // Gestione caricamento file PDF (o CSV/TXT) con Numero Progressivo e Nome
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingPdf(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (ext === 'pdf') {
        const pdfjsLib = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const allExtractedLines: string[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Raggruppa i frammenti di testo della pagina per riga (coordinata Y con tolleranza di 4pt)
          const rowGroups: { y: number; items: { x: number; str: string }[] }[] = [];

          for (const item of textContent.items) {
            const textStr = String(item.str || '').trim();
            if (!textStr) continue;
            const x = item.transform ? Number(item.transform[4]) : 0;
            const y = item.transform ? Number(item.transform[5]) : 0;

            let group = rowGroups.find((g) => Math.abs(g.y - y) <= 4.5);
            if (!group) {
              group = { y, items: [] };
              rowGroups.push(group);
            }
            group.items.push({ x, str: textStr });
          }

          // Ordina le righe dall'alto verso il basso (Y decrescente nei PDF)
          rowGroups.sort((a, b) => b.y - a.y);

          for (const group of rowGroups) {
            // Ordina le colonne da sinistra a destra (X crescente)
            group.items.sort((a, b) => a.x - b.x);
            const rowText = group.items.map((i) => i.str).join(' ');
            allExtractedLines.push(rowText);
          }
        }

        const parsedItems = parseLinesIntoQueueItems(allExtractedLines);
        if (parsedItems.length === 0) {
          showNotice(
            'error',
            'Non sono stati trovati numeri progressivi e nomi leggibili nel PDF. Assicurati che il PDF contenga testo selezionabile (es. "1 Mario Rossi").'
          );
        } else {
          updateQueueState((prev) => ({
            ...prev,
            items: parsedItems,
            currentNumber: parsedItems[0].number,
            pdfFileName: file.name,
            callPulse: Date.now(),
          }));
          showNotice(
            'success',
            `✓ Caricati ${parsedItems.length} nominativi dal file "${file.name}"! Il monitor è pronto sul N° ${parsedItems[0].number} (${parsedItems[0].name}).`
          );
        }
      } else {
        // Supporto anche per file di testo o CSV
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        const parsedItems = parseLinesIntoQueueItems(lines);
        if (parsedItems.length === 0) {
          showNotice('error', 'Nessuna riga valida trovata nel file selezionato.');
        } else {
          updateQueueState((prev) => ({
            ...prev,
            items: parsedItems,
            currentNumber: parsedItems[0].number,
            pdfFileName: file.name,
            callPulse: Date.now(),
          }));
          showNotice(
            'success',
            `✓ Caricati ${parsedItems.length} nominativi dal file "${file.name}"!`
          );
        }
      }
    } catch (err: any) {
      showNotice(
        'error',
        `Errore nella lettura del file PDF: ${err?.message || 'Formato non supportato'}`
      );
    } finally {
      setIsParsingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = manualName.trim();
    if (!cleanName) return;
    const nextDefaultNumber =
      queueState.items.length > 0
        ? Math.max(...queueState.items.map((i) => i.number)) + 1
        : 1;
    const num = manualNumber.trim() ? parseInt(manualNumber.trim(), 10) : nextDefaultNumber;
    if (isNaN(num) || num <= 0) return;

    updateQueueState((prev) => {
      const filtered = prev.items.filter((i) => i.number !== num);
      const nextItems = [...filtered, { number: num, name: cleanName }].sort(
        (a, b) => a.number - b.number
      );
      return {
        ...prev,
        items: nextItems,
      };
    });
    setManualNumber('');
    setManualName('');
    showNotice('success', `✓ Aggiunto N° ${num} — ${cleanName}`);
  };

  const handleDeleteQueueItem = (num: number) => {
    updateQueueState((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.number !== num),
    }));
  };

  const handleClearList = () => {
    if (
      window.confirm(
        "Vuoi svuotare l'elenco dei nomi caricati dal PDF e riportare il contatore a 1?"
      )
    ) {
      updateQueueState((prev) => ({
        ...prev,
        items: [],
        currentNumber: 1,
        pdfFileName: '',
      }));
      showNotice('success', '✓ Elenco Eliminacode azzerato.');
    }
  };

  const toggleBrowserFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        monitorContainerRef.current?.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen API errors
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return queueState.items;
    return queueState.items.filter(
      (it) =>
        String(it.number).includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.notes && it.notes.toLowerCase().includes(q))
    );
  }, [queueState.items, searchTerm]);

  // ============================================================================
  // MODALITÀ SCHERMO MONITOR AULA (TUTTO SCHERMO GIGANTE PER TV / PROIETTORE / PC)
  // ============================================================================
  if (viewMode === 'monitor') {
    return (
      <div
        ref={monitorContainerRef}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0b1f1c] text-white select-none overflow-hidden"
      >
        {/* BARRA SUPERIORE MONITOR */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#112825] border-b border-emerald-800/60">
          <div className="flex items-center gap-4">
            <img
              src="/logo-associazione-qu3.png?v=15"
              alt="Logo QU3"
              className="h-14 w-14 rounded-2xl bg-white p-1 object-contain shadow-md"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {queueState.title || "Università della Terza Età — Quartu Sant'Elena"}
              </h1>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-300">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    cloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span>
                  Tabellone Eliminacode in Tempo Reale
                  {queueState.pdfFileName ? ` · Elenco: ${queueState.pdfFileName}` : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-block rounded-2xl bg-emerald-950/90 border border-emerald-700/60 px-4 py-2 text-xl font-semibold tabular-nums text-emerald-200">
              {clockStr}
            </span>

            <button
              type="button"
              onClick={() => {
                const nextVal = !soundEnabled;
                setSoundEnabled(nextVal);
                if (nextVal) {
                  playQueueCallChime(
                    queueState.currentNumber,
                    currentItem?.name || '',
                    true
                  );
                }
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium border transition ${
                soundEnabled
                  ? 'bg-emerald-700/80 border-emerald-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Attiva/Disattiva suono e annuncio vocale sul monitor"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Voce e Suono Attivi</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4" />
                  <span className="hidden sm:inline">Audio Disattivato</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-white transition"
              title="Schermo Intero"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Schermo Intero</span>
            </button>

            {!forceMonitorMode && (
              <button
                type="button"
                onClick={() => setViewMode('remote')}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 transition shadow-md"
              >
                <Smartphone className="h-4 w-4" />
                <span>Torna al Telecomando</span>
              </button>
            )}
          </div>
        </header>

        {/* CORPO CENTRALE GIGANTE: NUMERO IN GRANDE + NOME SOTTO */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-4 text-center">
          <div
            className={`w-full max-w-6xl rounded-[2.5rem] border-4 px-8 py-8 sm:py-12 transition-all duration-500 flex flex-col items-center justify-center shadow-2xl ${
              flashActive
                ? 'bg-emerald-800/90 border-amber-400 scale-[1.02] ring-8 ring-amber-400/30'
                : 'bg-[#132f2b] border-emerald-600/70'
            }`}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-400/50 px-6 py-1.5 text-sm sm:text-xl font-bold uppercase tracking-[0.22em] text-amber-300 mb-2">
              Turno Chiamato
            </span>

            {/* NUMERO GIGANTE */}
            <div
              className="font-black tabular-nums leading-none tracking-tight text-amber-400 drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              style={{ fontSize: 'clamp(7.5rem, 23vw, 17.5rem)' }}
            >
              {queueState.currentNumber}
            </div>

            {/* NOME SOTTO IL NUMERO (IMPORTATO DAL PDF) */}
            <div className="mt-4 w-full border-t-2 border-emerald-700/70 pt-6">
              {currentItem?.name ? (
                <div
                  className="font-bold text-white tracking-wide leading-tight break-words"
                  style={{ fontSize: 'clamp(2.2rem, 5.5vw, 4.75rem)' }}
                >
                  {currentItem.name}
                </div>
              ) : (
                <div className="text-2xl sm:text-4xl font-medium text-emerald-300/80">
                  Presentarsi alla postazione
                </div>
              )}
              {currentItem?.notes && (
                <p className="mt-2 text-lg sm:text-2xl font-medium text-emerald-300">
                  {currentItem.notes}
                </p>
              )}
            </div>
          </div>
        </main>

        {/* BARRA INFERIORE MONITOR: PRECEDENTE E PROSSIMO IN CODA */}
        <footer className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-4 bg-[#112825] border-t border-emerald-800/60">
          <div className="flex items-center justify-between rounded-2xl bg-[#0d211e] border border-emerald-800/60 px-5 py-3">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-emerald-400">
              Chiamato Precedente
            </span>
            {previousItem ? (
              <div className="flex items-center gap-3 text-right">
                <span className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-300">
                  N° {previousItem.number}
                </span>
                {previousItem.name && (
                  <span className="text-base sm:text-xl font-medium text-slate-300 truncate max-w-[240px] sm:max-w-[320px]">
                    · {previousItem.name}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-base text-slate-500">—</span>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[#0d211e] border border-emerald-700/70 px-5 py-3">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-amber-300">
              Prossimo in Coda
            </span>
            {nextItem ? (
              <div className="flex items-center gap-3 text-right">
                <span className="text-2xl sm:text-3xl font-bold tabular-nums text-amber-300">
                  N° {nextItem.number}
                </span>
                {nextItem.name && (
                  <span className="text-base sm:text-xl font-medium text-white truncate max-w-[240px] sm:max-w-[320px]">
                    · {nextItem.name}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-base text-slate-400">—</span>
            )}
          </div>
        </footer>
      </div>
    );
  }

  // ============================================================================
  // MODALITÀ TELECOMANDO (SMARTPHONE / REGIA 7726)
  // ============================================================================
  const monitorDirectUrl = `${window.location.origin}/?monitor=eliminacode`;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
      {/* INTESTAZIONE + SWITCH SCHERMO MONITOR AULA */}
      <div className="rounded-2xl bg-[#112825] text-white p-5 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-800/70 border border-emerald-600/50 px-3 py-0.5 text-xs font-medium text-emerald-200">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Riservato Amministratore 7726 — Giampiero Pilia</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Eliminacode — Telecomando &amp; Monitor Aula
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200">
            Comanda dal telefonino l&apos;avanzamento dei numeri e mostra in grande sul monitor d&apos;aula Numero e Nome importati dal PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('monitor')}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-md transition cursor-pointer"
          >
            <Monitor className="h-5 w-5" />
            <span>Apri Schermo Monitor Aula</span>
          </button>
          <a
            href={monitorDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-500/60 bg-emerald-900/60 hover:bg-emerald-800 px-3.5 py-3 text-xs font-medium text-emerald-100 transition"
            title="Apri il tabellone in una nuova scheda o sul PC dell'aula"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Nuova Scheda TV</span>
          </a>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-rose-300 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* PANNELLO PRINCIPALE TELECOMANDO SMARTPHONE */}
      <div className="rounded-3xl border-2 border-emerald-700/20 bg-white p-5 sm:p-6 shadow-sm space-y-5">
        {/* DISPLAY IN TEMPO REALE DI CIÒ CHE SI VEDE SUL MONITOR D'AULA */}
        <div className="rounded-3xl bg-[#112825] text-white p-6 text-center space-y-2 shadow-inner border border-emerald-800">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  cloudConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span>In onda sul Monitor Aula ({connectedDevices} disp. collegati)</span>
            </span>
            {queueState.pdfFileName && (
              <span className="truncate max-w-[180px] text-emerald-200">
                PDF: {queueState.pdfFileName}
              </span>
            )}
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300 pt-1">
            Numero Attuale sul Monitor
          </p>
          <div className="text-7xl sm:text-8xl font-black tabular-nums text-amber-400 leading-none py-1">
            {queueState.currentNumber}
          </div>
          <div className="pt-2 border-t border-emerald-800/80">
            <p className="text-xl sm:text-3xl font-bold text-white break-words">
              {currentItem?.name || 'Nessun nome associato a questo numero'}
            </p>
            {currentItem?.notes && (
              <p className="text-xs sm:text-sm text-emerald-300 mt-0.5">{currentItem.notes}</p>
            )}
          </div>

          {nextItem && (
            <div className="pt-2 text-xs sm:text-sm text-emerald-200">
              Prossimo: <strong className="text-amber-300">N° {nextItem.number}</strong>
              {nextItem.name ? ` — ${nextItem.name}` : ''}
            </div>
          )}
        </div>

        {/* PULSANTI GIGANTI DEL TELECOMANDO PER IL TELEFONINO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* PULSANTE GIGANTE AVANTI (Principale su mobile) */}
          <button
            type="button"
            onClick={handleNext}
            className="sm:col-span-2 order-1 sm:order-2 flex items-center justify-center gap-3 rounded-3xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-6 px-6 text-2xl sm:text-3xl font-bold shadow-lg transition cursor-pointer"
          >
            <span>AVANTI</span>
            <ChevronRight className="h-9 w-9 stroke-[2.5]" />
          </button>

          {/* PULSANTE INDIETRO */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={queueState.currentNumber <= 1}
            className="order-2 sm:order-1 flex items-center justify-center gap-2 rounded-3xl border-2 border-slate-300 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 py-5 px-5 text-lg font-bold transition cursor-pointer"
          >
            <ChevronLeft className="h-6 w-6" />
            <span>INDIETRO</span>
          </button>
        </div>

        {/* SECONDA FILA COMANDI: RICHIAMA CAMPANELLA / VAI A NUMERO / AZZERA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            type="button"
            onClick={handleRecall}
            className="flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 py-3.5 px-4 text-sm font-bold transition cursor-pointer"
          >
            <Bell className="h-4 w-4 text-amber-700" />
            <span>Richiama Numero (Suono)</span>
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(jumpNumberInput.trim(), 10);
              if (!isNaN(n) && n >= 1) {
                handleSelectSpecificNumber(n);
                setJumpNumberInput('');
              }
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="number"
              min={1}
              value={jumpNumberInput}
              onChange={(e) => setJumpNumberInput(e.target.value)}
              placeholder="Vai al N°..."
              className="h-12 w-full rounded-2xl border border-slate-300 px-3.5 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-2xl bg-slate-800 hover:bg-slate-900 px-4 text-xs font-bold text-white transition cursor-pointer"
            >
              Vai
            </button>
          </form>

          <button
            type="button"
            onClick={handleResetToOne}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3.5 px-4 text-sm font-medium transition cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Riparti dal N° 1</span>
          </button>
        </div>
      </div>

      {/* SEZIONE CARICAMENTO FILE PDF (NUMERO PROGRESSIVO + NOME) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-700" />
              <span>Importa Elenco da File PDF (Numero Progressivo + Nome)</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Carica un file PDF contenente il numero progressivo e il nome del socio (es.{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                1 Mario Rossi
              </code>
              ). Cliccando <strong>AVANTI</strong> sul telefonino, il monitor mostrerà il numero e sotto il nome corrispondente.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.txt,application/pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={isParsingPdf}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <FileUp className="h-4 w-4" />
              <span>{isParsingPdf ? 'Lettura PDF in corso...' : 'Carica File PDF'}</span>
            </button>

            {queueState.items.length > 0 && (
              <button
                type="button"
                onClick={handleClearList}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3.5 py-3 text-xs font-semibold text-rose-700 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Svuota</span>
              </button>
            )}
          </div>
        </div>

        {/* INTESTAZIONE PERSONALIZZABILE DEL MONITOR + AGGIUNTA RAPIDA RIGA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600">
              Titolo mostrato in alto sul Monitor d&apos;Aula
            </label>
            <input
              type="text"
              value={queueState.title}
              onChange={(e) =>
                updateQueueState((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Es. Iscrizioni Anno Accademico — Segreteria QU3"
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <form onSubmit={handleAddManualItem} className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600">
              Aggiungi o correggi singolo numero e nome al volo
            </label>
            <div className="flex items-center gap-2">
              <div className="relative w-24 shrink-0">
                <Hash className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min={1}
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  placeholder="N°"
                  className="h-10 w-full rounded-xl border border-slate-300 pl-7 pr-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div className="relative flex-1">
                <User className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Nome e Cognome..."
                  className="h-10 w-full rounded-xl border border-slate-300 pl-8 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1 h-10 rounded-xl bg-slate-800 hover:bg-slate-900 px-3.5 text-xs font-semibold text-white shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Aggiungi</span>
              </button>
            </div>
          </form>
        </div>

        {/* ELENCO DEI NUMERI E NOMI IMPORTATI DAL PDF (TOCCA UNA RIGA PER CHIAMARLA SUBITO SUL MONITOR) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs sm:text-sm font-medium text-slate-700">
              Elenco Prenotati / Numeri Progressivi ({queueState.items.length} in lista) —{' '}
              <span className="text-emerald-700">
                Tocca un nome per mandarlo subito sul monitor
              </span>
            </p>
            {queueState.items.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cerca numero o nome..."
                  className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          {queueState.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Nessun file PDF caricato al momento.
              </p>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Puoi già usare il pulsante <strong>AVANTI</strong> per far scorrere i numeri (1, 2, 3...) sul monitor, oppure cliccare su <strong>&ldquo;Carica File PDF&rdquo;</strong> per importare l&apos;elenco con Numero Progressivo e Nome.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isCurrent = item.number === queueState.currentNumber;
                return (
                  <div
                    key={item.number}
                    onClick={() => handleSelectSpecificNumber(item.number)}
                    className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition ${
                      isCurrent
                        ? 'bg-emerald-700 text-white font-semibold'
                        : 'bg-white hover:bg-emerald-50/70 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center min-w-[3rem] rounded-xl px-2.5 py-1 text-base font-bold tabular-nums ${
                          isCurrent
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                        }`}
                      >
                        N° {item.number}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base truncate">{item.name}</p>
                        {item.notes && (
                          <p
                            className={`text-xs ${
                              isCurrent ? 'text-emerald-100' : 'text-slate-500'
                            }`}
                          >
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                          <Check className="h-3.5 w-3.5" /> In Onda
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 hidden sm:inline">
                          Chiama ora →
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQueueItem(item.number);
                        }}
                        className={`rounded-lg p-1.5 transition ${
                          isCurrent
                            ? 'text-emerald-100 hover:bg-white/20'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title="Rimuovi dalla coda"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
