export const ASSOCIATION_LOGO_URL = '/logo-associazione-qu3.png?v=15';

let cachedLogoDataUrl: string | null = null;

export async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const response = await fetch(ASSOCIATION_LOGO_URL);
    if (!response.ok) throw new Error('Logo non trovato');
    const blob = await response.blob();
    cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return cachedLogoDataUrl;
  } catch {
    return null;
  }
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Impossibile caricare ${src}`));
    document.head.appendChild(script);
  });
}

export function playSuccessSound(voiceText?: string, enableVoice = true) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = now + idx * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.5, start + 0.05);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.15);
      gain.gain.linearRampToValueAtTime(0, start + 0.6);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  } catch {
    // Ignore audio context restriction errors
  }

  try {
    if (navigator.vibrate) {
      navigator.vibrate([120, 60, 180]);
    }
  } catch {
    // Ignore vibration errors
  }

  if (enableVoice && voiceText && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voiceText);
      utterance.lang = 'it-IT';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors
    }
  }
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number)[][];
  fileName: string;
  landscape?: boolean;
}

// Helper centralizzato per disegnare l'intestazione ufficiale con il logo dell'Associazione su ogni report PDF presente e futuro
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawOfficialPdfHeaderAndFooter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  logo: string | null,
  title: string,
  subtitle: string | undefined,
  timestamp: string,
  currentPage: number,
  totalPages: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Logo Ufficiale Associazione in alto a sinistra
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 14, 8, 24, 24);
    } catch {
      // Ignore image error
    }
  }

  const textStartX = logo ? 42 : 14;

  // Intestazione Associazione
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 61, 46);
  doc.text("UNIVERSITÀ DELLA TERZA ETÀ DI QUARTU S. ELENA — APS", textStartX, 15);

  // Titolo del Report
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(title, textStartX, 22);

  // Sottotitolo (se presente)
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, textStartX, 28);
  }

  // Data/Ora di stampa in alto a destra
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Stampato il ${timestamp}`, pageWidth - 14, 14, { align: 'right' });

  // Linea divisoria verde istituzionale sotto l'intestazione
  doc.setDrawColor(15, 61, 46);
  doc.setLineWidth(0.4);
  doc.line(14, 34, pageWidth - 14, 34);

  // Piè di pagina con mini-logo e numerazione pagine
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 14, pageHeight - 11.5, 6.5, 6.5);
    } catch {
      // Ignore image error
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "QU3 — Università della Terza Età di Quartu S. Elena APS",
    logo ? 22.5 : 14,
    pageHeight - 7.5
  );
  doc.text(
    `Pagina ${currentPage} di ${totalPages}`,
    pageWidth - 14,
    pageHeight - 7.5,
    { align: 'right' }
  );
}

export function formatItalianCurrency(val: number): string {
  if (isNaN(val)) return '€ 0,00';
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const parts = absVal.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '- ' : ''}€ ${intPart},${parts[1]}`;
}

export function formatItalianNumber(val: number, decimals: number = 2): string {
  if (isNaN(val)) return '0,00';
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const parts = absVal.toFixed(decimals).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '-' : ''}${intPart},${parts[1]}`;
}

export async function exportOfficialPdf(options: PdfExportOptions) {
  const { title, subtitle, head, body, fileName, landscape } = options;

  await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jspdfGlobal = (window as any).jspdf;
  const doc = new jspdfGlobal.jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const logo = await getLogoDataUrl();
  const timestamp = new Date().toLocaleString('it-IT');

  // Individua le colonne numeriche o di valuta per allinearle a destra
  const columnStyles: Record<number, { halign: 'right' | 'left' | 'center' }> = {};
  head.forEach((h, idx) => {
    const lower = String(h || '').toLowerCase();
    if (
      lower.includes('€') ||
      lower.includes('eur') ||
      lower.includes('importo') ||
      lower.includes('lordo') ||
      lower.includes('netto') ||
      lower.includes('tariffa') ||
      lower.includes('saldo') ||
      lower.includes('entrata') ||
      lower.includes('uscita') ||
      lower.includes('spesa') ||
      lower.includes('ricavi') ||
      lower.includes('costi') ||
      lower.includes('compenso') ||
      lower.includes('ore') ||
      lower.includes('totale')
    ) {
      columnStyles[idx] = { halign: 'right' };
    }
  });

  // Formatta le celle numeriche per la visualizzazione PDF
  const formattedBody = body.map((row) =>
    row.map((cell, colIdx) => {
      if (cell === null || cell === undefined) return '';
      const h = String(head[colIdx] || '').toLowerCase();
      const isCurrencyCol =
        h.includes('€') ||
        h.includes('eur') ||
        h.includes('importo') ||
        h.includes('lordo') ||
        h.includes('netto') ||
        h.includes('tariffa') ||
        h.includes('saldo') ||
        h.includes('entrata') ||
        h.includes('uscita') ||
        h.includes('spesa') ||
        h.includes('ricavi') ||
        h.includes('costi');

      if (typeof cell === 'number') {
        if (isCurrencyCol) {
          return formatItalianCurrency(cell);
        }
        return Number.isInteger(cell) ? String(cell) : formatItalianNumber(cell, 2);
      }

      // Se il valore è una stringa numerica come "14.99" in una colonna valuta
      const strVal = String(cell).trim();
      if (isCurrencyCol && /^[+-]?\d+(\.\d+)?$/.test(strVal)) {
        const num = parseFloat(strVal);
        if (!isNaN(num)) return formatItalianCurrency(num);
      }

      return strVal;
    })
  );

  doc.autoTable({
    startY: 38,
    head: [head],
    body: formattedBody,
    columnStyles,
    styles: {
      fontSize: 9.5,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [15, 61, 46],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [240, 247, 244],
    },
    margin: { top: 38, left: 14, right: 14, bottom: 16 },
  });

  // Disegna intestazione con logo e piè di pagina su tutte le pagine del documento
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawOfficialPdfHeaderAndFooter(doc, logo, title, subtitle, timestamp, p, totalPages);
  }

  doc.save(fileName);
}

export function exportCsv(
  arg1: string[] | string,
  arg2: (string | number)[][] | string[],
  arg3?: string | (string | number)[][]
) {
  let headers: string[];
  let rows: (string | number)[][];
  let fileName: string;

  if (typeof arg1 === 'string') {
    // Chiamata (fileName, headers, rows)
    fileName = arg1;
    headers = Array.isArray(arg2) ? (arg2 as string[]) : [];
    rows = Array.isArray(arg3) ? (arg3 as (string | number)[][]) : [];
  } else {
    // Chiamata (headers, rows, fileName)
    headers = Array.isArray(arg1) ? arg1 : [];
    rows = Array.isArray(arg2) ? (arg2 as (string | number)[][]) : [];
    fileName = typeof arg3 === 'string' ? arg3 : 'export.csv';
  }

  // Formatta ogni cella: i numeri vengono scritti con virgola decimale e SENZA apici,
  // così Excel li riconosce nativamente come numeri calcolabili (somma, media, valuta).
  const formatCellForCsv = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') {
      if (isNaN(val)) return '';
      if (Number.isInteger(val)) return String(val);
      const parts = val.toFixed(2).split('.');
      return `${parts[0]},${parts[1]}`;
    }
    const s = String(val).trim();
    // Se la stringa è un numero puro (es. "14.99", "-30.87", "14,99")
    if (/^[+-]?\d+([.,]\d+)?$/.test(s)) {
      const num = parseFloat(s.replace(',', '.'));
      if (!isNaN(num)) {
        if (Number.isInteger(num) && !s.includes('.') && !s.includes(',')) {
          return String(num);
        }
        const parts = num.toFixed(2).split('.');
        return `${parts[0]},${parts[1]}`;
      }
    }
    // Stringhe di testo: escape delle virgolette doppie e racchiuse tra virgolette se contengono delimitatori
    const escaped = s.replace(/"/g, '""');
    return escaped.includes(';') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes('"')
      ? `"${escaped}"`
      : escaped;
  };

  const csvContent =
    '\uFEFF' +
    [
      headers.map((h) => {
        const s = String(h ?? '').replace(/"/g, '""');
        return s.includes(';') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
      }).join(';'),
      ...rows.map((r) => r.map(formatCellForCsv).join(';')),
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
