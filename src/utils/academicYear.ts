// Utility centralizzata per la gestione degli Anni Accademici dell'Università della Terza Età
// Regola ufficiale: ogni anno accademico inizia il 1° Luglio di un anno e termina il 30 Giugno dell'anno successivo.
// Es. le attività precedenti il 1° Luglio 2026 appartengono all'A.A. 2025/2026;
// dal 1° Luglio 2026 al 30 Giugno 2027 appartengono all'A.A. 2026/2027 in corso.

export function getAcademicYear(dateInput?: string | Date | null): string {
  if (!dateInput) {
    return getCurrentAcademicYear();
  }

  let year: number;
  let month: number;

  if (typeof dateInput === 'string') {
    const clean = dateInput.trim();
    if (!clean) return getCurrentAcademicYear();

    if (clean.includes('-')) {
      const parts = clean.split('T')[0].split('-').map(Number);
      year = parts[0];
      month = parts[1];
    } else if (clean.includes('/')) {
      // Supporto formato DD/MM/YYYY o MM/DD/YYYY
      const parts = clean.split('/').map(Number);
      if (parts[2] && parts[2] > 1900) {
        year = parts[2];
        month = parts[1];
      } else {
        const d = new Date(clean);
        year = d.getFullYear();
        month = d.getMonth() + 1;
      }
    } else {
      const d = new Date(clean);
      year = d.getFullYear();
      month = d.getMonth() + 1;
    }
  } else {
    year = dateInput.getFullYear();
    month = dateInput.getMonth() + 1;
  }

  if (isNaN(year) || isNaN(month)) {
    return getCurrentAcademicYear();
  }

  // Dal 1° Luglio (mese >= 7) fino a Dicembre: Anno YYYY / (YYYY + 1)
  // Da Gennaio a Giugno (mese <= 6): Anno (YYYY - 1) / YYYY
  if (month >= 7) {
    return `${year}/${year + 1}`;
  }
  return `${year - 1}/${year}`;
}

export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 7) {
    return `${year}/${year + 1}`;
  }
  return `${year - 1}/${year}`;
}

export function formatAcademicYear(yearStr: string): string {
  if (!yearStr) return 'A.A. -';
  if (yearStr.startsWith('A.A.')) return yearStr;
  return `A.A. ${yearStr}`;
}

export function getAcademicYearDateRange(yearStr: string): { start: string; end: string } {
  const parts = yearStr.replace('A.A.', '').trim().split('/');
  const startYear = Number(parts[0]) || 2026;
  const endYear = Number(parts[1]) || startYear + 1;
  return {
    start: `${startYear}-07-01`,
    end: `${endYear}-06-30`,
  };
}

export function isDateInAcademicYear(dateStr?: string | null, targetAcademicYear?: string): boolean {
  if (!dateStr || !targetAcademicYear) return false;
  return getAcademicYear(dateStr) === targetAcademicYear;
}

export function getAvailableAcademicYears(
  dates: (string | null | undefined)[],
  includeCurrent: boolean = true
): string[] {
  const set = new Set<string>();
  if (includeCurrent) {
    const cur = getCurrentAcademicYear();
    set.add(cur);
    // aggiungi anche anno precedente come default storico
    const startYear = Number(cur.split('/')[0]);
    if (!isNaN(startYear)) {
      set.add(`${startYear - 1}/${startYear}`);
    }
  }

  for (const d of dates) {
    if (d) {
      set.add(getAcademicYear(d));
    }
  }

  // Ordina in ordine decrescente (il più recente in alto)
  return Array.from(set).sort().reverse();
}
