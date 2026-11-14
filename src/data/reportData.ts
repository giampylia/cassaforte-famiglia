import { exportOfficialPdf, ASSOCIATION_LOGO_URL } from '../utils/soundAndPdf';
import TEACHERS_RAW from './teachers_seed.json';
import { Excursion, ExcursionPayment, ExcursionAdjustment } from './lezioniCampoData';
import { CassaRecord } from '../context/AppContext';
import { Bilancio, BilancioConto } from './bilancioData';

// Caricamento dinamico di SheetJS per Excel nativo (.xlsx)
let xlsxPromise: Promise<any> | null = null;
export function loadSheetJS(): Promise<any> {
  if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = (err) => {
      xlsxPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return xlsxPromise;
}

// Helper per scaricare workbook
export async function downloadWorkbook(wb: any, fileName: string) {
  const XLSX = await loadSheetJS();
  XLSX.writeFile(wb, fileName);
}

// ----------------------------------------------------------------------------
// Modello Dati Docenti, Log Presenze & Buoni Benzina
// ----------------------------------------------------------------------------
export interface Teacher {
  id: string;
  matricola: string;
  first_name: string;
  last_name: string;
  contract: 'cococo' | 'piva' | 'b_benzina' | 'volontario' | 'occasionale';
  location: 'quartu' | 'soleminis' | 'plurisede';
  hourly_rate: number;
  net_rate?: number;
  time_type: 'pieno' | 'ridotto';
  is_active: boolean;
  hours_monday?: number;
  hours_tuesday?: number;
  hours_wednesday?: number;
  hours_thursday?: number;
  hours_friday?: number;
  hours_monday_soleminis?: number;
  hours_tuesday_soleminis?: number;
  hours_wednesday_soleminis?: number;
  hours_thursday_soleminis?: number;
  hours_friday_soleminis?: number;
}

export interface TeachingLog {
  id: string;
  teacher_id: string;
  log_date: string; // YYYY-MM-DD
  location: 'quartu' | 'soleminis';
  hours_worked: number;
  is_present: boolean;
}

export interface FuelVoucher {
  id: string;
  teaching_log_id: string;
  delivered: boolean;
  delivery_date: string | null;
}

export const CONTRACT_LABELS: Record<string, string> = {
  cococo: 'Co.Co.Co.',
  piva: 'P.IVA',
  b_benzina: 'B. Benzina',
  volontario: 'Volontario',
  occasionale: 'Occasionale',
};

export const LOCATION_LABELS: Record<string, string> = {
  quartu: 'Quartu',
  soleminis: 'Soleminis',
  plurisede: 'Plurisede',
};

export const TIME_TYPE_LABELS: Record<string, string> = {
  pieno: 'Tempo Pieno',
  ridotto: 'Tempo Ridotto',
};

// I 77 docenti clonati da QUfficio3
export const INITIAL_TEACHERS: Teacher[] = (TEACHERS_RAW as any[]) || [];

// Generatore log didattici per mese
export function generateTeachingLogsForMonth(
  teachers: Teacher[],
  yearMonth: string // "YYYY-MM"
): { logs: TeachingLog[]; vouchers: FuelVoucher[] } {
  const [yearStr, monthStr] = yearMonth.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const daysInMonth = new Date(y, m, 0).getDate();

  const logs: TeachingLog[] = [];
  const vouchers: FuelVoucher[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m - 1, day);
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = `${yearStr}-${String(monthStr).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    for (const t of teachers) {
      if (!t.is_active) continue;

      let qHours = 0;
      let sHours = 0;

      if (dayOfWeek === 1) {
        qHours = t.hours_monday || 0;
        sHours = t.hours_monday_soleminis || 0;
      } else if (dayOfWeek === 2) {
        qHours = t.hours_tuesday || 0;
        sHours = t.hours_tuesday_soleminis || 0;
      } else if (dayOfWeek === 3) {
        qHours = t.hours_wednesday || 0;
        sHours = t.hours_wednesday_soleminis || 0;
      } else if (dayOfWeek === 4) {
        qHours = t.hours_thursday || 0;
        sHours = t.hours_thursday_soleminis || 0;
      } else if (dayOfWeek === 5) {
        qHours = t.hours_friday || 0;
        sHours = t.hours_friday_soleminis || 0;
      }

      if (qHours > 0) {
        const logId = `log-${t.id}-${dateStr}-q`;
        logs.push({
          id: logId,
          teacher_id: t.id,
          log_date: dateStr,
          location: 'quartu',
          hours_worked: qHours,
          is_present: true,
        });

        if (t.contract === 'b_benzina') {
          // Consegna simulata se antecedente a oggi
          const isPast = d < new Date();
          vouchers.push({
            id: `vouch-${logId}`,
            teaching_log_id: logId,
            delivered: isPast,
            delivery_date: isPast ? dateStr : null,
          });
        }
      }

      if (sHours > 0) {
        const logId = `log-${t.id}-${dateStr}-s`;
        logs.push({
          id: logId,
          teacher_id: t.id,
          log_date: dateStr,
          location: 'soleminis',
          hours_worked: sHours,
          is_present: true,
        });

        if (t.contract === 'b_benzina') {
          const isPast = d < new Date();
          vouchers.push({
            id: `vouch-${logId}`,
            teaching_log_id: logId,
            delivered: isPast,
            delivery_date: isPast ? dateStr : null,
          });
        }
      }
    }
  }

  return { logs, vouchers };
}

// ----------------------------------------------------------------------------
// 1. REPORT REGISTRO CASSA
// ----------------------------------------------------------------------------
export function filterCassaRecordsForReport(
  records: CassaRecord[],
  periodo: string, // "tutti" | "YYYY-MM"
  stato: string // "tutti" | "approvato" | "in_attesa" | "rifiutato" | "bozza"
): CassaRecord[] {
  return records.filter((r) => {
    if (periodo !== 'tutti') {
      const recMonth = (r.data_movimento || r.created_at || '').slice(0, 7);
      if (recMonth !== periodo) return false;
    }
    if (stato !== 'tutti') {
      const recStato = (r.stato || 'approvato').toLowerCase();
      if (recStato !== stato.toLowerCase()) return false;
    }
    return true;
  });
}

export async function exportRegistroCassaXls(
  records: CassaRecord[],
  periodo: string,
  stato: string
) {
  const XLSX = await loadSheetJS();
  const filtered = filterCassaRecordsForReport(records, periodo, stato);

  const data = filtered.map((f) => ({
    'Data Scontrino': f.data_movimento ? new Date(f.data_movimento).toLocaleDateString('it-IT') : '',
    'N. Scontrino': f.numero_scontrino || '',
    Nome: f.richiedente_nominativo || 'Segreteria',
    Tipo: f.tipo === 'entrata' ? 'Entrata' : 'Spesa',
    Causale: f.causale || '',
    Importo: f.tipo === 'entrata' ? `+ ${f.importo.toFixed(2)}` : `- ${f.importo.toFixed(2)}`,
    'Importo Versato': f.importo_versato != null ? f.importo_versato.toFixed(2) : f.importo.toFixed(2),
    Stato: (f.stato || 'Approvato').charAt(0).toUpperCase() + (f.stato || 'approvato').slice(1),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 25 },
    { wch: 12 },
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registro Cassa');
  const d = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `registro_cassa_${periodo}_${d}.xlsx`);
}

export async function exportRegistroCassaPdf(
  records: CassaRecord[],
  periodo: string,
  stato: string
) {
  const filtered = filterCassaRecordsForReport(records, periodo, stato);
  const totEntrate = filtered
    .filter((r) => r.tipo === 'entrata')
    .reduce((sum, r) => sum + (r.importo || 0), 0);
  const totSpese = filtered
    .filter((r) => r.tipo === 'uscita')
    .reduce((sum, r) => sum + (r.importo || 0), 0);
  const saldo = totEntrate - totSpese;

  const subtitle = `Periodo: ${periodo === 'tutti' ? 'Tutti i periodi' : periodo} | Stato: ${stato} | Entrate: € ${totEntrate.toFixed(2)} — Spese: € ${totSpese.toFixed(2)} — Saldo: € ${saldo.toFixed(2)}`;

  await exportOfficialPdf({
    title: 'Registro Movimenti Piccola Cassa',
    subtitle,
    head: ['Data', 'N° Scontrino', 'Nominativo', 'Tipo', 'Causale', 'Importo (€)', 'Stato'],
    body: filtered.map((r) => [
      r.data_movimento ? new Date(r.data_movimento).toLocaleDateString('it-IT') : '',
      r.numero_scontrino || '-',
      r.richiedente_nominativo || 'Segreteria',
      r.tipo === 'entrata' ? 'Entrata' : 'Spesa',
      r.causale || '-',
      `${r.tipo === 'entrata' ? '+' : '-'} ${r.importo.toFixed(2)}`,
      (r.stato || 'Approvato').toUpperCase(),
    ]),
    fileName: `registro_cassa_${periodo}.pdf`,
    landscape: true,
  });
}

// ----------------------------------------------------------------------------
// 2. REPORT ANAGRAFICA DOCENTI
// ----------------------------------------------------------------------------
export async function exportAnagraficaDocentiXls(teachers: Teacher[]) {
  const XLSX = await loadSheetJS();
  const data = teachers
    .filter((t) => t.is_active)
    .sort((a, b) => a.last_name.localeCompare(b.last_name))
    .map((t) => ({
      Matricola: t.matricola,
      'Cognome Nome': `${t.last_name} ${t.first_name}`,
      Sede: LOCATION_LABELS[t.location] || t.location,
      Contratto: CONTRACT_LABELS[t.contract] || t.contract,
      Orario: TIME_TYPE_LABELS[t.time_type] || t.time_type,
      'Lordo (€/h)': t.hourly_rate || 0,
      'Netto (€/h)': t.net_rate || 0,
    }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 26 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Anagrafica Docenti');
  const d = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `anagrafica_docenti_${d}.xlsx`);
}

export async function exportAnagraficaDocentiPdf(teachers: Teacher[]) {
  const sorted = teachers
    .filter((t) => t.is_active)
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  await exportOfficialPdf({
    title: 'Anagrafica Ufficiale Docenti UTE',
    subtitle: `Totale Docenti Attivi: ${sorted.length}`,
    head: ['Matricola', 'Cognome e Nome', 'Sede', 'Contratto', 'Regime', 'Lordo (€/h)', 'Netto (€/h)'],
    body: sorted.map((t) => [
      t.matricola,
      `${t.last_name} ${t.first_name}`,
      LOCATION_LABELS[t.location] || t.location,
      CONTRACT_LABELS[t.contract] || t.contract,
      TIME_TYPE_LABELS[t.time_type] || t.time_type,
      `€ ${(t.hourly_rate || 0).toFixed(2)}`,
      `€ ${(t.net_rate || 0).toFixed(2)}`,
    ]),
    fileName: `anagrafica_docenti_${new Date().toISOString().split('T')[0]}.pdf`,
    landscape: false,
  });
}

// ----------------------------------------------------------------------------
// 3. REPORT PRESENZE DOCENTI (MATRICE 1..31)
// ----------------------------------------------------------------------------
export async function exportPresenzeDocentiXls(
  teachers: Teacher[],
  yearMonth: string,
  sede: string // "tutte" | "quartu" | "soleminis" | "plurisede"
) {
  const XLSX = await loadSheetJS();
  const { logs } = generateTeachingLogsForMonth(teachers, yearMonth);
  const [yStr, mStr] = yearMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const daysInMonth = new Date(y, m, 0).getDate();

  let targetTeachers = teachers.filter((t) => t.is_active);
  if (sede !== 'tutte') {
    targetTeachers = targetTeachers.filter((t) => t.location === sede || t.location === 'plurisede');
  }
  targetTeachers.sort((a, b) => a.last_name.localeCompare(b.last_name));

  const rows = targetTeachers.map((t) => {
    const row: Record<string, any> = {
      Matricola: t.matricola,
      'Cognome Nome': `${t.last_name} ${t.first_name}`,
    };
    let totHours = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yStr}-${String(mStr).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const teacherLogs = logs.filter(
        (l) => l.teacher_id === t.id && l.log_date === dateStr && (sede === 'tutte' || l.location === sede)
      );
      const dayHours = teacherLogs.reduce((acc, l) => acc + l.hours_worked, 0);
      row[String(day)] = dayHours > 0 ? dayHours : '';
      totHours += dayHours;
    }
    row['Totale Ore'] = totHours;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const cols = [{ wch: 12 }, { wch: 25 }];
  for (let d = 1; d <= daysInMonth; d++) {
    cols.push({ wch: 4 });
  }
  cols.push({ wch: 12 });
  ws['!cols'] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Presenze ${yearMonth}`);
  XLSX.writeFile(wb, `presenze_docenti_${yearMonth}_${sede}.xlsx`);
}

export async function exportPresenzeDocentiPdf(
  teachers: Teacher[],
  yearMonth: string,
  sede: string
) {
  const { logs } = generateTeachingLogsForMonth(teachers, yearMonth);
  let targetTeachers = teachers.filter((t) => t.is_active);
  if (sede !== 'tutte') {
    targetTeachers = targetTeachers.filter((t) => t.location === sede || t.location === 'plurisede');
  }
  targetTeachers.sort((a, b) => a.last_name.localeCompare(b.last_name));

  const body = targetTeachers.map((t) => {
    const teacherLogs = logs.filter(
      (l) => l.teacher_id === t.id && (sede === 'tutte' || l.location === sede)
    );
    const totHours = teacherLogs.reduce((acc, l) => acc + l.hours_worked, 0);
    const numLezioni = teacherLogs.length;
    return [
      t.matricola,
      `${t.last_name} ${t.first_name}`,
      LOCATION_LABELS[t.location] || t.location,
      CONTRACT_LABELS[t.contract] || t.contract,
      numLezioni,
      `${totHours} h`,
    ];
  });

  await exportOfficialPdf({
    title: `Registro Presenze Docenti — ${yearMonth}`,
    subtitle: `Sede: ${sede === 'tutte' ? 'Tutte le sedi' : LOCATION_LABELS[sede] || sede}`,
    head: ['Matricola', 'Cognome e Nome', 'Sede', 'Contratto', 'N° Lezioni Svolte', 'Totale Ore'],
    body,
    fileName: `presenze_docenti_${yearMonth}.pdf`,
    landscape: false,
  });
}

// ----------------------------------------------------------------------------
// 4. REPORT COMUNE DI SOLEMINIS
// ----------------------------------------------------------------------------
export function calculateSoleminisReportData(
  teachers: Teacher[],
  periodo: string // "tutti" | "YYYY-MM"
) {
  const targetTeachers = teachers.filter(
    (t) => t.is_active && (t.location === 'soleminis' || t.location === 'plurisede')
  );
  targetTeachers.sort((a, b) => a.last_name.localeCompare(b.last_name));

  // Raccoglie log se mese specifico, oppure per tutti i periodi
  const monthsToCheck = periodo !== 'tutti' ? [periodo] : ['2026-10', '2026-11', '2026-12'];

  let allLogs: TeachingLog[] = [];
  for (const m of monthsToCheck) {
    const { logs } = generateTeachingLogsForMonth(targetTeachers, m);
    allLogs = allLogs.concat(logs);
  }

  const rows = targetTeachers.map((t) => {
    const soleminisLogs = allLogs.filter(
      (l) => l.teacher_id === t.id && l.location === 'soleminis'
    );
    const hours = soleminisLogs.reduce((acc, l) => acc + l.hours_worked, 0);
    const lordoOra = t.hourly_rate || 0;
    const totLordo = Math.round(hours * lordoOra * 100) / 100;
    return {
      Matricola: t.matricola,
      'Cognome Nome': `${t.last_name} ${t.first_name}`,
      'Tipo Contratto': CONTRACT_LABELS[t.contract] || t.contract,
      'Ore Svolte': hours,
      'Lordo (€/h)': lordoOra,
      'Totale Lordo (€)': totLordo,
    };
  });

  const totOre = rows.reduce((acc, r) => acc + r['Ore Svolte'], 0);
  const totLordo = Math.round(rows.reduce((acc, r) => acc + r['Totale Lordo (€)'], 0) * 100) / 100;

  return { rows, totOre, totLordo };
}

export async function exportSoleminisXls(teachers: Teacher[], periodo: string) {
  const XLSX = await loadSheetJS();
  const { rows, totOre, totLordo } = calculateSoleminisReportData(teachers, periodo);

  const finalRows: any[] = [...rows];
  finalRows.push({
    Matricola: '',
    'Cognome Nome': 'TOTALE',
    'Tipo Contratto': '',
    'Ore Svolte': totOre,
    'Lordo (€/h)': '',
    'Totale Lordo (€)': totLordo,
  });

  const ws = XLSX.utils.json_to_sheet(finalRows);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comune Soleminis');
  const d = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `comune_soleminis_${d}.xlsx`);
}

export async function exportSoleminisPdf(teachers: Teacher[], periodo: string) {
  const { rows, totOre, totLordo } = calculateSoleminisReportData(teachers, periodo);

  const body: (string | number)[][] = rows.map((r) => [
    r.Matricola,
    r['Cognome Nome'],
    r['Tipo Contratto'],
    `${r['Ore Svolte']} h`,
    `€ ${Number(r['Lordo (€/h)']).toFixed(2)}`,
    `€ ${Number(r['Totale Lordo (€)']).toFixed(2)}`,
  ]);

  body.push(['', 'TOTALE GENERALE', '', `${totOre} h`, '', `€ ${totLordo.toFixed(2)}`]);

  await exportOfficialPdf({
    title: 'Report Rendicontazione Docenti — Comune di Soleminis',
    subtitle: `Periodo: ${periodo === 'tutti' ? 'Tutti i periodi' : periodo} — Totale Ore: ${totOre} h — Totale Compensi Lordi: € ${totLordo.toFixed(2)}`,
    head: ['Matricola', 'Cognome e Nome', 'Tipo Contratto', 'Ore Svolte', 'Lordo (€/h)', 'Totale Lordo (€)'],
    body,
    fileName: `comune_soleminis_${periodo}.pdf`,
    landscape: true,
  });
}

// ----------------------------------------------------------------------------
// 5. REPORT LEZIONI SUL CAMPO & ESCURSIONI
// ----------------------------------------------------------------------------
export async function exportLezioniCampoReportXls(
  excursions: Excursion[],
  payments: ExcursionPayment[]
) {
  const XLSX = await loadSheetJS();
  const wb = XLSX.utils.book_new();

  const types = [
    { key: 'lezione_sul_campo', title: 'Lezioni sul campo' },
    { key: 'visita_naturalistica', title: 'Visite naturalistiche' },
    { key: 'visita_della_domenica', title: 'Visite della domenica' },
  ];

  for (const t of types) {
    const list = excursions.filter((e) => e.excursion_type === t.key);
    if (list.length === 0) continue;

    const data = list.map((y) => {
      const pmts = payments.filter((p) => p.excursion_id === y.id);
      const totCosti = pmts.reduce((sum, p) => sum + (p.importo_pagato || 0), 0);
      const ricaviOrd = (y.num_participants || 0) * (y.quota || 0);
      const ricaviAuto = (y.num_participants_mezzi_propri || 0) * (y.quota_mezzi_propri || 0);
      const totRicavi = ricaviOrd + ricaviAuto;
      const saldo = totRicavi - totCosti;

      const pmtMap: Record<string, { preventivo: number; pagato: number }> = {};
      pmts.forEach((z) => {
        if (!pmtMap[z.category]) pmtMap[z.category] = { preventivo: 0, pagato: 0 };
        pmtMap[z.category].preventivo += z.totale_preventivo || 0;
        pmtMap[z.category].pagato += z.importo_pagato || 0;
      });

      return {
        Nome: y.name,
        Data: y.excursion_date ? new Date(y.excursion_date).toLocaleDateString('it-IT') : '',
        'Quota (€)': y.quota || 0,
        'N. Partecipanti': y.num_participants || 0,
        'Quota auto pr. (€)': y.quota_mezzi_propri || 0,
        'N. Part. auto pr.': y.num_participants_mezzi_propri || 0,
        Docente: y.docente || '',
        'Bus Prev. (€)': pmtMap.bus?.preventivo || 0,
        'Bus Pagato (€)': pmtMap.bus?.pagato || 0,
        'Ristorante Prev. (€)': pmtMap.ristorante?.preventivo || 0,
        'Ristorante Pagato (€)': pmtMap.ristorante?.pagato || 0,
        'Visite Prev. (€)': pmtMap.visite_lezioni?.preventivo || 0,
        'Visite Pagato (€)': pmtMap.visite_lezioni?.pagato || 0,
        'Hotel Prev. (€)': pmtMap.hotel?.preventivo || 0,
        'Hotel Pagato (€)': pmtMap.hotel?.pagato || 0,
        'Totale Costi (€)': totCosti,
        'Totale Ricavi (€)': totRicavi,
        'Saldo (€)': saldo,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, t.title);
  }

  const d = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `lezioni_sul_campo_${d}.xlsx`);
}

export async function exportLezioniCampoReportPdf(
  excursions: Excursion[],
  payments: ExcursionPayment[]
) {
  const body: (string | number)[][] = excursions.map((y, idx) => {
    const pmts = payments.filter((p) => p.excursion_id === y.id);
    const totCosti = pmts.reduce((sum, p) => sum + (p.importo_pagato || 0), 0);
    const ricaviOrd = (y.num_participants || 0) * (y.quota || 0);
    const ricaviAuto = (y.num_participants_mezzi_propri || 0) * (y.quota_mezzi_propri || 0);
    const totRicavi = ricaviOrd + ricaviAuto;
    const saldo = totRicavi - totCosti;

    return [
      idx + 1,
      y.name,
      y.excursion_date ? new Date(y.excursion_date).toLocaleDateString('it-IT') : '',
      y.docente || '-',
      (y.num_participants || 0) + (y.num_participants_mezzi_propri || 0),
      `€ ${totRicavi.toFixed(2)}`,
      `€ ${totCosti.toFixed(2)}`,
      `€ ${saldo.toFixed(2)}`,
    ];
  });

  const totRicaviAll = excursions.reduce(
    (acc, y) =>
      acc +
      (y.num_participants || 0) * (y.quota || 0) +
      (y.num_participants_mezzi_propri || 0) * (y.quota_mezzi_propri || 0),
    0
  );
  const totCostiAll = payments.reduce((acc, p) => acc + (p.importo_pagato || 0), 0);
  const saldoAll = totRicaviAll - totCostiAll;

  body.push(['', 'TOTALE GENERALE', '', '', '', `€ ${totRicaviAll.toFixed(2)}`, `€ ${totCostiAll.toFixed(2)}`, `€ ${saldoAll.toFixed(2)}`]);

  await exportOfficialPdf({
    title: 'Riepilogo Economico Lezioni sul Campo ed Escursioni',
    subtitle: `Totale Escursioni: ${excursions.length} · Ricavi Totali: € ${totRicaviAll.toFixed(2)} · Costi: € ${totCostiAll.toFixed(2)} · Saldo: € ${saldoAll.toFixed(2)}`,
    head: ['N°', 'Titolo Escursione', 'Data', 'Docente / Guida', 'Partecipanti', 'Ricavi Totali', 'Costi Totali', 'Saldo Netto'],
    body,
    fileName: `escursioni_report_${new Date().toISOString().split('T')[0]}.pdf`,
    landscape: true,
  });
}

// ----------------------------------------------------------------------------
// 6. REPORT BUONI BENZINA DOCENTI
// ----------------------------------------------------------------------------
export function calculateBuoniBenzinaData(teachers: Teacher[], yearMonth: string) {
  const benzinaTeachers = teachers.filter((t) => t.is_active && t.contract === 'b_benzina');
  benzinaTeachers.sort((a, b) => a.last_name.localeCompare(b.last_name));

  const { logs, vouchers } = generateTeachingLogsForMonth(benzinaTeachers, yearMonth);

  const summary = benzinaTeachers.map((t) => {
    const tLogs = logs.filter((l) => l.teacher_id === t.id && l.is_present && l.hours_worked > 0);
    const totBuoni = tLogs.length;
    const deliveredCount = tLogs.filter((l) => {
      const v = vouchers.find((vouch) => vouch.teaching_log_id === l.id);
      return v && v.delivered;
    }).length;

    return {
      Matricola: t.matricola,
      'Cognome Nome': `${t.last_name} ${t.first_name}`,
      Sede: LOCATION_LABELS[t.location] || t.location,
      'Totale Buoni': totBuoni,
      Consegnati: deliveredCount,
      'Da Consegnare': totBuoni - deliveredCount,
    };
  });

  const details: any[] = [];
  benzinaTeachers.forEach((t) => {
    const tLogs = logs.filter((l) => l.teacher_id === t.id && l.is_present && l.hours_worked > 0);
    tLogs.forEach((l) => {
      const v = vouchers.find((vouch) => vouch.teaching_log_id === l.id);
      details.push({
        Matricola: t.matricola,
        'Cognome Nome': `${t.last_name} ${t.first_name}`,
        Data: l.log_date,
        'Sede Lezione': LOCATION_LABELS[l.location] || l.location,
        Ore: l.hours_worked,
        Consegnato: v && v.delivered ? 'Sì' : 'No',
        'Data Consegna': v && v.delivery_date ? new Date(v.delivery_date).toLocaleDateString('it-IT') : '-',
      });
    });
  });

  return { summary, details };
}

export async function exportBuoniBenzinaXls(teachers: Teacher[], yearMonth: string) {
  const XLSX = await loadSheetJS();
  const { summary, details } = calculateBuoniBenzinaData(teachers, yearMonth);

  const totBuoni = summary.reduce((acc, r) => acc + r['Totale Buoni'], 0);
  const totCons = summary.reduce((acc, r) => acc + r.Consegnati, 0);

  const summaryRows = [...summary];
  summaryRows.push({
    Matricola: '',
    'Cognome Nome': 'TOTALE',
    Sede: '',
    'Totale Buoni': totBuoni,
    Consegnati: totCons,
    'Da Consegnare': totBuoni - totCons,
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];

  const wsDetails = XLSX.utils.json_to_sheet(details);
  wsDetails['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Riepilogo');
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Dettaglio');

  XLSX.writeFile(wb, `buoni_benzina_${yearMonth}.xlsx`);
}

export async function exportBuoniBenzinaPdf(teachers: Teacher[], yearMonth: string) {
  const { summary } = calculateBuoniBenzinaData(teachers, yearMonth);

  const totBuoni = summary.reduce((acc, r) => acc + r['Totale Buoni'], 0);
  const totCons = summary.reduce((acc, r) => acc + r.Consegnati, 0);

  const body: (string | number)[][] = summary.map((s) => [
    s.Matricola,
    s['Cognome Nome'],
    s.Sede,
    s['Totale Buoni'],
    s.Consegnati,
    s['Da Consegnare'],
  ]);

  body.push(['', 'TOTALE', '', totBuoni, totCons, totBuoni - totCons]);

  await exportOfficialPdf({
    title: 'Report Monitoraggio Buoni Benzina Docenti',
    subtitle: `Mese: ${yearMonth} · Totale Buoni Spettanti: ${totBuoni} · Consegnati: ${totCons} · Residui: ${totBuoni - totCons}`,
    head: ['Matricola', 'Cognome e Nome', 'Sede', 'Buoni Spettanti', 'Consegnati', 'Da Consegnare'],
    body,
    fileName: `buoni_benzina_${yearMonth}.pdf`,
    landscape: false,
  });
}

// ----------------------------------------------------------------------------
// 7. MODELLI MINISTERIALI BILANCI ETS (MODELLO A & MODELLO B)
// ----------------------------------------------------------------------------
export interface MinisterialItem {
  key: string;
  label: string;
  style: 'section' | 'subsection' | 'item' | 'total';
  indent: number;
  value: number;
}

// Calcolo ricorsivo totali anno precedente
export const MINISTERIAL_TREE: Record<string, { add?: string[]; sub?: string[] }> = {
  att_imm_immateriali: {
    add: ['att_costi_impianto', 'att_costi_sviluppo', 'att_brevetti', 'att_concessioni', 'att_avviamento', 'att_imm_corso_imm', 'att_altre_imm'],
  },
  att_imm_materiali: {
    add: ['att_terreni', 'att_impianti', 'att_attrezzature', 'att_altri_beni', 'att_imm_corso_mat'],
  },
  att_imm_finanziarie: {
    add: ['att_imp_controllate', 'att_imp_collegate', 'att_altre_imprese'],
  },
  att_immobilizzazioni: {
    add: ['att_imm_immateriali', 'att_imm_materiali', 'att_imm_finanziarie'],
  },
  att_crediti: {
    add: [
      'att_cred_utenti',
      'att_cred_associati',
      'att_cred_enti_pub',
      'att_cred_privati',
      'att_cred_rete',
      'att_cred_terzo',
      'att_cred_controllate',
      'att_cred_collegate',
      'att_cred_tributari',
      'att_cred_5mille',
      'att_cred_imposte',
      'att_cred_altri',
    ],
  },
  att_disp_liquide: {
    add: ['att_depositi', 'att_assegni', 'att_cassa'],
  },
  att_attivo_circ: {
    add: ['att_rimanenze', 'att_crediti', 'att_att_fin', 'att_disp_liquide'],
  },
  att_totale: {
    add: ['att_quote_assoc', 'att_immobilizzazioni', 'att_attivo_circ', 'att_ratei'],
  },
  pas_patr_libero: {
    add: ['pas_riserve_utili', 'pas_altre_riserve'],
  },
  pas_avanzo: {
    add: ['pas_risultato'],
  },
  pas_patrimonio: {
    add: ['pas_fondo_dotazione', 'pas_patr_vincolato', 'pas_patr_libero', 'pas_avanzo'],
  },
  pas_debiti: {
    add: [
      'pas_deb_banche',
      'pas_deb_finanziatori',
      'pas_deb_associati',
      'pas_deb_rete',
      'pas_deb_liberali',
      'pas_deb_acconti',
      'pas_deb_fornitori',
      'pas_deb_controllate',
      'pas_deb_tributari',
      'pas_deb_previdenza',
      'pas_deb_dipendenti',
      'pas_deb_altri',
    ],
  },
  pas_totale: {
    add: ['pas_patrimonio', 'pas_fondo_rischi', 'pas_tfr', 'pas_debiti', 'pas_ratei'],
  },
  mb_a_oneri_tot: {
    add: [
      'mb_a_materie',
      'mb_a_servizi',
      'mb_a_godimento',
      'mb_a_personale',
      'mb_a_ammortamenti',
      'mb_a_svalutazioni',
      'mb_a_accantonamenti',
      'mb_a_oneri_diversi',
    ],
  },
  mb_a_prov_tot: {
    add: [
      'mb_a_quote',
      'mb_a_progetti',
      'mb_a_prestazioni_soci',
      'mb_a_liberalita',
      'mb_a_cinque_mille',
      'mb_a_contributi_privati',
      'mb_a_prestazioni_terzi',
      'mb_a_contributi_enti',
      'mb_a_altri_proventi',
    ],
  },
  mb_a_risultato: {
    add: ['mb_a_prov_tot'],
    sub: ['mb_a_oneri_tot'],
  },
  mb_risultato_totale: {
    add: ['mb_a_risultato'],
  },
};

export function recalculateMinisterialTree(values: Record<string, number>): Record<string, number> {
  const t = { ...values };
  const keys = Object.keys(MINISTERIAL_TREE);
  for (let step = 0; step < 10; step++) {
    let changed = false;
    for (const k of keys) {
      const rule = MINISTERIAL_TREE[k];
      const addSum = (rule.add || []).reduce((sum, f) => sum + (t[f] || 0), 0);
      const subSum = (rule.sub || []).reduce((sum, f) => sum + (t[f] || 0), 0);
      const res = addSum - subSum;
      if ((t[k] || 0) !== res) {
        t[k] = res;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return t;
}

// Calcolo Modello A (Attivo e Passivo) e Modello B da conti analitici
export function computeModelloAAttivo(conti: BilancioConto[]): MinisterialItem[] {
  const getSum = (keys: string[]) =>
    conti
      .filter((c) => keys.includes(c.numero_conto))
      .reduce((acc, c) => acc + (c.totale_progressivo || 0), 0);

  const getAreaSum = (area: string, filterText?: string) =>
    conti
      .filter(
        (c) =>
          c.sezione === 'stato_patrimoniale' &&
          c.area === 'attivo' &&
          (!filterText || (c.nome_conto + ' ' + (c.sotto_area || '')).toLowerCase().includes(filterText))
      )
      .reduce((acc, c) => acc + (c.totale_progressivo || 0), 0);

  const impianti = getAreaSum('attivo', 'impianti');
  const attrezzature = getAreaSum('attivo', 'attrezzature') || getSum(['1222001.1', '1223001.1']);
  const altriBeni = getAreaSum('attivo', 'mobili') || getSum(['1233001.1']);
  const totImmMateriali = impianti + attrezzature + altriBeni;

  const creditiTrib = getAreaSum('attivo', 'tributar') || getSum(['1756000.1']);
  const creditiAltri = getAreaSum('attivo', 'crediti') || getSum(['1714000.2', '1721100.1', '1721200.1']);
  const totCrediti = creditiTrib + creditiAltri;

  const depositiBanca = getSum(['1801000.2', '1804000.2']) || getAreaSum('attivo', 'banca');
  const cassa = getAreaSum('attivo', 'cassa') || getSum(['1805000.1']);
  const totLiquidita = depositiBanca + cassa;

  const ratei = getAreaSum('attivo', 'ratei');
  const totAttivoCirc = totCrediti + totLiquidita;
  const totAttivo = totImmMateriali + totAttivoCirc + ratei;

  return [
    { key: 'att_quote_assoc', label: 'A) QUOTE ASSOCIATIVE ANCORA DOVUTE', style: 'section', indent: 0, value: 0 },
    { key: 'att_immobilizzazioni', label: 'B) IMMOBILIZZAZIONI', style: 'section', indent: 0, value: totImmMateriali },
    { key: 'att_imm_immateriali', label: 'I - Immobilizzazioni immateriali', style: 'subsection', indent: 1, value: 0 },
    { key: 'att_imm_materiali', label: 'II - Immobilizzazioni materiali', style: 'subsection', indent: 1, value: totImmMateriali },
    { key: 'att_impianti', label: '1) Impianti e macchinari', style: 'item', indent: 2, value: impianti },
    { key: 'att_attrezzature', label: '2) Attrezzature industriali e commerciali', style: 'item', indent: 2, value: attrezzature },
    { key: 'att_altri_beni', label: '3) Altri beni (arredi, computer)', style: 'item', indent: 2, value: altriBeni },
    { key: 'att_imm_finanziarie', label: 'III - Immobilizzazioni finanziarie', style: 'subsection', indent: 1, value: 0 },
    { key: 'att_attivo_circ', label: 'C) ATTIVO CIRCOLANTE', style: 'section', indent: 0, value: totAttivoCirc },
    { key: 'att_crediti', label: 'II - Crediti', style: 'subsection', indent: 1, value: totCrediti },
    { key: 'att_cred_tributari', label: '1) Crediti tributari', style: 'item', indent: 2, value: creditiTrib },
    { key: 'att_cred_altri', label: '2) Altri crediti', style: 'item', indent: 2, value: creditiAltri },
    { key: 'att_disp_liquide', label: 'IV - Disponibilità liquide', style: 'subsection', indent: 1, value: totLiquidita },
    { key: 'att_depositi', label: '1) Depositi bancari e postali', style: 'item', indent: 2, value: depositiBanca },
    { key: 'att_cassa', label: '2) Denaro e valori in cassa', style: 'item', indent: 2, value: cassa },
    { key: 'att_ratei', label: 'D) RATEI E RISCONTI ATTIVI', style: 'section', indent: 0, value: ratei },
    { key: 'att_totale', label: 'TOTALE ATTIVO (A+B+C+D)', style: 'total', indent: 0, value: totAttivo },
  ];
}

export function computeModelloAPassivo(conti: BilancioConto[]): MinisterialItem[] {
  const getSum = (keys: string[]) =>
    conti
      .filter((c) => keys.includes(c.numero_conto))
      .reduce((acc, c) => acc + (c.totale_progressivo || 0), 0);

  const getAreaSum = (area: string, filterText?: string) =>
    conti
      .filter(
        (c) =>
          c.sezione === 'stato_patrimoniale' &&
          c.area === 'passivo' &&
          (!filterText || (c.nome_conto + ' ' + (c.sotto_area || '')).toLowerCase().includes(filterText))
      )
      .reduce((acc, c) => acc + (c.totale_progressivo || 0), 0);

  const totRicavi = conti
    .filter((c) => c.sezione === 'conto_economico' && c.area === 'ricavi')
    .reduce((acc, c) => acc + (c.totale_progressivo || 0), 0);
  const totCosti = conti
    .filter((c) => c.sezione === 'conto_economico' && c.area === 'costi')
    .reduce((acc, c) => acc + (c.totale_progressivo || 0), 0);
  const avanzoEsercizio = totRicavi - totCosti;

  const fondoDotazione = Math.abs(getSum(['2068600.1'])) || 2582.28;
  const riserve = Math.abs(getSum(['2069000.1'])) || 0;
  const totPatrimonio = fondoDotazione + riserve + avanzoEsercizio;

  const tfr = Math.abs(getAreaSum('passivo', 'tfr')) || 0;
  const debBanche = Math.abs(getAreaSum('passivo', 'banc')) || 0;
  const debTributari = Math.abs(getAreaSum('passivo', 'tributar')) || getSum(['2862300.1', '2864000.1']);
  const debFornitori = Math.abs(getAreaSum('passivo', 'fornitor')) || getSum(['2801300.1', '2802100.1', '2802600.1']);
  const debAltri = Math.abs(getAreaSum('passivo', 'diversi')) || 0;
  const totDebiti = debBanche + debTributari + debFornitori + debAltri;

  const ratei = Math.abs(getAreaSum('passivo', 'ratei')) || 0;
  const totPassivo = totPatrimonio + tfr + totDebiti + ratei;

  return [
    { key: 'pas_patrimonio', label: 'A) PATRIMONIO NETTO', style: 'section', indent: 0, value: totPatrimonio },
    { key: 'pas_fondo_dotazione', label: 'I - Fondo di dotazione dell\'Ente', style: 'subsection', indent: 1, value: fondoDotazione },
    { key: 'pas_patr_vincolato', label: 'II - Patrimonio vincolato', style: 'subsection', indent: 1, value: 0 },
    { key: 'pas_patr_libero', label: 'III - Patrimonio libero', style: 'subsection', indent: 1, value: riserve },
    { key: 'pas_riserve_utili', label: '1) Riserve e avanzi statutari', style: 'item', indent: 2, value: riserve },
    { key: 'pas_avanzo', label: 'IV - Avanzo / Disavanzo di esercizio', style: 'subsection', indent: 1, value: avanzoEsercizio },
    { key: 'pas_risultato', label: 'Risultato dell\'esercizio corrente', style: 'item', indent: 2, value: avanzoEsercizio },
    { key: 'pas_fondo_rischi', label: 'B) FONDI PER RISCHI ED ONERI', style: 'section', indent: 0, value: 0 },
    { key: 'pas_tfr', label: 'C) TRATTAMENTO DI FINE RAPPORTO (TFR)', style: 'section', indent: 0, value: tfr },
    { key: 'pas_debiti', label: 'D) DEBITI', style: 'section', indent: 0, value: totDebiti },
    { key: 'pas_deb_banche', label: '1) Debiti verso banche e istituti', style: 'item', indent: 2, value: debBanche },
    { key: 'pas_deb_fornitori', label: '2) Debiti verso fornitori', style: 'item', indent: 2, value: debFornitori },
    { key: 'pas_deb_tributari', label: '3) Debiti tributari ed erariali', style: 'item', indent: 2, value: debTributari },
    { key: 'pas_deb_altri', label: '4) Altri debiti diversi', style: 'item', indent: 2, value: debAltri },
    { key: 'pas_ratei', label: 'E) RATEI E RISCONTI PASSIVI', style: 'section', indent: 0, value: ratei },
    { key: 'pas_totale', label: 'TOTALE PASSIVO E PATRIMONIO NETTO (A+B+C+D+E)', style: 'total', indent: 0, value: totPassivo },
  ];
}

export function computeModelloBRendiconto(conti: BilancioConto[]): MinisterialItem[] {
  const getCosti = (filterText: string) =>
    conti
      .filter(
        (c) =>
          c.sezione === 'conto_economico' &&
          c.area === 'costi' &&
          (c.nome_conto + ' ' + (c.sotto_area || '')).toLowerCase().includes(filterText)
      )
      .reduce((acc, c) => acc + (c.totale_progressivo || 0), 0);

  const getRicavi = (filterText: string) =>
    conti
      .filter(
        (c) =>
          c.sezione === 'conto_economico' &&
          c.area === 'ricavi' &&
          (c.nome_conto + ' ' + (c.sotto_area || '')).toLowerCase().includes(filterText)
      )
      .reduce((acc, c) => acc + (c.totale_progressivo || 0), 0);

  const oneriMaterie = getCosti('acquisto') || getCosti('cancelleria') || getCosti('materiale');
  const oneriServizi = getCosti('serviz') || getCosti('compensi') || getCosti('docenz');
  const oneriGodimento = getCosti('godimento') || getCosti('locazion') || getCosti('affitto');
  const oneriPersonale = getCosti('personale') || getCosti('stipend');
  const ammortamenti = getCosti('ammortament');
  const oneriDiversi = getCosti('oneri') || getCosti('imposte') || getCosti('bollette') || getCosti('banc');
  const totOneriA = oneriMaterie + oneriServizi + oneriGodimento + oneriPersonale + ammortamenti + oneriDiversi;

  const quoteAssociative = getRicavi('quote') || getRicavi('iscrizion');
  const contributiEnti = getRicavi('comun') || getRicavi('pubblic') || getRicavi('regione');
  const liberalita = getRicavi('liberal') || getRicavi('donazion');
  const cinqueMille = getRicavi('5 per mille') || getRicavi('cinque per mille');
  const proventiAttivita = getRicavi('prestazion') || getRicavi('corsi') || getRicavi('gite');
  const altriProventi = getRicavi('altri') || getRicavi('sopravvenienz');
  const totProventiA = quoteAssociative + contributiEnti + liberalita + cinqueMille + proventiAttivita + altriProventi;

  const risultatoA = totProventiA - totOneriA;

  return [
    { key: 'mb_a_title', label: 'A) ATTIVITÀ DI INTERESSE GENERALE', style: 'section', indent: 0, value: 0 },
    { key: 'mb_a_oneri_tot', label: '1. ONERI E COSTI DI INTERESSE GENERALE', style: 'subsection', indent: 1, value: totOneriA },
    { key: 'mb_a_materie', label: 'a) Materie prime, sussidiarie, di consumo e merci', style: 'item', indent: 2, value: oneriMaterie },
    { key: 'mb_a_servizi', label: 'b) Servizi (docenze, consulenze, assicurazioni)', style: 'item', indent: 2, value: oneriServizi },
    { key: 'mb_a_godimento', label: 'c) Godimento beni di terzi (locazione aule e sedi)', style: 'item', indent: 2, value: oneriGodimento },
    { key: 'mb_a_personale', label: 'd) Personale dipendente e collaboratori', style: 'item', indent: 2, value: oneriPersonale },
    { key: 'mb_a_ammortamenti', label: 'e) Ammortamenti beni materiali e immateriali', style: 'item', indent: 2, value: ammortamenti },
    { key: 'mb_a_oneri_diversi', label: 'f) Oneri diversi di gestione (utenze, spese bancarie)', style: 'item', indent: 2, value: oneriDiversi },
    { key: 'mb_a_prov_tot', label: '2. ENTRATE, RENDITE E PROVENTI', style: 'subsection', indent: 1, value: totProventiA },
    { key: 'mb_a_quote', label: 'a) Quote associative e apporti dei fondatori', style: 'item', indent: 2, value: quoteAssociative },
    { key: 'mb_a_prestazioni_soci', label: 'b) Contributi per attività e corsi svolti verso i soci', style: 'item', indent: 2, value: proventiAttivita },
    { key: 'mb_a_liberalita', label: 'c) Erogazioni liberali e donazioni', style: 'item', indent: 2, value: liberalita },
    { key: 'mb_a_cinque_mille', label: 'd) Proventi del 5 per mille', style: 'item', indent: 2, value: cinqueMille },
    { key: 'mb_a_contributi_enti', label: 'e) Contributi da enti pubblici (Comune di Quartu, Soleminis)', style: 'item', indent: 2, value: contributiEnti },
    { key: 'mb_a_altri_proventi', label: 'f) Altri proventi e sopravvenienze attive', style: 'item', indent: 2, value: altriProventi },
    { key: 'mb_a_risultato', label: 'RISULTATO ATTIVITÀ DI INTERESSE GENERALE (+/-)', style: 'total', indent: 1, value: risultatoA },
    { key: 'mb_risultato_totale', label: 'AVANZO / DISAVANZO D\'ESERCIZIO COMPLESSIVO (+/-)', style: 'total', indent: 0, value: risultatoA },
  ];
}

// Esportazione Excel dei Modelli Ministeriali
export async function exportModelliMinisterialiXls(
  bilancio: Bilancio,
  attivo: MinisterialItem[],
  passivo: MinisterialItem[],
  rendiconto: MinisterialItem[],
  prevYearValues: Record<string, number>
) {
  const XLSX = await loadSheetJS();
  const wb = XLSX.utils.book_new();

  const formatList = (items: MinisterialItem[]) =>
    items.map((it) => ({
      Voce: it.label,
      'Esercizio Corrente (€)': Math.round(it.value * 100) / 100,
      'Esercizio Precedente (€)': Math.round((prevYearValues[it.key] || 0) * 100) / 100,
    }));

  const wsA = XLSX.utils.json_to_sheet([...formatList(attivo), { Voce: '--- PASSIVO ---', 'Esercizio Corrente (€)': '', 'Esercizio Precedente (€)': '' }, ...formatList(passivo)]);
  wsA['!cols'] = [{ wch: 55 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsA, 'Modello A - Stato Patr.');

  const wsB = XLSX.utils.json_to_sheet(formatList(rendiconto));
  wsB['!cols'] = [{ wch: 55 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsB, 'Modello B - Rendiconto');

  XLSX.writeFile(wb, `Modelli_Ministeriali_${bilancio.esercizio.replace('/', '-')}.xlsx`);
}

// Esportazione PDF Modello A (Stato Patrimoniale)
export async function exportModelloAPdf(
  bilancio: Bilancio,
  attivo: MinisterialItem[],
  passivo: MinisterialItem[],
  prevYearValues: Record<string, number>
) {
  const body: (string | number)[][] = [];

  body.push(['--- SEZIONE ATTIVO ---', '', '']);
  attivo.forEach((it) => {
    body.push([
      it.label,
      `€ ${it.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `€ ${(prevYearValues[it.key] || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ]);
  });

  body.push(['--- SEZIONE PASSIVO E PATRIMONIO NETTO ---', '', '']);
  passivo.forEach((it) => {
    body.push([
      it.label,
      `€ ${it.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `€ ${(prevYearValues[it.key] || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ]);
  });

  await exportOfficialPdf({
    title: 'Modello A — Stato Patrimoniale Enti Terzo Settore',
    subtitle: `Esercizio: ${bilancio.esercizio} (Chiusura: 30/06/${bilancio.anno_fine}) · Confronto con Esercizio Precedente`,
    head: ['Descrizione Voce Ministeriale', `Esercizio ${bilancio.esercizio}`, `Esercizio Precedente`],
    body,
    fileName: `Modello_A_StatoPatrimoniale_${bilancio.esercizio.replace('/', '-')}.pdf`,
    landscape: false,
  });
}

// Esportazione PDF Modello B (Rendiconto Gestionale)
export async function exportModelloBPdf(
  bilancio: Bilancio,
  rendiconto: MinisterialItem[],
  prevYearValues: Record<string, number>
) {
  const body: (string | number)[][] = rendiconto.map((it) => [
    it.label,
    `€ ${it.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `€ ${(prevYearValues[it.key] || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  ]);

  await exportOfficialPdf({
    title: 'Modello B — Rendiconto Gestionale Enti Terzo Settore',
    subtitle: `Esercizio: ${bilancio.esercizio} (Chiusura: 30/06/${bilancio.anno_fine}) · Confronto con Esercizio Precedente`,
    head: ['Descrizione Voce Ministeriale', `Esercizio ${bilancio.esercizio}`, `Esercizio Precedente`],
    body,
    fileName: `Modello_B_RendicontoGestionale_${bilancio.esercizio.replace('/', '-')}.pdf`,
    landscape: false,
  });
}
