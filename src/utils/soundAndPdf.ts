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

  doc.autoTable({
    startY: 38,
    head: [head],
    body: body.map((row: (string | number)[]) => row.map((cell) => String(cell ?? ''))),
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

export function exportCsv(headers: string[], rows: (string | number)[][], fileName: string) {
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
