import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Monitor,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Bell,
  RotateCcw,
  Camera,
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
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import { useApp, QueueItem } from '../context/AppContext';
import { Profile } from '../data/initialData';

// Caricamento dinamico di PDF.js da CDN (per leggere sia PDF testuali sia trasformare PDF scannerizzati in immagini)
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

// Caricamento dinamico di Tesseract.js per leggere le foto del foglio o i PDF scannerizzati
let tesseractPromise: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  if ((window as any).Tesseract) return Promise.resolve((window as any).Tesseract);
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => resolve((window as any).Tesseract);
    script.onerror = (err) => {
      tesseractPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return tesseractPromise;
}

// Suono "Din-Don" professionale da tabellone sala d'attesa + sintesi vocale opzionale
function playQueueCallChime(number: number, name: string, voiceActive: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

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
        const text = name ? `Turno ${number}, ${name}` : `Turno numero ${number}`;
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

// Parole di altre colonne (es. materie dei corsi, sedi, intestazioni) da rimuovere per tenere SOLO Nome e Cognome
const EXTRA_COLUMN_WORDS = new RegExp(
  '\\b(inglese|spagnolo|francese|tedesco|informatica|computer|smartphone|ginnastica|posturale|dolce|yoga|pilates|ballo|danza|storia|arte|sardegna|pittura|disegno|acquerello|teatro|coro|musica|canto|psicologia|filosofia|letteratura|poesia|fotografia|cucito|ricamo|scacchi|burraco|bridge|viaggi|quartu|soleminis|base|avanzato|intermedio|corso|materia|firma|pagato|acconto|saldo|mattina|pomeriggio|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì])\\b.*$',
  'i'
);

const HEADER_NOISE =
  /^(pagina|page|elenco|lista|universit|quartu|soleminis|data|stampato|totale|prog\.?\s*nome|n[°.]?\s*nome|num\.?\s*cognome|cognome\s+e\s+nome|nome\s+e\s+cognome|materia|firma)/i;

// Pulisce la parte testuale tenendo solo Nome e Cognome (ed eventualmente confrontando con l'Anagrafica Soci)
function extractCleanNameOnly(rawRest: string, knownProfiles: Profile[]): string {
  // Se ci sono separatori di colonna evidenti (| o tab o doppi spazi lunghi o trattini), prende la prima colonna alfabetica (Nome e Cognome)
  let text = rawRest
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ') // rimuove date
    .replace(/\b\d{6,12}\b/g, ' ') // rimuove numeri di telefono
    .replace(/€\s*\d+([.,]\d+)?/g, ' ') // rimuove importi
    .trim();

  // Rimuove eventuale numero tessera iniziale se seguito dal nome
  const secondNumMatch = text.match(/^(\d{1,5})\s+([A-Za-zÀ-ÿ].+)$/);
  if (secondNumMatch) {
    text = secondNumMatch[2].trim();
  }

  // Taglia via eventuali colonne successive (es. Materia prescelta)
  text = text.replace(EXTRA_COLUMN_WORDS, '').trim();

  // Tiene solo caratteri validi per un nome e cognome (fino a max 4 parole per evitare colonne extra residue)
  const cleanWords = text
    .replace(/[^A-Za-zÀ-ÿ'\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length >= 2 || /^[A-Za-zÀ-ÿ]\.$/.test(w));

  const candidateName = cleanWords.slice(0, 4).join(' ').trim();
  if (!candidateName || candidateName.length < 2) return '';

  // Se il nome letto dall'OCR assomiglia molto a un socio già presente in Anagrafica Soci, usa il nome esatto dell'Anagrafica!
  const lowerCand = candidateName.toLowerCase();
  const candParts = lowerCand.split(/\s+/).filter((w) => w.length >= 3);
  if (candParts.length > 0 && knownProfiles.length > 0) {
    const exactOrClose = knownProfiles.find((p) => {
      if (p.member_number === '000') return false;
      const pName = p.full_name.toLowerCase();
      return candParts.every((part) => pName.includes(part));
    });
    if (exactOrClose) {
      return exactOrClose.full_name;
    }
  }

  return candidateName;
}

// Analizza le righe estratte dal foglio fotografato o dal PDF per ricavare [Numero Progressivo (1ª colonna), Nome e Cognome (2ª colonna)]
function parseSheetLinesIntoQueueItems(
  lines: string[],
  knownProfiles: Profile[],
  existingMaxNumber: number
): QueueItem[] {
  const results: QueueItem[] = [];
  const seenNumbers = new Set<number>();
  const fallbackNamesOnly: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/\u00A0/g, ' ')
      .replace(/[|;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!line || line.length < 2) continue;
    if (HEADER_NOISE.test(line)) continue;

    // Cerca 1ª colonna = Numero Progressivo (es. "1 Mario Rossi Inglese", "24) Melis Maria", "25 - Sanna Giampaolo")
    const matchStart = line.match(
      /^(?:n[°º.]?\s*|#\s*)?(\d{1,4})(?:[.)\-:\s]+)(.+)$/i
    );

    if (matchStart) {
      const num = parseInt(matchStart[1], 10);
      const cleanName = extractCleanNameOnly(matchStart[2], knownProfiles);
      if (num > 0 && num <= 999 && cleanName && !HEADER_NOISE.test(cleanName)) {
        if (!seenNumbers.has(num)) {
          seenNumbers.add(num);
          results.push({ number: num, name: cleanName });
        }
        continue;
      }
    }

    // Fallback: se l'OCR non ha letto il numerino a inizio riga ma ha letto chiaramente Nome e Cognome
    const cleanOnlyName = extractCleanNameOnly(line, knownProfiles);
    if (cleanOnlyName && cleanOnlyName.includes(' ') && cleanOnlyName.length >= 5) {
      fallbackNamesOnly.push(cleanOnlyName);
    }
  }

  if (results.length > 0) {
    return results.sort((a, b) => a.number - b.number);
  }

  // Se nella foto del foglio l'OCR ha letto i nomi ma la colonna dei numeri era tagliata, numera a partire da existingMaxNumber + 1
  return fallbackNamesOnly.map((name, idx) => ({
    number: existingMaxNumber + idx + 1,
    name,
  }));
}

interface EliminacodeViewProps {
  forceMonitorMode?: boolean;
}

export const EliminacodeView: React.FC<EliminacodeViewProps> = ({ forceMonitorMode = false }) => {
  const { queueState, updateQueueState, profiles, cloudConnected, connectedDevices } = useApp();

  // Modalità: 'remote' = Regia Segreteria (Telefonino / PC Segreteria) | 'monitor' = Schermo Sala d'Attesa
  const [viewMode, setViewMode] = useState<'remote' | 'monitor'>(
    forceMonitorMode ? 'monitor' : 'remote'
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [flashActive, setFlashActive] = useState<boolean>(false);

  // Stato scansione Foto / PDF
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusText, setScanStatusText] = useState<string>('');
  const [lastSheetPhotoUrl, setLastSheetPhotoUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);

  // Notifiche e campi rapidi
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Inserimento / integrazione rapida riga (Numero progressivo + Nome e Cognome)
  const [quickNumber, setQuickNumber] = useState<string>('');
  const [quickName, setQuickName] = useState<string>('');

  // Impostazione visibile "Da che numero partire"
  const [startNumberInput, setStartNumberInput] = useState<string>(
    String(queueState.currentNumber || 1)
  );
  const [showStartNumberModal, setShowStartNumberModal] = useState<boolean>(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const monitorContainerRef = useRef<HTMLDivElement | null>(null);
  const quickNameInputRef = useRef<HTMLInputElement | null>(null);
  const lastPlayedPulseRef = useRef<number>(queueState.callPulse || 0);

  // Sincronizza il campo "Numero da cui partire" quando cambia il numero attuale
  useEffect(() => {
    setStartNumberInput(String(queueState.currentNumber || 1));
  }, [queueState.currentNumber]);

  // Calcola il prossimo numero progressivo libero per l'inserimento rapido (es. se siamo arrivati a 24, propone 25)
  const nextAvailableProgressiveNumber = useMemo(() => {
    if (queueState.items.length === 0) return 1;
    return Math.max(...queueState.items.map((i) => i.number)) + 1;
  }, [queueState.items]);

  useEffect(() => {
    setQuickNumber(String(nextAvailableProgressiveNumber));
  }, [nextAvailableProgressiveNumber]);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 6000);
  };

  // Socio attualmente chiamato sul monitor in Sala d'Attesa
  const currentItem = useMemo(() => {
    return queueState.items.find((it) => it.number === queueState.currentNumber) || null;
  }, [queueState.items, queueState.currentNumber]);

  // Prossimo socio in coda
  const nextItem = useMemo(() => {
    const nextNum = queueState.currentNumber + 1;
    const found = queueState.items.find((it) => it.number === nextNum);
    if (!found && queueState.items.length > 0) {
      const higher = queueState.items.find((it) => it.number > queueState.currentNumber);
      if (higher) return higher;
    }
    return {
      number: nextNum,
      name: found?.name || '',
    };
  }, [queueState.items, queueState.currentNumber]);

  // Effetto sonoro e lampeggio sullo Schermo Sala d'Attesa quando la Segreteria preme AVANTI o RICHIAMA
  useEffect(() => {
    if (!queueState.callPulse || queueState.callPulse === lastPlayedPulseRef.current) return;
    lastPlayedPulseRef.current = queueState.callPulse;
    setFlashActive(true);
    const timer = setTimeout(() => setFlashActive(false), 2400);

    if (viewMode === 'monitor' && soundEnabled) {
      const matched = queueState.items.find((it) => it.number === queueState.currentNumber);
      playQueueCallChime(queueState.currentNumber, matched?.name || '', true);
    }

    return () => clearTimeout(timer);
  }, [queueState.callPulse, queueState.currentNumber, queueState.items, viewMode, soundEnabled]);

  // Integra i nuovi nominativi (es. dal 25 al 36) SENZA cancellare i precedenti (1..24) e SENZA spostare il turno attuale
  const integrateExtractedItems = (extracted: QueueItem[], sourceLabel: string) => {
    updateQueueState((prev) => {
      const mapByNum = new Map<number, QueueItem>();
      // Mantiene tutti i nominativi già presenti (es. 1..24)
      for (const existing of prev.items) {
        mapByNum.set(existing.number, existing);
      }

      let newlyAddedCount = 0;
      let updatedCount = 0;
      let minAdded = Infinity;
      let maxAdded = 0;

      for (const item of extracted) {
        const already = mapByNum.get(item.number);
        if (!already) {
          mapByNum.set(item.number, item);
          newlyAddedCount++;
          if (item.number < minAdded) minAdded = item.number;
          if (item.number > maxAdded) maxAdded = item.number;
        } else if (!already.name && item.name) {
          mapByNum.set(item.number, item);
          updatedCount++;
        }
      }

      const mergedList = Array.from(mapByNum.values()).sort((a, b) => a.number - b.number);
      const wasEmpty = prev.items.length === 0;
      const nextCurrentNum = wasEmpty && mergedList.length > 0 ? mergedList[0].number : prev.currentNumber;

      setTimeout(() => {
        if (newlyAddedCount > 0) {
          showNotice(
            'success',
            `✓ Integrati ${newlyAddedCount} nuovi nominativi (dal N° ${minAdded} al N° ${maxAdded}). Totale in lista: ${mergedList.length} soci.`
          );
        } else if (updatedCount > 0) {
          showNotice(
            'success',
            `✓ Aggiornati ${updatedCount} nominativi. Totale in lista: ${mergedList.length} soci.`
          );
        } else {
          showNotice(
            'success',
            `✓ Foglio letto (${extracted.length} righe): i nominativi 1–${mergedList[mergedList.length - 1]?.number || ''} erano già presenti in lista.`
          );
        }
      }, 50);

      return {
        ...prev,
        items: mergedList,
        currentNumber: nextCurrentNum,
        pdfFileName: sourceLabel,
        callPulse: wasEmpty ? Date.now() : prev.callPulse,
      };
    });
  };

  // Migliora contrasto dell'immagine fotografata per facilitare la lettura OCR di numeri e nomi
  const preprocessImageForOcr = (fileOrBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 2200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(url);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        // Aumenta il contrasto su foglio bianco
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const contrasted = gray < 165 ? Math.max(0, gray * 0.65) : Math.min(255, gray * 1.15);
          data[i] = contrasted;
          data[i + 1] = contrasted;
          data[i + 2] = contrasted;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  };

  // Gestisce sia la FOTO SCATTATA AL FOGLIO sia il FILE PDF (testuale o scannerizzato)
  const handleProcessSheetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanProgress(10);
    setScanStatusText('Apertura documento in corso...');

    const existingMax =
      queueState.items.length > 0 ? Math.max(...queueState.items.map((i) => i.number)) : 0;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext);

      if (isImage) {
        // Salva anteprima della foto del foglio così la Segreteria può anche consultarla a schermo
        const previewUrl = URL.createObjectURL(file);
        setLastSheetPhotoUrl(previewUrl);

        setScanStatusText('Lettura ottica (OCR) della foto del foglio in corso...');
        const processedDataUrl = await preprocessImageForOcr(file);
        const Tesseract = await loadTesseract();

        const result = await Tesseract.recognize(processedDataUrl, 'ita', {
          logger: (m: any) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              setScanProgress(Math.round(15 + m.progress * 80));
            }
          },
        });

        const rawLines = String(result?.data?.text || '').split(/\r?\n/);
        const parsed = parseSheetLinesIntoQueueItems(rawLines, profiles, existingMax);

        if (parsed.length > 0) {
          integrateExtractedItems(parsed, `Foto: ${file.name}`);
        } else {
          setShowPhotoModal(true);
          showNotice(
            'error',
            'La scrittura a mano sul foglio è molto leggera: ho aperto la foto qui sotto così puoi inserire o confermare i nomi velocemente!'
          );
        }
      } else if (ext === 'pdf' || file.type === 'application/pdf') {
        setScanStatusText('Lettura pagine del file PDF...');
        const pdfjsLib = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const allExtractedLines: string[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          setScanProgress(Math.round((pageNum / pdf.numPages) * 50));
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

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

          rowGroups.sort((a, b) => b.y - a.y);
          for (const group of rowGroups) {
            group.items.sort((a, b) => a.x - b.x);
            allExtractedLines.push(group.items.map((i) => i.str).join(' '));
          }
        }

        let parsed = parseSheetLinesIntoQueueItems(allExtractedLines, profiles, existingMax);

        // Se il PDF era una SCANSIONE (immagine dentro PDF senza testo digitale), usa l'OCR sulla pagina PDF!
        if (parsed.length === 0 && pdf.numPages > 0) {
          setScanStatusText('PDF scannerizzato rilevato: lettura ottica (OCR) dei nomi in corso...');
          const Tesseract = await loadTesseract();
          const ocrLines: string[] = [];

          for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              const pageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
              if (pageNum === 1) setLastSheetPhotoUrl(pageDataUrl);
              const res = await Tesseract.recognize(pageDataUrl, 'ita', {
                logger: (m: any) => {
                  if (m.status === 'recognizing text' && typeof m.progress === 'number') {
                    setScanProgress(Math.round(40 + m.progress * 55));
                  }
                },
              });
              ocrLines.push(...String(res?.data?.text || '').split(/\r?\n/));
            }
          }
          parsed = parseSheetLinesIntoQueueItems(ocrLines, profiles, existingMax);
        }

        if (parsed.length > 0) {
          integrateExtractedItems(parsed, file.name);
        } else {
          showNotice(
            'error',
            'Non sono stati trovati numeri e nomi leggibili automaticamente. Puoi riprovare con una foto più ravvicinata alle prime due colonne o inserirli qui sotto.'
          );
        }
      } else {
        const text = await file.text();
        const parsed = parseSheetLinesIntoQueueItems(text.split(/\r?\n/), profiles, existingMax);
        if (parsed.length > 0) {
          integrateExtractedItems(parsed, file.name);
        } else {
          showNotice('error', 'Nessun nominativo trovato nel file.');
        }
      }
    } catch (err: any) {
      showNotice('error', `Errore durante la lettura del foglio: ${err?.message || 'Riprova'}`);
    } finally {
      setIsScanning(false);
      setScanProgress(0);
      setScanStatusText('');
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Comandi Telecomando Segreteria
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

  const handleSetStartingNumber = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = parseInt(startNumberInput.trim(), 10);
    if (isNaN(num) || num < 1) return;
    updateQueueState((prev) => ({
      ...prev,
      currentNumber: num,
      callPulse: Date.now(),
    }));
    setShowStartNumberModal(false);
    showNotice('success', `✓ Turno impostato sul N° ${num}. Lo schermo in Sala d'Attesa è aggiornato!`);
  };

  // Aggiunta/Modifica rapida di una riga (es. mentre si guarda la foto del foglio)
  const handleQuickAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = quickName.trim();
    if (!cleanName) return;
    const num = parseInt(quickNumber.trim(), 10) || nextAvailableProgressiveNumber;
    if (num < 1) return;

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

    setQuickNumber(String(num + 1));
    setQuickName('');
    quickNameInputRef.current?.focus();
  };

  const handleUpdateItemNameInline = (num: number, newName: string) => {
    updateQueueState((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.number === num ? { ...it, name: newName } : it)),
    }));
  };

  const handleDeleteQueueItem = (num: number) => {
    updateQueueState((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.number !== num),
    }));
  };

  // AZZERA TUTTO per il giorno successivo / nuova fila in Sala d'Attesa
  const handleFullResetForNewDay = () => {
    const startFromRaw = window.prompt(
      "AZZERAMENTO COMPLETO PER NUOVA FILA:\nTutti i nominativi in elenco verranno cancellati.\n\nDa quale numero progressivo vuoi far partire la nuova fila? (Scrivi 1 oppure il numero desiderato):",
      '1'
    );
    if (startFromRaw === null) return; // Annullato dall'utente
    const parsedStart = Math.max(1, parseInt(startFromRaw.trim(), 10) || 1);

    updateQueueState((prev) => ({
      ...prev,
      items: [],
      currentNumber: parsedStart,
      pdfFileName: '',
      callPulse: Date.now(),
    }));
    setLastSheetPhotoUrl(null);
    setStartNumberInput(String(parsedStart));
    showNotice(
      'success',
      `✓ Eliminacode completamente azzerato! Nuova fila pronta a partire dal N° ${parsedStart}.`
    );
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

  // Suggerimenti rapidi dall'Anagrafica Soci mentre si digita un nome
  const memberSuggestions = useMemo(() => {
    const q = quickName.trim().toLowerCase();
    if (q.length < 2) return [];
    return profiles
      .filter((p) => p.member_number !== '000' && p.full_name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [quickName, profiles]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return queueState.items;
    return queueState.items.filter(
      (it) => String(it.number).includes(q) || it.name.toLowerCase().includes(q)
    );
  }, [queueState.items, searchTerm]);

  // ============================================================================
  // SCHERMO SALA D'ATTESA (SFONDO BEL VERDE + CORNICE BIANCA + TURNO CHIAMATO E NOME)
  // ============================================================================
  if (viewMode === 'monitor') {
    return (
      <div
        ref={monitorContainerRef}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-emerald-700 text-white select-none overflow-hidden"
      >
        {/* BARRA SUPERIORE DISCRETA PER CONTROLLI SCHERMO SALA D'ATTESA */}
        <header className="flex items-center justify-between px-6 py-4 bg-emerald-800/80 border-b border-white/25">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo-associazione-qu3.png?v=15"
              alt="Logo QU3"
              className="h-12 w-12 rounded-xl bg-white p-1 object-contain shadow-xs"
            />
            <span className="text-lg sm:text-2xl font-bold tracking-tight text-white">
              Università della Terza Età — Quartu Sant&apos;Elena
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const nextVal = !soundEnabled;
                setSoundEnabled(nextVal);
                if (nextVal) {
                  playQueueCallChime(queueState.currentNumber, currentItem?.name || '', true);
                }
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                soundEnabled
                  ? 'bg-white text-emerald-900 border-white'
                  : 'bg-emerald-900/70 border-white/40 text-white/80'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="hidden sm:inline">
                {soundEnabled ? 'Audio Attivo' : 'Audio Muto'}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-900/70 hover:bg-emerald-900 border border-white/40 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Tutto Schermo</span>
            </button>

            {!forceMonitorMode && (
              <button
                type="button"
                onClick={() => setViewMode('remote')}
                className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-emerald-50 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-900 transition shadow-xs cursor-pointer"
              >
                <Smartphone className="h-4 w-4" />
                <span>Torna alla Segreteria</span>
              </button>
            )}
          </div>
        </header>

        {/* RIQUADRO CENTRALE SALA D'ATTESA: SFONDO BEL VERDE, CORNICE BIANCA, TURNO CHIAMATO + NOME E COGNOME */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-6 text-center">
          <div
            className={`w-full max-w-6xl rounded-[2.5rem] border-4 border-white px-8 py-10 sm:py-14 transition-all duration-500 flex flex-col items-center justify-center shadow-2xl ${
              flashActive ? 'bg-emerald-600 scale-[1.02]' : 'bg-emerald-800/90'
            }`}
          >
            <div className="rounded-full border-2 border-white bg-white/15 px-8 py-2 text-lg sm:text-3xl font-extrabold uppercase tracking-[0.2em] text-white mb-4">
              TURNO CHIAMATO
            </div>

            {/* NUMERO GIGANTE BIANCO */}
            <div
              className="font-black tabular-nums leading-none tracking-tight text-white drop-shadow-md"
              style={{ fontSize: 'clamp(8rem, 25vw, 18rem)' }}
            >
              {queueState.currentNumber}
            </div>

            {/* NOME E COGNOME SOTTO IL NUMERO */}
            <div className="mt-6 w-full border-t-2 border-white/60 pt-6">
              <div
                className="font-bold text-white tracking-wide leading-tight break-words"
                style={{ fontSize: 'clamp(2.4rem, 6vw, 5rem)' }}
              >
                {currentItem?.name || '\u00A0'}
              </div>
            </div>
          </div>
        </main>

        {/* PIE' DI PAGINA PULITO */}
        <footer className="px-6 py-3 bg-emerald-800/80 border-t border-white/25 text-center text-sm sm:text-lg font-medium text-emerald-100">
          Attendere la chiamata del proprio numero e nome
        </footer>
      </div>
    );
  }

  // ============================================================================
  // MODALITÀ SEGRETERIA (TELEFONINO / PC AMMINISTRATORE 7726)
  // ============================================================================
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-5">
      {/* BARRA DI SCELTA MODALITÀ CHIARISSIMA */}
      <div className="rounded-2xl bg-emerald-800 text-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">
            Eliminacode — Gestione Segreteria e Sala d&apos;Attesa
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100">
            Fotografa il foglio firmato dai soci (es. 1–24, poi 25–36) e fai avanzare il turno in Sala d&apos;Attesa.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setViewMode('monitor')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white bg-emerald-700 hover:bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition shrink-0 cursor-pointer"
        >
          <Monitor className="h-4 w-4" />
          <span>Mostra Schermo Sala d&apos;Attesa</span>
        </button>
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

      {/* ====================================================================
          PASSO 1 (IN CIMA E SUBITO VISIBILE): FOTOGRAFA IL FOGLIO O CARICA PDF
         ==================================================================== */}
      <div className="rounded-3xl border-2 border-emerald-600 bg-emerald-50/70 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="inline-block rounded-full bg-emerald-700 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white mb-1">
              Passo 1 · Acquisizione Foglio Soci
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Fotografa il Foglio compilato dai Soci (o carica PDF scannerizzato)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Legge la <strong>1ª colonna (Numero Progressivo)</strong> e la{' '}
              <strong>2ª colonna (Nome e Cognome)</strong>, ignorando le altre colonne. Se rifai la foto più tardi (es. dal 25 al 36), <strong>integra i nuovi nomi</strong> senza cancellare i precedenti.
            </p>
          </div>
        </div>

        {/* INPUT NASCOSTI PER FOTOCAMERA DIRETTA E PER GALLERIA / PDF */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleProcessSheetFile}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf,.csv,.txt"
          onChange={handleProcessSheetFile}
          className="hidden"
        />

        {/* DUE PULSANTI GRANDI E IMMEDIATI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isScanning}
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-4 px-5 text-base sm:text-lg font-bold shadow-md transition cursor-pointer"
          >
            <Camera className="h-6 w-6 shrink-0" />
            <span>📷 Fotografa il Foglio con il Telefonino</span>
          </button>

          <button
            type="button"
            disabled={isScanning}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-3 rounded-2xl border-2 border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-900 py-4 px-5 text-base sm:text-lg font-bold shadow-xs transition cursor-pointer"
          >
            <FileUp className="h-6 w-6 shrink-0 text-emerald-700" />
            <span>📄 Carica PDF Scannerizzato o Foto</span>
          </button>
        </div>

        {/* BARRA DI AVANZAMENTO LETTURA FOTO / PDF */}
        {isScanning && (
          <div className="rounded-2xl border border-emerald-300 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
              <span>{scanStatusText || 'Lettura nominativi in corso...'}</span>
              <span>{scanProgress}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-emerald-100 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${Math.max(8, scanProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* SE È STATA SCATTATA UNA FOTO AL FOGLIO, PERMETTE DI VEDERLA A SCHERMO */}
        {lastSheetPhotoUrl && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-2.5">
            <div className="flex items-center gap-3">
              <img
                src={lastSheetPhotoUrl}
                alt="Ultima foto foglio"
                className="h-10 w-10 rounded-lg object-cover border border-slate-200"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700">
                Ultima foto del foglio acquisita
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoModal(!showPhotoModal)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-900 transition cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{showPhotoModal ? 'Nascondi Foto Foglio' : 'Guarda Foto Foglio'}</span>
            </button>
          </div>
        )}

        {showPhotoModal && lastSheetPhotoUrl && (
          <div className="rounded-2xl border border-slate-300 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Foto del Foglio (puoi leggerla qui mentre controlli o integri i nomi sotto)
              </span>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={lastSheetPhotoUrl}
              alt="Foglio Soci"
              className="max-h-96 w-full object-contain rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>
        )}
      </div>

      {/* ====================================================================
          PASSO 2: TELECOMANDO SEGRETERIA (AVANTI / DA CHE NUMERO PARTIRE / AZZERA TUTTO)
         ==================================================================== */}
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-block rounded-full bg-slate-800 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
            Passo 2 · Comando Turni dalla Segreteria
          </span>
          <span className="text-xs font-medium text-slate-500">
            Soci in lista: <strong>{queueState.items.length}</strong> (Ultimo N°:{' '}
            <strong>
              {queueState.items.length > 0
                ? Math.max(...queueState.items.map((i) => i.number))
                : 0}
            </strong>
            )
          </span>
        </div>

        {/* ANTEPRIMA DELLO SCHERMO SALA D'ATTESA (VERDE CON CORNICE BIANCA) */}
        <div className="rounded-3xl bg-emerald-700 p-4 sm:p-5 text-white shadow-md">
          <div className="rounded-2xl border-4 border-white bg-emerald-800/90 p-5 text-center space-y-2">
            <div className="inline-block rounded-full border border-white bg-white/15 px-4 py-0.5 text-xs font-extrabold uppercase tracking-[0.18em] text-white">
              TURNO CHIAMATO (IN SALA D&apos;ATTESA)
            </div>
            <div className="text-6xl sm:text-7xl font-black tabular-nums text-white leading-none py-1">
              {queueState.currentNumber}
            </div>
            <div className="pt-2 border-t border-white/40">
              <p className="text-xl sm:text-3xl font-bold text-white break-words">
                {currentItem?.name || '— Nessun nome associato a questo numero —'}
              </p>
            </div>
          </div>

          {nextItem && (
            <div className="mt-3 flex items-center justify-between px-2 text-xs sm:text-sm text-emerald-100">
              <span>
                Prossimo turno:{' '}
                <strong className="text-white">
                  N° {nextItem.number} {nextItem.name ? `— ${nextItem.name}` : ''}
                </strong>
              </span>
              <span>{connectedDevices} schermi collegati</span>
            </div>
          )}
        </div>

        {/* PULSANTI GIGANTI AVANTI / INDIETRO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={handleNext}
            className="sm:col-span-2 order-1 sm:order-2 flex items-center justify-center gap-3 rounded-3xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-5 px-6 text-2xl sm:text-3xl font-black shadow-lg transition cursor-pointer"
          >
            <span>AVANTI (+1)</span>
            <ChevronRight className="h-8 w-8 stroke-[2.5]" />
          </button>

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

        {/* PULSANTI BEN VISIBILI: DA CHE NUMERO PARTIRE / RICHIAMA / AZZERA TUTTO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* TASTO BEN VISIBILE: SCEGLI DA CHE NUMERO PARTIRE */}
          <button
            type="button"
            onClick={() => {
              setStartNumberInput(String(queueState.currentNumber || 1));
              setShowStartNumberModal(true);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 py-3.5 px-4 text-sm font-bold shadow-2xs transition cursor-pointer"
          >
            <Hash className="h-4 w-4 text-emerald-700" />
            <span>Scegli da che N° partire (Oggi: {queueState.currentNumber})</span>
          </button>

          {/* TASTO RICHIAMA CAMPANELLA */}
          <button
            type="button"
            onClick={handleRecall}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 py-3.5 px-4 text-sm font-bold transition cursor-pointer"
          >
            <Bell className="h-4 w-4 text-emerald-700" />
            <span>Richiama Turno (Suono)</span>
          </button>

          {/* TASTO AZZERA TUTTO PER IL GIORNO SUCCESSIVO */}
          <button
            type="button"
            onClick={handleFullResetForNewDay}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 py-3.5 px-4 text-sm font-bold transition cursor-pointer"
          >
            <RotateCcw className="h-4 w-4 text-rose-700" />
            <span>Azzera Tutto (Nuova Giornata)</span>
          </button>
        </div>

        {/* FINESTRELLA RAPIDA "DA CHE NUMERO PARTIRE" */}
        {showStartNumberModal && (
          <form
            onSubmit={handleSetStartingNumber}
            className="rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm font-bold text-emerald-950">
                Da quale numero progressivo vuoi partire (o chiamare ora)?
              </p>
              <p className="text-xs text-emerald-800">
                Inserisci il numero (es. 1, 15, 25): lo schermo in Sala d&apos;Attesa mostrerà subito quel numero e il relativo nome.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number"
                min={1}
                value={startNumberInput}
                onChange={(e) => setStartNumberInput(e.target.value)}
                className="h-11 w-24 rounded-xl border-2 border-emerald-600 bg-white px-3 text-center text-lg font-bold text-slate-900 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 text-sm font-bold text-white cursor-pointer"
              >
                Imposta N°
              </button>
              <button
                type="button"
                onClick={() => setShowStartNumberModal(false)}
                className="h-11 rounded-xl bg-white border border-slate-300 px-3 text-xs font-medium text-slate-600"
              >
                Chiudi
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ====================================================================
          PASSO 3: ELENCO NOMINATIVI MEMORIZZATI (1..24, POI INTEGRATI 25..36)
         ==================================================================== */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Elenco Nominativi Memorizzati ({queueState.items.length} soci)
            </h2>
            <p className="text-xs text-slate-500">
              Puoi anche aggiungere o correggere un nome al volo qui sotto (con suggerimento automatico dall&apos;Anagrafica Soci).
            </p>
          </div>

          {queueState.items.length > 0 && (
            <div className="relative w-full sm:w-60">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca N° o nome..."
                className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* INSERIMENTO / INTEGRAZIONE MANUALE RAPIDA CON AUTOCOMPLETAMENTO SOCI */}
        <div className="space-y-2">
          <form onSubmit={handleQuickAddRow} className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 sm:w-36 shrink-0">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Prog. N°</span>
              <input
                type="number"
                min={1}
                value={quickNumber}
                onChange={(e) => setQuickNumber(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-center text-base font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="relative flex-1">
              <User className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={quickNameInputRef}
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder={`Scrivi Nome e Cognome per il N° ${quickNumber}...`}
                className="h-11 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 text-xs sm:text-sm font-bold text-white shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Memorizza N° {quickNumber}</span>
            </button>
          </form>

          {/* SUGGERIMENTI AUTOMATICI DALL'ANAGRAFICA SOCI */}
          {memberSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                <Sparkles className="h-3 w-3" /> Tocca per completare da Anagrafica:
              </span>
              {memberSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const num = parseInt(quickNumber.trim(), 10) || nextAvailableProgressiveNumber;
                    updateQueueState((prev) => {
                      const filtered = prev.items.filter((i) => i.number !== num);
                      const nextItems = [...filtered, { number: num, name: s.full_name }].sort(
                        (a, b) => a.number - b.number
                      );
                      return { ...prev, items: nextItems };
                    });
                    setQuickNumber(String(num + 1));
                    setQuickName('');
                    quickNameInputRef.current?.focus();
                  }}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-950 transition cursor-pointer"
                >
                  + N° {quickNumber}: {s.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* LISTA NUMERI E NOMI MEMORIZZATI */}
        {queueState.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center space-y-1">
            <p className="text-sm font-semibold text-slate-700">
              Nessun nominativo in lista per oggi.
            </p>
            <p className="text-xs text-slate-500">
              Usa il pulsante verde <strong>&ldquo;📷 Fotografa il Foglio con il Telefonino&rdquo;</strong> in alto per acquisire i nomi (es. dall&apos;1 al 24), oppure inseriscili qui sopra.
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const isCurrent = item.number === queueState.currentNumber;
              return (
                <div
                  key={item.number}
                  className={`flex items-center justify-between gap-2 px-3.5 py-2.5 transition ${
                    isCurrent ? 'bg-emerald-50/90' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        updateQueueState((prev) => ({
                          ...prev,
                          currentNumber: item.number,
                          callPulse: Date.now(),
                        }))
                      }
                      className={`inline-flex items-center justify-center min-w-[3.2rem] rounded-xl px-2.5 py-1.5 text-sm font-black tabular-nums cursor-pointer transition ${
                        isCurrent
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-emerald-100 text-slate-800'
                      }`}
                      title="Tocca per chiamare subito questo numero in Sala d'Attesa"
                    >
                      N° {item.number}
                    </button>

                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItemNameInline(item.number, e.target.value)}
                      className={`h-9 flex-1 min-w-0 rounded-lg border px-2.5 text-sm font-semibold focus:outline-none ${
                        isCurrent
                          ? 'border-emerald-500 bg-white text-emerald-950'
                          : 'border-transparent hover:border-slate-200 focus:border-emerald-500 bg-transparent text-slate-800'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white">
                        <Check className="h-3.5 w-3.5" /> Chiamato
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateQueueState((prev) => ({
                            ...prev,
                            currentNumber: item.number,
                            callPulse: Date.now(),
                          }))
                        }
                        className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 cursor-pointer"
                      >
                        Chiama
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteQueueItem(item.number)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Elimina riga"
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
  );
};
