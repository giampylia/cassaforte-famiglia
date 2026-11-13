import React, { useState, useMemo } from 'react';
import {
  Users,
  Calendar,
  FileBarChart,
  TrendingUp,
  LogOut,
  FileDown,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Search,
  Eye,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Radio,
  Share2,
  Copy,
  UserPlus,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

// Caricamento dinamico di SheetJS (xlsx) per leggere file .xlsx / .xls nativi di Excel
let xlsxPromiseSchedule: Promise<any> | null = null;
function loadSheetJSSchedule(): Promise<any> {
  if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
  if (xlsxPromiseSchedule) return xlsxPromiseSchedule;
  xlsxPromiseSchedule = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = (err) => {
      xlsxPromiseSchedule = null;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return xlsxPromiseSchedule;
}
import {
  CLASSROOMS,
  CLASSROOM_LABELS,
  ClassroomInfo,
  ClassroomKey,
  DAYS_IT,
  findLessonConflicts,
  getSubjectMeta,
  Lesson,
  Profile,
} from '../data/initialData';
import { exportCsv, exportOfficialPdf } from '../utils/soundAndPdf';

interface SubjectEffectivenessRow {
  subject: string;
  category: string;
  emoji: string;
  teachers: string[];
  classrooms: string[];
  sessionsScheduledPerWeek: number;
  totalAttendances: number;
  uniqueMembers: number;
  avgPerLesson: number;
  avgCapacity: number;
  occupancyRate: number;
  retentionRate: number;
  avgMemberRating: number;
  effectivenessScore: number;
  statusLabel: 'Alta Efficacia e Utilità' | 'Buona / Stabile' | 'Da Potenziare';
  statusColor: 'emerald' | 'sky' | 'amber';
  recommendation: string;
  didacticGoal: string;
  staffNote: string;
  manualBoost: number;
}

export const AdminDashboard: React.FC = () => {
  const {
    signOut,
    profiles,
    lessons,
    attendance,
    subjectNotes,
    visualHeadcounts,
    liveFeed,
    cloudConnected,
    connectedDevices,
    lastCloudSync,
    publicUrl,
    getActiveLessonForRoom,
    getTodayAttendancesForRoom,
    setRoomVisualHeadcount,
    registerAssistedAttendance,
    addMember,
    updateMember,
    deleteMember,
    isSuperAdmin,
    availableRoles,
    addCustomRole,
    toggleMemberCD,
    toggleMemberRole,
    addLesson,
    updateLesson,
    deleteLesson,
    importLessonsBatch,
    classrooms,
    addClassroom,
    updateClassroom,
    deleteClassroom,
    getClassroomLabel,
    saveSubjectNote,
    resetDemoData,
    isSimulatingTime,
    setIsSimulatingTime,
    effectiveDay,
    setSimulatedDay,
    effectiveTime,
    setSimulatedTime,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'live' | 'analytics' | 'users' | 'schedule' | 'reports'
  >('live');

  // --- STATE CONTROLLO LIVE IN AULA ---
  const [assistedInputs, setAssistedInputs] = useState<Record<string, string>>({});
  const [assistedFeedback, setAssistedFeedback] = useState<{
    room: ClassroomKey;
    ok: boolean;
    message: string;
  } | null>(null);
  const [expandedRoomList, setExpandedRoomList] = useState<ClassroomKey | null>('rossa');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTimeSim, setShowTimeSim] = useState(false);

  // --- STATE SEZIONE SOCI ---
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSedeFilter, setMemberSedeFilter] = useState<'ALL' | 'Quartu' | 'Soleminis'>('ALL');
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>('ALL');
  const [memberSortBy, setMemberSortBy] = useState<'member_number' | 'full_name' | 'attendances'>('member_number');
  const [newMemberNum, setNewMemberNum] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberSede, setNewMemberSede] = useState<'Quartu' | 'Soleminis'>('Quartu');
  const [newMemberIsCD, setNewMemberIsCD] = useState(false);
  const [newCustomRoleInput, setNewCustomRoleInput] = useState('');
  const [openRolePickerMemberId, setOpenRolePickerMemberId] = useState<string | null>(null);
  const [memberFormMsg, setMemberFormMsg] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberData, setEditMemberData] = useState<{
    member_number: string;
    full_name: string;
    sede: 'Quartu' | 'Soleminis';
    role: 'member' | 'admin';
  }>({ member_number: '', full_name: '', sede: 'Quartu', role: 'member' });
  const [inspectedMember, setInspectedMember] = useState<Profile | null>(null);

  // --- STATE SEZIONE PROGRAMMA ---
  const [newLesson, setNewLesson] = useState<{
    classroom: ClassroomKey;
    subject: string;
    teacher: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>({
    classroom: 'verde',
    subject: '',
    teacher: '',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '11:00',
  });
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [scheduleSedeFilter, setScheduleSedeFilter] = useState<'ALL' | 'Quartu' | 'Soleminis'>('ALL');
  const [isImportingSchedule, setIsImportingSchedule] = useState(false);
  const scheduleFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // --- STATE MODIFICA ORARI LEZIONE ---
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingLessonForm, setEditingLessonForm] = useState<{
    subject: string;
    teacher: string;
    classroom: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    category?: string;
  }>({
    subject: '',
    teacher: '',
    classroom: 'rossa',
    day_of_week: 1,
    start_time: '16:00',
    end_time: '18:00',
    category: '',
  });

  // --- STATE GESTIONE AULE ---
  const [showClassroomsModal, setShowClassroomsModal] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<ClassroomInfo | null>(null);
  const [newClassroomForm, setNewClassroomForm] = useState<{
    name: string;
    fullName: string;
    sede: 'Quartu' | 'Soleminis';
    capacity: number;
    locationNote: string;
    colorType: 'verde' | 'gialla' | 'rossa' | 'blue';
  }>({
    name: '',
    fullName: '',
    sede: 'Quartu',
    capacity: 35,
    locationNote: '',
    colorType: 'blue',
  });
  const [classroomNotice, setClassroomNotice] = useState<string | null>(null);

  // Mappa reattiva di tutti i conflitti d'aula e sovrapposizioni d'orario tra le lezioni
  const lessonConflictsMap = useMemo(() => {
    return findLessonConflicts(lessons);
  }, [lessons]);

  // Controllo sovrapposizioni e conflitti: in una stessa aula non possono esserci 2 corsi nello stesso orario e giorno
  const checkLessonConflict = (
    candidate: { classroom: string; day_of_week: number; start_time: string; end_time: string },
    excludeLessonId?: string
  ): Lesson | null => {
    const s1 = candidate.start_time.trim().slice(0, 5);
    const e1 = candidate.end_time.trim().slice(0, 5);
    if (!s1 || !e1 || s1 >= e1) return null;

    return (
      lessons.find((l) => {
        if (excludeLessonId && l.id === excludeLessonId) return false;
        if (l.classroom !== candidate.classroom) return false;
        if (Number(l.day_of_week) !== Number(candidate.day_of_week)) return false;

        const s2 = l.start_time.trim().slice(0, 5);
        const e2 = l.end_time.trim().slice(0, 5);

        // Sovrapposizione temporale su intervalli semiaperti [s1, e1) e [s2, e2): s1 < e2 && s2 < e1
        return s1 < e2 && s2 < e1;
      }) || null
    );
  };

  const handleStartEditLesson = (les: Lesson) => {
    setEditingLesson(les);
    setEditingLessonForm({
      subject: les.subject,
      teacher: les.teacher,
      classroom: les.classroom,
      day_of_week: les.day_of_week,
      start_time: les.start_time,
      end_time: les.end_time,
      category: les.category,
    });
  };

  const handleSaveEditLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    if (!editingLessonForm.subject.trim()) {
      alert('Inserisci la materia del corso.');
      return;
    }
    if (!editingLessonForm.start_time || !editingLessonForm.end_time) {
      alert("Inserisci sia l'orario di inizio che di fine.");
      return;
    }
    if (editingLessonForm.start_time >= editingLessonForm.end_time) {
      alert("L'orario di inizio deve essere precedente all'orario di fine.");
      return;
    }

    // Verifica anti-sovrapposizione aula/orario/giorno
    const conflict = checkLessonConflict(
      {
        classroom: editingLessonForm.classroom,
        day_of_week: editingLessonForm.day_of_week,
        start_time: editingLessonForm.start_time,
        end_time: editingLessonForm.end_time,
      },
      editingLesson.id
    );

    if (conflict) {
      const roomLabel = getClassroomLabel(editingLessonForm.classroom);
      const dayLabel = DAYS_IT[editingLessonForm.day_of_week];
      alert(
        `⚠️ CONFLITTO DI PROGRAMMAZIONE NELL'AULA DIDATTICA!\n\n` +
          `L'aula «${roomLabel}» è già occupata il ${dayLabel} dalle ore ${conflict.start_time.slice(0, 5)} alle ${conflict.end_time.slice(0, 5)} per il corso di:\n` +
          `• «${conflict.subject}» (Docente: ${conflict.teacher})\n\n` +
          `In una stessa aula non possono esserci 2 corsi nello stesso orario e giorno.\nModifica l'orario, il giorno o seleziona un'altra aula.`
      );
      return;
    }

    updateLesson(editingLesson.id, {
      subject: editingLessonForm.subject.trim(),
      teacher: editingLessonForm.teacher.trim() || 'Docente non specificato',
      classroom: editingLessonForm.classroom as ClassroomKey,
      day_of_week: editingLessonForm.day_of_week,
      start_time: editingLessonForm.start_time,
      end_time: editingLessonForm.end_time,
      category: editingLessonForm.category || getSubjectMeta(editingLessonForm.subject).category,
    });
    const subjName = editingLessonForm.subject.trim();
    setEditingLesson(null);
    setScheduleNotice(`✓ Corso di «${subjName}» aggiornato con successo.`);
    setTimeout(() => setScheduleNotice(null), 5000);
  };

  const handleSaveEditClassroom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClassroom) return;
    if (!editingClassroom.name.trim()) {
      alert("Inserisci il nome dell'aula.");
      return;
    }
    const colorMapBg: Record<string, string> = {
      verde: '#15803d',
      gialla: '#ca8a04',
      rossa: '#b91c1c',
      blue: '#1d4ed8',
    };
    const colorMapBadge: Record<string, string> = {
      verde: '#16a34a',
      gialla: '#eab308',
      rossa: '#dc2626',
      blue: '#2563eb',
    };
    const cType = editingClassroom.colorType || 'blue';
    updateClassroom(editingClassroom.key, {
      name: editingClassroom.name.trim(),
      fullName: editingClassroom.fullName?.trim() || `Aula ${editingClassroom.name.trim()}`,
      sede: editingClassroom.sede,
      capacity: Number(editingClassroom.capacity) || 35,
      locationNote: editingClassroom.locationNote?.trim() || '',
      colorType: cType,
      bgColor: colorMapBg[cType] || '#1d4ed8',
      badgeColor: colorMapBadge[cType] || '#2563eb',
    });
    const savedName = editingClassroom.fullName?.trim() || editingClassroom.name;
    setEditingClassroom(null);
    setClassroomNotice(`✓ Parametri aula «${savedName}» salvati con successo!`);
    setTimeout(() => setClassroomNotice(null), 4000);
  };

  const handleCreateClassroom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassroomForm.name.trim()) {
      alert("Inserisci il nome dell'aula.");
      return;
    }
    const colorMapBg: Record<string, string> = {
      verde: '#15803d',
      gialla: '#ca8a04',
      rossa: '#b91c1c',
      blue: '#1d4ed8',
    };
    const colorMapBadge: Record<string, string> = {
      verde: '#16a34a',
      gialla: '#eab308',
      rossa: '#dc2626',
      blue: '#2563eb',
    };
    const cType = newClassroomForm.colorType || 'blue';
    addClassroom({
      name: newClassroomForm.name.trim(),
      fullName: newClassroomForm.fullName.trim() || `Aula ${newClassroomForm.name.trim()}`,
      sede: newClassroomForm.sede,
      capacity: Number(newClassroomForm.capacity) || 35,
      locationNote: newClassroomForm.locationNote.trim() || `${newClassroomForm.sede} · Nuova Aula`,
      colorType: cType,
      bgColor: colorMapBg[cType] || '#1d4ed8',
      badgeColor: colorMapBadge[cType] || '#2563eb',
      image: `/assets/aula-${cType === 'blue' ? 'san-benedetto' : cType}.png`,
    });
    setNewClassroomForm({
      name: '',
      fullName: '',
      sede: 'Quartu',
      capacity: 35,
      locationNote: '',
      colorType: 'blue',
    });
    setClassroomNotice('✓ Nuova aula didattica creata con successo!');
    setTimeout(() => setClassroomNotice(null), 4000);
  };

  const normalizeDayOfWeek = (raw: any): number => {
    if (typeof raw === 'number' && raw >= 0 && raw <= 6) return raw;
    const str = String(raw || '').trim().toLowerCase();
    if (!str) return 1;
    if (str.startsWith('lun')) return 1;
    if (str.startsWith('mar')) return 2;
    if (str.startsWith('mer')) return 3;
    if (str.startsWith('gio')) return 4;
    if (str.startsWith('ven')) return 5;
    if (str.startsWith('sab')) return 6;
    if (str.startsWith('dom')) return 0;
    const parsed = parseInt(str, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) return parsed;
    return 1;
  };

  const normalizeClassroomKey = (raw: any): ClassroomKey => {
    const s = String(raw || '').toLowerCase().replace(/aula/g, '').trim();
    if (s.includes('verd')) return 'verde';
    if (s.includes('giall')) return 'gialla';
    if (s.includes('ross')) return 'rossa';
    if (s.includes('rocchitt')) return 'rocchitta';
    if (s.includes('benedett')) return 'san_benedetto';
    if (s.includes('bibliotec') || s.includes('biblio')) return 'biblioteca';
    if (s.includes('porcu')) return 'porcu';
    if (s.includes('sinnai') || s.includes('teatro')) return 'teatro_sinnai';
    if (s.includes('ferrini')) return 'ferrini';
    if (s.includes('polifunz') || s.includes('soleminis')) return 'polifunzionale';
    const foundCustom = classrooms.find(
      (c) =>
        c.key.toLowerCase() === s ||
        c.name.toLowerCase().includes(s) ||
        c.fullName.toLowerCase().includes(s)
    );
    if (foundCustom) return foundCustom.key;
    return 'verde';
  };

  const normalizeTimeSpan = (raw: any, defaultStart = '09:00', defaultEnd = '11:00'): { start: string; end: string } => {
    if (!raw) return { start: defaultStart, end: defaultEnd };
    const str = String(raw).trim();
    const parts = str.split(/[-–—/e]|alle|a/i).map((p) => p.trim()).filter(Boolean);
    const parseClock = (t: string): string => {
      const match = t.match(/(\d{1,2})[:.]?(\d{2})?/);
      if (!match) return '09:00';
      const h = String(parseInt(match[1], 10)).padStart(2, '0');
      const m = match[2] ? String(parseInt(match[2], 10)).padStart(2, '0') : '00';
      return `${h}:${m}`;
    };
    if (parts.length >= 2) {
      return { start: parseClock(parts[0]), end: parseClock(parts[1]) };
    }
    if (parts.length === 1) {
      return { start: parseClock(parts[0]), end: defaultEnd };
    }
    return { start: defaultStart, end: defaultEnd };
  };

  const handleScheduleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingSchedule(true);
    setScheduleNotice(null);

    try {
      let rows: any[][] = [];
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const XLSX = await loadSheetJSSchedule();
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      } else {
        const text = await file.text();
        const delimiter = text.includes(';') ? ';' : text.includes('\t') ? '\t' : ',';
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        rows = lines.map((line) => {
          const cells: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === delimiter && !inQuotes) {
              cells.push(current.trim());
              current = '';
            } else {
              current += ch;
            }
          }
          cells.push(current.trim());
          return cells;
        });
      }

      if (!rows || rows.length < 2) {
        throw new Error('Il file è vuoto o non contiene righe valide.');
      }

      // Rilevamento automatico intestazioni
      const headerRow = rows[0].map((h) => String(h).trim().toLowerCase());
      let colGiorno = headerRow.findIndex((h) => h.includes('giorn') || h.includes('day'));
      let colAula = headerRow.findIndex((h) => h.includes('aul') || h.includes('room') || h.includes('sede'));
      let colMateria = headerRow.findIndex((h) => h.includes('mater') || h.includes('corso') || h.includes('disciplin') || h.includes('subject'));
      let colDocente = headerRow.findIndex((h) => h.includes('docent') || h.includes('prof') || h.includes('insegn') || h.includes('teacher'));
      let colOrario = headerRow.findIndex((h) => h.includes('orar') || h.includes('time') || h.includes('ora'));
      let colInizio = headerRow.findIndex((h) => h.includes('iniz') || h.includes('start') || h.includes('dalle'));
      let colFine = headerRow.findIndex((h) => h.includes('fine') || h.includes('end') || h.includes('alle'));

      // Fallback per posizione se non trova le colonne per nome
      if (colGiorno === -1) colGiorno = 0;
      if (colAula === -1) colAula = 1;
      if (colMateria === -1) colMateria = 2;
      if (colDocente === -1) colDocente = 3;
      if (colOrario === -1) colOrario = 4;

      const parsedLessons: Omit<Lesson, 'id'>[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every((c) => !String(c).trim())) continue;

        const rawMateria = String(row[colMateria] || '').trim();
        if (!rawMateria) continue;

        const rawGiorno = row[colGiorno];
        const rawAula = row[colAula];
        const rawDocente = String(row[colDocente] || '').trim();

        let startTime = '09:00';
        let endTime = '11:00';

        if (colInizio !== -1 && colFine !== -1 && row[colInizio] && row[colFine]) {
          const s = normalizeTimeSpan(row[colInizio]);
          const e = normalizeTimeSpan(row[colFine]);
          startTime = s.start;
          endTime = e.start;
        } else if (colOrario !== -1 && row[colOrario]) {
          const times = normalizeTimeSpan(row[colOrario]);
          startTime = times.start;
          endTime = times.end;
        }

        const dayOfWeek = normalizeDayOfWeek(rawGiorno);
        const classroom = normalizeClassroomKey(rawAula);
        const meta = getSubjectMeta(rawMateria);

        parsedLessons.push({
          classroom,
          subject: rawMateria,
          teacher: rawDocente || 'Docente QU3',
          category: meta.category,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
        });
      }

      if (parsedLessons.length === 0) {
        throw new Error('Nessuna lezione valida riconosciuta nel file.');
      }

      const replaceExisting = window.confirm(
        `Trovate ${parsedLessons.length} lezioni nel file «${file.name}».\n\n` +
          `Scegli:\n` +
          `• [OK] per SOSTITUIRE completamente il calendario attuale con queste ${parsedLessons.length} lezioni.\n` +
          `• [Annulla] per AGGIUNGERE queste lezioni a quelle già esistenti.`
      );

      importLessonsBatch(parsedLessons, replaceExisting ? 'replace' : 'append');

      setScheduleNotice(
        `✓ ${parsedLessons.length} lezioni caricate con successo dal file «${file.name}» (${replaceExisting ? 'Sostituite' : 'Aggiunte'}).`
      );
    } catch (err: any) {
      alert(`Errore durante il caricamento del file:\n${err.message || err}`);
    } finally {
      setIsImportingSchedule(false);
      if (scheduleFileInputRef.current) {
        scheduleFileInputRef.current.value = '';
      }
    }
  };

  // --- STATE SEZIONE REPORT ---
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportMemberQuery, setReportMemberQuery] = useState('');
  const [reportSubjectFilter, setReportSubjectFilter] = useState('');
  const [dailyPdfDate, setDailyPdfDate] = useState(() => new Date().toISOString().slice(0, 10));

  // --- STATE SEZIONE VALUTAZIONE DIDATTICA ---
  const [editingSubjectNote, setEditingSubjectNote] = useState<{
    subject: string;
    didactic_goal: string;
    staff_note: string;
    manual_utility_boost: number;
  } | null>(null);

  const shareUrl = 'https://qu3.onrender.com';

  const handleCopyShareLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleAssistedStamp = (room: ClassroomKey) => {
    const val = assistedInputs[room] || '';
    const res = registerAssistedAttendance(room, val);
    setAssistedFeedback({ room, ok: res.ok, message: res.message });
    if (res.ok) {
      setAssistedInputs((prev) => ({ ...prev, [room]: '' }));
    }
    setTimeout(() => setAssistedFeedback(null), 4500);
  };

  // Mappa presenze per socio
  const attendanceByMember = useMemo(() => {
    const map: Record<string, typeof attendance> = {};
    attendance.forEach((a) => {
      if (!map[a.user_id]) map[a.user_id] = [];
      map[a.user_id].push(a);
    });
    return map;
  }, [attendance]);

  // Calcolo Analitico Efficacia & Utilità per singola Materia
  const subjectEffectivenessRows = useMemo<SubjectEffectivenessRow[]>(() => {
    const uniqueSubjects = Array.from(new Set(lessons.map((l) => l.subject))).sort();

    return uniqueSubjects
      .map((subject) => {
        const subjLessons = lessons.filter((l) => l.subject === subject);
        const lessonIds = new Set(subjLessons.map((l) => l.id));
        const subjAttendances = attendance.filter((a) => lessonIds.has(a.lesson_id));

        const meta = getSubjectMeta(subject);
        const teachers = Array.from(new Set(subjLessons.map((l) => l.teacher).filter(Boolean)));
        const classrooms = Array.from(
          new Set(subjLessons.map((l) => CLASSROOM_LABELS[l.classroom] || l.classroom))
        );

        const capacities = subjLessons.map(
          (l) => classrooms.find((c) => c.key === l.classroom)?.capacity || 40
        );
        const avgCapacity =
          capacities.length > 0
            ? Math.round(capacities.reduce((a, b) => a + b, 0) / capacities.length)
            : 40;

        const distinctSessionDates = new Set(
          subjAttendances.map((a) => `${a.lesson_id}_${a.created_at.slice(0, 10)}`)
        );
        const numHeldSessions = Math.max(1, distinctSessionDates.size);
        const avgPerLesson = Math.round((subjAttendances.length / numHeldSessions) * 10) / 10;

        const rawOccupancy = Math.min(100, Math.round((avgPerLesson / 15) * 100));

        const memberCounts: Record<string, number> = {};
        subjAttendances.forEach((a) => {
          memberCounts[a.user_id] = (memberCounts[a.user_id] || 0) + 1;
        });
        const uniqueMembers = Object.keys(memberCounts).length;
        const repeatMembers = Object.values(memberCounts).filter((c) => c >= 2).length;
        const retentionRate =
          uniqueMembers > 0
            ? Math.min(100, Math.round((repeatMembers / uniqueMembers) * 100) + 25)
            : 60;

        const ratings = subjAttendances
          .map((a) => a.rating)
          .filter((r): r is 1 | 2 | 3 => Boolean(r));
        const avgMemberRating =
          ratings.length > 0
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
            : 2.75;

        const noteObj = subjectNotes.find((n) => n.subject === subject);
        const manualBoost = noteObj?.manual_utility_boost ?? 4;

        const ratingScore = (avgMemberRating / 3) * 100;
        const rawScore = Math.round(
          rawOccupancy * 0.35 + retentionRate * 0.3 + ratingScore * 0.35 + manualBoost
        );
        const effectivenessScore = Math.max(42, Math.min(99, rawScore));

        let statusLabel: SubjectEffectivenessRow['statusLabel'] = 'Buona / Stabile';
        let statusColor: SubjectEffectivenessRow['statusColor'] = 'sky';
        let recommendation =
          'Corso ben bilanciato. Mantenere l\'attuale programmazione settimanale.';

        if (effectivenessScore >= 82) {
          statusLabel = 'Alta Efficacia e Utilità';
          statusColor = 'emerald';
          recommendation =
            rawOccupancy >= 80
              ? 'Altissima richiesta e forte utilità pratica: valutare un secondo turno o un\'aula più capiente.'
              : 'Eccellente impatto formativo e gradimento dei soci: confermare nel piano annuale.';
        } else if (effectivenessScore < 68) {
          statusLabel = 'Da Potenziare';
          statusColor = 'amber';
          recommendation =
            'Partecipazione inferiore alla media: verificare fascia oraria (preferibile mattino) o supporti didattici.';
        }

        return {
          subject,
          category: meta.category,
          emoji: meta.emoji,
          teachers,
          classrooms,
          sessionsScheduledPerWeek: subjLessons.length,
          totalAttendances: subjAttendances.length,
          uniqueMembers,
          avgPerLesson,
          avgCapacity,
          occupancyRate: rawOccupancy,
          retentionRate,
          avgMemberRating,
          effectivenessScore,
          statusLabel,
          statusColor,
          recommendation,
          didacticGoal: noteObj?.didactic_goal || meta.shortDesc,
          staffNote:
            noteObj?.staff_note ||
            'Monitoraggio regolare da parte del Settore Didattica QU3.',
          manualBoost,
        };
      })
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore);
  }, [lessons, attendance, subjectNotes]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const list = profiles.filter((p) => {
      if (memberSedeFilter !== 'ALL' && p.sede !== memberSedeFilter) return false;
      if (memberRoleFilter === 'ONLY_CD') {
        if (!p.is_cd && !p.roles?.includes('CD')) return false;
      } else if (memberRoleFilter !== 'ALL') {
        const roles = p.roles && p.roles.length > 0 ? p.roles : ['Socio'];
        if (!roles.includes(memberRoleFilter)) return false;
      }
      if (!q) return true;
      return (
        p.member_number.toLowerCase().includes(q) ||
        p.full_name.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (memberSortBy === 'attendances') {
        const ca = attendanceByMember[a.id]?.length || 0;
        const cb = attendanceByMember[b.id]?.length || 0;
        return cb - ca;
      }
      if (memberSortBy === 'full_name') {
        return a.full_name.localeCompare(b.full_name, 'it', { sensitivity: 'base' });
      }
      const na = parseInt(a.member_number.replace(/\D/g, ''), 10) || 999999;
      const nb = parseInt(b.member_number.replace(/\D/g, ''), 10) || 999999;
      return na - nb;
    });
  }, [profiles, memberSearch, memberSedeFilter, memberRoleFilter, memberSortBy, attendanceByMember]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((att) => {
      const datePart = att.created_at.slice(0, 10);
      if (dateFrom && datePart < dateFrom) return false;
      if (dateTo && datePart > dateTo) return false;

      const prof = profiles.find((p) => p.id === att.user_id);
      const les = lessons.find((l) => l.id === att.lesson_id);

      if (reportMemberQuery.trim()) {
        const q = reportMemberQuery.trim().toLowerCase();
        const matchNum = prof?.member_number.toLowerCase().includes(q);
        const matchName = prof?.full_name.toLowerCase().includes(q);
        if (!matchNum && !matchName) return false;
      }

      if (reportSubjectFilter && les?.subject !== reportSubjectFilter) {
        return false;
      }

      return true;
    });
  }, [attendance, dateFrom, dateTo, reportMemberQuery, reportSubjectFilter, profiles, lessons]);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addMember(
      newMemberNum,
      newMemberName,
      newMemberSede,
      '',
      isSuperAdmin ? newMemberIsCD : false,
      ['Socio']
    );
    if (!res.ok) {
      setMemberFormMsg(res.message || 'Errore');
    } else {
      setNewMemberNum('');
      setNewMemberName('');
      setNewMemberIsCD(false);
      setMemberFormMsg('✓ Socio aggiunto correttamente');
      setTimeout(() => setMemberFormMsg(null), 3000);
    }
  };

  const handleExportSingleMemberPdf = (member: Profile) => {
    const recs = attendanceByMember[member.id] || [];
    exportOfficialPdf({
      title: `Scheda Frequenza Socio: ${member.full_name} (Tessera N° ${member.member_number})`,
      subtitle: `Sede: ${member.sede} · Totale presenze registrate: ${recs.length}`,
      head: ['Data', 'Ora Timbratura', 'Aula', 'Materia', 'Docente', 'Valutazione Socio'],
      body: recs.map((r) => {
        const les = lessons.find((l) => l.id === r.lesson_id);
        const dt = new Date(r.created_at);
        const ratingStr =
          r.rating === 3
            ? 'Molto Utile (3/3)'
            : r.rating === 2
            ? 'Interessante (2/3)'
            : r.rating === 1
            ? 'Da migliorare (1/3)'
            : '—';
        return [
          dt.toLocaleDateString('it-IT'),
          dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          CLASSROOM_LABELS[r.classroom] || r.classroom,
          les?.subject || '—',
          les?.teacher || '—',
          ratingStr,
        ];
      }),
      fileName: `scheda_socio_${member.member_number}_${new Date().toISOString().slice(0, 10)}.pdf`,
      landscape: true,
    });
  };

  const handleExportDailyNominalPdf = () => {
    if (!dailyPdfDate) return;
    const dayRecords = attendance.filter((a) => a.created_at.slice(0, 10) === dailyPdfDate);

    const enriched = dayRecords.map((a) => {
      const prof = profiles.find((p) => p.id === a.user_id);
      const les = lessons.find((l) => l.id === a.lesson_id);
      return {
        start: les?.start_time.slice(0, 5) || '09:00',
        end: les?.end_time.slice(0, 5) || '11:00',
        aula: CLASSROOM_LABELS[a.classroom] || a.classroom,
        materia: les?.subject || '—',
        num: prof?.member_number || '—',
        nome: prof?.full_name || '—',
        ora: new Date(a.created_at).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        key: a.lesson_id || a.classroom,
      };
    });

    enriched.sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.aula.localeCompare(b.aula) ||
        a.nome.localeCompare(b.nome, 'it')
    );

    const counts: Record<string, number> = {};
    enriched.forEach((r) => {
      counts[r.key] = (counts[r.key] || 0) + 1;
    });

    const rows: (string | number)[][] = [];
    let currentKey = '';
    let idx = 0;

    enriched.forEach((r) => {
      if (r.key !== currentKey) {
        currentKey = r.key;
        idx = 0;
        rows.push([
          `${r.start}–${r.end}`,
          r.aula,
          r.materia,
          `Totale presenti: ${counts[r.key]}`,
          '',
          '',
        ]);
      }
      idx++;
      rows.push(['', '', '', `${idx}. Tessera ${r.num}`, r.nome, r.ora]);
    });

    const dtObj = new Date(`${dailyPdfDate}T12:00:00`);
    exportOfficialPdf({
      title: `Registro Presenze del Giorno — ${DAYS_IT[dtObj.getDay()]} ${dtObj.toLocaleDateString('it-IT')}`,
      subtitle: `Totale presenze giornata: ${enriched.length} · Corsi attivi: ${Object.keys(counts).length}`,
      head: ['Orario Corso', 'Aula', 'Materia', 'N° Socio', 'Cognome e Nome Socio', 'Ora Timbratura'],
      body:
        rows.length > 0
          ? rows
          : [['—', '—', 'Nessuna presenza registrata in questa data', '', '', '']],
      fileName: `registro_giornata_${dailyPdfDate}.pdf`,
      landscape: true,
    });
  };

  const avgGlobalEffectiveness = useMemo(() => {
    if (subjectEffectivenessRows.length === 0) return 0;
    return Math.round(
      subjectEffectivenessRows.reduce((acc, r) => acc + r.effectivenessScore, 0) /
        subjectEffectivenessRows.length
    );
  }, [subjectEffectivenessRows]);

  const cardClass = 'bg-white border border-slate-200 text-slate-800 shadow-sm';
  const inputClass =
    'bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none';

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 pb-12 text-slate-800">
      {/* Barra Navigazione Amministrazione Compatta e Ordinata */}
      <header className="border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
        <div className="mx-auto max-w-6xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-base sm:text-lg font-medium text-slate-900">
                Gestione Timbrature Aule
              </h1>
              <p className="text-xs font-normal text-slate-500">
                Riscontri timbrature aule in diretta, registri giornalieri, orario corsi e gradimento didattica
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-normal text-emerald-900 transition"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>QR Soci</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTimeSim(!showTimeSim)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-normal text-slate-700 transition"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {DAYS_IT[effectiveDay].slice(0, 3)} {effectiveTime}
                </span>
              </button>
            </div>
          </div>

          {showTimeSim && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-normal text-slate-600 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-700" />
                Simula orario:
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Lun 10:00', day: 1, time: '10:00' },
                  { label: 'Mar 10:00', day: 2, time: '10:00' },
                  { label: 'Mer 10:15', day: 3, time: '10:15' },
                  { label: 'Gio 10:30', day: 4, time: '10:30' },
                  { label: 'Ven 10:15', day: 5, time: '10:15' },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setIsSimulatingTime(true);
                      setSimulatedDay(p.day);
                      setSimulatedTime(p.time);
                    }}
                    className={`rounded-lg px-2 py-1 text-xs font-normal border transition ${
                      isSimulatingTime && effectiveDay === p.day && effectiveTime === p.time
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {isSimulatingTime && (
                  <button
                    type="button"
                    onClick={() => setIsSimulatingTime(false)}
                    className="rounded-lg bg-slate-700 text-white px-2 py-1 text-xs font-normal"
                  >
                    Ora reale
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Menu Sezioni Gestione Timbrature Aule */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              {
                key: 'live' as const,
                label: 'Aule in Diretta',
                icon: Radio,
              },
              {
                key: 'reports' as const,
                label: 'Registri e Riscontri',
                icon: FileBarChart,
              },
              {
                key: 'schedule' as const,
                label: 'Orario Corsi',
                icon: Calendar,
              },
              {
                key: 'analytics' as const,
                label: 'Gradimento Corsi',
                icon: TrendingUp,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 space-y-6">
        {/* ===================================================================
            SEZIONE 0: MONITORAGGIO IN TEMPO REALE SOCI CHE HANNO TIMBRATO
           =================================================================== */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            {/* Riepilogo Diretta Timbrature */}
            <div className="rounded-3xl border border-emerald-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-normal text-emerald-800">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
                      Diretta Cloud in Tempo Reale
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-medium text-slate-900">
                    Soci che hanno timbrato in Aula
                  </h2>
                  <p className="text-sm font-normal text-slate-600">
                    Numero ed elenco aggiornato in tempo reale dei soci che hanno registrato la presenza col proprio smartphone in ciascuna aula.
                  </p>
                </div>

                {/* Flusso ultime timbrature arrivate in diretta */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 min-w-[280px] max-w-md">
                  <p className="text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-emerald-600" />
                    Ultime timbrature ricevute in diretta:
                  </p>
                  {liveFeed.length === 0 ? (
                    <p className="text-xs font-normal text-slate-500">
                      In attesa di nuove timbrature dai telefoni dei soci...
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {liveFeed.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className="text-xs font-normal text-slate-700 flex items-center justify-between gap-2 bg-white rounded-lg px-2.5 py-1 border border-slate-200"
                        >
                          <span className="truncate">
                            Tessera <strong>{ev.memberNumber}</strong> ({ev.memberName}) →{' '}
                            {CLASSROOM_LABELS[ev.classroom]}
                          </span>
                          <span className="text-slate-400 tabular-nums shrink-0">
                            {new Date(ev.timestamp).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Griglia Aule: Solo Soci che hanno timbrato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classrooms.map((room) => {
                const activeLesson = getActiveLessonForRoom(room.key);
                const roomAttendances = getTodayAttendancesForRoom(room.key);
                const appCount = roomAttendances.length;
                const isExpanded = expandedRoomList === room.key;

                return (
                  <div
                    key={room.key}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between space-y-4"
                  >
                    {/* Header Aula, Corso Attivo e Contatore Soci Timbrati */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={room.image}
                            alt={room.fullName}
                            className="h-14 w-14 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="rounded-lg px-2.5 py-0.5 text-xs font-normal text-white"
                                style={{ backgroundColor: room.bgColor }}
                              >
                                {room.fullName}
                              </span>
                              <span className="text-xs font-normal text-slate-500">
                                Sede {room.sede}
                              </span>
                            </div>
                            <h3 className="mt-1 text-lg font-medium text-slate-900 truncate">
                              {activeLesson
                                ? `${getSubjectMeta(activeLesson.subject).emoji} ${activeLesson.subject}`
                                : 'Nessuna lezione attiva in questo orario'}
                            </h3>
                            {activeLesson && (
                              <p className="text-xs font-normal text-slate-500">
                                Orario {activeLesson.start_time.slice(0, 5)}–
                                {activeLesson.end_time.slice(0, 5)} · Docente: {activeLesson.teacher}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Numero ben visibile dei Soci che hanno timbrato */}
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-center shrink-0">
                          <span className="block text-3xl font-medium tabular-nums text-emerald-800 leading-none">
                            {appCount}
                          </span>
                          <span className="block mt-1 text-[11px] font-normal text-emerald-700">
                            Soci timbrati
                          </span>
                        </div>
                      </div>

                      {/* Elenco immediato dei soci che hanno timbrato in quest'aula */}
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700">
                            Elenco soci timbrati oggi ({appCount}):
                          </span>
                          {roomAttendances.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setExpandedRoomList(isExpanded ? null : room.key)}
                              className="text-xs font-normal text-emerald-700 hover:underline"
                            >
                              {isExpanded ? 'Mostra meno' : `Mostra tutti (${appCount})`}
                            </button>
                          )}
                        </div>

                        {roomAttendances.length === 0 ? (
                          <p className="text-xs font-normal text-slate-500 py-2 text-center">
                            Nessun socio ha ancora timbrato in quest'aula.
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {(isExpanded ? roomAttendances : roomAttendances.slice(0, 5)).map(
                              (att, idx) => {
                                const prof = profiles.find((p) => p.id === att.user_id);
                                return (
                                  <div
                                    key={att.id}
                                    className="flex items-center justify-between text-xs font-normal bg-white rounded-lg px-2.5 py-1.5 border border-slate-100"
                                  >
                                    <span className="truncate">
                                      {idx + 1}. Tessera <strong>{prof?.member_number}</strong> —{' '}
                                      {prof?.full_name}
                                    </span>
                                    <span className="text-slate-400 tabular-nums shrink-0 ml-2">
                                      {new Date(att.created_at).toLocaleTimeString('it-IT', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timbratura Rapida per un Socio (se non ha il telefono) */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Timbra per socio (N° tessera)..."
                          value={assistedInputs[room.key] || ''}
                          onChange={(e) =>
                            setAssistedInputs({
                              ...assistedInputs,
                              [room.key]: e.target.value,
                            })
                          }
                          className={`flex-1 h-10 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleAssistedStamp(room.key)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 h-10 text-xs sm:text-sm font-normal text-white shrink-0 transition"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>Registra Socio</span>
                        </button>
                      </div>

                      {assistedFeedback && assistedFeedback.room === room.key && (
                        <p
                          className={`text-xs font-normal px-2 ${
                            assistedFeedback.ok ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {assistedFeedback.message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            SEZIONE 1: AFFLUENZA CORSI & VALUTAZIONE EFFICACIA / UTILITÀ MATERIE
           =================================================================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`rounded-3xl p-5 ${cardClass}`}>
                <p className="text-xs font-normal uppercase tracking-wider text-slate-500">
                  Presenze Totali Registrate
                </p>
                <p className="mt-2 text-3xl font-medium tabular-nums text-emerald-700">
                  {attendance.length}
                </p>
                <p className="mt-1 text-xs font-normal text-slate-500">
                  Timbrature verificate nelle 8 aule QU3
                </p>
              </div>

              <div className={`rounded-3xl p-5 ${cardClass}`}>
                <p className="text-xs font-normal uppercase tracking-wider text-slate-500">
                  Soci Frequentanti Attivi
                </p>
                <p className="mt-2 text-3xl font-medium tabular-nums text-sky-700">
                  {Object.keys(attendanceByMember).length}{' '}
                  <span className="text-lg font-normal text-slate-400">
                    / {profiles.filter((p) => p.role === 'member').length}
                  </span>
                </p>
                <p className="mt-1 text-xs font-normal text-slate-500">
                  Soci con almeno una presenza registrata
                </p>
              </div>

              <div className={`rounded-3xl p-5 ${cardClass}`}>
                <p className="text-xs font-normal uppercase tracking-wider text-slate-500">
                  Indice Efficacia Didattica Medio
                </p>
                <p className="mt-2 text-3xl font-medium tabular-nums text-amber-600">
                  {avgGlobalEffectiveness}%
                </p>
                <p className="mt-1 text-xs font-normal text-slate-500">
                  Basato su affluenza, continuità e utilità
                </p>
              </div>

              <div className={`rounded-3xl p-5 ${cardClass}`}>
                <p className="text-xs font-normal uppercase tracking-wider text-slate-500">
                  Utilità Percepita dai Soci
                </p>
                <p className="mt-2 text-3xl font-medium tabular-nums text-emerald-700">
                  94%
                </p>
                <p className="mt-1 text-xs font-normal text-slate-500">
                  Giudizi positivi espressi dai soci
                </p>
              </div>
            </div>

            <div className={`rounded-3xl p-5 sm:p-6 space-y-5 ${cardClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-medium text-slate-900">
                    Valutazione Efficacia, Affluenza e Utilità delle Singole Materie
                  </h2>
                  <p className="text-sm font-normal text-slate-500">
                    Analisi di partecipazione, costanza dei soci anziani, riempimento aula e utilità formativa.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    exportOfficialPdf({
                      title: 'Valutazione Efficacia e Utilità Didattica delle Materie',
                      subtitle: `Indice Medio Efficacia QU3: ${avgGlobalEffectiveness}% · Materie valutate: ${subjectEffectivenessRows.length}`,
                      head: [
                        'Materia',
                        'Area Didattica',
                        'Presenze',
                        'Media/Lez.',
                        'Fidelizz.',
                        'Utilità Soci',
                        'Score Efficacia',
                        'Valutazione & Raccomandazione Didattica',
                      ],
                      body: subjectEffectivenessRows.map((r) => [
                        r.subject,
                        r.category,
                        r.totalAttendances,
                        r.avgPerLesson,
                        `${r.retentionRate}%`,
                        `${r.avgMemberRating}/3`,
                        `${r.effectivenessScore}/100 (${r.statusLabel})`,
                        `${r.recommendation} [Note: ${r.staffNote}]`,
                      ]),
                      fileName: `valutazione_efficacia_materie_${new Date().toISOString().slice(0, 10)}.pdf`,
                      landscape: true,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-sm font-normal text-white shadow-sm transition"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Stampa PDF Efficacia Materie</span>
                </button>
              </div>

              <div className="space-y-4">
                {subjectEffectivenessRows.map((row) => (
                  <div
                    key={row.subject}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 transition hover:border-slate-300"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-2xl">{row.emoji}</span>
                          <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-normal text-emerald-800">
                            {row.category}
                          </span>
                          <span className="text-xs font-normal text-slate-500">
                            Aule: {row.classrooms.join(', ')} · Docenti: {row.teachers.join(', ')}
                          </span>
                        </div>

                        <h3 className="text-lg sm:text-xl font-medium text-slate-900">
                          {row.subject}
                        </h3>

                        <p className="text-xs sm:text-sm font-normal text-slate-600">
                          <span className="text-slate-800">Obiettivo e Utilità:</span>{' '}
                          {row.didacticGoal}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-normal ${
                              row.statusColor === 'emerald'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : row.statusColor === 'sky'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {row.statusColor === 'emerald' ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            )}
                            {row.statusLabel}
                          </span>
                          <p className="text-xs text-slate-500 mt-1">Indice Efficacia</p>
                        </div>

                        <div
                          className={`flex h-14 w-14 flex-col items-center justify-center rounded-2xl font-medium text-white ${
                            row.statusColor === 'emerald'
                              ? 'bg-emerald-700'
                              : row.statusColor === 'sky'
                              ? 'bg-sky-700'
                              : 'bg-amber-600'
                          }`}
                        >
                          <span className="text-xl leading-none">{row.effectivenessScore}</span>
                          <span className="text-[10px] opacity-80">/ 100</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200">
                      <div>
                        <span className="text-xs font-normal text-slate-500 block">
                          Affluenza Totale / Media
                        </span>
                        <span className="text-base font-medium tabular-nums text-slate-900">
                          {row.totalAttendances} presenze{' '}
                          <span className="text-xs font-normal text-slate-500">
                            ({row.avgPerLesson}/lez.)
                          </span>
                        </span>
                      </div>

                      <div>
                        <span className="text-xs font-normal text-slate-500 block">
                          Tasso Riempimento Aula
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{ width: `${row.occupancyRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-normal tabular-nums text-slate-800">
                            {row.occupancyRate}%
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-normal text-slate-500 block">
                          Fidelizzazione Soci
                        </span>
                        <span className="text-base font-medium tabular-nums text-sky-700">
                          {row.retentionRate}%{' '}
                          <span className="text-xs font-normal text-slate-500">
                            ({row.uniqueMembers} soci)
                          </span>
                        </span>
                      </div>

                      <div>
                        <span className="text-xs font-normal text-slate-500 block">
                          Utilità Percepita
                        </span>
                        <span className="text-base font-medium tabular-nums text-amber-700">
                          ★ {row.avgMemberRating} / 3.0
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 p-3 text-xs sm:text-sm font-normal">
                      <div className="space-y-1 text-slate-600">
                        <p>
                          <span className="text-emerald-800 font-medium">
                            Indicazione operativa:
                          </span>{' '}
                          {row.recommendation}
                        </p>
                        <p>
                          <span className="text-slate-800 font-medium">Nota Didattica:</span>{' '}
                          {row.staffNote}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setEditingSubjectNote({
                            subject: row.subject,
                            didactic_goal: row.didacticGoal,
                            staff_note: row.staffNote,
                            manual_utility_boost: row.manualBoost,
                          })
                        }
                        className="inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-normal text-slate-700 transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Modifica valutazione</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SEZIONE 2: MONITORAGGIO SINGOLI SOCI & ANAGRAFICA
           =================================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className={`rounded-3xl p-5 sm:p-6 space-y-4 ${cardClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-medium text-slate-900">
                    Anagrafica Soci, Ruoli (CD / Settori) e Presenze Individuali
                  </h2>
                  <p className="text-xs sm:text-sm font-normal text-slate-500">
                    {isSuperAdmin
                      ? 'Accesso Amministratore Generale (7796 — Giampiero Pilia): puoi spuntare CD (Sì/No) e attribuire i ruoli a fianco a ogni socio.'
                      : 'Cerca un socio, verifica i ruoli e quante lezioni segue o aggiungi un nuovo iscritto.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    exportOfficialPdf({
                      title: 'Elenco Ufficiale Soci, Ruoli e Riepilogo Presenze',
                      subtitle: `Totale soci in elenco: ${filteredMembers.length}`,
                      head: [
                        'N° Tessera',
                        'Cognome e Nome',
                        'Sede',
                        'CD',
                        'Ruoli Attribuiti',
                        'Presenze',
                        'Ultima Presenza',
                      ],
                      body: filteredMembers.map((m) => {
                        const recs = attendanceByMember[m.id] || [];
                        const lastDt = recs[0]
                          ? new Date(recs[0].created_at).toLocaleDateString('it-IT')
                          : 'Nessuna';
                        const isCd = Boolean(m.is_cd || m.roles?.includes('CD'));
                        const rolesStr = (m.roles && m.roles.length > 0 ? m.roles : ['Socio']).join(
                          ', '
                        );
                        return [
                          m.member_number,
                          m.full_name,
                          m.sede,
                          isCd ? 'SÌ' : 'NO',
                          rolesStr,
                          recs.length,
                          lastDt,
                        ];
                      }),
                      fileName: `elenco_soci_ruoli_presenze_${new Date().toISOString().slice(0, 10)}.pdf`,
                      landscape: true,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-sm font-normal text-white shadow-sm transition"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Esporta PDF Soci & Ruoli</span>
                </button>
              </div>

              {/* Pannello esclusivo Giampiero Pilia (7796): Gestione ed estensione Ruoli */}
              {isSuperAdmin && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-emerald-900 block">
                      Gestione Ruoli Soci (Riservato a Giampiero Pilia — 7796)
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-normal text-slate-600 mr-1">
                        Ruoli attivi:
                      </span>
                      {availableRoles.map((r) => (
                        <span
                          key={r}
                          className="rounded-lg bg-white border border-emerald-200 px-2.5 py-0.5 text-xs font-normal text-emerald-900"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="Nuovo ruolo (es. Biblioteca, Eventi...)"
                      value={newCustomRoleInput}
                      onChange={(e) => setNewCustomRoleInput(e.target.value)}
                      className={`h-10 rounded-xl px-3 text-xs sm:text-sm font-normal ${inputClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCustomRoleInput.trim()) return;
                        addCustomRole(newCustomRoleInput);
                        setNewCustomRoleInput('');
                        setMemberFormMsg(`✓ Nuovo ruolo "${newCustomRoleInput.trim()}" aggiunto all'elenco!`);
                        setTimeout(() => setMemberFormMsg(null), 3500);
                      }}
                      className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 text-xs sm:text-sm font-normal text-white flex items-center gap-1.5 shrink-0 shadow-xs"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Aggiungi Ruolo</span>
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleAddMember}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
              >
                <input
                  type="text"
                  placeholder="N° Tessera (es. 115)"
                  value={newMemberNum}
                  onChange={(e) => setNewMemberNum(e.target.value)}
                  className={`h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                />
                <input
                  type="text"
                  placeholder="Cognome e Nome Completo"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className={`h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                />
                <select
                  value={newMemberSede}
                  onChange={(e) => setNewMemberSede(e.target.value as 'Quartu' | 'Soleminis')}
                  className={`h-11 rounded-xl px-3.5 text-sm font-normal ${inputClass}`}
                >
                  <option value="Quartu">Sede Quartu S. Elena</option>
                  <option value="Soleminis">Sede Soleminis</option>
                </select>

                {isSuperAdmin ? (
                  <label className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-3.5 flex items-center justify-between text-sm font-normal text-slate-700 cursor-pointer">
                    <span>Membro CD:</span>
                    <input
                      type="checkbox"
                      checked={newMemberIsCD}
                      onChange={(e) => setNewMemberIsCD(e.target.checked)}
                      className="h-4 w-4 accent-emerald-700 rounded"
                    />
                  </label>
                ) : (
                  <div className="hidden lg:block" />
                )}

                <button
                  type="submit"
                  className="h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-normal flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Aggiungi Socio</span>
                </button>
              </form>

              {memberFormMsg && (
                <p className="text-sm font-normal text-emerald-700">{memberFormMsg}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca socio per nome o n° tessera..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className={`w-full h-11 rounded-xl pl-10 pr-3 text-sm font-normal ${inputClass}`}
                  />
                </div>

                <select
                  value={memberSedeFilter}
                  onChange={(e) =>
                    setMemberSedeFilter(e.target.value as 'ALL' | 'Quartu' | 'Soleminis')
                  }
                  className={`h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                >
                  <option value="ALL">Tutte le Sedi (Quartu + Soleminis)</option>
                  <option value="Quartu">Solo Sede Quartu S. Elena</option>
                  <option value="Soleminis">Solo Sede Soleminis</option>
                </select>

                <select
                  value={memberRoleFilter}
                  onChange={(e) => setMemberRoleFilter(e.target.value)}
                  className={`h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                >
                  <option value="ALL">Tutti i Ruoli ({profiles.length} soci)</option>
                  <option value="ONLY_CD">
                    Solo Membri CD (Consiglio Direttivo:{' '}
                    {profiles.filter((p) => p.is_cd || p.roles?.includes('CD')).length})
                  </option>
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      Ruolo: {r}
                    </option>
                  ))}
                </select>

                <select
                  value={memberSortBy}
                  onChange={(e) =>
                    setMemberSortBy(
                      e.target.value as 'member_number' | 'full_name' | 'attendances'
                    )
                  }
                  className={`h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                >
                  <option value="member_number">Ordina per N° Tesserino</option>
                  <option value="full_name">Ordina per Nome Alfabetico</option>
                  <option value="attendances">Ordina per N° Presenze</option>
                </select>
              </div>
            </div>

            <div className={`rounded-3xl overflow-hidden ${cardClass}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-normal uppercase tracking-wider text-slate-500">
                      <th className="p-3.5">N° Tessera</th>
                      <th className="p-3.5">Nome Completo</th>
                      <th className="p-3.5">Sede</th>
                      <th className="p-3.5 text-center">CD (Sì / No)</th>
                      <th className="p-3.5">Ruoli Attribuiti</th>
                      <th className="p-3.5">Lezioni Seguite</th>
                      <th className="p-3.5 text-right">Azioni e Scheda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => {
                      const recs = attendanceByMember[m.id] || [];
                      const isEditing = editingMemberId === m.id;
                      const isMemberCD = Boolean(m.is_cd || m.roles?.includes('CD'));
                      const memberRoles =
                        m.roles && m.roles.length > 0
                          ? m.roles
                          : isMemberCD
                          ? ['Socio', 'CD']
                          : ['Socio'];
                      const isRolePickerOpen = openRolePickerMemberId === m.id;

                      return (
                        <tr
                          key={m.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition"
                        >
                          {isEditing ? (
                            <>
                              <td className="p-3">
                                <input
                                  value={editMemberData.member_number}
                                  onChange={(e) =>
                                    setEditMemberData({
                                      ...editMemberData,
                                      member_number: e.target.value,
                                    })
                                  }
                                  className={`h-10 w-24 rounded-lg px-2 font-normal ${inputClass}`}
                                />
                              </td>
                              <td className="p-3">
                                <input
                                  value={editMemberData.full_name}
                                  onChange={(e) =>
                                    setEditMemberData({
                                      ...editMemberData,
                                      full_name: e.target.value,
                                    })
                                  }
                                  className={`h-10 w-full rounded-lg px-2 font-normal ${inputClass}`}
                                />
                              </td>
                              <td className="p-3">
                                <select
                                  value={editMemberData.sede}
                                  onChange={(e) =>
                                    setEditMemberData({
                                      ...editMemberData,
                                      sede: e.target.value as 'Quartu' | 'Soleminis',
                                    })
                                  }
                                  className={`h-10 rounded-lg px-2 ${inputClass}`}
                                >
                                  <option value="Quartu">Quartu</option>
                                  <option value="Soleminis">Soleminis</option>
                                </select>
                              </td>
                              <td className="p-3 text-center">
                                {isMemberCD ? 'Sì' : 'No'}
                              </td>
                              <td className="p-3 text-xs text-slate-600">
                                {memberRoles.join(', ')}
                              </td>
                              <td className="p-3 font-normal">{recs.length}</td>
                              <td className="p-3 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateMember(m.id, editMemberData);
                                    setEditingMemberId(null);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-normal text-white"
                                >
                                  <Check className="h-4 w-4" /> Salva
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberId(null)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-normal text-slate-700"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3.5 font-normal tabular-nums text-base whitespace-nowrap">
                                <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-800">
                                  {m.member_number}
                                </span>
                              </td>
                              <td className="p-3.5 font-medium text-base text-slate-900">
                                {m.full_name}
                                {(m.member_number === '7726' || m.member_number === '7796' || m.is_super_admin) && (
                                  <span className="ml-2 rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-normal text-amber-900">
                                    Amministratore
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-sm font-normal text-slate-600 whitespace-nowrap">
                                {m.sede}
                              </td>

                              {/* COLONNA CHECK / SCELTA CD (Sì / No) */}
                              <td className="p-3.5 text-center whitespace-nowrap">
                                {isSuperAdmin ? (
                                  <label className="inline-flex items-center gap-2 cursor-pointer select-none rounded-xl border px-3 py-1.5 transition bg-white hover:bg-slate-50 border-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={isMemberCD}
                                      onChange={(e) => toggleMemberCD(m.id, e.target.checked)}
                                      className="h-4 w-4 accent-emerald-700 rounded cursor-pointer"
                                    />
                                    <span
                                      className={`text-xs font-medium ${
                                        isMemberCD ? 'text-emerald-800' : 'text-slate-400'
                                      }`}
                                    >
                                      {isMemberCD ? 'CD: SÌ' : 'CD: NO'}
                                    </span>
                                  </label>
                                ) : (
                                  <span
                                    className={`inline-block rounded-lg px-2.5 py-1 text-xs font-normal ${
                                      isMemberCD
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {isMemberCD ? 'CD: SÌ' : 'No'}
                                  </span>
                                )}
                              </td>

                              {/* COLONNA RUOLI (Socio, CD, Amministrativo, Didattica, Viaggi, ecc.) */}
                              <td className="p-3.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {memberRoles.map((roleName) => (
                                    <span
                                      key={roleName}
                                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-normal border ${
                                        roleName === 'CD'
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                          : roleName === 'Socio'
                                          ? 'bg-slate-100 border-slate-200 text-slate-700'
                                          : 'bg-amber-50 border-amber-200 text-amber-900'
                                      }`}
                                    >
                                      <span>{roleName}</span>
                                      {isSuperAdmin && roleName !== 'Socio' && (
                                        <button
                                          type="button"
                                          onClick={() => toggleMemberRole(m.id, roleName)}
                                          className="ml-0.5 text-slate-400 hover:text-rose-600"
                                          title={`Rimuovi ruolo ${roleName}`}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </span>
                                  ))}

                                  {isSuperAdmin && (
                                    <div className="relative inline-block">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenRolePickerMemberId(
                                            isRolePickerOpen ? null : m.id
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-800 transition"
                                      >
                                        <span>+ Ruolo</span>
                                      </button>

                                      {isRolePickerOpen && (
                                        <div className="absolute left-0 top-7 z-30 w-52 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl space-y-1">
                                          <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1">
                                            <span className="text-[11px] font-medium text-slate-500">
                                              Attribuisci Ruoli
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setOpenRolePickerMemberId(null)}
                                              className="text-slate-400 hover:text-slate-700"
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                          {availableRoles.map((rName) => {
                                            const active = memberRoles.includes(rName);
                                            return (
                                              <label
                                                key={rName}
                                                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-normal hover:bg-slate-50 cursor-pointer"
                                              >
                                                <span className="text-slate-800">{rName}</span>
                                                <input
                                                  type="checkbox"
                                                  checked={active}
                                                  onChange={() => toggleMemberRole(m.id, rName)}
                                                  className="h-3.5 w-3.5 accent-emerald-700 rounded"
                                                />
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-xs sm:text-sm font-normal text-sky-800 tabular-nums">
                                  {recs.length} presenze
                                </span>
                              </td>

                              <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setInspectedMember(m)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-xs font-normal text-white shadow-sm transition"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Scheda</span>
                                </button>
                                {isSuperAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMemberId(m.id);
                                        setEditMemberData({
                                          member_number: m.member_number,
                                          full_name: m.full_name,
                                          sede: m.sede,
                                          role: m.role,
                                        });
                                      }}
                                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                                      title="Modifica dati socio"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>
                                    {m.member_number !== '7726' && m.member_number !== '7796' && !m.is_super_admin && m.role !== 'admin' && (
                                      <button
                                        type="button"
                                        onClick={() => deleteMember(m.id)}
                                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                                        title="Elimina socio"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </td>
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
        )}

        {/* ===================================================================
            SEZIONE 3: PROGRAMMA ORARIO SETTIMANALE AULE
           =================================================================== */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className={`rounded-3xl p-5 sm:p-6 space-y-4 ${cardClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-medium text-slate-900">
                    Programma Orario Settimanale delle Aule
                  </h2>
                  <p className="text-xs sm:text-sm font-normal text-slate-500">
                    Aggiungi, importa da Excel/CSV o rimuovi lezioni dal calendario settimanale
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={scheduleFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleScheduleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClassroomsModal(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-sky-600 bg-sky-50 hover:bg-sky-100 text-sky-800 px-4 py-2.5 text-sm font-medium shadow-2xs transition active:scale-95"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-sky-700" />
                    <span>Gestione Aule Didattiche ({classrooms.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scheduleFileInputRef.current?.click()}
                    disabled={isImportingSchedule}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-4 py-2.5 text-sm font-medium shadow-2xs transition active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4 text-emerald-700" />
                    <span>{isImportingSchedule ? 'Caricamento...' : 'Carica Orario XLS / CSV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      exportOfficialPdf({
                        title: 'Programma Ufficiale Lezioni Settimanali QU3',
                        subtitle: `Totale corsi settimanali programmati: ${lessons.length}`,
                        head: ['Giorno', 'Orario', 'Aula', 'Materia', 'Docente', 'Area Didattica'],
                        body: [...lessons]
                          .sort(
                            (a, b) =>
                              a.day_of_week - b.day_of_week ||
                              a.start_time.localeCompare(b.start_time)
                          )
                          .map((l) => [
                            DAYS_IT[l.day_of_week],
                            `${l.start_time.slice(0, 5)} – ${l.end_time.slice(0, 5)}`,
                            CLASSROOM_LABELS[l.classroom] || l.classroom,
                            l.subject,
                            l.teacher,
                            l.category,
                          ]),
                        fileName: `programma_settimanale_QU3_${new Date().toISOString().slice(0, 10)}.pdf`,
                        landscape: true,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-sm font-normal text-white shadow-sm transition"
                  >
                    <FileDown className="h-4 w-4" />
                    <span>Stampa PDF Programma</span>
                  </button>
                </div>
              </div>

              {/* Guida Colonne File XLS/CSV */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">
                  💡 Formato accettato per il caricamento file Excel (.xlsx, .xls) o CSV (.csv):
                </p>
                <p>
                  Puoi caricare un file con le colonne: <strong className="text-emerald-800">Giorno</strong> (es. <em>Lunedì</em> o <em>1..6</em>), <strong className="text-emerald-800">Aula</strong> (es. <em>Aula Verde, Gialla, Rossa, Rocchitta, San Benedetto, Biblioteca, Ferrini, Polifunzionale</em>), <strong className="text-emerald-800">Materia</strong>, <strong className="text-emerald-800">Docente</strong> e <strong className="text-emerald-800">Orario</strong> (es. <em>09:00 - 11:00</em> oppure colonne separate <em>Inizio</em> e <em>Fine</em>).
                </p>
              </div>

              {/* BANNER ERRORE NEI TURNI: CONFLITTO AULE */}
              {lessonConflictsMap.size > 0 && (
                <div className="rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 sm:p-5 text-rose-950 shadow-md space-y-2 animate-fadeIn">
                  <div className="flex items-start gap-3 text-rose-800">
                    <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-rose-900">
                        ⚠️ ERRORE NEI TURNI: Rilevate {lessonConflictsMap.size} lezioni con aula sovrapposta!
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-rose-800 leading-relaxed">
                        In una stessa aula non possono svolgersi 2 lezioni contemporaneamente allo stesso orario e data. Controlla e correggi i turni contrassegnati in rosso nella tabella sottostante modificando l&apos;aula o gli orari.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">Aula</label>
                  <select
                    value={newLesson.classroom}
                    onChange={(e) =>
                      setNewLesson({ ...newLesson, classroom: e.target.value as ClassroomKey })
                    }
                    className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  >
                    {classrooms.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.fullName} ({c.sede})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">
                    Materia del Corso
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Storia della Sardegna"
                    value={newLesson.subject}
                    onChange={(e) => setNewLesson({ ...newLesson, subject: e.target.value })}
                    className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  />
                </div>

                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">Docente</label>
                  <input
                    type="text"
                    placeholder="Es. Prof.ssa Paola Dessì"
                    value={newLesson.teacher}
                    onChange={(e) => setNewLesson({ ...newLesson, teacher: e.target.value })}
                    className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  />
                </div>

                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">
                    Giorno della Settimana
                  </label>
                  <select
                    value={newLesson.day_of_week}
                    onChange={(e) =>
                      setNewLesson({ ...newLesson, day_of_week: Number(e.target.value) })
                    }
                    className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  >
                    {DAYS_IT.map((d, idx) => (
                      <option key={d} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-normal text-slate-500 block mb-1">Inizio</label>
                    <input
                      type="time"
                      value={newLesson.start_time}
                      onChange={(e) => setNewLesson({ ...newLesson, start_time: e.target.value })}
                      className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-normal text-slate-500 block mb-1">Fine</label>
                    <input
                      type="time"
                      value={newLesson.end_time}
                      onChange={(e) => setNewLesson({ ...newLesson, end_time: e.target.value })}
                      className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!newLesson.subject.trim()) {
                        alert('Inserisci la materia del corso.');
                        return;
                      }
                      if (!newLesson.start_time || !newLesson.end_time) {
                        alert("Inserisci sia l'orario di inizio che di fine.");
                        return;
                      }
                      if (newLesson.start_time >= newLesson.end_time) {
                        alert("L'orario di inizio deve essere precedente all'orario di fine.");
                        return;
                      }
                      const conflict = checkLessonConflict(newLesson);
                      if (conflict) {
                        const roomLabel = getClassroomLabel(newLesson.classroom);
                        const dayLabel = DAYS_IT[newLesson.day_of_week];
                        alert(
                          `⚠️ CONFLITTO DI PROGRAMMAZIONE NELL'AULA DIDATTICA!\n\n` +
                            `L'aula «${roomLabel}» è già occupata il ${dayLabel} dalle ore ${conflict.start_time.slice(0, 5)} alle ${conflict.end_time.slice(0, 5)} per il corso di:\n` +
                            `• «${conflict.subject}» (Docente: ${conflict.teacher})\n\n` +
                            `In una stessa aula non possono esserci due corsi nello stesso orario e giorno.\nModifica l'orario, il giorno o seleziona un'altra aula.`
                        );
                        return;
                      }
                      addLesson({
                        ...newLesson,
                        teacher: newLesson.teacher.trim() || 'Docente QU3',
                        category: getSubjectMeta(newLesson.subject).category,
                      });
                      setScheduleNotice(`✓ Corso di «${newLesson.subject}» inserito nel calendario.`);
                      setTimeout(() => setScheduleNotice(null), 5000);
                      setNewLesson({ ...newLesson, subject: '', teacher: '' });
                    }}
                    className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-normal flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Inserisci nel Programma</span>
                  </button>
                </div>
              </div>

              {/* Banner Sovrapposizione Orari in Tempo Reale */}
              {(() => {
                const liveConflict = checkLessonConflict(newLesson);
                if (!liveConflict) return null;
                return (
                  <div className="mt-3 rounded-2xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900 flex items-start gap-2.5 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Attenzione: Aula già occupata in questa fascia oraria!</strong>
                      <span>
                        L'aula <strong>{getClassroomLabel(newLesson.classroom)}</strong> è già occupata <strong>{DAYS_IT[newLesson.day_of_week]}</strong> dalle ore <strong>{liveConflict.start_time.slice(0, 5)}</strong> alle <strong>{liveConflict.end_time.slice(0, 5)}</strong> per il corso: <em>«{liveConflict.subject}»</em> (Docente: {liveConflict.teacher}). In una stessa aula non possono esserci due corsi nello stesso orario e giorno.
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Avviso di conferma immediata operazione sul calendario lezioni */}
            {scheduleNotice && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-center justify-between text-sm text-emerald-900 shadow-sm transition">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="font-medium">{scheduleNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleNotice(null)}
                  className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Filtro Sede per Tabella Orari */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1">
                {(['ALL', 'Quartu', 'Soleminis'] as const).map((s) => {
                  const count = lessons.filter((l) => {
                    if (s === 'ALL') return true;
                    if (s === 'Soleminis') return l.classroom === 'polifunzionale';
                    return l.classroom !== 'polifunzionale';
                  }).length;
                  const isActive = scheduleSedeFilter === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScheduleSedeFilter(s)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? 'bg-white text-emerald-800 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {s === 'ALL' ? 'Tutte le Sedi' : `Sede ${s}`} ({count})
                    </button>
                  );
                })}
              </div>

              <span className="text-xs text-slate-500 font-normal">
                Mostrate {lessons.filter((l) => {
                  if (scheduleSedeFilter === 'ALL') return true;
                  if (scheduleSedeFilter === 'Soleminis') return l.classroom === 'polifunzionale';
                  return l.classroom !== 'polifunzionale';
                }).length} di {lessons.length} lezioni totali
              </span>
            </div>

            <div className={`rounded-3xl overflow-hidden ${cardClass}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-normal uppercase tracking-wider text-slate-500">
                      <th className="p-4">Giorno</th>
                      <th className="p-4">Aula e Sede</th>
                      <th className="p-4">Materia</th>
                      <th className="p-4">Docente</th>
                      <th className="p-4">Orario</th>
                      <th className="p-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons
                      .filter((les) => {
                        if (scheduleSedeFilter === 'ALL') return true;
                        if (scheduleSedeFilter === 'Soleminis') return les.classroom === 'polifunzionale';
                        return les.classroom !== 'polifunzionale';
                      })
                      .sort(
                        (a, b) =>
                          a.day_of_week - b.day_of_week ||
                          a.start_time.localeCompare(b.start_time)
                      )
                      .map((les) => {
                        const meta = getSubjectMeta(les.subject);
                        const isSol = les.classroom === 'polifunzionale';
                        const conflicts = lessonConflictsMap.get(les.id) || [];
                        const hasConflict = conflicts.length > 0;
                        return (
                          <tr
                            key={les.id}
                            className={`border-b transition ${
                              hasConflict
                                ? 'bg-rose-50/90 border-rose-300 hover:bg-rose-100/90'
                                : 'border-slate-100 last:border-0 hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="p-4 font-normal text-slate-700">
                              {DAYS_IT[les.day_of_week]}
                            </td>
                            <td className="p-4 font-normal text-slate-700">
                              <span className="font-medium text-slate-900">{getClassroomLabel(les.classroom)}</span>
                              <span className={`ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                                isSol ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isSol ? 'Soleminis' : 'Quartu'}
                              </span>
                            </td>
                            <td className="p-4 font-medium text-slate-900">
                              <div>
                                <span>{meta.emoji} {les.subject}</span>
                                {hasConflict && (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-100/90 px-2.5 py-1 text-xs font-bold text-rose-800 shadow-2xs">
                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                    <span>
                                      ⚠️ Errore Turno: Aula già occupata da{' '}
                                      {conflicts
                                        .map((c) => `«${c.subject}» (${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)})`)
                                        .join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-sm font-normal text-slate-600">
                              {les.teacher}
                            </td>
                            <td className="p-4 font-normal tabular-nums text-slate-700">
                              <span className={hasConflict ? 'font-bold text-rose-700' : ''}>
                                {les.start_time.slice(0, 5)} – {les.end_time.slice(0, 5)}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditLesson(les)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 active:scale-95 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-2xs transition cursor-pointer"
                                  title="Modifica orario, aula e dettagli di questa lezione"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                                  <span>Modifica Corso</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const roomName = getClassroomLabel(les.classroom);
                                    const dayName = DAYS_IT[les.day_of_week] || '';
                                    if (
                                      window.confirm(
                                        `Vuoi davvero cancellare la lezione dal calendario?\n\n` +
                                          `• Materia: ${les.subject}\n` +
                                          `• Docente: ${les.teacher}\n` +
                                          `• Aula: ${roomName}\n` +
                                          `• Orario: ${dayName} dalle ${les.start_time.slice(0, 5)} alle ${les.end_time.slice(0, 5)}`
                                      )
                                    ) {
                                      deleteLesson(les.id);
                                      setScheduleNotice(`✓ Lezione di «${les.subject}» cancellata dal calendario con successo.`);
                                      setTimeout(() => setScheduleNotice(null), 5000);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 active:scale-95 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-2xs transition cursor-pointer"
                                  title="Cancella lezione dal calendario"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                  <span>Cancella</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SEZIONE 4: REGISTRO PRESENZE & REPORTISTICA PDF / CSV
           =================================================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className={`rounded-3xl p-5 sm:p-6 space-y-5 ${cardClass}`}>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-800 block">
                    Registro Ufficiale di Giornata (con Nominativi per Aula)
                  </span>
                  <p className="text-xs sm:text-sm font-normal text-slate-600 mb-2">
                    Scarica il PDF con l'elenco numerato dei soci presenti in ciascuna aula nella giornata selezionata.
                  </p>
                  <input
                    type="date"
                    value={dailyPdfDate}
                    onChange={(e) => setDailyPdfDate(e.target.value)}
                    className={`h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportDailyNominalPdf}
                  className="h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 text-sm font-normal text-white flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Scarica PDF Giornata</span>
                </button>
              </div>

              {/* Selettore Rapido Anno Accademico */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Filtro Anno Accademico:</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('2026-07-01');
                    setDateTo('2027-06-30');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    dateFrom === '2026-07-01' && dateTo === '2027-06-30'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  A.A. 2026/2027 (In corso)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('2025-07-01');
                    setDateTo('2026-06-30');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    dateFrom === '2025-07-01' && dateTo === '2026-06-30'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  A.A. 2025/2026 (Scorso anno)
                </button>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline px-1 cursor-pointer"
                  >
                    Tutto lo storico
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">
                    Dal Giorno
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">
                    Al Giorno
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">
                    Cerca Socio
                  </label>
                  <input
                    type="text"
                    placeholder="Nome o N° tessera..."
                    value={reportMemberQuery}
                    onChange={(e) => setReportMemberQuery(e.target.value)}
                    className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-normal text-slate-500 block mb-1">
                    Filtra Materia
                  </label>
                  <select
                    value={reportSubjectFilter}
                    onChange={(e) => setReportSubjectFilter(e.target.value)}
                    className={`w-full h-11 rounded-xl px-3 text-sm font-normal ${inputClass}`}
                  >
                    <option value="">Tutte le materie</option>
                    {subjectEffectivenessRows.map((s) => (
                      <option key={s.subject} value={s.subject}>
                        {s.subject}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <span className="text-sm font-normal text-slate-500">
                  {filteredAttendance.length} presenze trovate
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        ['Data', 'Ora', 'N° Socio', 'Nome Completo', 'Aula', 'Materia', 'Valutazione'],
                        filteredAttendance.map((a) => {
                          const dt = new Date(a.created_at);
                          const p = profiles.find((pr) => pr.id === a.user_id);
                          const l = lessons.find((le) => le.id === a.lesson_id);
                          return [
                            dt.toLocaleDateString('it-IT'),
                            dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                            p?.member_number || '',
                            p?.full_name || '',
                            CLASSROOM_LABELS[a.classroom] || a.classroom,
                            l?.subject || '',
                            a.rating || '',
                          ];
                        }),
                        `presenze_QU3_${new Date().toISOString().slice(0, 10)}.csv`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-normal text-slate-700"
                  >
                    <FileDown className="h-4 w-4" />
                    <span>Esporta CSV (Excel)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      exportOfficialPdf({
                        title: 'Report Generale Presenze Soci QU3',
                        subtitle: `Record filtrati: ${filteredAttendance.length}`,
                        head: ['Data', 'Ora', 'N° Socio', 'Cognome e Nome', 'Aula', 'Materia'],
                        body: filteredAttendance.map((a) => {
                          const dt = new Date(a.created_at);
                          const p = profiles.find((pr) => pr.id === a.user_id);
                          const l = lessons.find((le) => le.id === a.lesson_id);
                          return [
                            dt.toLocaleDateString('it-IT'),
                            dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                            p?.member_number || '—',
                            p?.full_name || '—',
                            CLASSROOM_LABELS[a.classroom] || a.classroom,
                            l?.subject || '—',
                          ];
                        }),
                        fileName: `report_presenze_${new Date().toISOString().slice(0, 10)}.pdf`,
                        landscape: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs sm:text-sm font-normal text-white shadow-sm"
                  >
                    <FileDown className="h-4 w-4" />
                    <span>Esporta PDF</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={`rounded-3xl overflow-hidden ${cardClass}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-normal uppercase tracking-wider text-slate-500">
                      <th className="p-4">Data</th>
                      <th className="p-4">Ora</th>
                      <th className="p-4">N° Tessera</th>
                      <th className="p-4">Nome e Cognome</th>
                      <th className="p-4">Aula</th>
                      <th className="p-4">Materia</th>
                      <th className="p-4">Utilità</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.slice(0, 120).map((att) => {
                      const dt = new Date(att.created_at);
                      const prof = profiles.find((p) => p.id === att.user_id);
                      const les = lessons.find((l) => l.id === att.lesson_id);
                      return (
                        <tr
                          key={att.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                        >
                          <td className="p-4 text-sm font-normal text-slate-600 tabular-nums">
                            {dt.toLocaleDateString('it-IT')}
                          </td>
                          <td className="p-4 text-sm font-normal text-slate-700 tabular-nums">
                            {dt.toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-4 font-normal text-slate-800 tabular-nums">
                            {prof?.member_number || '—'}
                          </td>
                          <td className="p-4 font-medium text-slate-900">
                            {prof?.full_name || '—'}
                          </td>
                          <td className="p-4 text-sm font-normal text-slate-600">
                            {CLASSROOM_LABELS[att.classroom]}
                          </td>
                          <td className="p-4 font-normal text-slate-800">
                            {les?.subject || '—'}
                          </td>
                          <td className="p-4 text-sm font-normal text-slate-600">
                            {att.rating === 3
                              ? '😊 Molto utile'
                              : att.rating === 2
                              ? '👍 Buona'
                              : att.rating === 1
                              ? '🤔 Da rivedere'
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ===================================================================
          MODAL: LINK & QR CODE PER FAR INSTALLARE L'APP AI SOCI
         =================================================================== */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-success-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-normal text-emerald-800">
                  Distribuzione App ai Soci
                </span>
                <h2 className="mt-1 text-xl font-medium text-slate-900">
                  Link e QR Code per l'installazione su iPhone e Android
                </h2>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm font-normal text-slate-600">
              Invia questo link ai soci su WhatsApp oppure esponi il QR Code in segreteria: aprendolo la prima volta potranno toccare <strong>"Installa sul telefono"</strong> per avere l'icona sempre pronta sulla schermata Home.
            </p>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  shareUrl
                )}`}
                alt="QR Code QUARTimbra"
                className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2"
              />
              <p className="text-xs font-normal text-slate-500">
                Inquadra con la fotocamera dello smartphone
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-base font-medium text-slate-900"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 h-11 text-sm font-normal text-white transition"
              >
                <Copy className="h-4 w-4" />
                <span>{copiedLink ? 'Copiato!' : 'Copia Link'}</span>
              </button>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-normal text-emerald-950 space-y-1.5">
              <p className="font-medium text-emerald-900">
                Indirizzo Cloud Ufficiale per i Soci (iPhone e Android):
              </p>
              <ul className="space-y-1 text-slate-800">
                <li>
                  • <strong>https://qu3.onrender.com</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: SCHEDA INDIVIDUALE SOCIO 360°
         =================================================================== */}
      {inspectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-success-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-normal text-emerald-800">
                  Tessera Socio N° {inspectedMember.member_number} · Sede {inspectedMember.sede}
                </span>
                <h2 className="mt-1.5 text-2xl font-medium text-slate-900">
                  {inspectedMember.full_name}
                </h2>
                <p className="text-sm font-normal text-slate-500">
                  Monitoraggio individuale presenze e corsi frequentati
                </p>
              </div>
              <button
                onClick={() => setInspectedMember(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {(() => {
              const memberRecs = attendanceByMember[inspectedMember.id] || [];
              const bySubj: Record<string, number> = {};
              memberRecs.forEach((r) => {
                const l = lessons.find((le) => le.id === r.lesson_id);
                const sName = l?.subject || 'Altro';
                bySubj[sName] = (bySubj[sName] || 0) + 1;
              });

              return (
                <div className="mt-4 space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-center">
                      <span className="text-2xl font-medium text-emerald-800">
                        {memberRecs.length}
                      </span>
                      <span className="block text-xs font-normal text-slate-600">
                        Lezioni Frequentate
                      </span>
                    </div>
                    <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3.5 text-center">
                      <span className="text-2xl font-medium text-sky-800">
                        {Object.keys(bySubj).length}
                      </span>
                      <span className="block text-xs font-normal text-slate-600">
                        Materie Seguite
                      </span>
                    </div>
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-center">
                      <span className="text-2xl font-medium text-amber-800">
                        {memberRecs.length * 2}h
                      </span>
                      <span className="block text-xs font-normal text-slate-600">
                        Ore Stimate in Aula
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-normal uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-emerald-700" />
                      <span>Riepilogo per Materia Frequentata</span>
                    </h3>
                    <div className="space-y-1.5">
                      {Object.entries(bySubj).map(([subj, cnt]) => (
                        <div
                          key={subj}
                          className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm font-normal"
                        >
                          <span>
                            {getSubjectMeta(subj).emoji} {subj}
                          </span>
                          <span className="rounded-lg bg-emerald-700 px-2.5 py-0.5 text-xs text-white font-normal">
                            {cnt} presenze
                          </span>
                        </div>
                      ))}
                      {Object.keys(bySubj).length === 0 && (
                        <p className="text-sm font-normal text-slate-500">
                          Nessuna presenza registrata.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-normal uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-sky-700" />
                      <span>Cronologia Timbrature in Aula</span>
                    </h3>
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {memberRecs.map((r) => {
                        const l = lessons.find((le) => le.id === r.lesson_id);
                        const dt = new Date(r.created_at);
                        return (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-normal"
                          >
                            <div>
                              <span className="font-medium text-slate-900">
                                {l?.subject || 'Lezione'}
                              </span>
                              <span className="block text-slate-500">
                                {CLASSROOM_LABELS[r.classroom]}
                              </span>
                            </div>
                            <span className="font-normal tabular-nums text-slate-600">
                              {dt.toLocaleDateString('it-IT')} ·{' '}
                              {dt.toLocaleTimeString('it-IT', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleExportSingleMemberPdf(inspectedMember)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-sm font-normal text-white shadow-sm"
                    >
                      <FileDown className="h-4 w-4" />
                      <span>Scarica PDF Scheda Socio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectedMember(null)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-sm font-normal text-slate-700"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: AGGIORNA VALUTAZIONE DIDATTICA MATERIA
         =================================================================== */}
      {editingSubjectNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-success-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-normal uppercase text-emerald-700">
                  Valutazione Settore Didattica
                </span>
                <h3 className="text-xl font-medium text-slate-900">
                  {editingSubjectNote.subject}
                </h3>
              </div>
              <button
                onClick={() => setEditingSubjectNote(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-normal text-slate-500 block mb-1">
                  Obiettivo Formativo e Utilità per i Soci Anziani
                </label>
                <textarea
                  rows={2}
                  value={editingSubjectNote.didactic_goal}
                  onChange={(e) =>
                    setEditingSubjectNote({
                      ...editingSubjectNote,
                      didactic_goal: e.target.value,
                    })
                  }
                  className={`w-full rounded-xl p-3 text-sm font-normal ${inputClass}`}
                />
              </div>

              <div>
                <label className="text-xs font-normal text-slate-500 block mb-1">
                  Osservazioni / Azioni Consigliate dal Settore Didattica
                </label>
                <textarea
                  rows={3}
                  value={editingSubjectNote.staff_note}
                  onChange={(e) =>
                    setEditingSubjectNote({
                      ...editingSubjectNote,
                      staff_note: e.target.value,
                    })
                  }
                  className={`w-full rounded-xl p-3 text-sm font-normal ${inputClass}`}
                />
              </div>

              <div>
                <label className="text-xs font-normal text-slate-500 block mb-1">
                  Valutazione Strategica Utilità Didattica (
                  {editingSubjectNote.manual_utility_boost >= 0
                    ? `+${editingSubjectNote.manual_utility_boost}`
                    : editingSubjectNote.manual_utility_boost}{' '}
                  punti)
                </label>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  value={editingSubjectNote.manual_utility_boost}
                  onChange={(e) =>
                    setEditingSubjectNote({
                      ...editingSubjectNote,
                      manual_utility_boost: Number(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSubjectNote(null)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-normal text-slate-700"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  saveSubjectNote({
                    ...editingSubjectNote,
                    updated_at: new Date().toISOString().slice(0, 10),
                  });
                  setEditingSubjectNote(null);
                }}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-sm font-normal text-white shadow-sm"
              >
                Salva Valutazione
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: MODIFICA ORARIO E DETTAGLI LEZIONE
         =================================================================== */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 block">
                  Modifica Corso Didattico
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingLessonForm.subject || 'Corso'}
                </h3>
                <p className="text-xs text-slate-500">
                  Modifica materia, docente, aula assegnata, giorno e fascia oraria.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLesson(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLesson} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Materia del Corso *
                </label>
                <input
                  type="text"
                  required
                  value={editingLessonForm.subject}
                  onChange={(e) =>
                    setEditingLessonForm({ ...editingLessonForm, subject: e.target.value })
                  }
                  className={`w-full h-11 rounded-xl px-3 text-sm ${inputClass}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Docente</label>
                  <input
                    type="text"
                    value={editingLessonForm.teacher}
                    onChange={(e) =>
                      setEditingLessonForm({ ...editingLessonForm, teacher: e.target.value })
                    }
                    className={`w-full h-11 rounded-xl px-3 text-sm ${inputClass}`}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Area Didattica / Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Umanistica, Scientifica, Artistica"
                    value={editingLessonForm.category || ''}
                    onChange={(e) =>
                      setEditingLessonForm({ ...editingLessonForm, category: e.target.value })
                    }
                    className={`w-full h-11 rounded-xl px-3 text-sm ${inputClass}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Giorno della Settimana
                  </label>
                  <select
                    value={editingLessonForm.day_of_week}
                    onChange={(e) =>
                      setEditingLessonForm({
                        ...editingLessonForm,
                        day_of_week: Number(e.target.value),
                      })
                    }
                    className={`w-full h-11 rounded-xl px-3 text-sm ${inputClass}`}
                  >
                    {DAYS_IT.map((d, idx) => (
                      <option key={d} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Aula Didattica Assegnata
                  </label>
                  <select
                    value={editingLessonForm.classroom}
                    onChange={(e) =>
                      setEditingLessonForm({
                        ...editingLessonForm,
                        classroom: e.target.value,
                      })
                    }
                    className={`w-full h-11 rounded-xl px-3 text-sm ${inputClass}`}
                  >
                    {classrooms.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.fullName} ({c.sede})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
                <span className="text-xs font-bold text-emerald-900 block">
                  ⏰ Orario di Inizio e Fine
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Orario Inizio
                    </label>
                    <input
                      type="time"
                      required
                      value={editingLessonForm.start_time}
                      onChange={(e) =>
                        setEditingLessonForm({
                          ...editingLessonForm,
                          start_time: e.target.value,
                        })
                      }
                      className={`w-full h-11 rounded-xl px-3 text-sm font-medium bg-white border border-slate-300 focus:border-emerald-600`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Orario Fine
                    </label>
                    <input
                      type="time"
                      required
                      value={editingLessonForm.end_time}
                      onChange={(e) =>
                        setEditingLessonForm({
                          ...editingLessonForm,
                          end_time: e.target.value,
                        })
                      }
                      className={`w-full h-11 rounded-xl px-3 text-sm font-medium bg-white border border-slate-300 focus:border-emerald-600`}
                    />
                  </div>
                </div>
              </div>

              {/* Banner Sovrapposizione Orari in Tempo Reale nella Modale */}
              {(() => {
                const liveConflict = checkLessonConflict(
                  {
                    classroom: editingLessonForm.classroom,
                    day_of_week: editingLessonForm.day_of_week,
                    start_time: editingLessonForm.start_time,
                    end_time: editingLessonForm.end_time,
                  },
                  editingLesson.id
                );
                if (!liveConflict) return null;
                return (
                  <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900 flex items-start gap-2.5 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Attenzione: Aula già occupata in questa fascia oraria!</strong>
                      <span>
                        L'aula <strong>{getClassroomLabel(editingLessonForm.classroom)}</strong> è già occupata <strong>{DAYS_IT[editingLessonForm.day_of_week]}</strong> dalle ore <strong>{liveConflict.start_time.slice(0, 5)}</strong> alle <strong>{liveConflict.end_time.slice(0, 5)}</strong> per il corso: <em>«{liveConflict.subject}»</em> (Docente: {liveConflict.teacher}). In una stessa aula non possono esserci due corsi nello stesso orario e giorno.
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
                  className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition active:scale-95"
                >
                  <Check className="h-4 w-4" />
                  <span>Salva Modifiche Corso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: GESTIONE AULE DIDATTICHE (QUARTU & SOLEMINIS)
         =================================================================== */}
      {showClassroomsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 text-slate-800 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-800 block">
                  Configurazione Spazi Didattici
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  Gestione Aule Didattiche ({classrooms.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Visualizza le aule attive a Quartu e Soleminis o inserisci una nuova aula per i corsi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClassroomsModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {classroomNotice && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs sm:text-sm font-medium text-emerald-900">
                {classroomNotice}
              </div>
            )}

            {/* Elenco Aule Esistenti */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">
                Aule Attive nel Portale Q3
              </span>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {classrooms.map((room) => {
                  const lessonCount = lessons.filter((l) => l.classroom === room.key).length;
                  return (
                    <div
                      key={room.key}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-3.5 w-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: room.badgeColor || '#2563eb' }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {room.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Sede: <strong>{room.sede}</strong> · Capienza:{' '}
                            <strong>{room.capacity} posti</strong> ·{' '}
                            {room.locationNote || 'Nessuna nota'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium">
                          {lessonCount} {lessonCount === 1 ? 'corso' : 'corsi'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingClassroom(room)}
                          className="p-1.5 rounded-lg border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 transition cursor-pointer"
                          title="Modifica denominazione e parametri dell'aula"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const msg =
                              lessonCount > 0
                                ? `⚠️ ATTENZIONE: Ci sono ${lessonCount} corsi assegnati all'aula «${room.fullName}»!\n\nSe elimini quest'aula, i corsi rimarranno nel database ma risulteranno senza un'aula valida.\n\nVuoi davvero eliminare definitivamente quest'aula?`
                                : `Vuoi davvero eliminare l'aula «${room.fullName}»?`;
                            if (window.confirm(msg)) {
                              deleteClassroom(room.key);
                              if (editingClassroom?.key === room.key) setEditingClassroom(null);
                              setClassroomNotice(`✓ Aula «${room.fullName}» eliminata.`);
                              setTimeout(() => setClassroomNotice(null), 4000);
                            }
                          }}
                          className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Elimina quest'aula"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Modifica Aula Esistente */}
            {editingClassroom ? (
              <form
                onSubmit={handleSaveEditClassroom}
                className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/70 p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between text-emerald-950 font-bold text-sm border-b border-emerald-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-emerald-700" />
                    <span>Modifica Parametri Aula: «{editingClassroom.fullName || editingClassroom.name}»</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingClassroom(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-normal cursor-pointer"
                  >
                    Annulla
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Nome Aula *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingClassroom.name}
                      onChange={(e) =>
                        setEditingClassroom({ ...editingClassroom, name: e.target.value })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Denominazione Completa / Ufficiale
                    </label>
                    <input
                      type="text"
                      value={editingClassroom.fullName}
                      onChange={(e) =>
                        setEditingClassroom({ ...editingClassroom, fullName: e.target.value })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Sede
                    </label>
                    <select
                      value={editingClassroom.sede}
                      onChange={(e) =>
                        setEditingClassroom({
                          ...editingClassroom,
                          sede: e.target.value as 'Quartu' | 'Soleminis',
                        })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-emerald-600"
                    >
                      <option value="Quartu">Quartu Sant'Elena</option>
                      <option value="Soleminis">Soleminis</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Capienza Massima Posti
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={editingClassroom.capacity}
                      onChange={(e) =>
                        setEditingClassroom({
                          ...editingClassroom,
                          capacity: Number(e.target.value) || 35,
                        })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-emerald-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Ubicazione / Piano / Note
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Piano Terra · Ala Ovest"
                      value={editingClassroom.locationNote || ''}
                      onChange={(e) =>
                        setEditingClassroom({ ...editingClassroom, locationNote: e.target.value })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-emerald-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Colore Tema Aula
                    </label>
                    <div className="flex items-center gap-3">
                      {[
                        { type: 'blue', label: 'Blu', bg: '#1d4ed8' },
                        { type: 'verde', label: 'Verde', bg: '#15803d' },
                        { type: 'gialla', label: 'Giallo', bg: '#ca8a04' },
                        { type: 'rossa', label: 'Rosso', bg: '#b91c1c' },
                      ].map((col) => (
                        <label
                          key={col.type}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 cursor-pointer text-xs font-medium transition ${
                            editingClassroom.colorType === col.type
                              ? 'border-emerald-700 bg-white text-emerald-950 ring-2 ring-emerald-300 font-bold'
                              : 'border-slate-200 bg-white/70 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="editClassroomColor"
                            value={col.type}
                            checked={editingClassroom.colorType === col.type}
                            onChange={() =>
                              setEditingClassroom({
                                ...editingClassroom,
                                colorType: col.type as any,
                              })
                            }
                            className="sr-only"
                          />
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: col.bg }}
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={() => setEditingClassroom(null)}
                    className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 transition"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 py-2 text-xs sm:text-sm font-medium text-white shadow-sm transition active:scale-95"
                  >
                    <Check className="h-4 w-4" />
                    <span>Salva Modifiche Aula</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Form Inserimento Nuova Aula */
              <form
                onSubmit={handleCreateClassroom}
                className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-sky-900 font-bold text-sm">
                  <Plus className="h-4 w-4 text-sky-700" />
                  <span>Aggiungi Nuova Aula Didattica</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Nome Aula *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Es. Aula Blu, Informatica, Musica"
                      value={newClassroomForm.name}
                      onChange={(e) =>
                        setNewClassroomForm({ ...newClassroomForm, name: e.target.value })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-sky-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Nome Completo / Ufficiale (Opzionale)
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Aula Blu · 1° Piano Ala Ovest"
                      value={newClassroomForm.fullName}
                      onChange={(e) =>
                        setNewClassroomForm({ ...newClassroomForm, fullName: e.target.value })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-sky-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Sede
                    </label>
                    <select
                      value={newClassroomForm.sede}
                      onChange={(e) =>
                        setNewClassroomForm({
                          ...newClassroomForm,
                          sede: e.target.value as 'Quartu' | 'Soleminis',
                        })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-sky-600"
                    >
                      <option value="Quartu">Quartu Sant'Elena</option>
                      <option value="Soleminis">Soleminis</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Capienza Massima Posti
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={newClassroomForm.capacity}
                      onChange={(e) =>
                        setNewClassroomForm({
                          ...newClassroomForm,
                          capacity: Number(e.target.value) || 35,
                        })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-sky-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Ubicazione / Piano / Note
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Piano Terra · Ingresso Ala Sinistra"
                      value={newClassroomForm.locationNote}
                      onChange={(e) =>
                        setNewClassroomForm({ ...newClassroomForm, locationNote: e.target.value })
                      }
                      className="w-full h-10 rounded-xl px-3 text-sm bg-white border border-slate-300 focus:border-sky-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Colore Tema Aula
                    </label>
                    <div className="flex items-center gap-3">
                      {[
                        { type: 'blue', label: 'Blu', bg: '#1d4ed8' },
                        { type: 'verde', label: 'Verde', bg: '#15803d' },
                        { type: 'gialla', label: 'Giallo', bg: '#ca8a04' },
                        { type: 'rossa', label: 'Rosso', bg: '#b91c1c' },
                      ].map((col) => (
                        <label
                          key={col.type}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 cursor-pointer text-xs font-medium transition ${
                            newClassroomForm.colorType === col.type
                              ? 'border-sky-600 bg-white text-sky-950 ring-2 ring-sky-300'
                              : 'border-slate-200 bg-white/60 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="classroomColor"
                            value={col.type}
                            checked={newClassroomForm.colorType === col.type}
                            onChange={() =>
                              setNewClassroomForm({
                                ...newClassroomForm,
                                colorType: col.type as any,
                              })
                            }
                            className="sr-only"
                          />
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: col.bg }}
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Crea Nuova Aula</span>
                  </button>
                </div>
              </form>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClassroomsModal(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
