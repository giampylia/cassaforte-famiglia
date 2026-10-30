import React, { useState, useMemo, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Plus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  Check,
  X,
  FileDown,
  Users,
} from 'lucide-react';
import { useApp, ImportedMemberRow } from '../context/AppContext';
import { getMemberParts, Profile } from '../data/initialData';
import { exportCsv, exportOfficialPdf } from '../utils/soundAndPdf';

// Caricamento dinamico di SheetJS (xlsx) per leggere file .xlsx / .xls nativi di Excel
let xlsxPromise: Promise<any> | null = null;
function loadSheetJS(): Promise<any> {
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

type SortField = 'member_number' | 'first_name' | 'last_name' | 'sede' | 'role';

export const AnagraficaSociView: React.FC = () => {
  const {
    currentUser,
    profiles,
    isSuperAdmin,
    availableRoles,
    addCustomRole,
    toggleMemberCD,
    importMembersBatch,
    updateMember,
    deleteMember,
    deleteMembersBatch,
  } = useApp();

  // Sia Giampiero Pilia (7796) sia l'accesso Amministratore (000) possono gestire/eliminare soci in Anagrafica
  const canManageMembers = Boolean(isSuperAdmin || currentUser?.role === 'admin');

  // Selezione multipla soci per eliminazione rapida di gruppo
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Stato ordinamento (cliccabile su tutti i campi: Tessera, Nome, Cognome, Sede, Ruolo)
  const [sortField, setSortField] = useState<SortField>('member_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Ricerca e filtri
  const [searchQuery, setSearchQuery] = useState('');
  const [sedeFilter, setSedeFilter] = useState<'ALL' | 'Quartu' | 'Soleminis'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Form aggiunta singolo socio
  const [newTessera, setNewTessera] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newSede, setNewSede] = useState<'Quartu' | 'Soleminis'>('Quartu');
  const [newRole, setNewRole] = useState<string>('Socio');
  const [newCustomRole, setNewCustomRole] = useState('');

  // Stato Modifica riga socio
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<{
    member_number: string;
    first_name: string;
    last_name: string;
    sede: 'Quartu' | 'Soleminis';
    roleName: string;
  }>({
    member_number: '',
    first_name: '',
    last_name: '',
    sede: 'Quartu',
    roleName: 'Socio',
  });

  // Feedback importazione / operazioni
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Arricchisce ogni profilo con Nome, Cognome e Ruolo principale separati
  const enrichedProfiles = useMemo(() => {
    return profiles
      .filter((p) => p.member_number !== '000') // Nasconde l'account tecnico 000 dall'anagrafica soci
      .map((p) => {
        const parts = getMemberParts(p);
        return {
          ...p,
          parsedFirstName: parts.firstName,
          parsedLastName: parts.lastName,
          parsedRole: parts.primaryRole,
        };
      });
  }, [profiles]);

  // Filtro e Ordinamento per tutti i campi (Tessera, Nome, Cognome, Sede, Ruolo)
  const sortedMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = enrichedProfiles.filter((m) => {
      if (sedeFilter !== 'ALL' && m.sede !== sedeFilter) return false;
      if (roleFilter === 'ONLY_CD') {
        if (!m.is_cd && !m.roles?.includes('CD')) return false;
      } else if (roleFilter !== 'ALL') {
        const roles = m.roles && m.roles.length > 0 ? m.roles : ['Socio'];
        if (
          !roles.some((r) => r.toLowerCase() === roleFilter.toLowerCase()) &&
          m.parsedRole.toLowerCase() !== roleFilter.toLowerCase()
        ) {
          return false;
        }
      }
      if (!q) return true;
      return (
        m.member_number.toLowerCase().includes(q) ||
        m.parsedFirstName.toLowerCase().includes(q) ||
        m.parsedLastName.toLowerCase().includes(q) ||
        m.full_name.toLowerCase().includes(q) ||
        m.sede.toLowerCase().includes(q) ||
        m.parsedRole.toLowerCase().includes(q)
      );
    });

    const factor = sortDir === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sortField === 'member_number') {
        const na = parseInt(a.member_number.replace(/\D/g, ''), 10);
        const nb = parseInt(b.member_number.replace(/\D/g, ''), 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) {
          return (na - nb) * factor;
        }
        return a.member_number.localeCompare(b.member_number, 'it') * factor;
      }
      if (sortField === 'first_name') {
        return (
          a.parsedFirstName.localeCompare(b.parsedFirstName, 'it', {
            sensitivity: 'base',
          }) * factor
        );
      }
      if (sortField === 'last_name') {
        return (
          a.parsedLastName.localeCompare(b.parsedLastName, 'it', {
            sensitivity: 'base',
          }) * factor
        );
      }
      if (sortField === 'sede') {
        const cmp = a.sede.localeCompare(b.sede, 'it', { sensitivity: 'base' });
        if (cmp !== 0) return cmp * factor;
        return a.parsedLastName.localeCompare(b.parsedLastName, 'it');
      }
      if (sortField === 'role') {
        const cmp = a.parsedRole.localeCompare(b.parsedRole, 'it', {
          sensitivity: 'base',
        });
        if (cmp !== 0) return cmp * factor;
        return a.parsedLastName.localeCompare(b.parsedLastName, 'it');
      }
      return 0;
    });
  }, [enrichedProfiles, searchQuery, sedeFilter, roleFilter, sortField, sortDir]);

  // Aggiunta manuale di un singolo socio
  const handleAddSingleMember = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = newTessera.trim();
    const cleanFirst = newFirstName.trim();
    const cleanLast = newLastName.trim();

    if (!cleanNum || (!cleanFirst && !cleanLast)) {
      showNotice('error', 'Inserisci almeno il N° Tessera, il Nome e il Cognome.');
      return;
    }

    const res = importMembersBatch([
      {
        member_number: cleanNum,
        first_name: cleanFirst,
        last_name: cleanLast,
        sede: newSede,
        roleName: newRole || 'Socio',
      },
    ]);

    setNewTessera('');
    setNewFirstName('');
    setNewLastName('');
    showNotice(
      'success',
      res.added > 0
        ? `✓ Socio ${cleanFirst} ${cleanLast} (Tessera / Password: ${cleanNum}) aggiunto!`
        : `✓ Dati del socio Tessera ${cleanNum} aggiornati!`
    );
  };

  // Parser righe grezze provenienti da CSV o Excel
  const parseMatrixToMembers = (matrix: any[][]): ImportedMemberRow[] => {
    const cleanRows = matrix
      .map((r) => r.map((cell) => String(cell ?? '').trim()))
      .filter((r) => r.some((cell) => cell.length > 0));

    if (cleanRows.length === 0) return [];

    // Individua se la prima riga è un'intestazione (es. Tessera, Nome, Cognome, Sede, Ruolo)
    const firstRowLower = cleanRows[0].map((c) => c.toLowerCase());
    const hasHeader = firstRowLower.some(
      (c) =>
        c.includes('tessera') ||
        c.includes('codice') ||
        c.includes('nome') ||
        c.includes('cognome') ||
        c.includes('sede') ||
        c.includes('ruolo')
    );

    let idxTessera = 0;
    let idxNome = 1;
    let idxCognome = 2;
    let idxSede = 3;
    let idxRuolo = 4;

    if (hasHeader) {
      firstRowLower.forEach((col, idx) => {
        if (col.includes('tessera') || col.includes('codice') || col.includes('num') || col === 'id') {
          idxTessera = idx;
        } else if (col === 'nome' || col.includes('first')) {
          idxNome = idx;
        } else if (col.includes('cognome') || col.includes('last')) {
          idxCognome = idx;
        } else if (col.includes('sede') || col.includes('citt')) {
          idxSede = idx;
        } else if (col.includes('ruolo') || col.includes('carica') || col.includes('cd')) {
          idxRuolo = idx;
        }
      });
    }

    const dataRows = hasHeader ? cleanRows.slice(1) : cleanRows;

    const result: ImportedMemberRow[] = [];
    for (const r of dataRows) {
      const tessera = (r[idxTessera] || '').trim();
      if (!tessera) continue;

      let nome = (r[idxNome] || '').trim();
      let cognome = (r[idxCognome] || '').trim();

      // Se l'utente aveva messo Nome e Cognome insieme in una sola colonna
      if (nome && !cognome && nome.includes(' ')) {
        const parts = nome.split(/\s+/);
        cognome = parts[parts.length - 1];
        nome = parts.slice(0, -1).join(' ');
      }

      const rawSede = (r[idxSede] || 'Quartu').trim();
      const sede: 'Quartu' | 'Soleminis' = rawSede.toLowerCase().includes('soleminis')
        ? 'Soleminis'
        : 'Quartu';

      const ruolo = (r[idxRuolo] || 'Socio').trim() || 'Socio';

      result.push({
        member_number: tessera,
        first_name: nome,
        last_name: cognome,
        sede,
        roleName: ruolo,
      });
    }

    return result;
  };

  // Gestione caricamento file CSV o Excel (.csv, .xlsx, .xls)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (ext === 'csv' || ext === 'txt') {
        const text = await file.text();
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        // Rileva automaticamente il separatore (punto e virgola di Excel italiano, virgola o tab)
        const sample = lines[0] || '';
        const sep = sample.includes(';') ? ';' : sample.includes('\t') ? '\t' : ',';

        const matrix = lines.map((line) =>
          line.split(sep).map((cell) => cell.replace(/^["']|["']$/g, '').trim())
        );

        const parsedRows = parseMatrixToMembers(matrix);
        if (parsedRows.length === 0) {
          showNotice(
            'error',
            'Nessun socio valido trovato nel file CSV. Verifica che contenga le colonne: Tessera, Nome, Cognome, Sede, Ruolo.'
          );
        } else {
          const { added, updated } = importMembersBatch(parsedRows);
          showNotice(
            'success',
            `✓ Importazione completata: ${added} nuovi soci inseriti e ${updated} soci aggiornati! (La Tessera è la loro password di accesso).`
          );
        }
      } else {
        // File Excel (.xlsx / .xls)
        const XLSX = await loadSheetJS();
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        });

        const parsedRows = parseMatrixToMembers(matrix);
        if (parsedRows.length === 0) {
          showNotice(
            'error',
            'Nessun socio valido trovato nel foglio Excel. Verifica che le colonne siano: Tessera, Nome, Cognome, Sede, Ruolo.'
          );
        } else {
          const { added, updated } = importMembersBatch(parsedRows);
          showNotice(
            'success',
            `✓ Importazione Excel completata: ${added} nuovi soci inseriti e ${updated} soci aggiornati!`
          );
        }
      }
    } catch (err) {
      console.error('Errore importazione file:', err);
      showNotice(
        'error',
        'Impossibile leggere il file selezionato. Usa un file .csv o .xlsx con le colonne Tessera, Nome, Cognome, Sede, Ruolo.'
      );
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  // Scarica modello CSV/Excel pronto da compilare in Excel
  const handleDownloadTemplate = () => {
    exportCsv(
      'modello_importazione_soci_Q3.csv',
      ['Tessera', 'Nome', 'Cognome', 'Sede', 'Ruolo'],
      [
        ['115', 'Mario', 'Rossi', 'Quartu', 'Socio'],
        ['116', 'Anna', 'Bianchi', 'Quartu', 'CD'],
        ['117', 'Giuseppe', 'Verdi', 'Quartu', 'Didattica'],
        ['205', 'Lucia', 'Spiga', 'Soleminis', 'Socio'],
      ]
    );
  };

  // Esporta l'intera Anagrafica Soci ordinata in CSV (apribile con Excel)
  const handleExportAllCsv = () => {
    exportCsv(
      `anagrafica_soci_Q3_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Tessera', 'Nome', 'Cognome', 'Sede', 'Ruolo'],
      sortedMembers.map((m) => [
        m.member_number,
        m.parsedFirstName,
        m.parsedLastName,
        m.sede,
        m.parsedRole,
      ])
    );
  };

  // Esporta l'intera Anagrafica Soci in PDF ufficiale
  const handleExportAllPdf = () => {
    exportOfficialPdf({
      title: 'Anagrafica Ufficiale Soci QU3',
      subtitle: `Totale soci: ${sortedMembers.length} · Ordinati per: ${
        sortField === 'member_number'
          ? 'Tessera'
          : sortField === 'first_name'
          ? 'Nome'
          : sortField === 'last_name'
          ? 'Cognome'
          : sortField === 'sede'
          ? 'Sede'
          : 'Ruolo'
      }`,
      head: ['N° Tessera (Password)', 'Nome', 'Cognome', 'Sede', 'Ruolo'],
      body: sortedMembers.map((m) => [
        m.member_number,
        m.parsedFirstName,
        m.parsedLastName,
        m.sede,
        m.parsedRole,
      ]),
      fileName: `anagrafica_soci_Q3_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 inline ml-1" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-emerald-700 inline ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-emerald-700 inline ml-1" />
    );
  };

  const inputClass =
    'bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none';

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-3 py-3 sm:px-5 sm:py-5 pb-14 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Avviso di conferma / errore */}
        {feedbackMsg && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-normal flex items-center justify-between shadow-2xs ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="p-1 hover:opacity-75"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* BLOCCO 1: INTESTAZIONE + UPLOAD DA EXCEL / CSV */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-medium text-slate-900">
                  Anagrafica Soci ({sortedMembers.length})
                </h1>
                <p className="text-xs sm:text-sm font-normal text-slate-500">
                  Il numero di <strong>Tessera</strong> di ciascun socio è anche la sua password di accesso all'App
                </p>
              </div>
            </div>

            {/* Pulsanti Importazione Excel / CSV ed Esportazione */}
            <div className="flex flex-wrap items-center gap-2">
              {canManageMembers && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-xs transition"
                  >
                    <Upload className="h-4 w-4" />
                    <span>
                      {isImporting ? 'Caricamento...' : 'Carica Soci da Excel / CSV'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2.5 text-xs sm:text-sm font-normal text-emerald-900 transition"
                    title="Scarica un file di esempio pronto da compilare con Excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                    <span>Scarica Modello Excel/CSV</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleExportAllPdf}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2.5 text-xs sm:text-sm font-normal text-slate-700 transition"
              >
                <FileDown className="h-4 w-4 text-emerald-700" />
                <span>Stampa PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllCsv}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2.5 text-xs sm:text-sm font-normal text-slate-700 transition"
              >
                <FileDown className="h-4 w-4 text-slate-500" />
                <span>Esporta Excel/CSV</span>
              </button>
            </div>
          </div>

          {/* Nota formato file per l'amministratore */}
          {canManageMembers && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-normal text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <span>
                💡 <strong>Formato file Excel / CSV:</strong> 5 colonne nell'ordine{' '}
                <strong>Tessera</strong> (che sarà la password), <strong>Nome</strong>,{' '}
                <strong>Cognome</strong>, <strong>Sede</strong> (Quartu o Soleminis),{' '}
                <strong>Ruolo</strong> (Socio, CD, Didattica, Amministrativo, Viaggi).
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Nuovo ruolo (es. Biblioteca)"
                  value={newCustomRole}
                  onChange={(e) => setNewCustomRole(e.target.value)}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCustomRole.trim()) return;
                    addCustomRole(newCustomRole);
                    showNotice('success', `✓ Nuovo ruolo "${newCustomRole.trim()}" aggiunto!`);
                    setNewCustomRole('');
                  }}
                  className="h-8 rounded-lg bg-emerald-700 text-white px-2.5 text-xs font-normal"
                >
                  + Crea Ruolo
                </button>
              </div>
            </div>
          )}

          {/* Form inserimento rapido singolo socio */}
          {canManageMembers && (
            <form
              onSubmit={handleAddSingleMember}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100"
            >
              <input
                type="text"
                placeholder="Tessera / Password *"
                value={newTessera}
                onChange={(e) => setNewTessera(e.target.value)}
                className={`h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
              />
              <input
                type="text"
                placeholder="Nome *"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className={`h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
              />
              <input
                type="text"
                placeholder="Cognome *"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className={`h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
              />
              <select
                value={newSede}
                onChange={(e) => setNewSede(e.target.value as 'Quartu' | 'Soleminis')}
                className={`h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
              >
                <option value="Quartu">Sede: Quartu</option>
                <option value="Soleminis">Sede: Soleminis</option>
              </select>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className={`h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    Ruolo: {r}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <Plus className="h-4 w-4" />
                <span>Aggiungi Socio</span>
              </button>
            </form>
          )}
        </div>

        {/* BLOCCO 2: RICERCA, FILTRI E PULSANTI DI ORDINAMENTO RAPIDO */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca tessera, nome, cognome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-10 rounded-xl pl-10 pr-3 text-sm font-normal ${inputClass}`}
              />
            </div>

            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value as any)}
              className={`h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
            >
              <option value="ALL">Tutte le Sedi (Quartu + Soleminis)</option>
              <option value="Quartu">Solo Sede Quartu</option>
              <option value="Soleminis">Solo Sede Soleminis</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={`h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
            >
              <option value="ALL">Tutti i Ruoli</option>
              <option value="ONLY_CD">Solo Consiglio Direttivo (CD)</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  Ruolo: {r}
                </option>
              ))}
            </select>

            <select
              value={`${sortField}:${sortDir}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split(':') as [SortField, 'asc' | 'desc'];
                setSortField(f);
                setSortDir(d);
              }}
              className={`h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
            >
              <option value="member_number:asc">Ordina per: Tessera (Crescente)</option>
              <option value="member_number:desc">Ordina per: Tessera (Decrescente)</option>
              <option value="first_name:asc">Ordina per: Nome (A → Z)</option>
              <option value="first_name:desc">Ordina per: Nome (Z → A)</option>
              <option value="last_name:asc">Ordina per: Cognome (A → Z)</option>
              <option value="last_name:desc">Ordina per: Cognome (Z → A)</option>
              <option value="sede:asc">Ordina per: Sede (Quartu → Soleminis)</option>
              <option value="sede:desc">Ordina per: Sede (Soleminis → Quartu)</option>
              <option value="role:asc">Ordina per: Ruolo (A → Z)</option>
              <option value="role:desc">Ordina per: Ruolo (Z → A)</option>
            </select>
          </div>

          {/* BARRA SELEZIONE ED ELIMINAZIONE SOCI (Singola o Multipla) */}
          {canManageMembers && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>
                  Per eliminare soci: clicca su <strong>Elimina</strong> a destra della riga, oppure spunta le caselle a sinistra per eliminarne più d&apos;uno insieme.
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const count = selectedIds.length;
                        if (
                          window.confirm(
                            `Confermi l'eliminazione definitiva dei ${count} soci selezionati?`
                          )
                        ) {
                          deleteMembersBatch(selectedIds);
                          setSelectedIds([]);
                          showNotice('success', `✓ Eliminati ${count} soci dall'Anagrafica.`);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-3.5 py-2 text-xs font-medium text-white shadow-2xs transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Elimina Selezionati ({selectedIds.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-2 text-xs text-slate-600"
                    >
                      <span>Deseleziona</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TABELLA ANAGRAFICA SOCI CON INTESTAZIONI CLICCABILI PER ORDINARE */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-600 select-none">
                  {canManageMembers && (
                    <th className="p-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        title="Seleziona / Deseleziona tutti i soci visualizzati"
                        checked={
                          sortedMembers.filter((m) => m.member_number !== '7796').length > 0 &&
                          sortedMembers
                            .filter((m) => m.member_number !== '7796')
                            .every((m) => selectedIds.includes(m.id))
                        }
                        onChange={(e) => {
                          const deletableVisibleIds = sortedMembers
                            .filter((m) => m.member_number !== '7796')
                            .map((m) => m.id);
                          if (e.target.checked) {
                            setSelectedIds(
                              Array.from(new Set([...selectedIds, ...deletableVisibleIds]))
                            );
                          } else {
                            setSelectedIds((prev) =>
                              prev.filter((id) => !deletableVisibleIds.includes(id))
                            );
                          }
                        }}
                        className="h-4 w-4 accent-emerald-700 rounded cursor-pointer"
                      />
                    </th>
                  )}
                  <th
                    onClick={() => handleSortClick('member_number')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                  >
                    Tessera (Password) {renderSortIcon('member_number')}
                  </th>
                  <th
                    onClick={() => handleSortClick('first_name')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                  >
                    Nome {renderSortIcon('first_name')}
                  </th>
                  <th
                    onClick={() => handleSortClick('last_name')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                  >
                    Cognome {renderSortIcon('last_name')}
                  </th>
                  <th
                    onClick={() => handleSortClick('sede')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                  >
                    Sede {renderSortIcon('sede')}
                  </th>
                  <th
                    onClick={() => handleSortClick('role')}
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                  >
                    Ruolo {renderSortIcon('role')}
                  </th>
                  <th className="p-3.5 text-center whitespace-nowrap">CD (Sì/No)</th>
                  {canManageMembers && (
                    <th className="p-3.5 text-right whitespace-nowrap">Azioni</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((m) => {
                  const isEditing = editingId === m.id;
                  const isCd = Boolean(m.is_cd || m.roles?.includes('CD'));
                  const isSelected = selectedIds.includes(m.id);

                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-slate-100 last:border-0 transition ${
                        isSelected ? 'bg-rose-50/40' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          {canManageMembers && <td className="p-3" />}
                          <td className="p-3">
                            <input
                              value={editRow.member_number}
                              onChange={(e) =>
                                setEditRow({ ...editRow, member_number: e.target.value })
                              }
                              className={`h-9 w-24 rounded-lg px-2 text-sm ${inputClass}`}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={editRow.first_name}
                              onChange={(e) =>
                                setEditRow({ ...editRow, first_name: e.target.value })
                              }
                              className={`h-9 w-full rounded-lg px-2 text-sm ${inputClass}`}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={editRow.last_name}
                              onChange={(e) =>
                                setEditRow({ ...editRow, last_name: e.target.value })
                              }
                              className={`h-9 w-full rounded-lg px-2 text-sm ${inputClass}`}
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={editRow.sede}
                              onChange={(e) =>
                                setEditRow({
                                  ...editRow,
                                  sede: e.target.value as 'Quartu' | 'Soleminis',
                                })
                              }
                              className={`h-9 rounded-lg px-2 text-sm ${inputClass}`}
                            >
                              <option value="Quartu">Quartu</option>
                              <option value="Soleminis">Soleminis</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              value={editRow.roleName}
                              onChange={(e) =>
                                setEditRow({ ...editRow, roleName: e.target.value })
                              }
                              className={`h-9 rounded-lg px-2 text-sm ${inputClass}`}
                            >
                              {availableRoles.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-center">{isCd ? 'Sì' : 'No'}</td>
                          <td className="p-3 text-right whitespace-nowrap space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                const fullName =
                                  `${editRow.first_name.trim()} ${editRow.last_name.trim()}`.trim();
                                const nextIsCd =
                                  editRow.roleName === 'CD' ||
                                  editRow.roleName === 'Amministratore' ||
                                  isCd;
                                updateMember(m.id, {
                                  member_number: editRow.member_number.trim(),
                                  first_name: editRow.first_name.trim(),
                                  last_name: editRow.last_name.trim(),
                                  full_name: fullName,
                                  sede: editRow.sede,
                                  is_cd: nextIsCd,
                                  roles: [editRow.roleName],
                                });
                                setEditingId(null);
                                showNotice('success', '✓ Dati socio aggiornati.');
                              }}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs text-white"
                            >
                              <Check className="h-3.5 w-3.5" /> Salva
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center rounded-xl bg-slate-200 p-1.5 text-slate-700"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          {canManageMembers && (
                            <td className="p-3.5 text-center">
                              {m.member_number !== '7796' && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedIds((prev) => [...prev, m.id]);
                                    } else {
                                      setSelectedIds((prev) => prev.filter((id) => id !== m.id));
                                    }
                                  }}
                                  className="h-4 w-4 accent-rose-600 rounded cursor-pointer"
                                />
                              )}
                            </td>
                          )}
                          <td className="p-3.5 font-medium tabular-nums whitespace-nowrap">
                            <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-sm text-emerald-900">
                              {m.member_number}
                            </span>
                          </td>
                          <td className="p-3.5 text-sm sm:text-base font-normal text-slate-800">
                            {m.parsedFirstName}
                          </td>
                          <td className="p-3.5 text-sm sm:text-base font-medium text-slate-900">
                            {m.parsedLastName}
                          </td>
                          <td className="p-3.5 text-sm font-normal text-slate-600 whitespace-nowrap">
                            {m.sede}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {canManageMembers && m.member_number !== '7796' ? (
                              <select
                                value={m.parsedRole.split(',')[0].trim() || 'Socio'}
                                onChange={(e) => {
                                  const chosen = e.target.value;
                                  const nextIsCd = chosen === 'CD' || chosen === 'Amministratore';
                                  updateMember(m.id, {
                                    roles: [chosen],
                                    is_cd: nextIsCd,
                                  });
                                }}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 hover:border-emerald-500 focus:outline-none"
                              >
                                {availableRoles.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800">
                                {m.parsedRole}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {canManageMembers && m.member_number !== '7796' ? (
                              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isCd}
                                  onChange={(e) => toggleMemberCD(m.id, e.target.checked)}
                                  className="h-4 w-4 accent-emerald-700 rounded cursor-pointer"
                                />
                                <span
                                  className={`text-xs font-medium ${
                                    isCd ? 'text-emerald-800' : 'text-slate-400'
                                  }`}
                                >
                                  {isCd ? 'Sì' : 'No'}
                                </span>
                              </label>
                            ) : (
                              <span
                                className={`text-xs font-medium ${
                                  isCd ? 'text-emerald-800' : 'text-slate-400'
                                }`}
                              >
                                {isCd ? 'Sì' : 'No'}
                              </span>
                            )}
                          </td>
                          {canManageMembers && (
                            <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(m.id);
                                  setEditRow({
                                    member_number: m.member_number,
                                    first_name: m.parsedFirstName,
                                    last_name: m.parsedLastName,
                                    sede: m.sede,
                                    roleName: m.parsedRole.split(',')[0].trim() || 'Socio',
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                                title="Modifica socio"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Modifica</span>
                              </button>
                              {m.member_number !== '7796' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Vuoi eliminare il socio ${m.full_name} (Tessera ${m.member_number})?`
                                      )
                                    ) {
                                      deleteMember(m.id);
                                      setSelectedIds((prev) => prev.filter((id) => id !== m.id));
                                      showNotice(
                                        'success',
                                        `✓ Socio ${m.full_name} (Tessera ${m.member_number}) eliminato.`
                                      );
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                                  title="Elimina socio"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Elimina</span>
                                </button>
                              )}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
