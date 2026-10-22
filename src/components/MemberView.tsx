import React, { useState } from 'react';
import {
  Check,
  Calendar,
  LogOut,
  X,
  Clock,
  MapPin,
  Users,
  Hand,
  Award,
  AlertCircle,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CLASSROOMS,
  CLASSROOM_LABELS,
  ClassroomInfo,
  DAYS_IT,
  getSubjectMeta,
  Lesson,
} from '../data/initialData';

export const MemberView: React.FC = () => {
  const {
    currentUser,
    signOut,
    lessons,
    attendance,
    activeLessons,
    getActiveLessonForRoom,
    getTodayAttendanceCountForLesson,
    myTodayAttendance,
    registerAttendance,
    cancelAttendance,
    rateAttendance,
    effectiveDay,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'presence' | 'program' | 'history'>('presence');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');

  // Schermata di conferma dopo la timbratura
  const [stampSuccess, setStampSuccess] = useState<{
    roomName: string;
    lesson: Lesson;
    attendanceId: string;
    timeStr: string;
    rated?: 1 | 2 | 3;
  } | null>(null);

  if (!currentUser) return null;

  const isSoleminisMember = (currentUser.sede || 'Quartu').toLowerCase() === 'soleminis';

  const visibleClassrooms = CLASSROOMS.filter((room) => {
    if (isSoleminisMember) return room.key === 'polifunzionale';
    return room.key !== 'polifunzionale';
  });

  const handleRoomStamp = (room: ClassroomInfo) => {
    setFeedbackBanner(null);
    const result = registerAttendance(room.key);
    if (!result.ok) {
      setFeedbackBanner(result.message);
      setTimeout(() => setFeedbackBanner(null), 5000);
      return;
    }
    if (result.lesson && result.attendanceId) {
      setStampSuccess({
        roomName: room.fullName,
        lesson: result.lesson,
        attendanceId: result.attendanceId,
        timeStr: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  };

  const handleRateFromSuccessModal = (rating: 1 | 2 | 3) => {
    if (!stampSuccess) return;
    rateAttendance(stampSuccess.attendanceId, rating);
    setStampSuccess({ ...stampSuccess, rated: rating });
    setTimeout(() => {
      setStampSuccess(null);
    }, 800);
  };

  const myAllAttendance = attendance.filter((a) => a.user_id === currentUser.id);

  const scheduleDays = [1, 2, 3, 4, 5, 6]
    .map((dayIdx) => ({
      dayIdx,
      dayName: DAYS_IT[dayIdx],
      lessons: lessons
        .filter((l) => {
          if (l.day_of_week !== dayIdx) return false;
          if (isSoleminisMember) return l.classroom === 'polifunzionale';
          return l.classroom !== 'polifunzionale';
        })
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }))
    .filter(
      (d) =>
        d.lessons.length > 0 &&
        (selectedDayFilter === 'all' || selectedDayFilter === d.dayIdx)
    );

  return (
    <div className="min-h-[calc(100vh-52px)] bg-slate-50 px-3 py-4 sm:px-5 sm:py-6 text-slate-800">
      {/* Schermata di conferma presenza registrata */}
      {stampSuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-700 p-6 text-white animate-success-in overflow-y-auto">
          <div className="max-w-lg w-full text-center space-y-5 my-auto">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white text-emerald-700 shadow-lg">
              <Check className="h-14 w-14 stroke-[2.2]" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-medium tracking-normal leading-snug">
              Presenza registrata con successo
            </h2>

            <div className="rounded-3xl bg-white/15 border border-white/25 p-5 space-y-2">
              <p className="text-lg sm:text-xl font-normal text-emerald-100">
                {stampSuccess.roomName} · Ore {stampSuccess.timeStr}
              </p>
              <p className="text-xl sm:text-2xl font-medium">
                {getSubjectMeta(stampSuccess.lesson.subject).emoji}{' '}
                {stampSuccess.lesson.subject}
              </p>
              <p className="text-base font-normal text-emerald-100">
                Docente: {stampSuccess.lesson.teacher}
              </p>
            </div>

            {/* Valutazione opzionale semplificata */}
            <div className="rounded-3xl bg-white/10 border border-white/20 p-4 space-y-3">
              <p className="text-base sm:text-lg font-normal">
                Ti piace questa materia? (Facoltativo, tocca una faccina)
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleRateFromSuccessModal(3)}
                  className={`flex flex-col items-center justify-center rounded-2xl p-3 font-normal transition active:scale-95 border ${
                    stampSuccess.rated === 3
                      ? 'bg-white text-emerald-900 border-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/25'
                  }`}
                >
                  <span className="text-3xl mb-1">😊</span>
                  <span className="text-sm sm:text-base">Molto utile</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRateFromSuccessModal(2)}
                  className={`flex flex-col items-center justify-center rounded-2xl p-3 font-normal transition active:scale-95 border ${
                    stampSuccess.rated === 2
                      ? 'bg-white text-emerald-900 border-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/25'
                  }`}
                >
                  <span className="text-3xl mb-1">👍</span>
                  <span className="text-sm sm:text-base">Interessante</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRateFromSuccessModal(1)}
                  className={`flex flex-col items-center justify-center rounded-2xl p-3 font-normal transition active:scale-95 border ${
                    stampSuccess.rated === 1
                      ? 'bg-white text-emerald-900 border-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/25'
                  }`}
                >
                  <span className="text-3xl mb-1">🤔</span>
                  <span className="text-sm sm:text-base">Da migliorare</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStampSuccess(null)}
              className="w-full rounded-2xl bg-white text-emerald-900 hover:bg-emerald-50 py-4 text-xl font-medium shadow-md transition active:scale-95"
            >
              Torna alle aule
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* Intestazione Socio su Sfondo Bianco */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="/app-icon.jpeg"
              alt="QUARTimbra"
              className="h-12 w-12 rounded-2xl object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs sm:text-sm font-normal text-emerald-800">
                  Tessera N° {currentUser.member_number}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-0.5 text-xs sm:text-sm font-normal text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                  Sede {currentUser.sede || 'Quartu'}
                </span>
              </div>
              <p className="truncate text-lg sm:text-xl font-medium text-slate-900 mt-0.5">
                Benvenuto/a, {currentUser.full_name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-base font-normal text-slate-700 transition active:scale-95"
          >
            <LogOut className="h-5 w-5 text-slate-500 stroke-[1.75]" />
            <span>Esci</span>
          </button>
        </header>

        {/* Menu Principale Sobrio e Lineare */}
        <nav
          aria-label="Menu Principale"
          className="grid grid-cols-3 gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm"
        >
          <button
            type="button"
            onClick={() => setActiveTab('presence')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 rounded-2xl px-3 py-3.5 text-base sm:text-lg font-normal transition ${
              activeTab === 'presence'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Hand className="h-5 w-5 shrink-0 stroke-[1.75]" />
            <span>Timbra Presenza</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('program')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 rounded-2xl px-3 py-3.5 text-base sm:text-lg font-normal transition ${
              activeTab === 'program'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-5 w-5 shrink-0 stroke-[1.75]" />
            <span>Programma Corsi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 rounded-2xl px-3 py-3.5 text-base sm:text-lg font-normal transition ${
              activeTab === 'history'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Award className="h-5 w-5 shrink-0 stroke-[1.75]" />
            <span>Le Mie Presenze ({myAllAttendance.length})</span>
          </button>
        </nav>

        {/* Avviso temporaneo */}
        {feedbackBanner && (
          <div className="animate-success-in flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
              <p className="text-base sm:text-lg font-normal">{feedbackBanner}</p>
            </div>
            <button
              onClick={() => setFeedbackBanner(null)}
              className="rounded-full p-1 hover:bg-amber-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* TAB 1: TIMBRA PRESENZA IN AULA */}
        {activeTab === 'presence' && (
          <div className="space-y-4">
            {/* Presenze già registrate oggi */}
            {myTodayAttendance.length > 0 && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
                <p className="text-sm font-medium text-emerald-800 mb-2">
                  ✓ Presenza registrata oggi
                </p>
                <div className="space-y-2">
                  {myTodayAttendance.map((att) => {
                    const les = lessons.find((l) => l.id === att.lesson_id);
                    return (
                      <div
                        key={att.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white border border-emerald-200 px-4 py-3"
                      >
                        <div>
                          <span className="text-base sm:text-lg font-medium text-slate-900">
                            {CLASSROOM_LABELS[att.classroom]} — {les?.subject || 'Lezione'}
                          </span>
                          <span className="block text-sm font-normal text-slate-500">
                            Registrata alle ore{' '}
                            {new Date(att.created_at).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => cancelAttendance(att.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-sm font-normal text-rose-700 transition active:scale-95"
                        >
                          <X className="h-4 w-4" />
                          <span>Annulla se errata</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-base sm:text-lg font-normal text-slate-700">
                Tocca l'aula in cui ti trovi per timbrare la tua presenza:
              </p>
              <span className="text-sm font-normal text-slate-500">
                {activeLessons.length} lezioni attive in questo momento
              </span>
            </div>

            {/* Elenco Aule con grafica bianca pulita, bordo colorato e font lineari */}
            <main className="flex flex-col gap-3">
              {visibleClassrooms.map((room) => {
                const activeLesson = getActiveLessonForRoom(room.key);
                const isAlreadyStamped = activeLesson
                  ? myTodayAttendance.some((a) => a.lesson_id === activeLesson.id)
                  : false;
                const count = activeLesson
                  ? getTodayAttendanceCountForLesson(activeLesson.id)
                  : 0;
                const subjectMeta = activeLesson
                  ? getSubjectMeta(activeLesson.subject)
                  : null;

                return (
                  <button
                    key={room.key}
                    type="button"
                    disabled={!activeLesson || isAlreadyStamped}
                    onClick={() => handleRoomStamp(room)}
                    className={`group relative flex w-full items-center justify-between rounded-3xl border bg-white p-3.5 sm:p-4 text-left transition-all duration-150 ${
                      isAlreadyStamped
                        ? 'border-2 border-emerald-600 bg-emerald-50/40 shadow-sm'
                        : activeLesson
                        ? 'border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md active:scale-[0.99] cursor-pointer'
                        : 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-50'
                    }`}
                  >
                    {/* Barra laterale colore aula */}
                    <div
                      className="w-2 self-stretch rounded-full mr-3 sm:mr-4 shrink-0"
                      style={{ backgroundColor: room.bgColor }}
                    />

                    {/* Icona Aula e Dettagli Corso */}
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                      <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-full border border-slate-200 p-0.5 bg-slate-50">
                        <img
                          src={room.image}
                          alt={room.fullName}
                          className="h-full w-full rounded-full object-cover"
                        />
                        {isAlreadyStamped && (
                          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 ring-2 ring-white text-white shadow">
                            <Check className="h-4 w-4 stroke-[2.5]" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 py-0.5 pr-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-block rounded-lg px-2.5 py-0.5 text-xs sm:text-sm font-normal text-white"
                            style={{ backgroundColor: room.bgColor }}
                          >
                            {room.fullName}
                          </span>
                          {activeLesson && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs sm:text-sm font-normal text-slate-700">
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                              {activeLesson.start_time.slice(0, 5)} –{' '}
                              {activeLesson.end_time.slice(0, 5)}
                            </span>
                          )}
                        </div>

                        {activeLesson ? (
                          <>
                            <p className="mt-1.5 text-xl sm:text-2xl font-medium text-slate-900 leading-snug break-words">
                              <span className="mr-1.5">{subjectMeta?.emoji}</span>
                              {activeLesson.subject}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-normal text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <User className="h-4 w-4 text-slate-400" />{' '}
                                {activeLesson.teacher}
                              </span>
                              <span
                                className={
                                  isAlreadyStamped
                                    ? 'text-emerald-700 font-medium'
                                    : 'text-emerald-700 underline'
                                }
                              >
                                {isAlreadyStamped
                                  ? '✓ Presenza già registrata'
                                  : 'Tocca qui per timbrare la presenza'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className="mt-1.5 text-lg sm:text-xl font-normal text-slate-400">
                            Nessuna lezione attiva in questo momento
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Contatore presenti sobrio e lineare */}
                    <div className="flex flex-col items-center justify-center pl-3 pr-2 sm:pr-4 shrink-0 text-right border-l border-slate-100">
                      <span className="text-3xl sm:text-4xl font-normal tabular-nums leading-none text-slate-800">
                        {count}
                      </span>
                      <span className="mt-1 text-xs font-normal text-slate-500 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> presenti
                      </span>
                    </div>
                  </button>
                );
              })}
            </main>
          </div>
        )}

        {/* TAB 2: PROGRAMMA SETTIMANALE DEI CORSI */}
        {activeTab === 'program' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <Calendar className="h-6 w-6 stroke-[1.75]" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-medium text-slate-900">
                    Programma Settimanale delle Lezioni
                  </h2>
                  <p className="text-sm sm:text-base font-normal text-slate-500">
                    Orari, aule e docenti dei corsi disponibili
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('all')}
                  className={`rounded-xl px-3 py-2 text-xs sm:text-sm font-normal transition ${
                    selectedDayFilter === 'all'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tutti i giorni
                </button>
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDayFilter(d)}
                    className={`rounded-xl px-3 py-2 text-xs sm:text-sm font-normal transition ${
                      selectedDayFilter === d
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {DAYS_IT[d].slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {scheduleDays.map((dayGroup) => (
                <div
                  key={dayGroup.dayIdx}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <h3 className="mb-3 text-lg sm:text-xl font-medium text-slate-900 flex items-center gap-2">
                    <span>{dayGroup.dayName}</span>
                    {dayGroup.dayIdx === effectiveDay && (
                      <span className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-0.5 text-xs font-normal text-emerald-800">
                        Oggi
                      </span>
                    )}
                  </h3>

                  <div className="grid grid-cols-1 gap-2.5">
                    {dayGroup.lessons.map((les) => {
                      const meta = getSubjectMeta(les.subject);
                      const roomObj = CLASSROOMS.find((r) => r.key === les.classroom);
                      return (
                        <div
                          key={les.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                              {meta.emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  style={{ backgroundColor: roomObj?.bgColor || '#2563eb' }}
                                  className="rounded-lg px-2.5 py-0.5 text-xs font-normal text-white"
                                >
                                  {CLASSROOM_LABELS[les.classroom]}
                                </span>
                                <span className="text-xs font-normal text-slate-500">
                                  {meta.category}
                                </span>
                              </div>
                              <p className="mt-1 text-lg sm:text-xl font-medium text-slate-900 leading-snug">
                                {les.subject}
                              </p>
                              <p className="text-sm font-normal text-slate-600">
                                Docente: {les.teacher}
                              </p>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
                            <span className="text-sm font-normal text-slate-500 sm:hidden">
                              Orario:
                            </span>
                            <span className="rounded-xl bg-slate-100 px-3.5 py-1.5 text-base sm:text-lg font-normal tabular-nums text-slate-800">
                              {les.start_time.slice(0, 5)} – {les.end_time.slice(0, 5)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: LE MIE PRESENZE */}
        {activeTab === 'history' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                <Award className="h-6 w-6 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-medium text-slate-900">
                  Le Tue Presenze Registrate
                </h2>
                <p className="text-sm sm:text-base font-normal text-slate-500">
                  Elenco delle lezioni a cui hai partecipato
                </p>
              </div>
            </div>

            {myAllAttendance.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-lg font-normal text-slate-600">
                  Non hai ancora registrato presenze. Vai su "Timbra Presenza" per registrare la tua lezione.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myAllAttendance.map((att) => {
                  const les = lessons.find((l) => l.id === att.lesson_id);
                  const dt = new Date(att.created_at);
                  const meta = getSubjectMeta(les?.subject || '');
                  return (
                    <div
                      key={att.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-emerald-700 px-2.5 py-0.5 text-xs font-normal text-white">
                            {CLASSROOM_LABELS[att.classroom]}
                          </span>
                          <span className="text-sm font-normal text-slate-500 tabular-nums">
                            {dt.toLocaleDateString('it-IT')} · Ore{' '}
                            {dt.toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-lg sm:text-xl font-medium text-slate-900">
                          {meta.emoji} {les?.subject || 'Lezione QU3'}
                        </p>
                        {les?.teacher && (
                          <p className="text-sm font-normal text-slate-600">
                            Docente: {les.teacher}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
                        <span className="text-xs font-normal text-slate-500">
                          Valuta utilità:
                        </span>
                        <div className="flex items-center gap-1.5">
                          {[
                            { val: 3 as const, emoji: '😊', label: 'Molto utile' },
                            { val: 2 as const, emoji: '👍', label: 'Buona' },
                            { val: 1 as const, emoji: '🤔', label: 'Da rivedere' },
                          ].map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => rateAttendance(att.id, opt.val)}
                              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-normal transition active:scale-95 ${
                                att.rating === opt.val
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="text-base">{opt.emoji}</span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
