import React, { useState } from 'react';
import {
  Check,
  Calendar,
  X,
  Clock,
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
  }).sort((a, b) => {
    const aActive = Boolean(getActiveLessonForRoom(a.key));
    const bActive = Boolean(getActiveLessonForRoom(b.key));
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return 0;
  });

  const visibleActiveCount = visibleClassrooms.filter((room) =>
    Boolean(getActiveLessonForRoom(room.key))
  ).length;

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
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-3 py-3 sm:px-5 sm:py-5 text-slate-800">
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

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3.5">
        {/* Menu Principale compatto su una sola riga */}
        <nav
          aria-label="Menu Principale"
          className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs"
        >
          <button
            type="button"
            onClick={() => setActiveTab('presence')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm sm:text-base font-medium transition ${
              activeTab === 'presence'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Hand className="h-4 w-4 shrink-0" />
            <span>Timbra</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('program')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm sm:text-base font-medium transition ${
              activeTab === 'program'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Orario Corsi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm sm:text-base font-medium transition ${
              activeTab === 'history'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Award className="h-4 w-4 shrink-0" />
            <span>Presenze ({myAllAttendance.length})</span>
          </button>
        </nav>

        {/* Avviso temporaneo */}
        {feedbackBanner && (
          <div className="animate-success-in flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm sm:text-base font-normal">{feedbackBanner}</p>
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
          <div className="space-y-3">
            {/* Presenze già registrate oggi */}
            {myTodayAttendance.length > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-2xs">
                <p className="text-xs sm:text-sm font-medium text-emerald-800 mb-2">
                  ✓ Presenza registrata oggi
                </p>
                <div className="space-y-2">
                  {myTodayAttendance.map((att) => {
                    const les = lessons.find((l) => l.id === att.lesson_id);
                    return (
                      <div
                        key={att.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-emerald-200 px-3.5 py-2.5"
                      >
                        <div>
                          <span className="text-sm sm:text-base font-medium text-slate-900">
                            {CLASSROOM_LABELS[att.classroom]} — {les?.subject || 'Lezione'}
                          </span>
                          <span className="block text-xs font-normal text-slate-500">
                            Ore{' '}
                            {new Date(att.created_at).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => cancelAttendance(att.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-normal text-rose-700 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Annulla</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <p className="text-sm sm:text-base font-medium text-slate-800">
                Tocca l'aula in cui ti trovi per timbrare:
              </p>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-normal text-emerald-800 shrink-0">
                {visibleActiveCount} {visibleActiveCount === 1 ? 'lezione attiva ora' : 'lezioni attive ora'}
              </span>
            </div>

            {/* Elenco Aule con layout largo e perfettamente leggibile */}
            <main className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className={`relative flex flex-col justify-between rounded-2xl border bg-white p-4 text-left transition-all duration-150 overflow-hidden ${
                      isAlreadyStamped
                        ? 'border-2 border-emerald-600 bg-emerald-50/40 shadow-xs'
                        : activeLesson
                        ? 'border-slate-200 hover:border-emerald-500 shadow-xs hover:shadow-md active:scale-[0.99] cursor-pointer'
                        : 'border-slate-200 bg-white/80 opacity-75 cursor-not-allowed'
                    }`}
                  >
                    {/* Fascia superiore colore aula */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: room.bgColor }}
                    />

                    {/* Riga 1: Icona + Nome Aula a sinistra, Presenti a destra */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={room.image}
                          alt={room.fullName}
                          className="h-11 w-11 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <span
                            className="inline-block rounded-lg px-2.5 py-0.5 text-xs sm:text-sm font-medium text-white"
                            style={{ backgroundColor: room.bgColor }}
                          >
                            {room.fullName}
                          </span>
                          {activeLesson && (
                            <span className="mt-1 flex items-center gap-1 text-xs font-normal text-slate-600">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {activeLesson.start_time.slice(0, 5)} –{' '}
                              {activeLesson.end_time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 shrink-0">
                        <Users className="h-4 w-4 text-slate-500" />
                        <span className="text-base sm:text-lg font-medium tabular-nums text-slate-800">
                          {count}
                        </span>
                        <span className="text-xs font-normal text-slate-500">presenti</span>
                      </div>
                    </div>

                    {/* Riga 2: Materia a tutta larghezza (mai schiacciata!) */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      {activeLesson ? (
                        <div className="space-y-1.5">
                          <p className="text-lg sm:text-xl font-medium text-slate-900 leading-snug">
                            <span className="mr-1.5">{subjectMeta?.emoji}</span>
                            {activeLesson.subject}
                          </p>
                          <p className="text-sm font-normal text-slate-600 flex items-center gap-1.5">
                            <User className="h-4 w-4 text-slate-400 shrink-0" />
                            <span>{activeLesson.teacher}</span>
                          </p>
                          <div
                            className={`mt-2 rounded-xl py-2 px-3 text-center text-sm font-medium ${
                              isAlreadyStamped
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-emerald-700 text-white'
                            }`}
                          >
                            {isAlreadyStamped
                              ? '✓ Presenza già registrata'
                              : 'Tocca qui per timbrare la presenza'}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm sm:text-base font-normal text-slate-400 py-1">
                          Nessuna lezione attiva in questo momento
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </main>
          </div>
        )}

        {/* TAB 2: PROGRAMMA SETTIMANALE DEI CORSI */}
        {activeTab === 'program' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-medium text-slate-900">
                  Orario Settimanale dei Corsi
                </h2>
                <p className="text-xs sm:text-sm font-normal text-slate-500">
                  Scegli il giorno per vedere lezioni, aule e docenti
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('all')}
                  className={`rounded-xl px-3 py-1.5 text-xs sm:text-sm font-normal transition ${
                    selectedDayFilter === 'all'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tutti
                </button>
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDayFilter(d)}
                    className={`rounded-xl px-3 py-1.5 text-xs sm:text-sm font-normal transition ${
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
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4"
                >
                  <h3 className="mb-2.5 text-base sm:text-lg font-medium text-slate-900 flex items-center gap-2">
                    <span>{dayGroup.dayName}</span>
                    {dayGroup.dayIdx === effectiveDay && (
                      <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-normal text-emerald-800">
                        Oggi
                      </span>
                    )}
                  </h3>

                  <div className="grid grid-cols-1 gap-2">
                    {dayGroup.lessons.map((les) => {
                      const meta = getSubjectMeta(les.subject);
                      const roomObj = CLASSROOMS.find((r) => r.key === les.classroom);
                      return (
                        <div
                          key={les.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                              {meta.emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  style={{ backgroundColor: roomObj?.bgColor || '#2563eb' }}
                                  className="rounded-lg px-2 py-0.5 text-xs font-normal text-white"
                                >
                                  {CLASSROOM_LABELS[les.classroom]}
                                </span>
                                <span className="text-xs font-normal text-slate-500">
                                  {les.start_time.slice(0, 5)} – {les.end_time.slice(0, 5)}
                                </span>
                              </div>
                              <p className="mt-1 text-base sm:text-lg font-medium text-slate-900 leading-snug">
                                {les.subject}
                              </p>
                              <p className="text-xs sm:text-sm font-normal text-slate-600">
                                Docente: {les.teacher}
                              </p>
                            </div>
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
          <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-lg sm:text-xl font-medium text-slate-900">
                Le Tue Presenze Registrate
              </h2>
              <p className="text-xs sm:text-sm font-normal text-slate-500">
                Elenco delle lezioni a cui hai partecipato
              </p>
            </div>

            {myAllAttendance.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-base font-normal text-slate-600">
                  Non hai ancora registrato presenze. Vai su "Timbra" per registrare la lezione.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myAllAttendance.map((att) => {
                  const les = lessons.find((l) => l.id === att.lesson_id);
                  const dt = new Date(att.created_at);
                  const meta = getSubjectMeta(les?.subject || '');
                  return (
                    <div
                      key={att.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-emerald-700 px-2.5 py-0.5 text-xs font-normal text-white">
                            {CLASSROOM_LABELS[att.classroom]}
                          </span>
                          <span className="text-xs sm:text-sm font-normal text-slate-500 tabular-nums">
                            {dt.toLocaleDateString('it-IT')} · Ore{' '}
                            {dt.toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-base sm:text-lg font-medium text-slate-900">
                          {meta.emoji} {les?.subject || 'Lezione QU3'}
                        </p>
                        {les?.teacher && (
                          <p className="text-xs sm:text-sm font-normal text-slate-600">
                            Docente: {les.teacher}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {[
                          { val: 3 as const, emoji: '😊', label: 'Utile' },
                          { val: 2 as const, emoji: '👍', label: 'Buona' },
                          { val: 1 as const, emoji: '🤔', label: 'Così così' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => rateAttendance(att.id, opt.val)}
                            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-normal transition ${
                              att.rating === opt.val
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{opt.emoji}</span>
                            <span>{opt.label}</span>
                          </button>
                        ))}
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
