import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen,
  Search,
  Upload,
  ArrowUpDown,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Download,
  BookMarked,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LibraryBook } from '../data/initialData';

// Caricamento dinamico di SheetJS (xlsx) per leggere file .xlsx / .xls nativi di Excel
let xlsxPromiseBiblio: Promise<any> | null = null;
function loadSheetJSBiblio(): Promise<any> {
  if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
  if (xlsxPromiseBiblio) return xlsxPromiseBiblio;
  xlsxPromiseBiblio = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = (err) => {
      xlsxPromiseBiblio = null;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return xlsxPromiseBiblio;
}

export const BibliotecaView: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    isCDMember,
    isSegreteriaMember,
    libraryBooks,
    addLibraryBook,
    updateLibraryBook,
    deleteLibraryBook,
    importLibraryBooksBatch,
  } = useApp();

  // Permessi di gestione (caricamento catalogo, aggiunta, eliminazione)
  const canManageLibrary =
    isSuperAdmin || isCDMember || isSegreteriaMember || currentUser?.role === 'admin';

  // Stato filtri e ricerca
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');

  // Stato ordinamento: per i 3 campi (Titolo, Autore, Genere letterario)
  const [sortField, setSortField] = useState<'title' | 'author' | 'genre'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Stato modale import file XLS / CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stato aggiunta / modifica libro singolo
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newCollocation, setNewCollocation] = useState('');
  const [newYear, setNewYear] = useState('');

  // Editing inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editCollocation, setEditCollocation] = useState('');

  // Elenco generi unici disponibili nel catalogo
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    libraryBooks.forEach((b) => {
      if (b.genre && b.genre.trim()) set.add(b.genre.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it-IT'));
  }, [libraryBooks]);

  // Elenco autori unici disponibili
  const availableAuthors = useMemo(() => {
    const set = new Set<string>();
    libraryBooks.forEach((b) => {
      if (b.author && b.author.trim()) set.add(b.author.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it-IT'));
  }, [libraryBooks]);

  // Gestione toggle ordinamento
  const toggleSort = (field: 'title' | 'author' | 'genre') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtraggio e Ordinamento combinati
  const filteredBooks = useMemo(() => {
    return libraryBooks
      .filter((book) => {
        // Filtro testuale (su Titolo, Autore, Genere letterario)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = book.title?.toLowerCase().includes(q);
          const matchAuthor = book.author?.toLowerCase().includes(q);
          const matchGenre = book.genre?.toLowerCase().includes(q);
          const matchCollocation = book.collocation?.toLowerCase().includes(q);
          if (!matchTitle && !matchAuthor && !matchGenre && !matchCollocation) return false;
        }

        // Filtro per genere letterario
        if (selectedGenre !== 'all' && book.genre !== selectedGenre) {
          return false;
        }

        // Filtro per autore
        if (selectedAuthor !== 'all' && book.author !== selectedAuthor) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const valA = (a[sortField] || '').toLowerCase();
        const valB = (b[sortField] || '').toLowerCase();
        const cmp = valA.localeCompare(valB, 'it-IT');
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [libraryBooks, searchQuery, selectedGenre, selectedAuthor, sortField, sortOrder]);

  // Gestione caricamento file XLS / CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setNotice(null);

    try {
      let rows: any[][] = [];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
          rows = lines.map((l) => {
            const cells: string[] = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < l.length; i++) {
              const c = l[i];
              if (c === '"') {
                if (inQuotes && l[i + 1] === '"') {
                  cur += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (c === delimiter && !inQuotes) {
                cells.push(cur.trim());
                cur = '';
              } else {
                cur += c;
              }
            }
            cells.push(cur.trim());
            return cells;
          });
        }
      } else {
        // File Excel .xlsx / .xls con SheetJS
        const XLSX = await loadSheetJSBiblio();
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      }

      if (rows.length < 2) {
        throw new Error('Il file non contiene righe di dati valide.');
      }

      // Riconoscimento intelligente intestazioni colonne
      let headerIdx = -1;
      let colTitle = -1;
      let colAuthor = -1;
      let colGenre = -1;
      let colColloc = -1;

      for (let r = 0; r < Math.min(5, rows.length); r++) {
        const rowStrings = (rows[r] || []).map((c) => String(c || '').toLowerCase().trim());
        const tIdx = rowStrings.findIndex((c) => c.includes('titol') || c.includes('libro') || c.includes('opera'));
        const aIdx = rowStrings.findIndex((c) => c.includes('autor') || c.includes('scrittor'));
        const gIdx = rowStrings.findIndex((c) => c.includes('gener') || c.includes('categor') || c.includes('materia'));
        const cIdx = rowStrings.findIndex((c) => c.includes('colloc') || c.includes('codic') || c.includes('scaffal') || c.includes('posiz'));

        if (tIdx !== -1 || aIdx !== -1 || gIdx !== -1) {
          headerIdx = r;
          colTitle = tIdx !== -1 ? tIdx : 0;
          colAuthor = aIdx !== -1 ? aIdx : 1;
          colGenre = gIdx !== -1 ? gIdx : 2;
          colColloc = cIdx;
          break;
        }
      }

      // Se non trovata intestazione esplicita, assume colonne 0: Titolo, 1: Autore, 2: Genere
      if (headerIdx === -1) {
        headerIdx = 0;
        colTitle = 0;
        colAuthor = 1;
        colGenre = 2;
      }

      const parsedBooks: Omit<LibraryBook, 'id'>[] = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const titleStr = String(row[colTitle] || '').trim();
        const authorStr = String(row[colAuthor] || '').trim();
        const genreStr = String(row[colGenre] || '').trim() || 'Narrativa';
        const collocStr = colColloc !== -1 ? String(row[colColloc] || '').trim() : '';

        if (!titleStr && !authorStr) continue;

        parsedBooks.push({
          title: titleStr || 'Titolo non specificato',
          author: authorStr || 'Autore sconosciuto',
          genre: genreStr,
          collocation: collocStr,
          available: true,
        });
      }

      if (parsedBooks.length === 0) {
        throw new Error('Nessun libro valido identificato nel file.');
      }

      const res = importLibraryBooksBatch(parsedBooks, importMode);
      setNotice({
        type: 'success',
        text: `✓ Operazione completata: ${res.count} volumi caricati con successo nel catalogo della biblioteca!`,
      });
      setShowImportModal(false);
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      setNotice({ type: 'error', text: `Errore durante l'importazione: ${err.message}` });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddSingleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Inserisci il titolo del libro.');
      return;
    }
    addLibraryBook({
      title: newTitle.trim(),
      author: newAuthor.trim() || 'Autore non specificato',
      genre: newGenre.trim() || 'Narrativa',
      collocation: newCollocation.trim(),
      year: newYear ? Number(newYear) : undefined,
      available: true,
    });
    setNewTitle('');
    setNewAuthor('');
    setNewGenre('');
    setNewCollocation('');
    setNewYear('');
    setShowAddModal(false);
    setNotice({ type: 'success', text: '✓ Nuovo libro inserito nel catalogo.' });
    setTimeout(() => setNotice(null), 3000);
  };

  const handleStartEdit = (b: LibraryBook) => {
    setEditingId(b.id);
    setEditTitle(b.title);
    setEditAuthor(b.author);
    setEditGenre(b.genre);
    setEditCollocation(b.collocation || '');
  };

  const handleSaveEdit = (id: string) => {
    updateLibraryBook(id, {
      title: editTitle.trim(),
      author: editAuthor.trim(),
      genre: editGenre.trim(),
      collocation: editCollocation.trim(),
    });
    setEditingId(null);
    setNotice({ type: 'success', text: '✓ Dati del libro aggiornati.' });
    setTimeout(() => setNotice(null), 3000);
  };

  // Esporta catalogo in CSV
  const handleExportCsv = () => {
    const headers = ['Titolo', 'Autore', 'Genere letterario', 'Collocazione'];
    const rows = libraryBooks.map((b) => [
      `"${(b.title || '').replace(/"/g, '""')}"`,
      `"${(b.author || '').replace(/"/g, '""')}"`,
      `"${(b.genre || '').replace(/"/g, '""')}"`,
      `"${(b.collocation || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogo_biblioteca_qu3_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {/* HEADER DELLA BIBLIOTECA */}
      <div className="rounded-3xl bg-gradient-to-br from-teal-900 via-emerald-800 to-emerald-950 text-white p-5 sm:p-7 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-200">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Catalogo Libri & Pubblicazioni</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
              Biblioteca Università Terza Età
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Consulta l&apos;archivio dei libri, romanzi storici, saggistica e opere della cultura sarda disponibili per i soci. Cerca e ordina per <strong>Titolo</strong>, <strong>Autore</strong> o <strong>Genere letterario</strong>.
            </p>
          </div>

          {canManageLibrary && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white text-emerald-950 hover:bg-emerald-50 px-4 py-2.5 text-xs sm:text-sm font-bold shadow-md transition active:scale-95 cursor-pointer"
              >
                <Upload className="h-4 w-4 text-emerald-700" />
                <span>Carica Catalogo XLS / CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600/80 hover:bg-emerald-600 border border-white/30 text-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Aggiungi Libro</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/30 text-white p-2.5 text-xs font-semibold transition cursor-pointer"
                title="Esporta catalogo CSV"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* CONTATORI CATALOGO */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/20 text-xs sm:text-sm">
          <div>
            <span className="text-emerald-200 block text-xs">Volumi a Catalogo</span>
            <strong className="text-lg text-white font-bold">{libraryBooks.length}</strong>
          </div>
          <div>
            <span className="text-emerald-200 block text-xs">Generi Letterari</span>
            <strong className="text-lg text-emerald-300 font-bold">{availableGenres.length}</strong>
          </div>
          <div>
            <span className="text-emerald-200 block text-xs">Autori Registrati</span>
            <strong className="text-lg text-white font-bold">{availableAuthors.length}</strong>
          </div>
          <div>
            <span className="text-emerald-200 block text-xs">Risultati Filtrati</span>
            <strong className="text-lg text-emerald-200 font-bold">{filteredBooks.length}</strong>
          </div>
        </div>
      </div>

      {/* NOTIFICHE OPERAZIONI */}
      {notice && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-4 text-sm font-medium border transition ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* BARRA RICERCA, FILTRI E ORDINAMENTO SUI 3 CAMPI */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Cerca testuale (su Titolo, Autore, Genere) */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per titolo, autore o genere..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro Genere Letterario */}
          <div className="md:col-span-4 relative">
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none font-medium"
            >
              <option value="all">Tutti i generi letterari ({libraryBooks.length})</option>
              {availableGenres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Autore */}
          <div className="md:col-span-3 relative">
            <select
              value={selectedAuthor}
              onChange={(e) => setSelectedAuthor(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none font-medium"
            >
              <option value="all">Tutti gli autori</option>
              {availableAuthors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PULSANTI ORDINAMENTO RAPIDO SUI 3 CAMPI */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <ArrowUpDown className="h-3.5 w-3.5 text-emerald-700" />
            <span className="font-semibold text-slate-700">Ordina catalogo per:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ordina per Titolo */}
            <button
              type="button"
              onClick={() => toggleSort('title')}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-medium transition cursor-pointer ${
                sortField === 'title'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Titolo</span>
              <span className="text-[10px] font-bold">
                {sortField === 'title' ? (sortOrder === 'asc' ? 'A→Z' : 'Z→A') : ''}
              </span>
            </button>

            {/* Ordina per Autore */}
            <button
              type="button"
              onClick={() => toggleSort('author')}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-medium transition cursor-pointer ${
                sortField === 'author'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Autore</span>
              <span className="text-[10px] font-bold">
                {sortField === 'author' ? (sortOrder === 'asc' ? 'A→Z' : 'Z→A') : ''}
              </span>
            </button>

            {/* Ordina per Genere */}
            <button
              type="button"
              onClick={() => toggleSort('genre')}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-medium transition cursor-pointer ${
                sortField === 'genre'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Genere letterario</span>
              <span className="text-[10px] font-bold">
                {sortField === 'genre' ? (sortOrder === 'asc' ? 'A→Z' : 'Z→A') : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* TABELLA / ELENCO DEI LIBRI */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {filteredBooks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <BookOpen className="mx-auto h-12 w-12 text-slate-300" />
            <p className="text-base font-semibold text-slate-700">Nessun volume trovato</p>
            <p className="text-xs text-slate-500">
              Nessun libro corrisponde ai filtri impostati. Prova a modificare la ricerca.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => toggleSort('title')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Titolo del Libro</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => toggleSort('author')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Autore</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => toggleSort('genre')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Genere Letterario</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="p-3.5 hidden sm:table-cell">Collocazione</th>
                  {canManageLibrary && <th className="p-3.5 text-right">Azioni</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBooks.map((book) => {
                  const isEditing = editingId === book.id;

                  return (
                    <tr
                      key={book.id}
                      className="hover:bg-slate-50/70 transition"
                    >
                      {isEditing ? (
                        /* RIGA MODIFICA INLINE */
                        <>
                          <td className="p-3">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-sm font-medium"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={editAuthor}
                              onChange={(e) => setEditAuthor(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-sm"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={editGenre}
                              onChange={(e) => setEditGenre(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-sm"
                            />
                          </td>
                          <td className="p-3 hidden sm:table-cell">
                            <input
                              type="text"
                              value={editCollocation}
                              onChange={(e) => setEditCollocation(e.target.value)}
                              placeholder="Scaffale / Codice"
                              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="p-3 text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(book.id)}
                              className="rounded-lg bg-emerald-700 text-white px-2.5 py-1 text-xs font-semibold"
                            >
                              <Check className="h-3.5 w-3.5 inline mr-1" /> Salva
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg bg-slate-200 text-slate-700 px-2.5 py-1 text-xs"
                            >
                              <X className="h-3.5 w-3.5 inline" />
                            </button>
                          </td>
                        </>
                      ) : (
                        /* RIGA NORMALE */
                        <>
                          <td className="p-3.5 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <BookMarked className="h-4 w-4 text-emerald-700 shrink-0" />
                              <span className="text-sm sm:text-base leading-snug">{book.title}</span>
                            </div>
                            {book.notes && (
                              <p className="text-[11px] text-slate-500 font-normal pl-6 mt-0.5">
                                {book.notes}
                              </p>
                            )}
                          </td>
                          <td className="p-3.5 text-sm font-medium text-slate-800">
                            {book.author}
                          </td>
                          <td className="p-3.5">
                            <span className="inline-block rounded-xl bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-semibold text-teal-900">
                              {book.genre || 'Generico'}
                            </span>
                          </td>
                          <td className="p-3.5 text-xs font-mono text-slate-600 hidden sm:table-cell">
                            {book.collocation ? (
                              <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">
                                {book.collocation}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          {canManageLibrary && (
                            <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(book)}
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                                title="Modifica volume"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Eliminare "${book.title}" dal catalogo?`)) {
                                    deleteLibraryBook(book.id);
                                  }
                                }}
                                className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                                title="Elimina libro"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
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
        )}
      </div>

      {/* MODALE CARICAMENTO FILE EXCEL / CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
                <h3 className="text-lg font-bold text-slate-900">
                  Carica Catalogo Libri XLS / CSV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <p>
                Puoi caricare un file Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) o un file <strong>.csv</strong> contenente l&apos;elenco dei libri della biblioteca.
              </p>
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3.5 text-xs text-emerald-900 space-y-1">
                <p className="font-bold">Colonne riconosciute automaticamente:</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                  <li><strong>Titolo</strong> (obbligatorio)</li>
                  <li><strong>Autore</strong> (obbligatorio)</li>
                  <li><strong>Genere letterario</strong> (es. Narrativa, Storia Sarda, Saggistica)</li>
                  <li><em>Collocazione</em> (opzionale: codice scaffale)</li>
                </ul>
              </div>

              {/* Modalità di importazione: aggiungi o sostituisci */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Modalità di caricamento
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={`flex items-center gap-2 rounded-xl border p-2.5 cursor-pointer transition ${
                      importMode === 'append'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="accent-emerald-700"
                    />
                    <span>Aggiungi al catalogo esistente</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 rounded-xl border p-2.5 cursor-pointer transition ${
                      importMode === 'replace'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-emerald-700"
                    />
                    <span>Sostituisci l&apos;intero catalogo</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Annulla
              </button>
              <label className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 text-xs font-bold shadow-md cursor-pointer transition active:scale-95">
                <Upload className="h-4 w-4" />
                <span>{isImporting ? 'Caricamento...' : 'Seleziona File XLS / CSV'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isImporting}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* MODALE AGGIUNTA MANUALE LIBRO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Nuovo Libro a Catalogo</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingleBook} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Titolo *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Es. Il giorno del giudizio"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Autore *
                </label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="Es. Salvatore Satta"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Genere Letterario
                  </label>
                  <input
                    type="text"
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    placeholder="Es. Narrativa Sarda"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Collocazione
                  </label>
                  <input
                    type="text"
                    value={newCollocation}
                    onChange={(e) => setNewCollocation(e.target.value)}
                    placeholder="Es. SARD-05"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 text-xs font-bold shadow-md"
                >
                  Inserisci nel Catalogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BibliotecaView;
