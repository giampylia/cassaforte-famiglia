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

// AudioContext condiviso + Generatore WAV 16-bit in memoria per garantire che il suono "Din-Don" si senta FORTE sia sul cellulare che sul Monitor TV
let sharedAudioCtx: AudioContext | null = null;
let cachedChimeWavUrl: string | null = null;

function getChimeWavUrl(): string {
  if (cachedChimeWavUrl) return cachedChimeWavUrl;
  const sampleRate = 44100;
  const durationSec = 1.15;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // Linear quantization
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // 1ª nota "DIN" (Mi5 = 659.25 Hz + armonica)
    if (t < 0.55) {
      const env1 = Math.exp(-t * 5.2);
      sample +=
        env1 *
        (0.65 * Math.sin(2 * Math.PI * 659.25 * t) +
          0.25 * Math.sin(2 * Math.PI * 1318.5 * t) +
          0.1 * Math.sin(2 * Math.PI * 1977.75 * t));
    }

    // 2ª nota "DON" (Do5 = 523.25 Hz + armonica)
    if (t >= 0.32) {
      const t2 = t - 0.32;
      const env2 = Math.exp(-t2 * 3.8);
      sample +=
        env2 *
        (0.7 * Math.sin(2 * Math.PI * 523.25 * t2) +
          0.22 * Math.sin(2 * Math.PI * 1046.5 * t2) +
          0.08 * Math.sin(2 * Math.PI * 1569.75 * t2));
    }

    const clamped = Math.max(-1, Math.min(1, sample * 0.92));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  cachedChimeWavUrl = URL.createObjectURL(blob);
  return cachedChimeWavUrl;
}

export function unlockAudioEngine() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
    }
  } catch {
    // Ignore
  }
}

// Suono "Din-Don" professionale da tabellone sala d'attesa + sintesi vocale opzionale
function playQueueCallChime(number: number, name: string, voiceActive: boolean) {
  let playedWav = false;
  try {
    const wavUrl = getChimeWavUrl();
    const audio = new Audio(wavUrl);
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playedWav = true;
      playPromise.catch(() => {
        // Fallback WebAudio se l'elemento HTMLAudio viene bloccato
        playWebAudioFallback();
      });
    } else {
      playedWav = true;
    }
  } catch {
    // Fallback
  }

  function playWebAudioFallback() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
      const ctx = sharedAudioCtx;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.65, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(523.25, now + 0.32);
      gain2.gain.setValueAtTime(0.7, now + 0.32);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.32);
      osc2.stop(now + 1.1);
    } catch {
      // Ignore audio context restrictions
    }
  }

  if (!playedWav) {
    playWebAudioFallback();
  }

  if (voiceActive && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const text = name ? `Turno numero ${number}, ${name}` : `Turno numero ${number}`;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'it-IT';
        utter.volume = 1.0;
        utter.rate = 0.95;
        const voices = window.speechSynthesis.getVoices?.() || [];
        const itVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('it'));
        if (itVoice) utter.voice = itVoice;
        window.speechSynthesis.speak(utter);
      }, 650);
    } catch {
      // Ignore speech synthesis errors
    }
  }
}

// Parole di altre colonne (es. materie dei corsi, sedi, intestazioni, barra formule) da rimuovere per tenere SOLO Nome e Cognome
const EXTRA_COLUMN_WORDS = new RegExp(
  '\\b(inglese|spagnolo|francese|tedesco|informatica|computer|smartphone|ginnastica|posturale|dolce|yoga|pilates|ballo|danza|storia|arte|sardegna|pittura|disegno|acquerello|teatro|coro|musica|canto|psicologia|filosofia|letteratura|poesia|fotografia|cucito|ricamo|scacchi|burraco|bridge|viaggi|quartu|soleminis|base|avanzato|intermedio|corso|materia|firma|pagato|acconto|saldo|mattina|pomeriggio|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|enter\\s+text|formula\\s+here|volte)\\b.*$',
  'i'
);

const HEADER_NOISE =
  /^(pagina|page|elenco|lista|universit|quartu|soleminis|data|stampato|totale|prog\.?\s*nome|n[°.]?\s*nome|num\.?\s*cognome|cognome\s+e\s+nome|nome\s+e\s+cognome|materia|firma|enter\s+text|formula\s+here|fx\b)/i;

// Pulisce la parte testuale tenendo solo Nome e Cognome (ed eventualmente confrontando con l'Anagrafica Soci)
function extractCleanNameOnly(rawRest: string, knownProfiles: Profile[]): string {
  // Se c'è il separatore di colonna | (inserito anche dal rilevatore geometrico delle colonne), tiene solo la colonna del Nome e Cognome
  let firstCol = rawRest.split('|')[0] || rawRest;

  let text = firstCol
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ') // rimuove date
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ') // rimuove orari tipo 19:00
    .replace(/\b\d{6,12}\b/g, ' ') // rimuove numeri di telefono
    .replace(/€\s*\d+([.,]\d+)?/g, ' ') // rimuove importi
    .replace(/\b\d{1,3}[.,]\d{1,3}\b/g, ' ') // rimuove decimali tipo 1.01, 1.02
    .replace(/\b[A-Za-z]{1,4}\d+[A-Za-z0-9]*\b/g, ' ') // rimuove codici alfanumerici extra colonna tipo RB1, WR1, TE1, QB1
    .replace(/\b\d+[A-Za-z]{1,4}\b/g, ' ')
    .trim();

  // Taglia via eventuali colonne successive (es. Materia prescelta)
  text = text.replace(EXTRA_COLUMN_WORDS, '').trim();

  // Tiene solo caratteri validi per un nome e cognome
  let cleanWords = text
    .replace(/[^A-Za-zÀ-ÿ'\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length >= 2 || /^[A-Za-zÀ-ÿ]\.(?:[A-Za-zÀ-ÿ]\.)?$/.test(w));

  // Se il nome e cognome è seguito in fondo alla riga da sigle brevi maiuscole di altre colonne (es. ATL, NYG, LV, PHI, WR, RB, TE, QB), le rimuove!
  const hasLowercaseInName = cleanWords.slice(0, 2).some((w) => /[a-zà-ÿ]/.test(w));
  if (hasLowercaseInName && cleanWords.length > 2) {
    while (
      cleanWords.length > 2 &&
      /^[A-Z]{2,4}$/.test(cleanWords[cleanWords.length - 1])
    ) {
      cleanWords.pop();
    }
  }

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

// Ricostruisce le righe ORIZZONTALI usando le coordinate (x, y) delle parole lette da Tesseract,
// evitando che le tabelle vengano lette in verticale colonna per colonna e separando con '|' le colonne a destra del Nome!
function reconstructRowsFromTesseractData(data: any): string[] {
  if (!data) return [];
  const rawWords: { text: string; x0: number; y0: number; x1: number; y1: number }[] = [];

  const collectWord = (w: any) => {
    const t = String(w?.text || '').trim();
    if (!t) return;
    const b = w?.bbox;
    if (b && typeof b.x0 === 'number' && typeof b.y0 === 'number') {
      rawWords.push({ text: t, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
    }
  };

  if (Array.isArray(data.words) && data.words.length > 0) {
    data.words.forEach(collectWord);
  } else if (Array.isArray(data.lines) && data.lines.length > 0) {
    data.lines.forEach((l: any) => {
      if (Array.isArray(l?.words) && l.words.length > 0) {
        l.words.forEach(collectWord);
      } else {
        collectWord(l);
      }
    });
  } else if (Array.isArray(data.blocks)) {
    data.blocks.forEach((blk: any) =>
      blk?.paragraphs?.forEach((p: any) =>
        p?.lines?.forEach((l: any) => {
          if (Array.isArray(l?.words) && l.words.length > 0) {
            l.words.forEach(collectWord);
          } else {
            collectWord(l);
          }
        })
      )
    );
  }

  if (rawWords.length === 0) return [];

  // Calcola l'altezza media delle parole per raggruppare con precisione le parole sulla stessa riga orizzontale
  const heights = rawWords
    .map((w) => Math.max(4, w.y1 - w.y0))
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 18;
  const rowTolerance = Math.max(8, medianHeight * 0.58);

  const rowGroups: {
    cy: number;
    words: { text: string; x0: number; y0: number; x1: number; y1: number }[];
  }[] = [];

  // Ordina prima per Y crescente così la formazione delle righe segue l'ordine dall'alto in basso
  const sortedByY = [...rawWords].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);

  for (const w of sortedByY) {
    const cy = (w.y0 + w.y1) / 2;
    let bestGroup: (typeof rowGroups)[0] | null = null;
    let bestDist = Infinity;
    for (const g of rowGroups) {
      const d = Math.abs(g.cy - cy);
      if (d <= rowTolerance && d < bestDist) {
        bestDist = d;
        bestGroup = g;
      }
    }
    if (!bestGroup) {
      rowGroups.push({ cy, words: [w] });
    } else {
      bestGroup.words.push(w);
      // Aggiorna centro verticale medio della riga
      bestGroup.cy =
        bestGroup.words.reduce((acc, item) => acc + (item.y0 + item.y1) / 2, 0) /
        bestGroup.words.length;
    }
  }

  rowGroups.sort((a, b) => a.cy - b.cy);

  return rowGroups.map((g) => {
    g.words.sort((a, b) => a.x0 - b.x0);
    let lineStr = '';
    let alphaWordsSeen = 0;
    for (let i = 0; i < g.words.length; i++) {
      const curr = g.words[i];
      if (i > 0) {
        const prev = g.words[i - 1];
        const gap = curr.x0 - prev.x1;
        // Se abbiamo già visto il Nome e Cognome (almeno 2 parole alfabetiche) e c'è un salto netto di colonna, inseriamo '|'
        if (alphaWordsSeen >= 2 && gap > medianHeight * 1.45) {
          lineStr += ' | ';
        } else {
          lineStr += ' ';
        }
      }
      lineStr += curr.text;
      if (/[A-Za-zÀ-ÿ]{2,}/.test(curr.text)) {
        alphaWordsSeen++;
      }
    }
    return lineStr.trim();
  });
}

// Analizza le righe estratte dal foglio fotografato o dal PDF per ricavare [Numero Progressivo, Nome e Cognome]
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
      .replace(/;+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!line || line.length < 2) continue;
    if (HEADER_NOISE.test(line)) continue;
    if (/^\d{1,2}:\d{2}\b/.test(line)) continue; // salta barra orologio telefono (es. 19:00)

    // Trova l'inizio del Nome e Cognome (prima parola alfabetica di almeno 2 lettere, oppure iniziali tipo A.J.)
    // ignorando prefissi come "N°", "n.", "#"
    const withoutPrefixLabel = line.replace(/^(?:n[°º.]?\s*|#\s*)/i, '').trim();
    const nameStartMatch = withoutPrefixLabel.match(
      /([A-Za-zÀ-ÿ]{2,}|[A-Za-zÀ-ÿ]\.[A-Za-zÀ-ÿ]\.)/
    );

    if (nameStartMatch && typeof nameStartMatch.index === 'number') {
      const prefixBeforeName = withoutPrefixLabel.slice(0, nameStartMatch.index).trim();
      const restFromName = withoutPrefixLabel.slice(nameStartMatch.index).trim();

      if (prefixBeforeName.length > 0) {
        // Rimuove eventuali codici decimali (es. 1.01, 1.02, 2.09) dal prefisso numerico
        // così "1.01 1 Bijan Robinson" o "1.02 2 Malik Nabers" non scambia MAI "1.02" per il numero 1!
        const prefixWithoutDecimals = prefixBeforeName.replace(/\b\d{1,3}[.,]\d{1,3}\b/g, ' ');
        const intMatches = prefixWithoutDecimals.match(/\b\d{1,4}\b/g) || [];
        const validInts = intMatches
          .map((m) => parseInt(m, 10))
          .filter((n) => !isNaN(n) && n > 0 && n <= 500);

        let chosenNum: number | null = null;
        if (validInts.length > 0) {
          // Prende l'intero immediatamente precedente al Nome e Cognome (es. in "3 1.01 1 Bijan Robinson" prende 1; in "4 1.02 2 Malik Nabers" prende 2)
          chosenNum = validInts[validInts.length - 1];
        } else {
          // Se nel prefisso c'era solo un decimale tipo "1.07" (perché il 7 era sbiadito), usa la parte dopo il punto o il progressivo successivo
          const decMatch = prefixBeforeName.match(/\b(\d{1,2})[.,](\d{2})\b/);
          if (decMatch) {
            const prevNum = results.length > 0 ? results[results.length - 1].number : existingMaxNumber;
            chosenNum = prevNum + 1;
          }
        }

        const cleanName = extractCleanNameOnly(restFromName, knownProfiles);
        if (chosenNum !== null && cleanName && !HEADER_NOISE.test(cleanName)) {
          // Se per un errore ottico dell'OCR il numero letto era già uscito ma siamo in una tabella sequenziale, assegna il successivo
          if (seenNumbers.has(chosenNum) && results.length > 0) {
            const expectedNext = results[results.length - 1].number + 1;
            if (!seenNumbers.has(expectedNext)) {
              chosenNum = expectedNext;
            }
          }
          if (!seenNumbers.has(chosenNum)) {
            seenNumbers.add(chosenNum);
            results.push({ number: chosenNum, name: cleanName });
          }
          continue;
        }
      }
    }

    // Fallback: se su una riga l'OCR ha letto chiaramente Nome e Cognome ma il numerino era fuori inquadratura
    const cleanOnlyName = extractCleanNameOnly(line, knownProfiles);
    if (cleanOnlyName && cleanOnlyName.includes(' ') && cleanOnlyName.length >= 5) {
      if (results.length > 0) {
        // Se siamo già dentro una tabella numerata e una singola riga aveva il numero illeggibile, le dà il numero successivo!
        const nextSequential = results[results.length - 1].number + 1;
        if (!seenNumbers.has(nextSequential)) {
          seenNumbers.add(nextSequential);
          results.push({ number: nextSequential, name: cleanOnlyName });
          continue;
        }
      }
      fallbackNamesOnly.push(cleanOnlyName);
    }
  }

  // Se la maggior parte delle righe aveva solo il nome (es. colonna numeri tagliata nella foto), integra anche fallbackNamesOnly!
  if (fallbackNamesOnly.length > 0 && results.length <= 2) {
    let startN =
      results.length > 0
        ? Math.max(...results.map((r) => r.number))
        : existingMaxNumber;
    for (const name of fallbackNamesOnly) {
      if (!results.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
        startN++;
        results.push({ number: startN, name });
      }
    }
  }

  if (results.length > 0) {
    return results.sort((a, b) => a.number - b.number);
  }

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
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(!forceMonitorMode);
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

  // Sblocca automaticamente l'audio al primo tocco o clic su qualsiasi punto della pagina
  useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudioEngine();
      setAudioUnlocked(true);
    };
    window.addEventListener('click', handleFirstInteraction, { passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstInteraction, { passive: true });
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

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

  // Verifica se il Monitor in Sala d'Attesa è in modalità Standby ("In attesa di prima chiamata" / "In pausa" / "Chiuso")
  const isStandby =
    queueState.currentNumber <= 0 ||
    (Boolean(queueState.standbyMode) && queueState.standbyMode !== 'none');

  const standbyDisplay = useMemo(() => {
    const mode = queueState.standbyMode || (queueState.currentNumber <= 0 ? 'waiting' : 'none');
    if (mode === 'paused') {
      return {
        badge: 'AVVISO SALA D’ATTESA',
        title: queueState.standbyMessage || 'SERVIZIO TEMPORANEAMENTE IN PAUSA',
        subtitle: 'Le chiamate riprenderanno a breve — Grazie per l’attesa',
      };
    }
    if (mode === 'closed') {
      return {
        badge: 'AVVISO SALA D’ATTESA',
        title: queueState.standbyMessage || 'SPORTELLO CHIUSO — NON OPERATIVO',
        subtitle: 'Il servizio di chiamata turni non è attivo in questo momento',
      };
    }
    return {
      badge: 'AVVISO SALA D’ATTESA',
      title: queueState.standbyMessage || 'IN ATTESA DI PRIMA CHIAMATA',
      subtitle: 'Il servizio inizierà a breve — Attendere l’avvio delle chiamate',
    };
  }, [queueState.standbyMode, queueState.standbyMessage, queueState.currentNumber]);

  // Prossimo socio in coda
  const nextItem = useMemo(() => {
    if (isStandby) {
      const firstNum =
        queueState.currentNumber > 0
          ? queueState.currentNumber
          : queueState.items.length > 0
          ? queueState.items[0].number
          : 1;
      const foundFirst = queueState.items.find((it) => it.number === firstNum);
      return {
        number: firstNum,
        name: foundFirst?.name || '',
      };
    }
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
  }, [queueState.items, queueState.currentNumber, isStandby]);

  // Effetto sonoro e lampeggio sia sullo Schermo Sala d'Attesa sia in Segreteria quando arriva un nuovo impulso
  useEffect(() => {
    if (!queueState.callPulse || queueState.callPulse === lastPlayedPulseRef.current) return;
    lastPlayedPulseRef.current = queueState.callPulse;
    setFlashActive(true);
    const timer = setTimeout(() => setFlashActive(false), 2400);

    if (soundEnabled && !isStandby && queueState.currentNumber > 0) {
      const matched = queueState.items.find((it) => it.number === queueState.currentNumber);
      playQueueCallChime(queueState.currentNumber, matched?.name || '', true);
    }

    return () => clearTimeout(timer);
  }, [queueState.callPulse, queueState.currentNumber, queueState.items, soundEnabled, isStandby]);

  // Integra i nuovi nominativi (es. dal 25 al 36) SENZA cancellare i precedenti (1..24) e SENZA uscire da "In Attesa Prima Chiamata" finché non si preme AVANTI
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
        } else if (item.name && already.name !== item.name) {
          mapByNum.set(item.number, item);
          updatedCount++;
        }
      }

      const mergedList = Array.from(mapByNum.values()).sort((a, b) => a.number - b.number);

      setTimeout(() => {
        if (newlyAddedCount > 0) {
          showNotice(
            'success',
            `✓ Letti e integrati ${newlyAddedCount} nuovi nominativi (dal N° ${minAdded} al N° ${maxAdded}). Totale in lista: ${mergedList.length} soci.`
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
        pdfFileName: sourceLabel,
      };
    });
  };

  // Pre-elaborazione adattiva per leggere sia foto di fogli cartacei sia screenshot di tabelle Excel/cellulare:
  // 1) Sbianca le barre scure del telefono (orologio in alto, barra formula nera in basso, intestazioni grigio scuro)
  // 2) Rimuove le griglie colorate (blu/verdi) delle tabelle Excel lasciando il testo nero nitidissimo su fondo bianco
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

        // Calcola la luminosità media su blocchi 24x24 per distinguere il foglio bianco dalle barre scure del cellulare/tavolo
        const blockSize = 24;
        const cols = Math.ceil(w / blockSize);
        const rows = Math.ceil(h / blockSize);
        const blockAvg = new Float32Array(cols * rows);

        for (let by = 0; by < rows; by++) {
          for (let bx = 0; bx < cols; bx++) {
            let sum = 0;
            let count = 0;
            const yStart = by * blockSize;
            const yEnd = Math.min(h, yStart + blockSize);
            const xStart = bx * blockSize;
            const xEnd = Math.min(w, xStart + blockSize);
            for (let y = yStart; y < yEnd; y += 2) {
              for (let x = xStart; x < xEnd; x += 2) {
                const idx = (y * w + x) * 4;
                sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                count++;
              }
            }
            blockAvg[by * cols + bx] = count > 0 ? sum / count : 255;
          }
        }

        for (let y = 0; y < h; y++) {
          const by = Math.min(rows - 1, Math.floor(y / blockSize));
          for (let x = 0; x < w; x++) {
            const bx = Math.min(cols - 1, Math.floor(x / blockSize));
            const localBg = blockAvg[by * cols + bx];
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);

            // Se il blocco locale ha sfondo scuro (es. barra nera telefono, colonna numeri riga Excel scura)
            // oppure è una linea di griglia colorata (azzurra/verde), la trasforma in bianco puro (255)
            if (localBg < 110 || (colorSpread > 35 && gray > 75)) {
              data[idx] = 255;
              data[idx + 1] = 255;
              data[idx + 2] = 255;
            } else {
              // Sul foglio/tabella bianca: rende scuro e netto l'inchiostro del testo ed elimina griglie chiare e ombre
              const isInk = gray < Math.min(165, localBg - 22);
              const val = isInk ? Math.max(0, gray * 0.35) : 255;
              data[idx] = val;
              data[idx + 1] = val;
              data[idx + 2] = val;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.94));
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

        setScanStatusText('Lettura ottica (OCR) di tutte le righe del foglio in corso...');
        const processedDataUrl = await preprocessImageForOcr(file);
        const Tesseract = await loadTesseract();

        const result = await Tesseract.recognize(processedDataUrl, 'ita', {
          tessedit_pageseg_mode: '6',
          logger: (m: any) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              setScanProgress(Math.round(15 + m.progress * 80));
            }
          },
        });

        // 1) Ricostruzione geometrica riga per riga tramite coordinate (x, y) delle parole
        const geomLines = reconstructRowsFromTesseractData(result?.data);
        const parsedGeom = parseSheetLinesIntoQueueItems(geomLines, profiles, existingMax);

        // 2) Parsing del testo grezzo lineare
        const rawLines = String(result?.data?.text || '').split(/\r?\n/);
        const parsedRaw = parseSheetLinesIntoQueueItems(rawLines, profiles, existingMax);

        // Sceglie il risultato più completo (quello che ha estratto più righe valide!)
        const bestParsed = parsedGeom.length >= parsedRaw.length ? parsedGeom : parsedRaw;

        if (bestParsed.length > 0) {
          integrateExtractedItems(bestParsed, `Foto: ${file.name}`);
        } else {
          setShowPhotoModal(true);
          showNotice(
            'error',
            'La scrittura sul foglio è molto leggera: ho aperto la foto qui sotto così puoi inserire o confermare i nomi velocemente!'
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
                tessedit_pageseg_mode: '6',
                logger: (m: any) => {
                  if (m.status === 'recognizing text' && typeof m.progress === 'number') {
                    setScanProgress(Math.round(40 + m.progress * 55));
                  }
                },
              });
              const geom = reconstructRowsFromTesseractData(res?.data);
              ocrLines.push(...(geom.length > 0 ? geom : String(res?.data?.text || '').split(/\r?\n/)));
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

  // Comandi Telecomando Segreteria (suona subito anche sul dispositivo in Segreteria oltre che sul Monitor!)
  const handleNext = () => {
    unlockAudioEngine();
    let targetNum = queueState.currentNumber + 1;

    if (isStandby) {
      // Se eravamo in "Attesa Prima Chiamata" (currentNumber <= 0), parte dal 1° numero in lista (o da 1)
      if (queueState.currentNumber <= 0) {
        targetNum = queueState.items.length > 0 ? queueState.items[0].number : 1;
      } else {
        // Se eravamo in Pausa a metà giornata, riprende dal turno corrente (o dal successivo)
        targetNum = queueState.currentNumber;
      }
    } else if (queueState.items.length > 0) {
      const nextInList = queueState.items.find((it) => it.number > queueState.currentNumber);
      if (nextInList) {
        targetNum = nextInList.number;
      }
    }

    const targetItem = queueState.items.find((it) => it.number === targetNum);
    const pulseNow = Date.now();
    lastPlayedPulseRef.current = pulseNow;
    if (soundEnabled) {
      playQueueCallChime(targetNum, targetItem?.name || '', true);
    }
    updateQueueState((prev) => ({
      ...prev,
      currentNumber: targetNum,
      standbyMode: 'none',
      standbyMessage: '',
      callPulse: pulseNow,
    }));
  };

  const handlePrev = () => {
    if (queueState.currentNumber <= 1) return;
    unlockAudioEngine();
    let prevNum = queueState.currentNumber - 1;
    if (queueState.items.length > 0) {
      const lowerItems = queueState.items.filter((it) => it.number < queueState.currentNumber);
      if (lowerItems.length > 0) {
        prevNum = lowerItems[lowerItems.length - 1].number;
      }
    }
    const finalNum = Math.max(1, prevNum);
    const targetItem = queueState.items.find((it) => it.number === finalNum);
    const pulseNow = Date.now();
    lastPlayedPulseRef.current = pulseNow;
    if (soundEnabled) {
      playQueueCallChime(finalNum, targetItem?.name || '', true);
    }
    updateQueueState((prev) => ({
      ...prev,
      currentNumber: finalNum,
      standbyMode: 'none',
      standbyMessage: '',
      callPulse: pulseNow,
    }));
  };

  const handleRecall = () => {
    unlockAudioEngine();
    const callNum =
      queueState.currentNumber > 0
        ? queueState.currentNumber
        : queueState.items.length > 0
        ? queueState.items[0].number
        : 1;
    const pulseNow = Date.now();
    lastPlayedPulseRef.current = pulseNow;
    const targetItem = queueState.items.find((it) => it.number === callNum);
    // Quando si preme "Richiama Turno (Suono)", riproduce SEMPRE il suono + voce!
    playQueueCallChime(callNum, targetItem?.name || '', true);
    updateQueueState((prev) => ({
      ...prev,
      currentNumber: callNum,
      standbyMode: 'none',
      standbyMessage: '',
      callPulse: pulseNow,
    }));
  };

  const handleSetStandbyStatus = (
    mode: 'waiting' | 'paused' | 'closed',
    msg: string,
    resetNumberToZero = false
  ) => {
    updateQueueState((prev) => ({
      ...prev,
      currentNumber: resetNumberToZero ? 0 : prev.currentNumber,
      standbyMode: mode,
      standbyMessage: msg,
    }));
    showNotice('success', `✓ Schermo Sala d'Attesa impostato su: "${msg}"`);
  };

  const handleSetStartingNumber = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = parseInt(startNumberInput.trim(), 10);
    if (isNaN(num) || num < 1) return;
    unlockAudioEngine();
    const pulseNow = Date.now();
    lastPlayedPulseRef.current = pulseNow;
    const targetItem = queueState.items.find((it) => it.number === num);
    if (soundEnabled) {
      playQueueCallChime(num, targetItem?.name || '', true);
    }
    updateQueueState((prev) => ({
      ...prev,
      currentNumber: num,
      standbyMode: 'none',
      standbyMessage: '',
      callPulse: pulseNow,
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

  // AZZERA TUTTO per il giorno successivo / nuova fila in Sala d'Attesa -> mostra "IN ATTESA DI PRIMA CHIAMATA"
  const handleFullResetForNewDay = () => {
    const confirmed = window.confirm(
      "AZZERAMENTO COMPLETO PER NUOVA GIORNATA / NUOVA FILA:\n\nTutti i nominativi in elenco verranno cancellati e il Monitor in Sala d'Attesa verrà messo su:\n«IN ATTESA DI PRIMA CHIAMATA».\n\nConfermi l'azzeramento?"
    );
    if (!confirmed) return;

    updateQueueState((prev) => ({
      ...prev,
      items: [],
      currentNumber: 0,
      standbyMode: 'waiting',
      standbyMessage: 'IN ATTESA DI PRIMA CHIAMATA',
      pdfFileName: '',
    }));
    setLastSheetPhotoUrl(null);
    setStartNumberInput('1');
    showNotice(
      'success',
      '✓ Eliminacode azzerato! Il Monitor in Sala d’Attesa ora mostra «IN ATTESA DI PRIMA CHIAMATA».'
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
        onClick={() => {
          if (!audioUnlocked) {
            unlockAudioEngine();
            setAudioUnlocked(true);
            if (soundEnabled && !isStandby && queueState.currentNumber > 0) {
              playQueueCallChime(queueState.currentNumber, currentItem?.name || '', true);
            } else if (soundEnabled) {
              playQueueCallChime(1, '', false);
            }
          }
        }}
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
            {!audioUnlocked && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  unlockAudioEngine();
                  setAudioUnlocked(true);
                  setSoundEnabled(true);
                  if (!isStandby && queueState.currentNumber > 0) {
                    playQueueCallChime(queueState.currentNumber, currentItem?.name || '', true);
                  } else {
                    playQueueCallChime(1, '', false);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-white text-emerald-950 px-4 py-2 text-xs sm:text-sm font-extrabold border-2 border-white shadow-md animate-pulse cursor-pointer"
              >
                <Volume2 className="h-4 w-4 text-emerald-700" />
                <span>Clicca qui per attivare il Suono sul Monitor</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                unlockAudioEngine();
                setAudioUnlocked(true);
                const nextVal = !soundEnabled;
                setSoundEnabled(nextVal);
                if (nextVal) {
                  if (!isStandby && queueState.currentNumber > 0) {
                    playQueueCallChime(queueState.currentNumber, currentItem?.name || '', true);
                  } else {
                    playQueueCallChime(1, '', false);
                  }
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
                {soundEnabled ? 'Audio Attivo (Prova)' : 'Audio Muto'}
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

        {/* RIQUADRO CENTRALE SALA D'ATTESA: SFONDO BEL VERDE, CORNICE BIANCA */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-6 text-center">
          <div
            className={`w-full max-w-6xl rounded-[2.5rem] border-4 border-white px-8 py-10 sm:py-14 transition-all duration-500 flex flex-col items-center justify-center shadow-2xl ${
              flashActive ? 'bg-emerald-600 scale-[1.02]' : 'bg-emerald-800/90'
            }`}
          >
            {isStandby ? (
              <>
                <div className="rounded-full border-2 border-white bg-white/15 px-8 py-2 text-lg sm:text-2xl font-extrabold uppercase tracking-[0.2em] text-white mb-6">
                  {standbyDisplay.badge}
                </div>

                <div
                  className="font-black uppercase tracking-wide text-white leading-tight drop-shadow-md py-4"
                  style={{ fontSize: 'clamp(2.8rem, 7vw, 6.2rem)' }}
                >
                  {standbyDisplay.title}
                </div>

                <div className="mt-6 w-full border-t-2 border-white/60 pt-6">
                  <div
                    className="font-semibold text-emerald-100 tracking-wide leading-snug"
                    style={{ fontSize: 'clamp(1.4rem, 3.2vw, 2.6rem)' }}
                  >
                    {standbyDisplay.subtitle}
                  </div>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </main>

        {/* PIE' DI PAGINA PULITO */}
        <footer className="px-6 py-3 bg-emerald-800/80 border-t border-white/25 text-center text-sm sm:text-lg font-medium text-emerald-100">
          {isStandby
            ? 'Segreteria Università della Terza Età — Quartu Sant’Elena'
            : 'Attendere la chiamata del proprio numero e nome'}
        </footer>
      </div>
    );
  }

  // ============================================================================
  // MODALITÀ SEGRETERIA (TELEFONINO / PC AMMINISTRATORE 7726)
  // ============================================================================
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-5">
      {/* BARRA DI SCELTA MODALITÀ E LINK DIRETTO PER IL MONITOR SALA D'ATTESA */}
      <div className="rounded-2xl bg-emerald-800 text-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

        {/* LINK DIRETTO DA APRIRE SUL MONITOR / TV IN SALA D'ATTESA (SENZA LOGIN) */}
        <div className="rounded-xl bg-emerald-900/80 border border-white/30 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs sm:text-sm">
            <span className="font-semibold text-emerald-200">
              📺 Link diretto per il Monitor in Sala d&apos;Attesa (senza login):{' '}
            </span>
            <a
              href="https://qu3.onrender.com/monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-bold text-white underline break-all"
            >
              https://qu3.onrender.com/monitor
            </a>
          </div>
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/monitor`;
              navigator.clipboard?.writeText(url);
              showNotice(
                'success',
                `✓ Link copiato (${url})! Aprilo sul browser del Monitor in Sala d'Attesa.`
              );
            }}
            className="inline-flex items-center justify-center rounded-lg bg-white text-emerald-900 hover:bg-emerald-50 px-3 py-1.5 text-xs font-bold transition shrink-0 cursor-pointer"
          >
            Copia Link Monitor
          </button>
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
          PASSO 2: TELECOMANDO SEGRETERIA (AVANTI / STATO MONITOR / DA CHE NUMERO PARTIRE / AZZERA TUTTO)
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
            {isStandby ? (
              <>
                <div className="inline-block rounded-full border border-white bg-white/15 px-4 py-0.5 text-xs font-extrabold uppercase tracking-[0.18em] text-white">
                  {standbyDisplay.badge} (IN SALA D&apos;ATTESA)
                </div>
                <div className="text-2xl sm:text-4xl font-black uppercase text-white leading-tight py-3">
                  {standbyDisplay.title}
                </div>
                <div className="pt-2 border-t border-white/40">
                  <p className="text-sm sm:text-base font-medium text-emerald-100">
                    {standbyDisplay.subtitle}
                  </p>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {nextItem && (
            <div className="mt-3 flex items-center justify-between px-2 text-xs sm:text-sm text-emerald-100">
              <span>
                {isStandby ? 'Primo turno pronto da chiamare: ' : 'Prossimo turno: '}
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
            className="sm:col-span-2 order-1 sm:order-2 flex items-center justify-center gap-3 rounded-3xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-5 px-6 text-xl sm:text-3xl font-black shadow-lg transition cursor-pointer"
          >
            <span>
              {isStandby
                ? `▶ INIZIA CHIAMATE (Dal N° ${nextItem.number})`
                : 'AVANTI (+1)'}
            </span>
            <ChevronRight className="h-8 w-8 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={handlePrev}
            disabled={isStandby || queueState.currentNumber <= 1}
            className="order-2 sm:order-1 flex items-center justify-center gap-2 rounded-3xl border-2 border-slate-300 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 py-5 px-5 text-lg font-bold transition cursor-pointer"
          >
            <ChevronLeft className="h-6 w-6" />
            <span>INDIETRO</span>
          </button>
        </div>

        {/* BARRA STATO MONITOR PRIMA DI INIZIARE O IN PAUSA/CHIUSURA */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Messaggio di Attesa / Chiusura sul Monitor (quando non stai chiamando i numeri):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                handleSetStandbyStatus('waiting', 'IN ATTESA DI PRIMA CHIAMATA', true)
              }
              className={`rounded-xl px-3 py-2.5 text-xs font-bold border transition cursor-pointer ${
                isStandby && (queueState.standbyMode === 'waiting' || !queueState.standbyMode)
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-emerald-50'
              }`}
            >
              ⏳ In Attesa di Prima Chiamata
            </button>

            <button
              type="button"
              onClick={() =>
                handleSetStandbyStatus('paused', 'SERVIZIO TEMPORANEAMENTE IN PAUSA', false)
              }
              className={`rounded-xl px-3 py-2.5 text-xs font-bold border transition cursor-pointer ${
                isStandby && queueState.standbyMode === 'paused'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-amber-50'
              }`}
            >
              ⏸️ Servizio in Pausa
            </button>

            <button
              type="button"
              onClick={() =>
                handleSetStandbyStatus('closed', 'SPORTELLO CHIUSO — NON OPERATIVO', false)
              }
              className={`rounded-xl px-3 py-2.5 text-xs font-bold border transition cursor-pointer ${
                isStandby && queueState.standbyMode === 'closed'
                  ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-rose-50'
              }`}
            >
              🔒 Sportello Chiuso / Non Operativo
            </button>
          </div>
        </div>

        {/* PULSANTI BEN VISIBILI: DA CHE NUMERO PARTIRE / RICHIAMA / AZZERA TUTTO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* TASTO BEN VISIBILE: SCEGLI DA CHE NUMERO PARTIRE */}
          <button
            type="button"
            onClick={() => {
              setStartNumberInput(String(queueState.currentNumber > 0 ? queueState.currentNumber : 1));
              setShowStartNumberModal(true);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 py-3.5 px-4 text-sm font-bold shadow-2xs transition cursor-pointer"
          >
            <Hash className="h-4 w-4 text-emerald-700" />
            <span>
              Scegli da che N° partire {queueState.currentNumber > 0 ? `(Ora: ${queueState.currentNumber})` : ''}
            </span>
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
