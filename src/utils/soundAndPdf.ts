import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

let cachedLogoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const response = await fetch('/q3-icon.jpeg');
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

export function playSuccessSound(voiceText?: string, enableVoice = true) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    // Original QUARTimbra C5 - E5 - G5 chime
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

export async function exportOfficialPdf(options: PdfExportOptions) {
  const { title, subtitle, head, body, fileName, landscape } = options;
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await getLogoDataUrl();

  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', 14, 10, 22, 22);
    } catch {
      // Ignore image error
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(20, 83, 45);
  doc.text("QU3 — Università della Terza Età di Quartu S. Elena", logo ? 40 : 14, 18);

  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(title, logo ? 40 : 14, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const timestamp = new Date().toLocaleString('it-IT');
  doc.text(`Stampato il ${timestamp}`, pageWidth - 14, 14, { align: 'right' });

  if (subtitle) {
    doc.text(subtitle, logo ? 40 : 14, 32);
  }

  autoTable(doc, {
    startY: 38,
    head: [head],
    body: body.map((row) => row.map((cell) => String(cell ?? ''))),
    styles: {
      fontSize: 9.5,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [22, 90, 60],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [240, 247, 244],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const totalPages = doc.getNumberOfPages();
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `QUARTimbra — Settore Didattica QU3 · Pagina ${currentPage} di ${totalPages}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    },
  });

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
