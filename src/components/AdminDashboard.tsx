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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CLASSROOMS,
  CLASSROOM_LABELS,
  ClassroomKey,
  DAYS_IT,
  getSubjectMeta,
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
    addLesson,
    deleteLesson,
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
  const [memberSortBy, setMemberSortBy] = useState<'member_number' | 'full_name' | 'attendances'>('member_number');
  const [newMemberNum, setNewMemberNum] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberSede, setNewMemberSede] = useState<'Quartu' | 'Soleminis'>('Quartu');
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
          (l) => CLASSROOMS.find((c) => c.key === l.classroom)?.capacity || 40
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
  }, [profiles, memberSearch, memberSedeFilter, memberSortBy, attendanceByMember]);

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
    const res = addMember(newMemberNum, newMemberName, newMemberSede);
    if (!res.ok) {
      setMemberFormMsg(res.message || 'Errore');
    } else {
      setNewMemberNum('');
      setNewMemberName('');
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
    <div className="min-h-[calc(100vh-52px)] bg-slate-50 pb-12 text-slate-800">
      {/* Intestazione Piattaforma Ufficio Presenze & Didattica */}
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/q3-icon.jpeg"
              alt="Q3"
              className="h-12 w-12 rounded-2xl object-cover border border-slate-200"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-normal text-emerald-800">
                  Ufficio Presenze & Settore Didattica
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-normal text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {cloudConnected
                    ? `Cloud Sincronizzato (${connectedDevices} disp. online)`
                    : 'Sincronizzazione locale attiva'}
                  {lastCloudSync && ` · Agg. ${lastCloudSync}`}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-medium text-slate-900 mt-0.5">
                Q3 — Piattaforma Monitoraggio Soci e Corsi
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs sm:text-sm font-normal text-white shadow-sm transition"
            >
              <Share2 className="h-4 w-4" />
              <span>Link & QR per i Soci</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTimeSim(!showTimeSim)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs sm:text-sm font-normal text-slate-700 transition"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              <span>
                {DAYS_IT[effectiveDay]} · {effectiveTime}
              </span>
            </button>

            <button
              type="button"
              onClick={resetDemoData}
              title="Ripristina dati dimostrativi"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs sm:text-sm font-normal text-slate-700 transition"
            >
              <RotateCcw className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Ripristina Demo</span>
            </button>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-sm transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Esci dall'Ufficio</span>
            </button>
          </div>
        </div>

        {/* Barra simulazione orario (opzionale per testare diverse fasce orarie) */}
        {showTimeSim && (
          <div className="mx-auto mt-3 max-w-6xl rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-normal text-slate-600 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-emerald-700" />
              Simula fascia oraria lezione:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Lun 10:00', day: 1, time: '10:00' },
                { label: 'Mar 10:00', day: 2, time: '10:00' },
                { label: 'Mer 10:15', day: 3, time: '10:15' },
                { label: 'Gio 10:30 (Oggi)', day: 4, time: '10:30' },
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
                  className={`rounded-lg px-2.5 py-1 text-xs font-normal border transition ${
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
                  className="rounded-lg bg-slate-700 text-white px-2.5 py-1 text-xs font-normal"
                >
                  Orario reale
                </button>
              )}
            </div>
          </div>
        )}

        {/* Menu Sezioni Piattaforma */}
        <div className="mx-auto mt-4 max-w-6xl grid grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            {
              key: 'live' as const,
              label: 'Soci Timbrati in Aula (Live)',
              icon: Radio,
              badge: 'Tempo reale',
            },
            {
              key: 'analytics' as const,
              label: 'Efficacia e Utilità Materie',
              icon: TrendingUp,
              badge: `${subjectEffectivenessRows.length} corsi`,
            },
            {
              key: 'users' as const,
              label: 'Anagrafica e Singoli Soci',
              icon: Users,
              badge: `${profiles.filter((p) => p.role === 'member').length} soci`,
            },
            {
              key: 'schedule' as const,
              label: 'Programma Orario Aule',
              icon: Calendar,
              badge: `${lessons.length} lezioni`,
            },
            {
              key: 'reports' as const,
              label: 'Registri PDF e CSV',
              icon: FileBarChart,
              badge: `${attendance.length} presenze`,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-3 text-left font-normal transition ${
                  isActive
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 stroke-[1.75]" />
                  <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-normal shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
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
              {CLASSROOMS.map((room) => {
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
                    Anagrafica Soci e Monitoraggio Presenze Individuali
                  </h2>
                  <p className="text-xs sm:text-sm font-normal text-slate-500">
                    Cerca un socio, verifica quante lezioni segue o aggiungi un nuovo iscritto
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    exportOfficialPdf({
                      title: 'Elenco Ufficiale Soci e Riepilogo Presenze Individuali',
                      subtitle: `Totale soci in elenco: ${filteredMembers.length}`,
                      head: [
                        'N° Tessera',
                        'Cognome e Nome',
                        'Sede',
                        'Presenze Registrate',
                        'Ultima Presenza',
                      ],
                      body: filteredMembers.map((m) => {
                        const recs = attendanceByMember[m.id] || [];
                        const lastDt = recs[0]
                          ? new Date(recs[0].created_at).toLocaleDateString('it-IT')
                          : 'Nessuna';
                        return [m.member_number, m.full_name, m.sede, recs.length, lastDt];
                      }),
                      fileName: `elenco_soci_presenze_${new Date().toISOString().slice(0, 10)}.pdf`,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-sm font-normal text-white shadow-sm transition"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Esporta PDF Soci & Presenze</span>
                </button>
              </div>

              <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
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
                      <th className="p-4">N° Tessera</th>
                      <th className="p-4">Nome Completo</th>
                      <th className="p-4">Sede</th>
                      <th className="p-4">Lezioni Seguite</th>
                      <th className="p-4">Ultima Presenza</th>
                      <th className="p-4 text-right">Azioni e Scheda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => {
                      const recs = attendanceByMember[m.id] || [];
                      const lastRec = recs[0];
                      const isEditing = editingMemberId === m.id;

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
                              <td className="p-3 font-normal">{recs.length}</td>
                              <td className="p-3">—</td>
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
                              <td className="p-4 font-normal tabular-nums text-base">
                                <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-800">
                                  {m.member_number}
                                </span>
                              </td>
                              <td className="p-4 font-medium text-base text-slate-900">
                                {m.full_name}
                              </td>
                              <td className="p-4 text-sm font-normal text-slate-600">
                                {m.sede}
                              </td>
                              <td className="p-4">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-sm font-normal text-sky-800 tabular-nums">
                                  {recs.length} presenze
                                </span>
                              </td>
                              <td className="p-4 text-sm font-normal text-slate-500 tabular-nums">
                                {lastRec
                                  ? new Date(lastRec.created_at).toLocaleDateString('it-IT')
                                  : '—'}
                              </td>
                              <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setInspectedMember(m)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-xs font-normal text-white shadow-sm transition"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Scheda Presenze</span>
                                </button>
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
                                  title="Modifica socio"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                {m.role !== 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => deleteMember(m.id)}
                                    className="inline-flex items-center justify-center rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                                    title="Elimina socio"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
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
                    Aggiungi o rimuovi lezioni dal calendario settimanale
                  </p>
                </div>

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
                    {CLASSROOMS.map((c) => (
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
                      if (!newLesson.subject.trim()) return;
                      addLesson({
                        ...newLesson,
                        teacher: newLesson.teacher.trim() || 'Docente QU3',
                        category: getSubjectMeta(newLesson.subject).category,
                      });
                      setNewLesson({ ...newLesson, subject: '', teacher: '' });
                    }}
                    className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-normal flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Inserisci nel Programma</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={`rounded-3xl overflow-hidden ${cardClass}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-normal uppercase tracking-wider text-slate-500">
                      <th className="p-4">Giorno</th>
                      <th className="p-4">Aula</th>
                      <th className="p-4">Materia</th>
                      <th className="p-4">Docente</th>
                      <th className="p-4">Orario</th>
                      <th className="p-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...lessons]
                      .sort(
                        (a, b) =>
                          a.day_of_week - b.day_of_week ||
                          a.start_time.localeCompare(b.start_time)
                      )
                      .map((les) => {
                        const meta = getSubjectMeta(les.subject);
                        return (
                          <tr
                            key={les.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                          >
                            <td className="p-4 font-normal text-slate-700">
                              {DAYS_IT[les.day_of_week]}
                            </td>
                            <td className="p-4 font-normal text-slate-700">
                              {CLASSROOM_LABELS[les.classroom]}
                            </td>
                            <td className="p-4 font-medium text-slate-900">
                              {meta.emoji} {les.subject}
                            </td>
                            <td className="p-4 text-sm font-normal text-slate-600">
                              {les.teacher}
                            </td>
                            <td className="p-4 font-normal tabular-nums text-slate-700">
                              {les.start_time.slice(0, 5)} – {les.end_time.slice(0, 5)}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                type="button"
                                onClick={() => deleteLesson(les.id)}
                                className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                                title="Rimuovi lezione"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
    </div>
  );
};
