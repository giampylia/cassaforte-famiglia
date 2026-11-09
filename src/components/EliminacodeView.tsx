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

// Parole di altre colonne (es. materie dei corsi, segreteria, gruppi, sedi, intestazioni, watermark fotocamera) da rimuovere per tenere SOLO Nome e Cognome
const EXTRA_COLUMN_WORDS = new RegExp(
  '\\b(segreteria|gruppo|ambiente|inglese|spagnolo|francese|tedesco|informatica|computer|smartphone|ginnastica|posturale|dolce|yoga|pilates|ballo|danza|storia|arte|sardegna|pittura|disegno|acquerello|teatro|coro|musica|canto|psicologia|filosofia|letteratura|poesia|fotografia|cucito|ricamo|scacchi|burraco|bridge|viaggi|quartu|soleminis|base|avanzato|intermedio|corso|materia|nominativo|firma|pagato|acconto|saldo|mattina|pomeriggio|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|enter\\s+text|formula\\s+here|volte|zte|blade|a76)\\b.*$',
  'i'
);

const HEADER_NOISE =
  /^(pagina|page|elenco|lista|universit|quartu|soleminis|data|stampato|totale|prog\b|nominativo\b|prog\.?\s*nominativo|prog\.?\s*nome|n[°.]?\s*nome|num\.?\s*cognome|cognome\s+e\s+nome|nome\s+e\s+cognome|materia|firma|enter\s+text|formula\s+here|fx\b|zte\s+blade)/i;

// Nominativi frequenti QU3 di riferimento (oltre all'intera Anagrafica Soci caricata nel cloud)
const KNOWN_SHEET_NAMES_FALLBACK: string[] = [
  'PILIA GIAMPIERO',
  'BOI VINCENZO',
  'COCCO MARIA NIVES',
  'CORDA NATALINA',
  'SANDRO PROSPERI',
  'GIOVANNA SOTGIU',
  'ANNA MARIA SANNA',
];

function normalizeOcrTokenForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/[1|!l]/g, 'I')
    .replace(/5/g, 'S')
    .replace(/8/g, 'B')
    .replace(/6/g, 'G')
    .replace(/[^A-Z]/g, '');
}

// Normalizza le lettere che nella scrittura a mano (a penna) hanno tratti simili per l'OCR (es. B/G, U/V, M/N, D/T)
function handwritingSkeleton(s: string): string {
  return normalizeOcrTokenForMatch(s)
    .replace(/[BG]/g, 'B')
    .replace(/[UV]/g, 'V')
    .replace(/[MN]/g, 'N')
    .replace(/[DT]/g, 'T')
    .replace(/II+/g, 'I');
}

function weightedHandwritingEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = dp[i];
      const cost =
        a[i - 1] === b[j - 1]
          ? 0
          : handwritingSkeleton(a[i - 1]) === handwritingSkeleton(b[j - 1])
          ? 0.35
          : 1;
      dp[i] = Math.min(prev + cost, dp[i] + 1, dp[i - 1] + 1);
      prev = temp;
    }
  }
  return dp[a.length];
}

function weightedLcsLength(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  const dp = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    let prev = 0;
    for (let j = 0; j < b.length; j++) {
      const tmp = dp[j + 1];
      const match =
        a[i] === b[j]
          ? 1
          : handwritingSkeleton(a[i]) === handwritingSkeleton(b[j])
          ? 0.8
          : 0;
      dp[j + 1] = match > 0 ? Math.max(dp[j + 1], dp[j], prev + match) : Math.max(dp[j + 1], dp[j]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function tokenSimilarity(cand: string, target: string): number {
  const c = normalizeOcrTokenForMatch(cand);
  const t = normalizeOcrTokenForMatch(target);
  if (!c || !t) return 0;
  if (c === t) return 1;
  const maxLen = Math.max(c.length, t.length);
  if (maxLen === 0) return 0;
  const edSim = 1 - weightedHandwritingEditDistance(c, t) / maxLen;
  const lcsSim = weightedLcsLength(c, t) / maxLen;
  const sc = handwritingSkeleton(c);
  const st = handwritingSkeleton(t);
  const bonus =
    (sc[0] === st[0] ? 0.09 : 0) +
    (sc[sc.length - 1] === st[st.length - 1] ? 0.06 : 0) +
    (sc.slice(0, 2) === st.slice(0, 2) ? 0.07 : 0);
  return Math.min(1, Math.max(edSim, lcsSim * 0.92) + bonus);
}

// Verifica se una stringa OCR sembra rumore di lettura su scrittura a mano (es. CamelCase interno "aGarvleEno", "SoNalu", o frammenti corti "sis GO uve")
function looksLikeNoisyHandwrittenOcr(s: string): boolean {
  const words = s.trim().split(/\s+/);
  const hasInternalCamelCase = words.some((w) => /[a-z][A-Z]/.test(w));
  const shortFragments = words.filter((w) => w.length <= 3).length;
  return hasInternalCamelCase || (words.length >= 3 && shortFragments >= 2);
}

// Confronta un nome letto dall'OCR (anche se scritto a penna con lettere deformate) con l'Anagrafica Soci.
// Restituisce null se nessun socio supera la soglia di affidabilità (così non inventa mai soci sbagliati come Gavino Carta o Anna Rita Cao!).
function fuzzyMatchSocioName(candidateName: string, knownProfiles: Profile[]): string | null {
  if (!candidateName || candidateName.length < 3) return null;

  const rawTokens = candidateName
    .split(/\s+/)
    .map((t) => normalizeOcrTokenForMatch(t))
    .filter((t) => t.length >= 2);

  if (rawTokens.length === 0) return null;
  const candJoined = rawTokens.join('');

  // Crea anche coppie di token adiacenti (es. se una parola lunga scritta a mano come PROSPERI è stata spezzata in "Vo SCE")
  const cSpans: { text: string; i0: number; i1: number }[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    cSpans.push({ text: rawTokens[i], i0: i, i1: i });
    if (i + 1 < rawTokens.length) {
      cSpans.push({ text: rawTokens[i] + rawTokens[i + 1], i0: i, i1: i + 1 });
    }
  }

  // Costruisce il pool di candidati dall'Anagrafica Soci + i nominativi QU3 noti (senza duplicati e senza profili di servizio)
  const pool: { display: string; tokens: string[] }[] = [];
  const seenKeys = new Set<string>();
  const addTarget = (display: string) => {
    const tokens = display
      .split(/\s+/)
      .map(normalizeOcrTokenForMatch)
      .filter((t) => t.length >= 2);
    if (tokens.length === 0) return;
    const key = [...tokens].sort().join('|');
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    pool.push({ display: display.trim(), tokens });
  };

  for (const fb of KNOWN_SHEET_NAMES_FALLBACK) {
    addTarget(fb);
  }
  for (const p of knownProfiles || []) {
    if (!p?.full_name || p.member_number === '000') continue;
    if (/segreteria|ufficio|presenze/i.test(p.full_name)) continue;
    addTarget(p.full_name);
  }

  let bestDisplay: string | null = null;
  let bestScore = 0;
  const isNoisy = looksLikeNoisyHandwrittenOcr(candidateName);

  for (const target of pool) {
    if (target.tokens.length === 0) continue;

    // 1) Accoppiamento bipartito senza sovrapposizioni tra span OCR e parole del socio (indipendente da Nome Cognome vs Cognome Nome)
    const pairs: { ti: number; ci: number; sim: number; tLen: number }[] = [];
    for (let ti = 0; ti < target.tokens.length; ti++) {
      for (let ci = 0; ci < cSpans.length; ci++) {
        pairs.push({
          ti,
          ci,
          sim: tokenSimilarity(cSpans[ci].text, target.tokens[ti]),
          tLen: target.tokens[ti].length,
        });
      }
    }
    pairs.sort((a, b) => b.sim - a.sim);

    const usedTarget = new Set<number>();
    const usedRawIdx = new Set<number>();
    const matched: { sim: number; tLen: number }[] = [];

    for (const pr of pairs) {
      const sp = cSpans[pr.ci];
      if (!usedTarget.has(pr.ti) && !usedRawIdx.has(sp.i0) && !usedRawIdx.has(sp.i1)) {
        usedTarget.add(pr.ti);
        usedRawIdx.add(sp.i0);
        usedRawIdx.add(sp.i1);
        matched.push({ sim: pr.sim, tLen: pr.tLen });
      }
    }

    if (matched.length > 0) {
      const top1 = matched[0].sim;
      const top1Len = matched[0].tLen;
      const top2 = matched.length > 1 ? matched[1].sim : 0;
      const combinedScore = matched.length > 1 ? top1 * 0.58 + top2 * 0.42 : top1 * 0.78;

      // Richiede che almeno una parola del nome sia nettamente riconoscibile (top1 >= 0.76) oppure entrambe solide (top1 >= 0.66 e top2 >= 0.50)
      const isAcceptable =
        (top1 >= 0.76 && top1Len >= 5 && combinedScore >= 0.56) ||
        (top1 >= 0.66 && top2 >= 0.50 && combinedScore >= 0.54) ||
        (top1 >= 0.85 && top2 >= 0.35 && combinedScore >= 0.54) ||
        (isNoisy && top1 >= 0.68 && top2 >= 0.42 && combinedScore >= 0.55);

      if (isAcceptable && combinedScore > bestScore) {
        bestScore = combinedScore;
        bestDisplay = target.display;
      }
    }

    // 2) Confronto stringa unita (nel caso l'OCR su scrittura a mano abbia unito Nome e Cognome senza spazio)
    const targetForward = target.tokens.join('');
    const targetReverse = [...target.tokens].reverse().join('');
    const simFwd = tokenSimilarity(candJoined, targetForward);
    const simRev = tokenSimilarity(candJoined, targetReverse);
    const joinedSim = Math.max(simFwd, simRev);
    if (joinedSim >= 0.70 && joinedSim > bestScore) {
      bestScore = joinedSim;
      bestDisplay = target.display;
    }
  }

  return bestDisplay;
}

// Pulisce la parte testuale tenendo solo Nome e Cognome (e confrontando anche con l'Anagrafica Soci)
function extractCleanNameOnly(rawRest: string, knownProfiles: Profile[]): string {
  if (!rawRest || !rawRest.trim()) return '';

  // Usa ':::' come separatore geometrico di colonna (evitando che i bordi verticali '|' letti dall'OCR taglino il nome!)
  let firstCol = rawRest.split(':::')[0] || rawRest;

  // Prova subito il match diretto con l'Anagrafica Soci sulla prima colonna
  const directSocio = fuzzyMatchSocioName(firstCol, knownProfiles);
  if (directSocio) {
    return directSocio;
  }

  let text = firstCol
    .replace(/\|+/g, ' ') // rimuove eventuali barre verticali di griglia lette come '|'
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ') // rimuove date
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ') // rimuove orari tipo 19:00
    .replace(/\b\d{6,12}\b/g, ' ') // rimuove numeri di telefono
    .replace(/€\s*\d+([.,]\d+)?/g, ' ') // rimuove importi
    .replace(/\b\d{1,3}[.,]\d{1,3}\b/g, ' ') // rimuove decimali tipo 1.01, 1.02
    .replace(/\b[A-Za-z]{1,4}\d+[A-Za-z0-9]*\b/g, ' ') // rimuove codici alfanumerici extra colonna
    .replace(/\b\d+[A-Za-z]{1,4}\b/g, ' ')
    .trim();

  // Taglia via eventuali colonne successive (es. Materia prescelta: SEGRETERIA, GRUPPO AMBIENTE, ecc.)
  text = text.replace(EXTRA_COLUMN_WORDS, '').trim();

  // Corregge cifre tipicamente scambiate dall'OCR dentro una parola alfabetica (es. P1LIA -> PILIA, B0I -> BOI)
  text = text
    .replace(/(?<=[A-Za-zÀ-ÿ])0(?=[A-Za-zÀ-ÿ])/g, 'O')
    .replace(/(?<=[A-Za-zÀ-ÿ])1(?=[A-Za-zÀ-ÿ])/g, 'I')
    .replace(/(?<=[A-Za-zÀ-ÿ])5(?=[A-Za-zÀ-ÿ])/g, 'S')
    .replace(/(?<=[A-Za-zÀ-ÿ])8(?=[A-Za-zÀ-ÿ])/g, 'B');

  // Tiene solo caratteri validi per un nome e cognome
  let cleanWords = text
    .replace(/[^A-Za-zÀ-ÿ'\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => {
      if (!w) return false;
      // Scarta finte parole fatte solo di I/l generate dai bordi verticali della tabella
      if (/^[Il|!.,-]+$/.test(w) && w.length <= 3) return false;
      return w.length >= 2 || /^[A-Za-zÀ-ÿ]\.(?:[A-Za-zÀ-ÿ]\.)?$/.test(w);
    });

  // Se il nome e cognome (scritto in Misto Maiuscolo/minuscolo) è seguito in fondo da sigle brevi maiuscole di altre colonne, le rimuove
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
  if (HEADER_NOISE.test(candidateName)) return '';

  const matched = fuzzyMatchSocioName(candidateName, knownProfiles);
  if (matched) {
    return matched;
  }

  // Se il testo NON corrisponde a nessun socio in Anagrafica, verifica che sia un vero Nome e Cognome leggibile
  // (almeno 2 parole alfabetiche di >= 3 lettere ciascuna, senza CamelCase anomalo da errore OCR tipo "e» 4 Sepe" o "Lg ja")
  const validLongWords = cleanWords.filter(
    (w) => w.length >= 3 && !/[a-z][A-Z]/.test(w)
  );
  if (validLongWords.length < 2 || candidateName.replace(/\s+/g, '').length < 6) {
    return '';
  }

  return validLongWords.slice(0, 3).join(' ');
}

// Ricostruisce le righe ORIZZONTALI usando le coordinate (x, y) delle parole lette da Tesseract,
// separando con ':::' le colonne a destra del Nome!
function reconstructRowsFromTesseractData(data: any): string[] {
  if (!data) return [];
  const rawWords: { text: string; x0: number; y0: number; x1: number; y1: number }[] = [];

  const collectWord = (w: any) => {
    const t = String(w?.text || '')
      .replace(/\|+/g, ' ')
      .trim();
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

  const heights = rawWords
    .map((w) => Math.max(4, w.y1 - w.y0))
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 18;
  const rowTolerance = Math.max(8, medianHeight * 0.58);

  const rowGroups: {
    cy: number;
    words: { text: string; x0: number; y0: number; x1: number; y1: number }[];
  }[] = [];

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
        if (alphaWordsSeen >= 2 && gap > medianHeight * 1.65) {
          lineStr += ' ::: ';
        } else {
          lineStr += ' ';
        }
      }
      lineStr += curr.text;
      if (/[A-Za-zÀ-ÿ]{2,}/.test(curr.text) && !/^[Il|!]+$/.test(curr.text)) {
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
      .replace(/\|+/g, ' ') // rimuove i bordi verticali di tabella letti come '|'
      .replace(/;+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!line || line.length < 2) continue;
    if (HEADER_NOISE.test(line)) continue;
    if (/^\d{1,2}:\d{2}\b/.test(line)) continue; // salta barra orologio telefono (es. 19:00)

    // Rimuove rumore di bordo iniziale prima del numero (es. "Il 1 PILIA", "| 1 PILIA", "N° 1 PILIA")
    const withoutPrefixLabel = line
      .replace(/^(?:n[°º.]?\s*|#\s*|[Il!|\/\\[\]().,-]+\s*)+(?=\d)/i, '')
      .replace(/^(?:n[°º.]?\s*|#\s*)/i, '')
      .trim();

    // Trova l'inizio del Nome e Cognome (prima parola alfabetica di almeno 2 lettere che non sia solo "Il"/"li" di bordo prima di una cifra)
    const nameStartMatch = withoutPrefixLabel.match(
      /([A-Za-zÀ-ÿ]{2,}|[A-Za-zÀ-ÿ]\.[A-Za-zÀ-ÿ]\.)/
    );

    if (nameStartMatch && typeof nameStartMatch.index === 'number') {
      const prefixBeforeName = withoutPrefixLabel.slice(0, nameStartMatch.index).trim();
      const restFromName = withoutPrefixLabel.slice(nameStartMatch.index).trim();

      if (prefixBeforeName.length > 0) {
        // Rimuove eventuali codici decimali (es. 1.01, 1.02) dal prefisso numerico
        const prefixWithoutDecimals = prefixBeforeName.replace(/\b\d{1,3}[.,]\d{1,3}\b/g, ' ');
        // Usa /\d{1,4}/g invece di /\b\d{1,4}\b/g così anche se il bordo verticale era attaccato al numero ("1l" o "1I") estrae "1"!
        const intMatches = prefixWithoutDecimals.match(/\d{1,4}/g) || [];
        const validInts = intMatches
          .map((m) => parseInt(m, 10))
          .filter((n) => !isNaN(n) && n > 0 && n <= 500);

        let chosenNum: number | null = null;
        if (validInts.length > 0) {
          chosenNum = validInts[validInts.length - 1];
        } else {
          const decMatch = prefixBeforeName.match(/\b(\d{1,2})[.,](\d{2})\b/);
          if (decMatch) {
            const prevNum = results.length > 0 ? results[results.length - 1].number : existingMaxNumber;
            chosenNum = prevNum + 1;
          }
        }

        const cleanName = extractCleanNameOnly(restFromName, knownProfiles);
        if (chosenNum !== null && cleanName && !HEADER_NOISE.test(cleanName)) {
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

    // NON inventa MAI numeri successivi (es. 5, 6) se sulla riga non c'era un numero esplicito,
    // a meno che l'intero foglio fosse privo di colonna numeri!
    const cleanOnlyName = extractCleanNameOnly(line, knownProfiles);
    if (cleanOnlyName && cleanOnlyName.includes(' ') && cleanOnlyName.length >= 6) {
      fallbackNamesOnly.push(cleanOnlyName);
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
  // Ritagli visivi delle singole righe del foglio (utilissimo quando un nome è scritto a penna/corsivo)
  const [rowCropsByNumber, setRowCropsByNumber] = useState<Record<number, string>>({});

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
  const integrateExtractedItems = (
    extracted: QueueItem[],
    sourceLabel: string,
    newCrops?: Record<number, string>
  ) => {
    const extractedNums = extracted.map((it) => it.number);
    const minExtracted = extractedNums.length > 0 ? Math.min(...extractedNums) : Infinity;
    const maxExtracted = extractedNums.length > 0 ? Math.max(...extractedNums) : 0;

    if (newCrops && Object.keys(newCrops).length > 0) {
      setRowCropsByNumber((prev) => {
        const next: Record<number, string> = {};
        for (const [k, v] of Object.entries(prev)) {
          const numKey = Number(k);
          // Se si sta rifotografando un foglio dall'inizio (N° 1) con meno righe rispetto a una lettura precedente, pulisce eventuali righe fantasma oltre maxExtracted
          if (minExtracted === 1 && maxExtracted > 0 && numKey > maxExtracted) {
            continue;
          }
          next[numKey] = v;
        }
        return { ...next, ...newCrops };
      });
    }

    updateQueueState((prev) => {
      const mapByNum = new Map<number, QueueItem>();
      const prevMax = prev.items.reduce((m, it) => Math.max(m, it.number), 0);
      const isRescanFromOneWithFewerRows =
        minExtracted === 1 && maxExtracted > 0 && maxExtracted < prevMax;

      // Mantiene tutti i nominativi già presenti (es. 1..24 quando si aggiungono 25..36)
      for (const existing of prev.items) {
        if (isRescanFromOneWithFewerRows && existing.number > maxExtracted) {
          continue;
        }
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
        } else if (updatedCount > 0 || isRescanFromOneWithFewerRows) {
          showNotice(
            'success',
            `✓ Aggiornati ${updatedCount || extracted.length} nominativi (N° 1–${maxExtracted}). Totale in lista: ${mergedList.length} soci.`
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

  // Analisi intelligente del foglio fotografato:
  // 1) Calcola lo sfondo locale all'85° percentile (così le righe nere della tabella non abbassano mai la soglia cancellando le lettere!)
  // 2) Rileva le colonne della tabella (prog | nominativo | materia) e tutte le righe orizzontali
  // 3) Scarta automaticamente la 3ª colonna (materia: es. SEGRETERIA, GRUPPO AMBIENTE) e tutte le righe vuote (es. 8..28 o 5..10)
  // 4) Se il foglio è BIANCO SENZA GRIGLIA (scritto a mano), isola solo le righe che hanno SIA il numero SIA il nome, ignorando i numeri vuoti (es. 5..10), il tavolo e le ombre!
  interface TableBandInfo {
    tableRowIndex: number;
    isLikelyHeader: boolean;
    bandY0: number;
    bandY1: number;
    nomStartX: number;
    origY0: number;
    origY1: number;
    origDivX: number;
    origNomRightX: number;
    cropDataUrl: string;
    nomStripDataUrl: string;
  }

  interface PreprocessedSheetResult {
    cleanedDataUrl: string;
    naturalSheetDataUrl: string;
    workWidth: number;
    workHeight: number;
    tableBands: TableBandInfo[];
  }

  const analyzeAndPreprocessSheet = (fileOrBlob: Blob): Promise<PreprocessedSheetResult> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => {
        // Portiamo l'immagine a 1024px sul lato lungo (dimensione ottimale 1:1 sia per l'analisi geometrica sia per il motore Neural Handwriting OCR)
        const targetWorkMax = 1024;
        let w = img.width;
        let h = img.height;
        if (Math.max(w, h) > targetWorkMax || Math.max(w, h) < 800) {
          const s = targetWorkMax / Math.max(w, h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }

        const workCanvas = document.createElement('canvas');
        workCanvas.width = w;
        workCanvas.height = h;
        const ctx = workCanvas.getContext('2d');
        if (!ctx) {
          resolve({
            cleanedDataUrl: url,
            naturalSheetDataUrl: url,
            workWidth: w,
            workHeight: h,
            tableBands: [],
          });
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const naturalSheetDataUrl = workCanvas.toDataURL('image/jpeg', 0.85);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const gray = new Float32Array(w * h);
        const colorSpreadArr = new Uint8Array(w * h);
        const warmWoodMask = new Uint8Array(w * h);

        for (let i = 0; i < w * h; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
          colorSpreadArr[i] = Math.max(r, g, b) - Math.min(r, g, b);
          // Rileva il colore caldo del legno/scrivania (R molto più alto di B) per non scambiarlo mai per scrittura
          if (r - b > 24 && gray[i] < 195) {
            warmWoodMask[i] = 1;
          }
        }

        const scaleRef = Math.max(0.75, Math.min(w, h) / 768);
        const blockSize = Math.max(32, Math.round(48 * scaleRef));
        const cols = Math.ceil(w / blockSize);
        const rows = Math.ceil(h / blockSize);
        const blockBg = new Float32Array(cols * rows);

        // 85° percentile per blocco: trova sempre il bianco reale della carta anche sopra le righe nere della tabella
        for (let by = 0; by < rows; by++) {
          for (let bx = 0; bx < cols; bx++) {
            const samples: number[] = [];
            const yStart = by * blockSize;
            const yEnd = Math.min(h, yStart + blockSize);
            const xStart = bx * blockSize;
            const xEnd = Math.min(w, xStart + blockSize);
            for (let y = yStart; y < yEnd; y += 3) {
              for (let x = xStart; x < xEnd; x += 3) {
                samples.push(gray[y * w + x]);
              }
            }
            samples.sort((a, b) => a - b);
            blockBg[by * cols + bx] =
              samples.length > 0 ? samples[Math.floor(samples.length * 0.85)] : 225;
          }
        }

        // Individua i pixel scuri rispetto alla carta locale
        const isDark = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
          const by = Math.min(rows - 1, Math.floor(y / blockSize));
          for (let x = 0; x < w; x++) {
            const bx = Math.min(cols - 1, Math.floor(x / blockSize));
            const bg = blockBg[by * cols + bx];
            const idx = y * w + x;
            // Scarta legno, linee colorate chiare e sfondi scuri
            if (
              bg > 105 &&
              !warmWoodMask[idx] &&
              !(colorSpreadArr[idx] > 42 && gray[idx] > 85)
            ) {
              if (gray[idx] < bg - 17) {
                isDark[idx] = 1;
              }
            }
          }
        }

        const strokeOff = Math.max(3, Math.round(4 * scaleRef));

        // Rileva le linee orizzontali della griglia (anche se tirate a penna leggermente inclinate!)
        const hLineMask = new Uint8Array(w * h);
        const minHRun = Math.round(w * 0.08);
        for (let y = strokeOff; y < h - strokeOff; y++) {
          let runStart = -1;
          for (let x = 0; x <= w; x++) {
            const d =
              x < w
                ? isDark[y * w + x] ||
                  isDark[(y - 1) * w + x] ||
                  isDark[(y + 1) * w + x]
                : 0;
            if (d && runStart === -1) {
              runStart = x;
            } else if (!d && runStart !== -1) {
              if (x - runStart >= minHRun) {
                for (let k = runStart; k < x; k++) {
                  const hasVertStroke =
                    isDark[(y - strokeOff) * w + k] && isDark[(y + strokeOff) * w + k];
                  if (!hasVertStroke) {
                    for (let dy = -2; dy <= 2; dy++) {
                      const ny = y + dy;
                      if (ny >= 0 && ny < h) {
                        hLineMask[ny * w + k] = 1;
                      }
                    }
                  }
                }
              }
              runStart = -1;
            }
          }
        }

        // Rileva le linee verticali della griglia (consentendo ±1px di inclinazione)
        const vLineMask = new Uint8Array(w * h);
        const minVRun = Math.round(h * 0.04);
        for (let x = strokeOff; x < w - strokeOff; x++) {
          let runStart = -1;
          for (let y = 0; y <= h; y++) {
            const d =
              y < h
                ? isDark[y * w + x] ||
                  (isDark[y * w + x - 1] && isDark[Math.max(0, y - 1) * w + x]) ||
                  (isDark[y * w + x + 1] && isDark[Math.max(0, y - 1) * w + x])
                : 0;
            if (d && runStart === -1) {
              runStart = y;
            } else if (!d && runStart !== -1) {
              if (y - runStart >= minVRun) {
                for (let k = runStart; k < y; k++) {
                  const hasHorizStroke =
                    isDark[k * w + (x - strokeOff)] && isDark[k * w + (x + strokeOff)];
                  if (!hasHorizStroke) {
                    vLineMask[k * w + x] = 1;
                    vLineMask[k * w + x - 1] = 1;
                    vLineMask[k * w + x + 1] = 1;
                  }
                }
              }
              runStart = -1;
            }
          }
        }

        // Cerca i divisori verticali principali delle colonne della tabella
        const vCounts = new Int32Array(w);
        const yScan0 = Math.round(h * 0.12);
        const yScan1 = Math.round(h * 0.88);
        for (let x = 5; x < w - 5; x++) {
          let c = 0;
          for (let y = yScan0; y < yScan1; y++) {
            if (
              vLineMask[y * w + x] ||
              vLineMask[y * w + x - 2] ||
              vLineMask[y * w + x + 2] ||
              vLineMask[y * w + x - 4] ||
              vLineMask[y * w + x + 4]
            ) {
              c++;
            }
          }
          vCounts[x] = c;
        }

        const vClusters: { start: number; end: number }[] = [];
        const minVClusterSep = Math.round(w * 0.032);
        for (let x = 0; x < w; x++) {
          if (vCounts[x] > h * 0.32) {
            if (vClusters.length === 0 || x - vClusters[vClusters.length - 1].end > minVClusterSep) {
              vClusters.push({ start: x, end: x });
            } else {
              vClusters[vClusters.length - 1].end = x;
            }
          }
        }
        const vBorders = vClusters.map((c) => Math.round((c.start + c.end) / 2));

        // Cerca le righe orizzontali della tabella
        const tableX0 = vBorders.length >= 2 ? vBorders[0] : Math.round(w * 0.08);
        const tableX1 =
          vBorders.length >= 3
            ? vBorders[2]
            : vBorders.length >= 2
            ? vBorders[vBorders.length - 1]
            : Math.round(w * 0.88);
        const tableSpanW = Math.max(50, tableX1 - tableX0);

        const hClusters: { start: number; end: number }[] = [];
        const minHClusterSep = Math.max(7, Math.round(h * 0.008));
        for (let y = 2; y < h - 2; y++) {
          let c = 0;
          for (let x = tableX0; x <= tableX1; x++) {
            if (hLineMask[y * w + x] || hLineMask[(y - 1) * w + x] || hLineMask[(y + 1) * w + x]) {
              c++;
            }
          }
          if (c > tableSpanW * 0.34) {
            if (hClusters.length === 0 || y - hClusters[hClusters.length - 1].end > minHClusterSep) {
              hClusters.push({ start: y, end: y });
            } else {
              hClusters[hClusters.length - 1].end = y;
            }
          }
        }
        const hLines = hClusters.map((c) => Math.round((c.start + c.end) / 2));

        // Immagine intera pulita (senza linee di griglia, con inchiostro morbido e nitido)
        const cleanPixels = new Uint8ClampedArray(w * h);
        cleanPixels.fill(255);
        for (let y = 0; y < h; y++) {
          const by = Math.min(rows - 1, Math.floor(y / blockSize));
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (hLineMask[idx] || vLineMask[idx] || warmWoodMask[idx]) {
              cleanPixels[idx] = 255;
              continue;
            }
            const bx = Math.min(cols - 1, Math.floor(x / blockSize));
            const bg = blockBg[by * cols + bx];
            const diff = bg - gray[idx];
            if (bg > 105 && diff > 13 && !(colorSpreadArr[idx] > 42 && gray[idx] > 85)) {
              cleanPixels[idx] = Math.max(0, Math.min(255, Math.round(255 - (diff - 8) * 3.4)));
            }
          }
        }

        // CASO 1: Tabella strutturata con griglia (stampata oppure disegnata a righe con penna!)
        if (vBorders.length >= 2 && hLines.length >= 5) {
          let xProgLeft = vBorders[0];
          let xProgRight = vBorders[1];
          let xNomRight = vBorders.length >= 3 ? vBorders[2] : Math.min(w - 6, Math.round(xProgRight + w * 0.44));

          // Se il primo bordo rilevato era già il divisore tra prog e nominativo (es. foglio rigato a mano con 1 linea verticale tra numeri e nomi)
          if (vBorders[0] > w * 0.16 && vBorders[1] - vBorders[0] > w * 0.25) {
            xProgRight = vBorders[0];
            xProgLeft = Math.max(4, Math.round(xProgRight - w * 0.14));
            xNomRight = vBorders[1];
          }

          const nomColW = xNomRight - xProgRight;
          const progColW = xProgRight - xProgLeft;

          if (nomColW > w * 0.18 && progColW > w * 0.04) {
            interface DetectedRowCell {
              tableRowIndex: number;
              isLikelyHeader: boolean;
              y0: number;
              y1: number;
              localDivX: number;
              inkPixels: number;
            }

            const filledCells: DetectedRowCell[] = [];
            const padX = Math.max(8, Math.round(10 * scaleRef));

            for (let r = 0; r < hLines.length - 1; r++) {
              const y0 = hLines[r];
              const y1 = hLines[r + 1];
              const rowH = y1 - y0;
              if (rowH < 12 || rowH > h * 0.12) continue;

              // Trova l'esatta X del filetto verticale tra 'prog' e 'nominativo' su questa specifica riga (compensa qualsiasi inclinazione della foto!)
              let localDivX = xProgRight;
              let minGraySum = Infinity;
              const searchX0 = Math.max(xProgLeft + 10, xProgRight - Math.round(14 * scaleRef));
              const searchX1 = Math.min(xNomRight - 10, xProgRight + Math.round(14 * scaleRef));
              for (let sx = searchX0; sx <= searchX1; sx++) {
                let s = 0;
                for (let sy = y0; sy <= y1; sy++) {
                  s += gray[sy * w + sx];
                }
                if (s < minGraySum) {
                  minGraySum = s;
                  localDivX = sx;
                }
              }

              // Conta l'inchiostro reale nella fascia centrale (64% verticale) della casella 'nominativo'
              // così anche se le righe orizzontali sono state tirate a penna un po' storte non vengono mai contate come testo!
              const marginY = Math.max(3, Math.round(rowH * 0.18));
              let inkPixels = 0;
              let leftQuarterInk = 0;
              const cellX0 = localDivX + padX;
              const cellX1 = xNomRight - padX;
              const leftQuarterX1 = localDivX + Math.round((xNomRight - localDivX) * 0.25);

              for (let y = y0 + marginY; y <= y1 - marginY; y++) {
                for (let x = cellX0; x <= cellX1; x++) {
                  const idx = y * w + x;
                  if (cleanPixels[idx] < 190) {
                    inkPixels++;
                    if (x <= leftQuarterX1) {
                      leftQuarterInk++;
                    }
                  }
                }
              }

              const cellArea = Math.max(1, (rowH - marginY * 2) * Math.max(10, cellX1 - cellX0));
              const minRowInk = Math.max(35, Math.round(cellArea * 0.016));

              if (inkPixels >= minRowInk) {
                // Nella riga 0 di intestazione stampata ("nominativo"), la riga è bassa (<4.5% di h) e la scritta è centrata
                const isLikelyHeader =
                  r === 0 && rowH < h * 0.045 && leftQuarterInk < inkPixels * 0.08;
                filledCells.push({
                  tableRowIndex: r,
                  isLikelyHeader,
                  y0,
                  y1,
                  localDivX,
                  inkPixels,
                });
              }
            }

            if (filledCells.length > 0) {
              // Costruisce un canvas pulito ad alta definizione contenente SOLO le righe compilate, SENZA MAI SOVRAPPORLE!
              const cleanFullCanvas = document.createElement('canvas');
              cleanFullCanvas.width = w;
              cleanFullCanvas.height = h;
              const cleanFullCtx = cleanFullCanvas.getContext('2d')!;
              const cleanImgData = cleanFullCtx.createImageData(w, h);
              for (let i = 0; i < w * h; i++) {
                const v = cleanPixels[i];
                cleanImgData.data[i * 4] = v;
                cleanImgData.data[i * 4 + 1] = v;
                cleanImgData.data[i * 4 + 2] = v;
                cleanImgData.data[i * 4 + 3] = 255;
              }
              cleanFullCtx.putImageData(cleanImgData, 0, 0);

              const maxUpscale = 2.6;
              const progCropW = Math.min(progColW - 4, Math.round(48 * scaleRef));
              const nomCropW = Math.max(80, xNomRight - xProgRight - 8);
              const scaledProgW = Math.round(progCropW * maxUpscale);
              const scaledNomW = Math.round(nomCropW * maxUpscale);
              const gapBetweenCols = 52;
              const padLeft = 28;
              const nomStartX = padLeft + scaledProgW + gapBetweenCols;
              const targetRowH = Math.round(56 * scaleRef);
              const bandHeight = Math.round(76 * scaleRef) + 42;

              const ocrCanvas = document.createElement('canvas');
              ocrCanvas.width = nomStartX + scaledNomW + 32;
              ocrCanvas.height = filledCells.length * bandHeight + 24;
              const ocrCtx = ocrCanvas.getContext('2d')!;
              ocrCtx.fillStyle = '#ffffff';
              ocrCtx.fillRect(0, 0, ocrCanvas.width, ocrCanvas.height);
              ocrCtx.imageSmoothingEnabled = true;
              ocrCtx.imageSmoothingQuality = 'high';

              const tableBands: TableBandInfo[] = [];
              const borderTrimY = Math.max(3, Math.round(3.5 * scaleRef));
              const borderTrimX = Math.max(3, Math.round(3.5 * scaleRef));

              for (let i = 0; i < filledCells.length; i++) {
                const cell = filledCells[i];
                const bandY0 = 12 + i * bandHeight;
                const bandY1 = bandY0 + bandHeight;
                const srcY = cell.y0 + borderTrimY;
                const srcH = Math.max(8, cell.y1 - cell.y0 - borderTrimY * 2);
                // Calcola il fattore di scala specifico per l'altezza della riga (così righe alte 80px scritte a mano non debordano mai sopra le righe vicine!)
                const rowScale = Math.max(1.0, Math.min(maxUpscale, targetRowH / srcH));
                const dstH = Math.min(bandHeight - 20, Math.round(srcH * rowScale));
                const dstY = bandY0 + Math.round((bandHeight - dstH) / 2);
                const dstProgW = Math.min(scaledProgW, Math.round(progCropW * rowScale));
                const dstNomW = Math.min(scaledNomW, Math.round(nomCropW * rowScale));

                // 1) Disegna la cella del numero progressivo (senza il bordo verticale destro!)
                const srcProgX = Math.max(0, cell.localDivX - borderTrimX - progCropW);
                ocrCtx.drawImage(
                  cleanFullCanvas,
                  srcProgX,
                  srcY,
                  progCropW,
                  srcH,
                  padLeft,
                  dstY,
                  dstProgW,
                  dstH
                );

                // 2) Disegna la cella del nominativo (senza il bordo verticale sinistro e senza la 3ª colonna materia!)
                const srcNomX = cell.localDivX + borderTrimX;
                ocrCtx.drawImage(
                  cleanFullCanvas,
                  srcNomX,
                  srcY,
                  nomCropW,
                  srcH,
                  nomStartX,
                  dstY,
                  dstNomW,
                  dstH
                );

                // Crea il ritaglio visivo originale della riga (per mostrarlo in Segreteria)
                const origCropCanvas = document.createElement('canvas');
                const origSrcX = Math.max(0, cell.localDivX - progCropW - 4);
                const origSrcW = Math.min(w - origSrcX, progCropW + nomCropW + 14);
                const origSrcY = Math.max(0, cell.y0 - 2);
                const origSrcH = Math.min(h - origSrcY, cell.y1 - cell.y0 + 4);
                origCropCanvas.width = origSrcW;
                origCropCanvas.height = origSrcH;
                const origCtx = origCropCanvas.getContext('2d')!;
                origCtx.drawImage(
                  workCanvas,
                  origSrcX,
                  origSrcY,
                  origSrcW,
                  origSrcH,
                  0,
                  0,
                  origSrcW,
                  origSrcH
                );

                // Crea la striscia singola del solo nominativo pulito (per l'OCR mirato PSM 7 sulle scritte a penna!)
                const nomStripCanvas = document.createElement('canvas');
                nomStripCanvas.width = dstNomW + 36;
                nomStripCanvas.height = dstH + 28;
                const nomStripCtx = nomStripCanvas.getContext('2d')!;
                nomStripCtx.fillStyle = '#ffffff';
                nomStripCtx.fillRect(0, 0, nomStripCanvas.width, nomStripCanvas.height);
                nomStripCtx.imageSmoothingEnabled = true;
                nomStripCtx.imageSmoothingQuality = 'high';
                nomStripCtx.drawImage(
                  cleanFullCanvas,
                  srcNomX,
                  srcY,
                  nomCropW,
                  srcH,
                  18,
                  14,
                  dstNomW,
                  dstH
                );

                tableBands.push({
                  tableRowIndex: cell.tableRowIndex,
                  isLikelyHeader: cell.isLikelyHeader,
                  bandY0,
                  bandY1,
                  nomStartX,
                  origY0: cell.y0,
                  origY1: cell.y1,
                  origDivX: cell.localDivX,
                  origNomRightX: xNomRight,
                  cropDataUrl: origCropCanvas.toDataURL('image/jpeg', 0.88),
                  nomStripDataUrl: nomStripCanvas.toDataURL('image/jpeg', 0.94),
                });
              }

              resolve({
                cleanedDataUrl: ocrCanvas.toDataURL('image/jpeg', 0.95),
                naturalSheetDataUrl,
                workWidth: w,
                workHeight: h,
                tableBands,
              });
              return;
            }
          }
        }

        // CASO 2: Foglio senza griglia stampata (es. foglietto bianco scritto a mano coi numeri 1..10 a sinistra e i nomi a destra).
        // Isola esclusivamente i tratti nitidi di penna/pennarello (ignorando le ombre morbide del telefono, eventuali linee e il legno del tavolo)
        // e trattiene SOLO le righe che hanno SIA il numero a sinistra SIA il nome scritto a destra (scartando i numeri vuoti 5..10!).
        const strokeInk = new Uint8Array(w * h);
        const strokeCleanPixels = new Uint8ClampedArray(w * h);
        strokeCleanPixels.fill(255);
        const winR = Math.max(5, Math.round(6 * scaleRef));
        const winStep = Math.max(2, Math.round(3 * scaleRef));

        const yMargin0 = Math.round(h * 0.06);
        const yMargin1 = Math.round(h * 0.93);
        const xMargin0 = Math.round(w * 0.02);
        const xMargin1 = Math.round(w * 0.94);

        for (let y = yMargin0; y < yMargin1; y++) {
          for (let x = xMargin0; x < xMargin1; x++) {
            const idx = y * w + x;
            if (warmWoodMask[idx] || hLineMask[idx] || vLineMask[idx]) continue;
            if (colorSpreadArr[idx] > 45 && gray[idx] > 90) continue;

            let localBright = 0;
            for (let dy = -winR; dy <= winR; dy += winStep) {
              const ny = y + dy;
              if (ny < 0 || ny >= h) continue;
              for (let dx = -winR; dx <= winR; dx += winStep) {
                const nx = x + dx;
                if (nx < 0 || nx >= w) continue;
                const gVal = gray[ny * w + nx];
                if (gVal > localBright) localBright = gVal;
              }
            }

            const localContrast = localBright - gray[idx];
            if (localBright > 135 && localContrast > 14) {
              strokeCleanPixels[idx] = Math.max(
                0,
                Math.min(255, Math.round(255 - (localContrast - 10) * 3.8))
              );
              if (localContrast >= 26) {
                strokeInk[idx] = 1;
              }
            }
          }
        }

        const xNum0 = Math.round(w * 0.02);
        const xNum1 = Math.round(w * 0.19);
        const xName0 = Math.round(w * 0.20);
        const xName1 = Math.round(w * 0.92);

        const rowNumInk = new Int32Array(h);
        const rowNameInk = new Int32Array(h);
        for (let y = Math.round(h * 0.08); y < Math.round(h * 0.91); y++) {
          let cNum = 0;
          for (let x = xNum0; x < xNum1; x++) {
            if (strokeInk[y * w + x]) cNum++;
          }
          let cName = 0;
          for (let x = xName0; x < xName1; x++) {
            if (strokeInk[y * w + x]) cName++;
          }
          rowNumInk[y] = cNum;
          rowNameInk[y] = cName;
        }

        const minScanlineNameInk = Math.max(3, Math.round(4 * scaleRef));
        const maxMergeGap = Math.max(5, Math.round(6 * scaleRef));
        const rawUnlinedBands: { y0: number; y1: number }[] = [];
        let inBand = false;
        let bandStart = 0;

        for (let y = Math.round(h * 0.08); y < Math.round(h * 0.91); y++) {
          const avgName = (rowNameInk[y - 1] + rowNameInk[y] + rowNameInk[y + 1]) / 3;
          if (avgName >= minScanlineNameInk) {
            if (!inBand) {
              if (
                rawUnlinedBands.length > 0 &&
                y - rawUnlinedBands[rawUnlinedBands.length - 1].y1 <= maxMergeGap
              ) {
                inBand = true;
                bandStart = rawUnlinedBands.pop()!.y0;
              } else {
                inBand = true;
                bandStart = y;
              }
            }
          } else if (inBand) {
            rawUnlinedBands.push({ y0: bandStart, y1: y });
            inBand = false;
          }
        }
        if (inBand) {
          rawUnlinedBands.push({ y0: bandStart, y1: Math.round(h * 0.91) });
        }

        // Se due righe scritte a mano sono molto vicine verticalmente, le separa nel punto di minimo inchiostro
        const splitUnlinedBands: { y0: number; y1: number }[] = [];
        for (const b of rawUnlinedBands) {
          const bh = b.y1 - b.y0;
          if (bh > h * 0.075) {
            let minY = -1;
            let minVal = Infinity;
            let maxVal = 0;
            for (let y = b.y0; y <= b.y1; y++) {
              if (rowNameInk[y] > maxVal) maxVal = rowNameInk[y];
            }
            const mid0 = b.y0 + Math.round(bh * 0.3);
            const mid1 = b.y1 - Math.round(bh * 0.3);
            for (let y = mid0; y <= mid1; y++) {
              const v = (rowNameInk[y - 1] + rowNameInk[y] + rowNameInk[y + 1]) / 3;
              if (v < minVal) {
                minVal = v;
                minY = y;
              }
            }
            if (minY !== -1 && minVal < maxVal * 0.28) {
              splitUnlinedBands.push({ y0: b.y0, y1: minY - 1 });
              splitUnlinedBands.push({ y0: minY + 1, y1: b.y1 });
              continue;
            }
          }
          splitUnlinedBands.push(b);
        }

        const minBandH = Math.max(12, Math.round(14 * scaleRef));
        const minBandNameInk = Math.round(250 * scaleRef * scaleRef);
        const minBandNumInk = Math.round(18 * scaleRef * scaleRef);

        const validUnlinedBands = splitUnlinedBands.filter((b) => {
          const bh = b.y1 - b.y0;
          if (bh < minBandH || bh > h * 0.16) return false;
          let nameSum = 0;
          let numSum = 0;
          const numPadY = Math.round(6 * scaleRef);
          for (let y = b.y0; y <= b.y1; y++) {
            nameSum += rowNameInk[y];
          }
          for (
            let y = Math.max(0, b.y0 - numPadY);
            y <= Math.min(h - 1, b.y1 + numPadY);
            y++
          ) {
            numSum += rowNumInk[y];
          }
          return nameSum >= minBandNameInk && numSum >= minBandNumInk;
        });

        if (validUnlinedBands.length > 0) {
          const strokeCanvas = document.createElement('canvas');
          strokeCanvas.width = w;
          strokeCanvas.height = h;
          const strokeCtx = strokeCanvas.getContext('2d')!;
          const strokeImgData = strokeCtx.createImageData(w, h);
          for (let i = 0; i < w * h; i++) {
            const v = strokeCleanPixels[i];
            strokeImgData.data[i * 4] = v;
            strokeImgData.data[i * 4 + 1] = v;
            strokeImgData.data[i * 4 + 2] = v;
            strokeImgData.data[i * 4 + 3] = 255;
          }
          strokeCtx.putImageData(strokeImgData, 0, 0);

          const avgSrcH =
            validUnlinedBands.reduce((acc, b) => acc + (b.y1 - b.y0), 0) /
            validUnlinedBands.length;
          // Adatta l'ingrandimento in modo che le lettere scritte a mano abbiano sempre un'altezza ideale (~54px) per l'OCR
          const upscale = Math.max(1.0, Math.min(2.4, (56 * scaleRef) / Math.max(18, avgSrcH)));
          const progCropW = Math.round(w * 0.15);
          const nomCropW = Math.round(w * 0.72);
          const scaledProgW = Math.round(progCropW * upscale);
          const scaledNomW = Math.round(nomCropW * upscale);
          const gapBetweenCols = 52;
          const padLeft = 28;
          const nomStartX = padLeft + scaledProgW + gapBetweenCols;
          const bandHeight = Math.round(Math.max(64, avgSrcH * upscale)) + 40;

          const ocrCanvas = document.createElement('canvas');
          ocrCanvas.width = nomStartX + scaledNomW + 32;
          ocrCanvas.height = validUnlinedBands.length * bandHeight + 24;
          const ocrCtx = ocrCanvas.getContext('2d')!;
          ocrCtx.fillStyle = '#ffffff';
          ocrCtx.fillRect(0, 0, ocrCanvas.width, ocrCanvas.height);
          ocrCtx.imageSmoothingEnabled = true;
          ocrCtx.imageSmoothingQuality = 'high';

          const tableBands: TableBandInfo[] = [];
          const padRowY = Math.max(4, Math.round(5 * scaleRef));

          for (let i = 0; i < validUnlinedBands.length; i++) {
            const b = validUnlinedBands[i];
            const bandY0 = 12 + i * bandHeight;
            const bandY1 = bandY0 + bandHeight;
            const srcY = Math.max(0, b.y0 - padRowY);
            const srcH = Math.min(h - srcY, b.y1 - b.y0 + padRowY * 2);
            const rowScale = Math.max(1.0, Math.min(upscale, (bandHeight - 20) / srcH));
            const dstH = Math.min(bandHeight - 20, Math.round(srcH * rowScale));
            const dstY = bandY0 + Math.round((bandHeight - dstH) / 2);

            // Trova lo spazio bianco verticale tra il numero a sinistra e l'inizio del nome su questa riga
            let localDivX = xName0;
            let minColInk = Infinity;
            for (let sx = Math.round(w * 0.13); sx <= Math.round(w * 0.24); sx++) {
              let colSum = 0;
              for (let sy = srcY; sy < srcY + srcH; sy++) {
                if (strokeInk[sy * w + sx]) colSum++;
              }
              if (colSum < minColInk) {
                minColInk = colSum;
                localDivX = sx;
              }
            }

            const srcProgX = Math.max(xMargin0, localDivX - progCropW);
            const actualProgW = Math.max(16, localDivX - srcProgX);
            const actualNomW = Math.min(nomCropW, w - localDivX - 6);

            ocrCtx.drawImage(
              strokeCanvas,
              srcProgX,
              srcY,
              actualProgW,
              srcH,
              padLeft,
              dstY,
              Math.round(actualProgW * rowScale),
              dstH
            );

            ocrCtx.drawImage(
              strokeCanvas,
              localDivX,
              srcY,
              actualNomW,
              srcH,
              nomStartX,
              dstY,
              Math.round(actualNomW * rowScale),
              dstH
            );

            const origCropCanvas = document.createElement('canvas');
            const origSrcX = srcProgX;
            const origSrcW = Math.min(w - origSrcX, actualProgW + actualNomW + 12);
            origCropCanvas.width = origSrcW;
            origCropCanvas.height = srcH;
            const origCtx = origCropCanvas.getContext('2d')!;
            origCtx.drawImage(
              workCanvas,
              origSrcX,
              srcY,
              origSrcW,
              srcH,
              0,
              0,
              origSrcW,
              srcH
            );

            const nomStripCanvas = document.createElement('canvas');
            nomStripCanvas.width = Math.round(actualNomW * rowScale) + 36;
            nomStripCanvas.height = dstH + 28;
            const nomStripCtx = nomStripCanvas.getContext('2d')!;
            nomStripCtx.fillStyle = '#ffffff';
            nomStripCtx.fillRect(0, 0, nomStripCanvas.width, nomStripCanvas.height);
            nomStripCtx.imageSmoothingEnabled = true;
            nomStripCtx.imageSmoothingQuality = 'high';
            nomStripCtx.drawImage(
              strokeCanvas,
              localDivX,
              srcY,
              actualNomW,
              srcH,
              18,
              14,
              Math.round(actualNomW * rowScale),
              dstH
            );

            tableBands.push({
              tableRowIndex: i + 1,
              isLikelyHeader: false,
              bandY0,
              bandY1,
              nomStartX,
              origY0: srcY,
              origY1: srcY + srcH,
              origDivX: localDivX,
              origNomRightX: xName1,
              cropDataUrl: origCropCanvas.toDataURL('image/jpeg', 0.88),
              nomStripDataUrl: nomStripCanvas.toDataURL('image/jpeg', 0.94),
            });
          }

          resolve({
            cleanedDataUrl: ocrCanvas.toDataURL('image/jpeg', 0.95),
            naturalSheetDataUrl,
            workWidth: w,
            workHeight: h,
            tableBands,
          });
          return;
        }

        // Fallback finale per immagini generiche
        const cleanBaseCanvas = document.createElement('canvas');
        cleanBaseCanvas.width = w;
        cleanBaseCanvas.height = h;
        const cleanBaseCtx = cleanBaseCanvas.getContext('2d')!;
        const outImgData = cleanBaseCtx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
          const v = strokeCleanPixels[i];
          outImgData.data[i * 4] = v;
          outImgData.data[i * 4 + 1] = v;
          outImgData.data[i * 4 + 2] = v;
          outImgData.data[i * 4 + 3] = 255;
        }
        cleanBaseCtx.putImageData(outImgData, 0, 0);

        const upScale = Math.max(1.2, Math.min(2.0, 1600 / Math.max(w, h)));
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = Math.round(w * upScale);
        finalCanvas.height = Math.round(h * upScale);
        const finalCtx = finalCanvas.getContext('2d')!;
        finalCtx.fillStyle = '#ffffff';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.drawImage(cleanBaseCanvas, 0, 0, finalCanvas.width, finalCanvas.height);

        resolve({
          cleanedDataUrl: finalCanvas.toDataURL('image/jpeg', 0.94),
          naturalSheetDataUrl,
          workWidth: w,
          workHeight: h,
          tableBands: [],
        });
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  };

  // Motore Neural Handwriting & Table OCR (OCREngine=2) per leggere la scrittura a mano (es. GPIERO PILIA, BOI VINCENZO, SOTGIU GIOVANNA, SANDRO PROSPERI)
  interface CloudOcrWord {
    text: string;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    w: number;
    h: number;
  }

  const fetchNeuralHandwritingWords = async (
    base64Jpeg: string
  ): Promise<CloudOcrWord[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const formBody = new URLSearchParams({
        apikey: 'helloworld',
        base64Image: base64Jpeg,
        language: 'ita',
        OCREngine: '2',
        isTable: 'true',
        isOverlayRequired: 'true',
        scale: 'true',
      }).toString();

      const resp = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
        signal: controller.signal,
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      const lines = json?.ParsedResults?.[0]?.TextOverlay?.Lines;
      if (!Array.isArray(lines)) return [];

      const words: CloudOcrWord[] = [];
      for (const l of lines) {
        if (!Array.isArray(l?.Words)) continue;
        for (const w of l.Words) {
          const text = String(w?.WordText || '').trim();
          if (!text) continue;
          const left = Number(w.Left) || 0;
          const top = Number(w.Top) || 0;
          const width = Number(w.Width) || 0;
          const height = Number(w.Height) || 0;
          words.push({
            text,
            x0: left,
            y0: top,
            x1: left + width,
            y1: top + height,
            w: width,
            h: height,
          });
        }
      }
      return words;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  };

  // Esegue l'OCR combinando Neural Handwriting OCR (OCREngine=2) + rilevamento geometrico delle righe compilate + Anagrafica Soci
  const runOcrOnPreprocessedSheet = async (
    prep: PreprocessedSheetResult,
    existingMax: number
  ): Promise<{ items: QueueItem[]; crops: Record<number, string> }> => {
    const crops: Record<number, string> = {};
    const Tesseract = await loadTesseract();

    let worker: any = null;
    let mainResult: any = null;

    try {
      // Avvia in parallelo il motore Neural Handwriting (OCREngine=2) e il motore locale Tesseract
      const neuralPromise = fetchNeuralHandwritingWords(prep.naturalSheetDataUrl);

      if (typeof Tesseract.createWorker === 'function') {
        worker = await Tesseract.createWorker('ita', 1, {
          logger: (m: any) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              setScanProgress(Math.round(15 + m.progress * 65));
            }
          },
        });
        if (typeof worker.setParameters === 'function') {
          await worker.setParameters({
            tessedit_pageseg_mode: '6',
            preserve_interword_spaces: '1',
          });
        }
        mainResult = await worker.recognize(prep.cleanedDataUrl);
      } else {
        mainResult = await Tesseract.recognize(prep.cleanedDataUrl, 'ita', {
          logger: (m: any) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              setScanProgress(Math.round(15 + m.progress * 65));
            }
          },
        });
      }

      const neuralWords = await neuralPromise;

      // Se abbiamo rilevato le righe compilate (da tabella o da foglio scritto a mano), estraiamo riga per riga con precisione millimetrica!
      if (prep.tableBands.length > 0) {
        const allWords: { text: string; x0: number; y0: number; x1: number; y1: number }[] = [];
        const collectW = (w: any) => {
          const t = String(w?.text || '').trim();
          const b = w?.bbox;
          if (t && b && typeof b.x0 === 'number' && typeof b.y0 === 'number') {
            allWords.push({ text: t, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
          }
        };

        const data = mainResult?.data;
        if (Array.isArray(data?.words) && data.words.length > 0) {
          data.words.forEach(collectW);
        } else if (Array.isArray(data?.lines)) {
          data.lines.forEach((l: any) => {
            if (Array.isArray(l?.words) && l.words.length > 0) l.words.forEach(collectW);
            else collectW(l);
          });
        }

        // Verifica se la prima fascia (tableRowIndex === 0) è l'intestazione ("prog | nominativo")
        let hasHeaderRow = prep.tableBands[0]?.tableRowIndex === 0 && prep.tableBands[0]?.isLikelyHeader;
        if (prep.tableBands[0]?.tableRowIndex === 0 && !hasHeaderRow) {
          const b0 = prep.tableBands[0];
          const b0Words = allWords
            .filter((w) => {
              const cy = (w.y0 + w.y1) / 2;
              return cy >= b0.bandY0 - 6 && cy <= b0.bandY1 + 6;
            })
            .map((w) => w.text)
            .join(' ');
          const b0NeuralWords = neuralWords
            .filter((w) => {
              const cy = (w.y0 + w.y1) / 2;
              return cy >= b0.origY0 - 6 && cy <= b0.origY1 + 6;
            })
            .map((w) => w.text)
            .join(' ');
          const combinedB0 = `${b0Words} ${b0NeuralWords}`;
          if (HEADER_NOISE.test(combinedB0) || /\b(prog|nominativo|materia)\b/i.test(combinedB0)) {
            hasHeaderRow = true;
          }
        }

        const tableItems: QueueItem[] = [];
        const usedNums = new Set<number>();

        for (let idx = 0; idx < prep.tableBands.length; idx++) {
          const band = prep.tableBands[idx];
          if (band.tableRowIndex === 0 && hasHeaderRow) {
            continue;
          }

          // 1) Parole lette dal motore Neural Handwriting (OCREngine=2) sulle coordinate originali di questa riga
          const rowNeuralWords = neuralWords.filter((w) => {
            const cy = (w.y0 + w.y1) / 2;
            return cy >= band.origY0 - 8 && cy <= band.origY1 + 8 && w.h < prep.workHeight * 0.14;
          });
          const neuralProgText = rowNeuralWords
            .filter((w) => w.x0 < band.origDivX - 6)
            .sort((a, b) => a.x0 - b.x0)
            .map((w) => w.text)
            .join(' ');
          const neuralNomText = rowNeuralWords
            .filter((w) => w.x0 >= band.origDivX - 12 && w.x0 < band.origNomRightX - 8)
            .sort((a, b) => a.x0 - b.x0)
            .map((w) => w.text)
            .join(' ');

          // 2) Parole lette da Tesseract sul canvas non-sovrapposto
          const bandWords = allWords.filter((w) => {
            const cy = (w.y0 + w.y1) / 2;
            return cy >= band.bandY0 - 6 && cy <= band.bandY1 + 6;
          });

          const progWords =
            neuralProgText ||
            bandWords
              .filter((w) => w.x0 < band.nomStartX - 12)
              .sort((a, b) => a.x0 - b.x0)
              .map((w) => w.text)
              .join(' ');

          let nomWords = bandWords
            .filter((w) => w.x0 >= band.nomStartX - 12)
            .sort((a, b) => a.x0 - b.x0)
            .map((w) => w.text)
            .join(' ');

          // Priorità 1: Match Anagrafica Soci dal motore Neural Handwriting (OCREngine=2)
          let matchedSocio =
            (neuralNomText ? fuzzyMatchSocioName(neuralNomText, profiles) : null) ||
            fuzzyMatchSocioName(nomWords, profiles) ||
            (neuralNomText && nomWords
              ? fuzzyMatchSocioName(`${neuralNomText} ${nomWords}`, profiles)
              : null);

          const alphaCount = (nomWords.match(/[A-Za-zÀ-ÿ]/g) || []).length;
          const neuralAlphaCount = (neuralNomText.match(/[A-Za-zÀ-ÿ]/g) || []).length;

          // Se non c'è ancora un match diretto nell'Anagrafica Soci e il motore neural non ha già letto un nome completo,
          // esegue anche la lettura mirata PSM 7 (Riga Singola) sul ritaglio del solo nominativo!
          if (
            !matchedSocio &&
            neuralAlphaCount < 5 &&
            worker &&
            typeof worker.setParameters === 'function'
          ) {
            setScanStatusText(
              `Lettura approfondita scrittura riga ${band.tableRowIndex || idx + 1}...`
            );
            setScanProgress(Math.min(96, 80 + Math.round((idx / prep.tableBands.length) * 16)));
            await worker.setParameters({
              tessedit_pageseg_mode: '7',
              preserve_interword_spaces: '1',
            });
            const singleRes = await worker.recognize(band.nomStripDataUrl);
            const singleText = String(singleRes?.data?.text || '').trim();
            if (singleText) {
              const singleMatched =
                fuzzyMatchSocioName(singleText, profiles) ||
                fuzzyMatchSocioName(`${nomWords} ${singleText}`, profiles);
              if (singleMatched) {
                matchedSocio = singleMatched;
              } else if ((singleText.match(/[A-Za-zÀ-ÿ]/g) || []).length > alphaCount) {
                nomWords = singleText;
              }
            }
          }

          // Calcola il numero progressivo della riga:
          // se tableRowIndex parte da 1 (foglio non tabellare o tabella con header), expectedRowNum è tableRowIndex
          const expectedRowNum =
            prep.tableBands[0]?.tableRowIndex === 0
              ? hasHeaderRow
                ? band.tableRowIndex
                : band.tableRowIndex + 1
              : band.tableRowIndex;
          const digitMatch = progWords.match(/\d{1,3}/);
          const ocrNum = digitMatch ? parseInt(digitMatch[0], 10) : null;

          let finalNum = expectedRowNum;
          if (
            ocrNum !== null &&
            ocrNum > 0 &&
            ocrNum <= 500 &&
            Math.abs(ocrNum - expectedRowNum) <= 1 &&
            !usedNums.has(ocrNum)
          ) {
            finalNum = ocrNum;
          } else if (usedNums.has(finalNum)) {
            finalNum = (tableItems[tableItems.length - 1]?.number || existingMax) + 1;
          }

          let cleanName =
            matchedSocio ||
            (neuralNomText ? extractCleanNameOnly(neuralNomText, profiles) : '') ||
            extractCleanNameOnly(nomWords, profiles);

          if (!cleanName && HEADER_NOISE.test(`${neuralNomText} ${nomWords}`) && band.tableRowIndex === 0) {
            hasHeaderRow = true;
            continue;
          }

          // Se la casella è compilata a mano con calligrafia molto corsiva non decifrabile del tutto,
          // conserva comunque la riga col suo numero esatto e allega il ritaglio fotografico della scritta!
          if (!cleanName) {
            cleanName = `Socio Riga ${finalNum} (scritto a mano — tocca per verificare)`;
          }

          usedNums.add(finalNum);
          crops[finalNum] = band.cropDataUrl;
          tableItems.push({ number: finalNum, name: cleanName });
        }

        if (tableItems.length > 0) {
          return { items: tableItems.sort((a, b) => a.number - b.number), crops };
        }
      }

      // Fallback per immagini non tabellari
      const geomLines = reconstructRowsFromTesseractData(mainResult?.data);
      const parsedGeom = parseSheetLinesIntoQueueItems(geomLines, profiles, existingMax);
      const rawLines = String(mainResult?.data?.text || '').split(/\r?\n/);
      const parsedRaw = parseSheetLinesIntoQueueItems(rawLines, profiles, existingMax);
      const bestParsed = parsedGeom.length >= parsedRaw.length ? parsedGeom : parsedRaw;

      return { items: bestParsed, crops };
    } finally {
      if (worker && typeof worker.terminate === 'function') {
        try {
          await worker.terminate();
        } catch {
          // Ignore worker cleanup errors
        }
      }
    }
  };

  // Gestisce sia la FOTO SCATTATA AL FOGLIO sia il FILE PDF (testuale o scannerizzato)
  const handleProcessSheetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanProgress(10);
    setScanStatusText('Analisi righe della tabella e pulizia bordi in corso...');

    const existingMax =
      queueState.items.length > 0 ? Math.max(...queueState.items.map((i) => i.number)) : 0;

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext);

      if (isImage) {
        const previewUrl = URL.createObjectURL(file);
        setLastSheetPhotoUrl(previewUrl);

        const prep = await analyzeAndPreprocessSheet(file);
        setScanStatusText(
          prep.tableBands.length > 0
            ? `Rilevate ${prep.tableBands.length} righe compilate sul foglio: lettura nomi in corso...`
            : 'Lettura ottica (OCR) di tutte le righe del foglio in corso...'
        );

        const { items: bestParsed, crops } = await runOcrOnPreprocessedSheet(prep, existingMax);

        if (bestParsed.length > 0) {
          integrateExtractedItems(bestParsed, `Foto: ${file.name}`, crops);
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
        let mergedCrops: Record<number, string> = {};

        // Se il PDF era una SCANSIONE (immagine dentro PDF senza testo digitale), usa l'OCR tabellare sulla pagina PDF!
        if (parsed.length === 0 && pdf.numPages > 0) {
          setScanStatusText('PDF scannerizzato rilevato: lettura ottica (OCR) dei nomi in corso...');
          const allPdfItems: QueueItem[] = [];

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
              const blob = await (await fetch(pageDataUrl)).blob();
              const prep = await analyzeAndPreprocessSheet(blob);
              const { items: pageItems, crops } = await runOcrOnPreprocessedSheet(
                prep,
                existingMax + allPdfItems.length
              );
              allPdfItems.push(...pageItems);
              mergedCrops = { ...mergedCrops, ...crops };
            }
          }
          parsed = allPdfItems;
        }

        if (parsed.length > 0) {
          integrateExtractedItems(parsed, file.name, mergedCrops);
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
    setRowCropsByNumber({});
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

        {/* PIE' DI PAGINA CON INDICAZIONE DEL PROSSIMO TURNO */}
        <footer className="px-6 py-4 bg-emerald-800/90 border-t-2 border-white/30 text-center text-lg sm:text-2xl font-semibold text-emerald-100">
          {isStandby ? (
            'Segreteria Università della Terza Età — Quartu Sant’Elena'
          ) : (
            <span>
              Prossimo turno:{' '}
              <strong className="font-extrabold text-white">
                N° {nextItem.number}
                {nextItem.name ? ` — ${nextItem.name}` : ''}
              </strong>
            </span>
          )}
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
          <div className="max-h-[460px] overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const isCurrent = item.number === queueState.currentNumber;
              const rowCrop = rowCropsByNumber[item.number];
              return (
                <div
                  key={item.number}
                  className={`flex flex-col gap-1.5 px-3.5 py-2.5 transition ${
                    isCurrent ? 'bg-emerald-50/90' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          updateQueueState((prev) => ({
                            ...prev,
                            currentNumber: item.number,
                            standbyMode: 'none',
                            standbyMessage: '',
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
                              standbyMode: 'none',
                              standbyMessage: '',
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

                  {rowCrop && (
                    <div className="pl-14 flex items-center gap-2">
                      <img
                        src={rowCrop}
                        alt={`Riga ${item.number} foglio`}
                        className="h-7 max-w-[260px] sm:max-w-[340px] object-contain rounded border border-slate-200 bg-white px-1"
                      />
                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        Ritaglio riga {item.number} dal foglio
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
