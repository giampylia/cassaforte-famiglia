import React, { useState, useMemo, useRef } from 'react';
import {
  Wallet,
  Plus,
  Camera,
  Upload,
  Check,
  X,
  Edit3,
  Trash2,
  Printer,
  FileDown,
  Search,
  Clock,
  CheckCircle2,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Settings,
  Eye,
  Receipt,
  Calendar,
  Tag,
  FileText,
  User,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CashMovement } from '../data/initialData';
import { exportCsv, exportOfficialPdf } from '../utils/soundAndPdf';

// Caricamento dinamico on-demand di Tesseract OCR da CDN per non rallentare l'avvio dell'app
let tesseractPromise: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  if ((window as any).Tesseract) {
    return Promise.resolve((window as any).Tesseract);
  }
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

// Parser intelligente per scontrini fiscali italiani (estrae Importo, Data scontrino e N° documento)
export function parseItalianReceiptText(rawText: string): {
  amount: number | null;
  date: string | null;
  receiptNumber: string | null;
  detectedLines: string[];
} {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Ricerca Data (formati dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, dd/mm/yy)
  let foundDate: string | null = null;
  const dateRegex =
    /\b(0?[1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/;
  for (const line of lines) {
    const m = line.match(dateRegex);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      let year = m[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      const numYear = parseInt(year, 10);
      if (numYear >= 2020 && numYear <= 2030) {
        foundDate = `${year}-${month}-${day}`;
        break;
      }
    }
  }

  // 2. Ricerca Importo (priorità a righe con TOTALE COMPLESSIVO, TOTALE EURO, TOTALE, IMPORTO, PAGATO, EUR)
  let foundAmount: number | null = null;
  const priorityKeywords = [
    /TOTALE\s+COMPLESSIVO/i,
    /TOTALE\s+EURO/i,
    /TOTALE\s+EUR/i,
    /IMPORTO\s+PAGATO/i,
    /TOTALE/i,
    /IMPORTO/i,
    /PAGAMENTO/i,
    /CONTANTI/i,
    /CARTA/i,
    /BANCOMAT/i,
    /EUR/i,
    /€/,
  ];

  const extractAmountsFromLine = (line: string): number[] => {
    // Normalizza eventuali spazi attorno alla virgola es. "12 , 50" -> "12,50"
    const normalized = line.replace(/(\d)\s*([,\.])\s*(\d{2})\b/g, '$1,$3');
    const matches = normalized.match(/\b\d{1,5}[,\.]\d{2}\b/g);
    if (!matches) return [];
    return matches
      .map((m) => parseFloat(m.replace(',', '.')))
      .filter((n) => !isNaN(n) && n > 0 && n < 10000);
  };

  for (const kw of priorityKeywords) {
    for (let i = 0; i < lines.length; i++) {
      if (kw.test(lines[i])) {
        const nums = extractAmountsFromLine(lines[i]);
        if (nums.length > 0) {
          foundAmount = Math.max(...nums);
          break;
        }
        // A volte il numero è sulla riga immediatamente successiva
        if (i + 1 < lines.length) {
          const nextNums = extractAmountsFromLine(lines[i + 1]);
          if (nextNums.length > 0) {
            foundAmount = Math.max(...nextNums);
            break;
          }
        }
      }
    }
    if (foundAmount !== null) break;
  }

  // Fallback: se non trova la parola "TOTALE", prende l'importo decimale più alto plausibile nello scontrino
  if (foundAmount === null) {
    const allAmounts: number[] = [];
    for (const line of lines) {
      // Ignora righe con percentuali IVA tipo 22,00% o 10,00%
      if (/%/.test(line) || /IVA/i.test(line)) continue;
      allAmounts.push(...extractAmountsFromLine(line));
    }
    if (allAmounts.length > 0) {
      foundAmount = Math.max(...allAmounts);
    }
  }

  // 3. Ricerca N° Scontrino / Documento (es. DOC. N. 0012-0045 o N. 0123)
  let foundReceiptNumber: string | null = null;
  const docRegex = /(?:DOC\.?\s*N\.?|SCONTRINO\s*N\.?|N\.?\s*DOC\.?)\s*([0-9]{2,6}[\-\/][0-9]{2,6}|[0-9]{3,8})/i;
  for (const line of lines) {
    const m = line.match(docRegex);
    if (m && m[1]) {
      foundReceiptNumber = m[1].trim();
      break;
    }
  }

  return {
    amount: foundAmount,
    date: foundDate,
    receiptNumber: foundReceiptNumber,
    detectedLines: lines.slice(0, 12),
  };
}

// Ridimensiona e ottimizza l'immagine dello scontrino per OCR veloce e salvataggio miniatura
async function processReceiptImage(file: File): Promise<{
  previewDataUrl: string;
  ocrCanvasUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // 1. Miniatura leggera da allegare alla richiesta (max 650px)
        const thumbCanvas = document.createElement('canvas');
        const maxThumb = 650;
        const scaleThumb = Math.min(1, maxThumb / Math.max(img.width, img.height));
        thumbCanvas.width = Math.round(img.width * scaleThumb);
        thumbCanvas.height = Math.round(img.height * scaleThumb);
        const tCtx = thumbCanvas.getContext('2d');
        if (tCtx) {
          tCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }
        const previewDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);

        // 2. Immagine ad alto contrasto per OCR (max 1400px)
        const ocrCanvas = document.createElement('canvas');
        const maxOcr = 1400;
        const scaleOcr = Math.min(1, maxOcr / Math.max(img.width, img.height));
        ocrCanvas.width = Math.round(img.width * scaleOcr);
        ocrCanvas.height = Math.round(img.height * scaleOcr);
        const oCtx = ocrCanvas.getContext('2d');
        if (oCtx) {
          oCtx.filter = 'grayscale(100%) contrast(145%)';
          oCtx.drawImage(img, 0, 0, ocrCanvas.width, ocrCanvas.height);
        }
        const ocrCanvasUrl = ocrCanvas.toDataURL('image/jpeg', 0.88);

        resolve({ previewDataUrl, ocrCanvasUrl });
      };
      img.onerror = reject;
      img.src = String(ev.target?.result || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const PiccolaCassaView: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    profiles,
    expenseCategories,
    addExpenseCategory,
    deleteExpenseCategory,
    cashMovements,
    cashOpeningBalance,
    setCashOpeningBalance,
    addCashMovement,
    updateCashMovement,
    deleteCashMovement,
  } = useApp();

  const todayIso = new Date().toISOString().slice(0, 10);

  // Filtri elenco movimenti
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'inviato' | 'approvato' | 'pagato'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'spesa' | 'entrata'>('all');

  // Modal Form (Nuova Richiesta / Versamento oppure Modifica completa per Giampiero Pilia 7796)
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);

  const [entryType, setEntryType] = useState<'spesa' | 'entrata'>('spesa');
  const [requesterId, setRequesterId] = useState<string>(currentUser?.id || '');
  const [requesterName, setRequesterName] = useState<string>(currentUser?.full_name || '');
  const [requestDate, setRequestDate] = useState<string>(todayIso);
  const [receiptDate, setReceiptDate] = useState<string>(todayIso);
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [customCategoryName, setCustomCategoryName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [statusInput, setStatusInput] = useState<'inviato' | 'approvato' | 'pagato'>('inviato');
  const [receiptImageData, setReceiptImageData] = useState<string | undefined>(undefined);

  // Stato Scanner OCR Scontrino
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'info' | 'warning';
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Modal Dettaglio / Stampa Ricevuta (uguale a qufficio3.lovable.app)
  const [selectedMovement, setSelectedMovement] = useState<CashMovement | null>(null);

  // Modal Gestione Causali & Saldo Iniziale (solo Super Admin 7796 Giampiero Pilia)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [showOpeningBalanceModal, setShowOpeningBalanceModal] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState(String(cashOpeningBalance));

  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  // Elenco soci CD (e Super Admin) per eventuale selezione da parte di Giampiero Pilia
  const cdProfiles = useMemo(() => {
    return profiles.filter(
      (p) => p.is_cd || p.roles?.includes('CD') || p.member_number === '7796'
    );
  }, [profiles]);

  // Apri form per nuova richiesta di rimborso o versamento
  const openNewForm = (type: 'spesa' | 'entrata') => {
    setEditingMovementId(null);
    setEntryType(type);
    setRequesterId(currentUser?.id || '');
    setRequesterName(currentUser?.full_name || '');
    setRequestDate(todayIso);
    setReceiptDate(todayIso);
    setReceiptNumber('');
    setAmountInput('');
    const defaultCat =
      type === 'entrata'
        ? expenseCategories.find((c) => c.name.toLowerCase().includes('versamento'))?.id || ''
        : expenseCategories[0]?.id || '';
    setSelectedCategoryId(defaultCat);
    setCustomCategoryName('');
    setDescription('');
    setStatusInput(type === 'entrata' && isSuperAdmin ? 'pagato' : 'inviato');
    setReceiptImageData(undefined);
    setScanFeedback(null);
    setShowFormModal(true);
  };

  // Apri form in modalità modifica
  const openEditForm = (mov: CashMovement) => {
    setEditingMovementId(mov.id);
    setEntryType(mov.entry_type);
    setRequesterId(mov.requester_id);
    setRequesterName(mov.requester_name);
    setRequestDate(mov.request_date);
    setReceiptDate(mov.receipt_date || mov.request_date);
    setReceiptNumber(mov.receipt_number || '');
    setAmountInput(String(mov.amount_requested));
    const catExists = expenseCategories.some((c) => c.id === mov.category_id);
    if (catExists && mov.category_id) {
      setSelectedCategoryId(mov.category_id);
      setCustomCategoryName('');
    } else if (mov.category_name) {
      setSelectedCategoryId('altro');
      setCustomCategoryName(mov.category_name);
    } else {
      setSelectedCategoryId('');
      setCustomCategoryName('');
    }
    setDescription(mov.description || '');
    setStatusInput(mov.status);
    setReceiptImageData(mov.receipt_image_data);
    setScanFeedback(null);
    setShowFormModal(true);
  };

  // Gestione Scansione Immagine Scontrino (OCR automatico)
  const handleReceiptFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);
    setScanProgress(12);
    setScanFeedback({
      type: 'info',
      message: 'Analisi immagine scontrino in corso... Lettura importo e data...',
    });

    try {
      const { previewDataUrl, ocrCanvasUrl } = await processReceiptImage(file);
      setReceiptImageData(previewDataUrl);
      setScanProgress(30);

      const Tesseract = await loadTesseract();
      setScanProgress(45);

      const result = await Tesseract.recognize(ocrCanvasUrl, 'ita+eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setScanProgress(45 + Math.round(m.progress * 50));
          }
        },
      });

      const rawText = result?.data?.text || '';
      const parsed = parseItalianReceiptText(rawText);

      const detectedParts: string[] = [];
      if (parsed.amount !== null) {
        setAmountInput(parsed.amount.toFixed(2));
        detectedParts.push(`Importo: € ${parsed.amount.toFixed(2)}`);
      }
      if (parsed.date !== null) {
        setReceiptDate(parsed.date);
        const [y, m, d] = parsed.date.split('-');
        detectedParts.push(`Data scontrino: ${d}/${m}/${y}`);
      }
      if (parsed.receiptNumber !== null) {
        setReceiptNumber(parsed.receiptNumber);
        detectedParts.push(`N° Doc: ${parsed.receiptNumber}`);
      }

      if (detectedParts.length > 0) {
        setScanFeedback({
          type: 'success',
          message: `✓ Dati estratti dallo scontrino: ${detectedParts.join(' · ')}. Puoi verificarli o correggerli qui sotto.`,
        });
      } else {
        setScanFeedback({
          type: 'warning',
          message:
            'Foto scontrino allegata correttamente. L\'immagine è poco nitida per la lettura automatica: verifica o inserisci manualmente importo e data.',
        });
      }
    } catch (err) {
      console.error('Errore OCR scontrino:', err);
      setScanFeedback({
        type: 'warning',
        message:
          'Immagine scontrino allegata. Inserisci o verifica manualmente importo e data scontrino.',
      });
    } finally {
      setIsScanningReceipt(false);
      setScanProgress(100);
      if (e.target) e.target.value = '';
    }
  };

  // Salvataggio Richiesta di Rimborso / Versamento
  const handleSaveMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(String(amountInput).replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setScanFeedback({
        type: 'warning',
        message: 'Inserisci un importo valido maggiore di 0 €.',
      });
      return;
    }

    let finalCategoryId: string | null = selectedCategoryId || null;
    let finalCategoryName = 'Non specificata';

    if (selectedCategoryId === 'altro') {
      finalCategoryId = null;
      finalCategoryName = customCategoryName.trim() || 'Altro';
    } else if (selectedCategoryId) {
      const found = expenseCategories.find((c) => c.id === selectedCategoryId);
      finalCategoryName = found ? found.name : 'Generale';
    }

    const finalRequesterName =
      (isSuperAdmin ? requesterName.trim() : currentUser?.full_name) || 'Socio CD';

    if (editingMovementId) {
      updateCashMovement(editingMovementId, {
        entry_type: entryType,
        requester_id: requesterId || currentUser?.id || 'cd-member',
        requester_name: finalRequesterName,
        request_date: requestDate || todayIso,
        receipt_date: receiptDate || requestDate || todayIso,
        receipt_number: receiptNumber.trim() || undefined,
        amount_requested: Math.round(numericAmount * 100) / 100,
        category_id: finalCategoryId,
        category_name: finalCategoryName,
        description: description.trim() || undefined,
        status: isSuperAdmin ? statusInput : undefined,
        receipt_image_data: receiptImageData,
      });
      showToast('✓ Movimento aggiornato correttamente.');
    } else {
      addCashMovement({
        entry_type: entryType,
        requester_id: requesterId || currentUser?.id || 'cd-member',
        requester_name: finalRequesterName,
        request_date: requestDate || todayIso,
        receipt_date: receiptDate || requestDate || todayIso,
        receipt_number: receiptNumber.trim() || undefined,
        amount_requested: Math.round(numericAmount * 100) / 100,
        category_id: finalCategoryId,
        category_name: finalCategoryName,
        description: description.trim() || undefined,
        status: isSuperAdmin ? statusInput : 'inviato',
        receipt_image_data: receiptImageData,
      });
      showToast(
        entryType === 'spesa'
          ? '✓ Richiesta di rimborso registrata correttamente.'
          : '✓ Versamento in Piccola Cassa registrato correttamente.'
      );
    }

    setShowFormModal(false);
  };

  // Filtra movimenti: Giampiero Pilia (7796) vede e modifica tutto; i soci CD vedono il registro e possono operare
  const visibleMovements = useMemo(() => {
    return cashMovements.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (typeFilter !== 'all' && m.entry_type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = m.requester_name.toLowerCase().includes(q);
        const matchCat = m.category_name.toLowerCase().includes(q);
        const matchDesc = (m.description || '').toLowerCase().includes(q);
        const matchNum = (m.receipt_number || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc && !matchNum) return false;
      }
      return true;
    });
  }, [cashMovements, statusFilter, typeFilter, searchQuery]);

  // Statistiche e Riepilogo Contabile (come su qufficio3.lovable.app)
  const stats = useMemo(() => {
    const totalCount = cashMovements.length;
    const pendingCount = cashMovements.filter((m) => m.status === 'inviato').length;
    const approvedCount = cashMovements.filter((m) => m.status === 'approvato').length;
    const paidCount = cashMovements.filter((m) => m.status === 'pagato').length;

    const totalEntrate = cashMovements
      .filter((m) => m.entry_type === 'entrata')
      .reduce((acc, m) => acc + Number(m.amount_requested || 0), 0);

    const totalSpese = cashMovements
      .filter((m) => m.entry_type === 'spesa')
      .reduce((acc, m) => acc + Number(m.amount_requested || 0), 0);

    const finalBalance = cashOpeningBalance + totalEntrate - totalSpese;

    return {
      totalCount,
      pendingCount,
      approvedCount,
      paidCount,
      totalEntrate,
      totalSpese,
      finalBalance,
    };
  }, [cashMovements, cashOpeningBalance]);

  // Stampa ricevuta singola (identica al modello di qufficio3.lovable.app)
  const handlePrintSingleReceipt = (mov: CashMovement) => {
    const isEntrata = mov.entry_type === 'entrata';
    const title = isEntrata ? "RICEVUTA D'INCASSO" : 'RICHIESTA DI RIMBORSO SPESE';
    const printWin = window.open('', '_blank', 'width=800,height=700');
    if (!printWin) return;

    const reqDateStr = mov.request_date
      ? new Date(`${mov.request_date}T12:00:00`).toLocaleDateString('it-IT')
      : '—';
    const recDateStr = mov.receipt_date
      ? new Date(`${mov.receipt_date}T12:00:00`).toLocaleDateString('it-IT')
      : '—';

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <title>${title} - Q3 Piccola Cassa</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 32px; max-width: 720px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { font-size: 20px; margin: 0; font-weight: 600; color: #0f766e; }
          .header p { font-size: 13px; color: #64748b; margin: 4px 0 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 14px; margin-bottom: 20px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 2px; }
          .val { font-size: 15px; font-weight: 500; color: #0f172a; }
          .amount-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px; text-align: center; margin: 20px 0; }
          .amount-box .val { font-size: 22px; color: #065f46; }
          .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 56px; text-align: center; font-size: 12px; color: #475569; }
          .sig-line { border-bottom: 1px solid #94a3b8; height: 40px; margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>QU3 — Università della Terza Età di Quartu Sant'Elena · Registro Piccola Cassa CD</p>
        </div>
        <div class="grid">
          <div class="box"><span class="label">Tipo Operazione</span><span class="val">${isEntrata ? 'Entrata / Versamento' : 'Rimborso Spesa'}</span></div>
          <div class="box"><span class="label">Stato</span><span class="val">${mov.status.toUpperCase()}</span></div>
          <div class="box"><span class="label">Socio CD (Nome e Cognome)</span><span class="val">${mov.requester_name}</span></div>
          <div class="box"><span class="label">Causale</span><span class="val">${mov.category_name}</span></div>
          <div class="box"><span class="label">Data Richiesta</span><span class="val">${reqDateStr}</span></div>
          <div class="box"><span class="label">Data Scontrino</span><span class="val">${recDateStr}</span></div>
          <div class="box"><span class="label">N° Scontrino / Documento</span><span class="val">${mov.receipt_number || '—'}</span></div>
          <div class="box"><span class="label">Data Pagamento / Incasso</span><span class="val">${mov.payment_date ? new Date(mov.payment_date).toLocaleDateString('it-IT') : '—'}</span></div>
        </div>
        <div class="box" style="margin-bottom: 16px;">
          <span class="label">Descrizione / Note</span>
          <span class="val">${mov.description || '—'}</span>
        </div>
        <div class="amount-box">
          <span class="label">${isEntrata ? 'Importo Versato in Cassa' : 'Importo Rimborso Richiesto'}</span>
          <span class="val">€ ${Number(mov.amount_requested).toFixed(2)}</span>
        </div>
        <div class="sigs">
          <div><div class="sig-line"></div>Firma Richiedente</div>
          <div><div class="sig-line"></div>Firma Tesoriere</div>
          <div><div class="sig-line"></div>Firma Revisore</div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  // Esporta PDF Registro Cassa completo
  const handleExportRegisterPdf = () => {
    exportOfficialPdf({
      title: 'Registro Ufficiale Piccola Cassa — Consiglio Direttivo (CD)',
      subtitle: `Saldo Iniziale: € ${cashOpeningBalance.toFixed(2)} · Entrate: +€ ${stats.totalEntrate.toFixed(2)} · Spese: -€ ${stats.totalSpese.toFixed(2)} · Saldo Finale: € ${stats.finalBalance.toFixed(2)}`,
      head: [
        'Data Rich.',
        'Data Scontr.',
        'Tipo',
        'Socio CD',
        'Causale',
        'Descrizione',
        'Importo (€)',
        'Stato',
      ],
      body: visibleMovements.map((m) => [
        new Date(`${m.request_date}T12:00:00`).toLocaleDateString('it-IT'),
        m.receipt_date
          ? new Date(`${m.receipt_date}T12:00:00`).toLocaleDateString('it-IT')
          : '—',
        m.entry_type === 'entrata' ? 'ENTRATA' : 'RIMBORSO',
        m.requester_name,
        m.category_name,
        m.description || '—',
        `${m.entry_type === 'entrata' ? '+' : '-'} € ${Number(m.amount_requested).toFixed(2)}`,
        m.status.toUpperCase(),
      ]),
      fileName: `registro_piccola_cassa_QU3_${todayIso}.pdf`,
      landscape: true,
    });
  };

  const handleExportRegisterCsv = () => {
    exportCsv(
      `piccola_cassa_QU3_${todayIso}.csv`,
      [
        'Data Richiesta',
        'Data Scontrino',
        'N. Scontrino',
        'Tipo',
        'Socio CD',
        'Causale',
        'Descrizione',
        'Importo EUR',
        'Stato',
      ],
      visibleMovements.map((m) => [
        m.request_date,
        m.receipt_date || '',
        m.receipt_number || '',
        m.entry_type === 'entrata' ? 'Entrata' : 'Rimborso Spesa',
        m.requester_name,
        m.category_name,
        m.description || '',
        Number(m.amount_requested).toFixed(2),
        m.status,
      ])
    );
  };

  const statusBadge = (status: CashMovement['status']) => {
    if (status === 'inviato') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-normal text-amber-800">
          <Clock className="h-3 w-3" /> In attesa
        </span>
      );
    }
    if (status === 'approvato') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-xs font-normal text-sky-800">
          <CheckCircle2 className="h-3 w-3" /> Approvato
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-normal text-emerald-800">
        <Banknote className="h-3 w-3" /> Pagato
      </span>
    );
  };

  const inputClass =
    'bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none';

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-3 py-3 sm:px-5 sm:py-5 pb-14 text-slate-800">
      <main className="mx-auto max-w-4xl space-y-4">
        {feedbackBanner && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-normal text-emerald-900 flex items-center justify-between shadow-2xs">
            <span>{feedbackBanner}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-emerald-700 hover:text-emerald-950"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* BLOCCO 1: INTESTAZIONE COMPATTA + 2 PULSANTI GRANDI E CHIARI */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg sm:text-xl font-medium text-slate-900">
                Piccola Cassa Consiglio Direttivo
              </h1>
              <p className="text-xs sm:text-sm font-normal text-slate-500">
                Richiedi un rimborso spese (anche fotografando lo scontrino) o registra un versamento
              </p>
            </div>

            {isSuperAdmin && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCategoriesModal(true)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-normal text-slate-700"
                >
                  <Settings className="h-3.5 w-3.5 text-slate-500" />
                  <span>Causali</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpeningBalanceInput(String(cashOpeningBalance));
                    setShowOpeningBalanceModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-normal text-slate-700"
                >
                  <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Saldo Iniziale</span>
                </button>
              </div>
            )}
          </div>

          {/* I 2 pulsanti principali grandi e immediati */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => openNewForm('spesa')}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 py-3.5 px-4 text-base font-medium text-white shadow-xs transition active:scale-[0.99]"
            >
              <Plus className="h-5 w-5" />
              <span>Richiesta di Rimborso</span>
            </button>

            <button
              type="button"
              onClick={() => openNewForm('entrata')}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-3.5 px-4 text-base font-medium text-emerald-900 transition active:scale-[0.99]"
            >
              <ArrowDownLeft className="h-5 w-5 text-emerald-700" />
              <span>Registra Versamento</span>
            </button>
          </div>

          {/* Riepilogo Saldo in 4 caselle pulite */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
              <span className="text-[11px] font-normal text-slate-500 block">Saldo Iniziale</span>
              <span className="text-base sm:text-lg font-medium text-slate-800 tabular-nums">
                € {cashOpeningBalance.toFixed(2)}
              </span>
            </div>
            <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200 p-3">
              <span className="text-[11px] font-normal text-emerald-800 block">+ Versamenti</span>
              <span className="text-base sm:text-lg font-medium text-emerald-700 tabular-nums">
                + € {stats.totalEntrate.toFixed(2)}
              </span>
            </div>
            <div className="rounded-2xl bg-rose-50/60 border border-rose-200 p-3">
              <span className="text-[11px] font-normal text-rose-800 block">- Rimborsi</span>
              <span className="text-base sm:text-lg font-medium text-rose-700 tabular-nums">
                - € {stats.totalSpese.toFixed(2)}
              </span>
            </div>
            <div className="rounded-2xl bg-emerald-700 text-white p-3">
              <span className="text-[11px] font-normal text-emerald-100 block">Saldo Cassa</span>
              <span className="text-base sm:text-lg font-medium tabular-nums">
                € {stats.finalBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* BLOCCO 2: ELENCO OPERAZIONI LEGGIBILE A SCHEDE */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca per socio, causale o descrizione..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-10 rounded-xl pl-10 pr-3 text-sm font-normal ${inputClass}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={`h-10 rounded-xl px-3 text-xs sm:text-sm font-normal ${inputClass}`}
              >
                <option value="all">Tutti gli stati ({cashMovements.length})</option>
                <option value="inviato">In attesa ({stats.pendingCount})</option>
                <option value="approvato">Approvati ({stats.approvedCount})</option>
                <option value="pagato">Pagati ({stats.paidCount})</option>
              </select>

              <button
                type="button"
                onClick={handleExportRegisterPdf}
                className="h-10 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 text-xs sm:text-sm font-normal text-slate-700 transition"
              >
                <FileDown className="h-4 w-4 text-emerald-700" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportRegisterCsv}
                className="h-10 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 text-xs sm:text-sm font-normal text-slate-700 transition"
              >
                <FileDown className="h-4 w-4 text-slate-500" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Lista Operazioni in formato Scheda chiara (nessuno scorrimento orizzontale su smartphone) */}
          {visibleMovements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-normal text-slate-500">
              Nessun movimento trovato. Tocca <strong>"Richiesta di Rimborso"</strong> o{' '}
              <strong>"Registra Versamento"</strong> in alto per iniziare.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleMovements.map((mov) => {
                const isEntrata = mov.entry_type === 'entrata';
                const canEdit =
                  isSuperAdmin ||
                  (mov.requester_id === currentUser?.id && mov.status === 'inviato');

                return (
                  <div
                    key={mov.id}
                    onClick={() => setSelectedMovement(mov)}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white p-3.5 sm:p-4 transition cursor-pointer space-y-2.5"
                  >
                    {/* Riga alta: Socio + Causale a sinistra, Importo + Stato a destra */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${
                              isEntrata
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-rose-100 text-rose-900'
                            }`}
                          >
                            {isEntrata ? 'Versamento' : 'Rimborso'}
                          </span>
                          <span className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 text-xs font-normal text-slate-700">
                            {mov.category_name}
                          </span>
                          {mov.receipt_image_data && (
                            <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-800">
                              📷 Scontrino
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-base font-medium text-slate-900">
                          {mov.requester_name}
                        </p>
                        {mov.description && (
                          <p className="text-xs sm:text-sm font-normal text-slate-600">
                            {mov.description}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        <p
                          className={`text-lg sm:text-xl font-medium tabular-nums ${
                            isEntrata ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isEntrata ? '+' : '-'} € {Number(mov.amount_requested).toFixed(2)}
                        </p>
                        <div>{statusBadge(mov.status)}</div>
                      </div>
                    </div>

                    {/* Riga bassa: Date a sinistra, Pulsanti azione a destra */}
                    <div
                      className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Richiesta:{' '}
                          <strong>
                            {new Date(`${mov.request_date}T12:00:00`).toLocaleDateString('it-IT')}
                          </strong>
                        </span>
                        {mov.receipt_date && (
                          <span>
                            Scontrino:{' '}
                            <strong>
                              {new Date(`${mov.receipt_date}T12:00:00`).toLocaleDateString('it-IT')}
                            </strong>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedMovement(mov)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1.5 text-xs font-normal text-slate-700"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Ricevuta</span>
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditForm(mov)}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 text-xs font-normal text-emerald-800"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Modifica</span>
                          </button>
                        )}

                        {isSuperAdmin && mov.status === 'inviato' && (
                          <button
                            type="button"
                            onClick={() => {
                              updateCashMovement(mov.id, { status: 'approvato' });
                              showToast('✓ Richiesta approvata.');
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-sky-600 hover:bg-sky-700 px-2.5 py-1.5 text-xs font-normal text-white"
                          >
                            <Check className="h-3.5 w-3.5" /> Approva
                          </button>
                        )}

                        {isSuperAdmin && mov.status !== 'pagato' && (
                          <button
                            type="button"
                            onClick={() => {
                              updateCashMovement(mov.id, {
                                status: 'pagato',
                                payment_date: new Date().toISOString(),
                              });
                              showToast('✓ Movimento segnato come Pagato.');
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 text-xs font-normal text-white"
                          >
                            <Banknote className="h-3.5 w-3.5" /> Paga
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              deleteCashMovement(mov.id);
                              showToast('Movimento eliminato.');
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50"
                            title="Elimina"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* =====================================================================
          MODAL FORM: RICHIESTA DI RIMBORSO / VERSAMENTO + SCANNER SCONTRINO OCR
         ===================================================================== */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg sm:text-xl font-medium text-slate-900">
                  {editingMovementId
                    ? 'Modifica Operazione Piccola Cassa'
                    : entryType === 'spesa'
                    ? 'Nuova Richiesta di Rimborso Spese'
                    : 'Nuovo Versamento in Piccola Cassa'}
                </h2>
                <p className="text-xs font-normal text-slate-500">
                  Compila i campi oppure scannerizza lo scontrino per inserire importo e data in automatico
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scelta Tipo Operazione: Rimborso Spesa o Versamento */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => setEntryType('spesa')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-normal transition ${
                  entryType === 'spesa'
                    ? 'bg-white text-rose-800 shadow-xs border border-rose-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>Richiesta di Rimborso (Spesa)</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryType('entrata')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-normal transition ${
                  entryType === 'entrata'
                    ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                <span>Versamento (Entrata)</span>
              </button>
            </div>

            {/* BOX SCANNERIZZA SCONTRINO (OCR AUTOMATICO) */}
            <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-emerald-950 flex items-center gap-1.5">
                      <span>Scannerizza Scontrino (Lettura Automatica)</span>
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    </h3>
                    <p className="text-xs font-normal text-slate-600">
                      Scatta una foto o carica l'immagine dello scontrino: il sistema legge da solo{' '}
                      <strong>Importo (€)</strong> e <strong>Data scontrino</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Input Fotocamera Diretta su Smartphone */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleReceiptFileSelected}
                    className="hidden"
                  />
                  {/* Input Galleria / File */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptFileSelected}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isScanningReceipt}
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 px-3.5 py-2 text-xs font-normal text-white shadow-xs transition"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Fotografa Scontrino</span>
                  </button>

                  <button
                    type="button"
                    disabled={isScanningReceipt}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 disabled:opacity-50 px-3 py-2 text-xs font-normal text-emerald-900 transition"
                  >
                    <Upload className="h-4 w-4 text-emerald-700" />
                    <span>Carica Immagine</span>
                  </button>
                </div>
              </div>

              {isScanningReceipt && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-normal text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Lettura ottica dello scontrino in corso...
                    </span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-emerald-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {scanFeedback && (
                <div
                  className={`rounded-xl px-3 py-2 text-xs font-normal ${
                    scanFeedback.type === 'success'
                      ? 'bg-emerald-100/90 text-emerald-950 border border-emerald-300'
                      : scanFeedback.type === 'warning'
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : 'bg-sky-50 text-sky-900 border border-sky-200'
                  }`}
                >
                  {scanFeedback.message}
                </div>
              )}

              {receiptImageData && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-2.5 border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <img
                      src={receiptImageData}
                      alt="Anteprima scontrino"
                      className="h-14 w-14 rounded-lg object-cover border border-slate-200"
                    />
                    <div className="text-xs">
                      <p className="font-medium text-slate-800">Foto scontrino allegata</p>
                      <p className="text-slate-500">
                        Visibile nel dettaglio della richiesta di rimborso
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptImageData(undefined)}
                    className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    Rimuovi foto
                  </button>
                </div>
              )}
            </div>

            {/* FORM DATI */}
            <form onSubmit={handleSaveMovement} className="space-y-4">
              {/* Socio Richiedente (modificabile liberamente da Giampiero Pilia 7796) */}
              <div>
                <label className="text-xs font-normal text-slate-600 flex items-center gap-1.5 mb-1">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Socio CD Richiedente / Versante</span>
                </label>
                {isSuperAdmin ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={requesterId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setRequesterId(id);
                        const found = profiles.find((p) => p.id === id);
                        if (found) setRequesterName(found.full_name);
                      }}
                      className={`h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                    >
                      <option value="">-- Seleziona da elenco CD o scrivi a fianco --</option>
                      {cdProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} (Tessera {p.member_number})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Nome e Cognome Socio"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      className={`h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                      required
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={requesterName}
                    disabled
                    className="w-full h-11 rounded-xl px-3.5 text-sm font-normal bg-slate-100 border border-slate-200 text-slate-700"
                  />
                )}
              </div>

              {/* Data Richiesta e Data Scontrino */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-normal text-slate-600 flex items-center gap-1.5 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Data Richiesta *</span>
                  </label>
                  <input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className={`w-full h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-normal text-slate-600 flex items-center gap-1.5 mb-1">
                    <Receipt className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Data Scontrino *</span>
                  </label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className={`w-full h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                    required
                  />
                </div>
              </div>

              {/* Importo (€) e N° Scontrino */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-normal text-slate-600 flex items-center gap-1.5 mb-1">
                    <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Importo (€) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Es. 24.50"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className={`w-full h-11 rounded-xl px-3.5 text-base font-medium tabular-nums ${inputClass}`}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-normal text-slate-600 flex items-center gap-1.5 mb-1">
                    <Receipt className="h-3.5 w-3.5 text-slate-400" />
                    <span>N° Scontrino / Documento (opzionale)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Es. 0142-0018"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className={`w-full h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                  />
                </div>
              </div>

              {/* Causale da Menu a Tendina */}
              <div>
                <label className="text-xs font-normal text-slate-600 flex items-center gap-1.5 mb-1">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  <span>Causale *</span>
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className={`w-full h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                  required
                >
                  <option value="">Seleziona una causale...</option>
                  {expenseCategories
                    .filter((c) => c.is_active)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  <option value="altro">Altro... (specifica manualmente)</option>
                </select>

                {selectedCategoryId === 'altro' && (
                  <input
                    type="text"
                    placeholder="Inserisci la causale personalizzata..."
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    className={`mt-2 w-full h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                    required
                  />
                )}
              </div>

              {/* Descrizione / Note */}
              <div>
                <label className="text-xs font-normal text-slate-600 flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>Descrizione / Note</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Dettagli sulla spesa sostenuta o sul versamento..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full rounded-xl p-3 text-sm font-normal ${inputClass}`}
                />
              </div>

              {/* Stato Operazione (riservato a Giampiero Pilia 7796) */}
              {isSuperAdmin && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5">
                  <label className="text-xs font-medium text-amber-900 block mb-1.5">
                    Stato Operazione (Controllo Amministratore 7796)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { key: 'inviato', label: 'In Attesa' },
                        { key: 'approvato', label: 'Approvato' },
                        { key: 'pagato', label: 'Pagato / Incassato' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setStatusInput(st.key)}
                        className={`rounded-xl py-2 text-xs font-normal border transition ${
                          statusInput === st.key
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 text-sm font-normal text-slate-700"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 text-sm font-normal text-white flex items-center gap-2 shadow-sm transition"
                >
                  <Check className="h-4 w-4" />
                  <span>
                    {editingMovementId
                      ? 'Salva Modifiche'
                      : entryType === 'spesa'
                      ? 'Invia Richiesta di Rimborso'
                      : 'Registra Versamento'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL DETTAGLIO E STAMPA RICEVUTA (identico a qufficio3.lovable.app)
         ===================================================================== */}
      {selectedMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-medium text-slate-900">
                  {selectedMovement.entry_type === 'entrata'
                    ? 'Dettaglio Versamento in Cassa'
                    : 'Dettaglio Richiesta di Rimborso'}
                </h2>
                <p className="text-xs font-normal text-slate-500">
                  Riepilogo operazione e modulo per la stampa con firme
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMovement(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <span className="text-xs text-slate-500 block">Tipo</span>
                <span className="font-medium text-slate-900">
                  {selectedMovement.entry_type === 'entrata'
                    ? 'Entrata / Versamento'
                    : 'Rimborso Spesa'}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <span className="text-xs text-slate-500 block">Stato</span>
                <div className="mt-0.5">{statusBadge(selectedMovement.status)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <span className="text-xs text-slate-500 block">Socio CD</span>
                <span className="font-medium text-slate-900">
                  {selectedMovement.requester_name}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <span className="text-xs text-slate-500 block">Causale</span>
                <span className="font-medium text-slate-900">
                  {selectedMovement.category_name}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <span className="text-xs text-slate-500 block">Data Richiesta</span>
                <span className="font-normal text-slate-800 tabular-nums">
                  {new Date(`${selectedMovement.request_date}T12:00:00`).toLocaleDateString(
                    'it-IT'
                  )}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <span className="text-xs text-slate-500 block">Data Scontrino</span>
                <span className="font-normal text-slate-800 tabular-nums">
                  {selectedMovement.receipt_date
                    ? new Date(`${selectedMovement.receipt_date}T12:00:00`).toLocaleDateString(
                        'it-IT'
                      )
                    : '—'}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <span className="text-xs text-slate-500 block">N° Scontrino</span>
                <span className="font-normal text-slate-800">
                  {selectedMovement.receipt_number || '—'}
                </span>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <span className="text-xs text-emerald-800 block">Importo</span>
                <span className="text-lg font-medium text-emerald-900 tabular-nums">
                  € {Number(selectedMovement.amount_requested).toFixed(2)}
                </span>
              </div>
            </div>

            {selectedMovement.description && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
                <span className="text-xs text-slate-500 block mb-0.5">Descrizione / Note</span>
                <p className="font-normal text-slate-800">{selectedMovement.description}</p>
              </div>
            )}

            {selectedMovement.receipt_image_data && (
              <div className="rounded-2xl border border-slate-200 p-3 bg-slate-50 space-y-2">
                <span className="text-xs font-normal text-slate-500 block">
                  Immagine Scontrino Scannerizzato:
                </span>
                <img
                  src={selectedMovement.receipt_image_data}
                  alt="Scontrino"
                  className="max-h-64 w-auto mx-auto rounded-xl border border-slate-200 object-contain"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handlePrintSingleReceipt(selectedMovement)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs sm:text-sm font-normal text-white shadow-sm transition"
              >
                <Printer className="h-4 w-4" />
                <span>Stampa Modulo con Firme</span>
              </button>

              <div className="flex items-center gap-2">
                {(isSuperAdmin ||
                  (selectedMovement.requester_id === currentUser?.id &&
                    selectedMovement.status === 'inviato')) && (
                  <button
                    type="button"
                    onClick={() => {
                      const mov = selectedMovement;
                      setSelectedMovement(null);
                      openEditForm(mov);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs sm:text-sm font-normal text-slate-700"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Modifica</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedMovement(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs sm:text-sm font-normal text-slate-600 hover:bg-slate-50"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL GESTIONE CAUSALI (Solo Giampiero Pilia 7796)
         ===================================================================== */}
      {showCategoriesModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-medium text-slate-900">
                  Gestione Causali Menu a Tendina
                </h2>
                <p className="text-xs font-normal text-slate-500">
                  Aggiungi o rimuovi le causali disponibili per i rimborsi e versamenti del CD
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoriesModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nuova causale (es. Acquisto toner)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={`flex-1 h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCatName.trim()) return;
                  addExpenseCategory(newCatName, newCatDesc);
                  setNewCatName('');
                  setNewCatDesc('');
                }}
                className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 text-xs sm:text-sm font-normal text-white flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Aggiungi
              </button>
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {expenseCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs font-normal text-slate-500">{cat.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteExpenseCategory(cat.id)}
                    className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                    title="Elimina causale"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL SALDO INIZIALE (Solo Giampiero Pilia 7796)
         ===================================================================== */}
      {showOpeningBalanceModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-medium text-slate-900">
                Saldo Iniziale Piccola Cassa
              </h2>
              <button
                type="button"
                onClick={() => setShowOpeningBalanceModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-normal text-slate-600 block mb-1">
                Fondo Cassa Iniziale Anno Accademico (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                className={`w-full h-11 rounded-xl px-3.5 text-base font-medium ${inputClass}`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOpeningBalanceModal(false)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-normal text-slate-600"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(String(openingBalanceInput).replace(',', '.'));
                  if (!isNaN(val)) {
                    setCashOpeningBalance(Math.round(val * 100) / 100);
                    showToast('✓ Saldo iniziale aggiornato.');
                  }
                  setShowOpeningBalanceModal(false);
                }}
                className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 text-sm font-normal text-white"
              >
                Salva Saldo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
