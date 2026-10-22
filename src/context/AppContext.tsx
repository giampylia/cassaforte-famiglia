import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  AttendanceRecord,
  ClassroomKey,
  CLASSROOM_LABELS,
  generateInitialAttendance,
  INITIAL_LESSONS,
  INITIAL_PROFILES,
  INITIAL_SUBJECT_NOTES,
  Lesson,
  Profile,
  SubjectDidacticNote,
  getSubjectMeta,
} from '../data/initialData';
import { playSuccessSound } from '../utils/soundAndPdf';

export type FontScale = 'normal' | 'large' | 'xlarge';

export interface LiveFeedEvent {
  id: string;
  timestamp: string;
  memberNumber: string;
  memberName: string;
  classroom: ClassroomKey;
  subject: string;
  action: 'stamp' | 'cancel' | 'assisted';
}

interface CloudDbSnapshot {
  profiles: Profile[];
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  subjectNotes: SubjectDidacticNote[];
  visualHeadcounts: Record<ClassroomKey, number>;
  liveFeed: LiveFeedEvent[];
  updatedAt: string;
}

interface AppContextType {
  currentUser: Profile | null;
  profiles: Profile[];
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  subjectNotes: SubjectDidacticNote[];
  visualHeadcounts: Record<ClassroomKey, number>;
  liveFeed: LiveFeedEvent[];
  cloudConnected: boolean;
  connectedDevices: number;
  lastCloudSync: string | null;
  publicUrl: string | null;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  lightTheme: boolean;
  setLightTheme: (val: boolean) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (val: boolean) => void;
  // Time simulator for testing any day/time
  isSimulatingTime: boolean;
  setIsSimulatingTime: (val: boolean) => void;
  effectiveDay: number;
  setSimulatedDay: (day: number) => void;
  effectiveTime: string;
  setSimulatedTime: (time: string) => void;
  // Active lessons right now
  activeLessons: Lesson[];
  getActiveLessonForRoom: (room: ClassroomKey) => Lesson | null;
  getTodayAttendanceCountForLesson: (lessonId: string) => number;
  getTodayAttendancesForRoom: (room: ClassroomKey) => AttendanceRecord[];
  myTodayAttendance: AttendanceRecord[];
  // Auth
  signInMember: (memberCardNumber: string) => { error: string | null };
  signInAdmin: (secretCode: string) => { error: string | null };
  signOut: () => void;
  // Member actions
  registerAttendance: (room: ClassroomKey) => { ok: boolean; message: string; attendanceId?: string; lesson?: Lesson };
  registerAssistedAttendance: (room: ClassroomKey, memberCardNumber: string) => { ok: boolean; message: string };
  cancelAttendance: (attendanceId: string) => void;
  rateAttendance: (attendanceId: string, rating: 1 | 2 | 3) => void;
  // Live Classroom Headcount (for Ufficio Presenze in classroom)
  setRoomVisualHeadcount: (room: ClassroomKey, count: number) => void;
  // Admin actions
  addMember: (member_number: string, full_name: string, sede: 'Quartu' | 'Soleminis', phone?: string) => { ok: boolean; message?: string };
  updateMember: (id: string, data: Partial<Profile>) => void;
  deleteMember: (id: string) => void;
  addLesson: (lesson: Omit<Lesson, 'id'>) => void;
  updateLesson: (id: string, data: Partial<Lesson>) => void;
  deleteLesson: (id: string) => void;
  saveSubjectNote: (note: SubjectDidacticNote) => void;
  resetDemoData: () => void;
}

const STORAGE_KEYS = {
  USER: 'quartimbra_current_user_v3',
  PROFILES: 'quartimbra_profiles_v3',
  LESSONS: 'quartimbra_lessons_v3',
  ATTENDANCE: 'quartimbra_attendance_v3',
  NOTES: 'quartimbra_subject_notes_v3',
  HEADCOUNTS: 'quartimbra_headcounts_v3',
  LIVE_FEED: 'quartimbra_live_feed_v3',
  FONT_SCALE: 'quartimbra_font_scale_v3',
  LIGHT_THEME: 'quartimbra_light_theme_v3',
  VOICE: 'quartimbra_voice_v3',
};

const DEFAULT_HEADCOUNTS: Record<ClassroomKey, number> = {
  verde: 45,
  gialla: 30,
  rossa: 95,
  rocchitta: 25,
  san_benedetto: 40,
  biblioteca: 20,
  ferrini: 30,
  polifunzionale: 35,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILES);
      return saved ? JSON.parse(saved) : INITIAL_PROFILES;
    } catch {
      return INITIAL_PROFILES;
    }
  });

  const [lessons, setLessons] = useState<Lesson[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LESSONS);
      return saved ? JSON.parse(saved) : INITIAL_LESSONS;
    } catch {
      return INITIAL_LESSONS;
    }
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      return saved ? JSON.parse(saved) : generateInitialAttendance();
    } catch {
      return generateInitialAttendance();
    }
  });

  const [subjectNotes, setSubjectNotes] = useState<SubjectDidacticNote[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
      return saved ? JSON.parse(saved) : INITIAL_SUBJECT_NOTES;
    } catch {
      return INITIAL_SUBJECT_NOTES;
    }
  });

  const [visualHeadcounts, setVisualHeadcounts] = useState<Record<ClassroomKey, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HEADCOUNTS);
      return saved ? JSON.parse(saved) : DEFAULT_HEADCOUNTS;
    } catch {
      return DEFAULT_HEADCOUNTS;
    }
  });

  const [liveFeed, setLiveFeed] = useState<LiveFeedEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIVE_FEED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [fontScale, setFontScale] = useState<FontScale>(() => {
    return (localStorage.getItem(STORAGE_KEYS.FONT_SCALE) as FontScale) || 'large';
  });

  // White background by default as requested by user!
  const [lightTheme, setLightTheme] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LIGHT_THEME);
    return saved !== null ? saved === 'true' : true;
  });

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOICE);
    return saved !== null ? saved === 'true' : true;
  });

  const [cloudConnected, setCloudConnected] = useState<boolean>(false);
  const [connectedDevices, setConnectedDevices] = useState<number>(1);
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const isApplyingRemoteRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Real clock vs simulated clock
  const [isSimulatingTime, setIsSimulatingTime] = useState<boolean>(false);
  const [simulatedDay, setSimulatedDay] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 1 : d;
  });
  const [simulatedTime, setSimulatedTime] = useState<string>('10:15');
  const [realNow, setRealNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setRealNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Push state snapshot to Cloud Server & BroadcastChannel
  const pushCloudSnapshot = async (snapshot: CloudDbSnapshot, eventLabel?: string) => {
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'STATE_SYNC', db: snapshot });
      }
    } catch {
      // Ignore BroadcastChannel errors
    }

    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db: snapshot, eventLabel }),
      });
      if (res.ok) {
        const data = await res.json();
        setCloudConnected(true);
        if (data.publicUrl) setPublicUrl(data.publicUrl);
        if (typeof data.connectedDevices === 'number') {
          setConnectedDevices(Math.max(1, data.connectedDevices));
        }
        setLastCloudSync(new Date().toLocaleTimeString('it-IT'));
      }
    } catch {
      // Offline fallback: localStorage continues to work seamlessly
    }
  };

  const applyRemoteSnapshot = (db: CloudDbSnapshot) => {
    if (!db) return;
    isApplyingRemoteRef.current = true;
    if (Array.isArray(db.profiles)) setProfiles(db.profiles);
    if (Array.isArray(db.lessons)) setLessons(db.lessons);
    if (Array.isArray(db.attendance)) setAttendance(db.attendance);
    if (Array.isArray(db.subjectNotes)) setSubjectNotes(db.subjectNotes);
    if (db.visualHeadcounts) setVisualHeadcounts(db.visualHeadcounts);
    if (Array.isArray(db.liveFeed)) setLiveFeed(db.liveFeed);
    setLastCloudSync(new Date().toLocaleTimeString('it-IT'));
    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 50);
  };

  // Connect to Real-Time Cloud Server (/api/state + /api/events SSE) and BroadcastChannel
  useEffect(() => {
    // 1. Initial fetch from Cloud server
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => {
        setCloudConnected(true);
        if (data.publicUrl) setPublicUrl(data.publicUrl);
        if (typeof data.connectedDevices === 'number') {
          setConnectedDevices(Math.max(1, data.connectedDevices));
        }
        if (data.db && data.db.attendance && data.db.attendance.length > 0) {
          applyRemoteSnapshot(data.db);
        } else {
          // Initialize cloud server with our initial data
          pushCloudSnapshot({
            profiles,
            lessons,
            attendance,
            subjectNotes,
            visualHeadcounts,
            liveFeed,
            updatedAt: new Date().toISOString(),
          });
        }
      })
      .catch(() => {
        setCloudConnected(false);
      });

    // 2. Subscribe to Server-Sent Events (/api/events) for sub-second real-time sync
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events');
      es.onopen = () => setCloudConnected(true);
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.publicUrl) setPublicUrl(parsed.publicUrl);
          if (parsed.type === 'CONNECTED' && typeof parsed.connectedClients === 'number') {
            setConnectedDevices(Math.max(1, parsed.connectedClients));
          } else if (parsed.type === 'STATE_SYNC' && parsed.payload?.db) {
            applyRemoteSnapshot(parsed.payload.db);
          } else if (parsed.type === 'PUBLIC_URL' && parsed.payload?.publicUrl) {
            setPublicUrl(parsed.payload.publicUrl);
          }
        } catch {
          // Ignore malformed SSE message
        }
      };
      es.onerror = () => {
        setCloudConnected(false);
      };
    } catch {
      // Ignore SSE errors
    }

    // 3. Subscribe to BroadcastChannel for instant multi-tab sync
    try {
      const bc = new BroadcastChannel('quartimbra_cloud_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'STATE_SYNC' && ev.data.db) {
          applyRemoteSnapshot(ev.data.db);
        }
      };
      broadcastChannelRef.current = bc;
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      if (es) es.close();
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale);
    localStorage.setItem(STORAGE_KEYS.FONT_SCALE, fontScale);
  }, [fontScale]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LIGHT_THEME, String(lightTheme));
  }, [lightTheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOICE, String(voiceEnabled));
  }, [voiceEnabled]);

  // Persist to localStorage & sync to Cloud when state changes locally
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    localStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(subjectNotes));
    localStorage.setItem(STORAGE_KEYS.HEADCOUNTS, JSON.stringify(visualHeadcounts));
    localStorage.setItem(STORAGE_KEYS.LIVE_FEED, JSON.stringify(liveFeed));

    if (!isApplyingRemoteRef.current) {
      pushCloudSnapshot({
        profiles,
        lessons,
        attendance,
        subjectNotes,
        visualHeadcounts,
        liveFeed,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [profiles, lessons, attendance, subjectNotes, visualHeadcounts, liveFeed]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [currentUser]);

  const effectiveDay = isSimulatingTime ? simulatedDay : realNow.getDay();
  const effectiveTime = isSimulatingTime
    ? simulatedTime
    : realNow.toTimeString().slice(0, 5);

  const activeLessons = useMemo(() => {
    return lessons.filter((les) => {
      if (les.day_of_week !== effectiveDay) return false;
      const [sh, sm] = les.start_time.split(':').map(Number);
      const startMinus10 = Math.max(0, sh * 60 + sm - 10);
      const openTimeStr = `${String(Math.floor(startMinus10 / 60)).padStart(2, '0')}:${String(startMinus10 % 60).padStart(2, '0')}`;
      const closeTimeStr = les.end_time.slice(0, 5);
      return effectiveTime >= openTimeStr && effectiveTime <= closeTimeStr;
    });
  }, [lessons, effectiveDay, effectiveTime]);

  const getActiveLessonForRoom = (room: ClassroomKey): Lesson | null => {
    return activeLessons.find((l) => l.classroom === room) || null;
  };

  const todayIsoPrefix = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const getTodayAttendanceCountForLesson = (lessonId: string): number => {
    return attendance.filter(
      (a) => a.lesson_id === lessonId && a.created_at.slice(0, 10) === todayIsoPrefix
    ).length;
  };

  const getTodayAttendancesForRoom = (room: ClassroomKey): AttendanceRecord[] => {
    const activeLesson = getActiveLessonForRoom(room);
    if (activeLesson) {
      return attendance.filter(
        (a) => a.lesson_id === activeLesson.id && a.created_at.slice(0, 10) === todayIsoPrefix
      );
    }
    return attendance.filter(
      (a) => a.classroom === room && a.created_at.slice(0, 10) === todayIsoPrefix
    );
  };

  const myTodayAttendance = useMemo(() => {
    if (!currentUser) return [];
    return attendance.filter(
      (a) => a.user_id === currentUser.id && a.created_at.slice(0, 10) === todayIsoPrefix
    );
  }, [attendance, currentUser, todayIsoPrefix]);

  // Member login: ONLY accepts member card numbers (never logs into admin!)
  const signInMember = (rawCardNumber: string): { error: string | null } => {
    const cleaned = rawCardNumber.trim();
    if (!cleaned) {
      return { error: 'Digita il numero della tua tessera per entrare.' };
    }

    // Prevent anyone from entering "admin" in the member login box
    if (cleaned.toLowerCase() === 'admin' || cleaned.includes('@')) {
      return {
        error: 'Inserisci un numero di tessera socio valido (solo cifre). Per l\'Ufficio Presenze usa il link riservato in fondo alla pagina.',
      };
    }

    const matched = profiles.find(
      (p) =>
        p.role === 'member' &&
        (p.member_number.toLowerCase() === cleaned.toLowerCase() ||
          p.full_name.toLowerCase() === cleaned.toLowerCase())
    );

    if (matched) {
      setCurrentUser(matched);
      return { error: null };
    }

    if (/^\d+$/.test(cleaned)) {
      const autoProfile: Profile = {
        id: `u-${cleaned}`,
        member_number: cleaned,
        full_name: `Socio Tessera N° ${cleaned}`,
        sede: Number(cleaned) >= 200 && Number(cleaned) < 300 ? 'Soleminis' : 'Quartu',
        role: 'member',
        joined_year: new Date().getFullYear(),
      };
      setProfiles((prev) => [...prev, autoProfile]);
      setCurrentUser(autoProfile);
      return { error: null };
    }

    return {
      error: 'Numero di tessera non riconosciuto. Controlla le cifre riportate sulla tua tessera socio.',
    };
  };

  // Dedicated Staff / Ufficio Presenze login protected by PIN/Password
  const signInAdmin = (secretCode: string): { error: string | null } => {
    const cleaned = secretCode.trim().toLowerCase();
    // Accept office codes: "07088", "ufficio", "didattica", "quartu2026", "admin2024"
    if (
      cleaned === '07088' ||
      cleaned === 'ufficio' ||
      cleaned === 'didattica' ||
      cleaned === 'quartu2026' ||
      cleaned === 'admin2024' ||
      cleaned === 'admin'
    ) {
      const adminProfile = profiles.find((p) => p.role === 'admin') || INITIAL_PROFILES[0];
      setCurrentUser(adminProfile);
      return { error: null };
    }
    return { error: 'Codice Ufficio non valido.' };
  };

  const signOut = () => {
    setCurrentUser(null);
  };

  const registerAttendance = (room: ClassroomKey) => {
    if (!currentUser) {
      return { ok: false, message: 'Effettua prima l\'accesso.' };
    }
    const activeLesson = getActiveLessonForRoom(room);
    if (!activeLesson) {
      return {
        ok: false,
        message: 'Nessuna lezione attiva in questa aula in questo momento.',
      };
    }

    const alreadyThisLesson = myTodayAttendance.some(
      (a) => a.lesson_id === activeLesson.id
    );
    if (alreadyThisLesson) {
      return {
        ok: false,
        message: 'Hai già timbrato la tua presenza per questa lezione.',
      };
    }

    const overlapping = myTodayAttendance.find((att) => {
      const otherLesson = activeLessons.find((l) => l.id === att.lesson_id);
      if (!otherLesson || otherLesson.id === activeLesson.id) return false;
      return (
        otherLesson.start_time <= activeLesson.end_time &&
        otherLesson.end_time >= activeLesson.start_time
      );
    });

    if (overlapping) {
      const otherRoomName = CLASSROOM_LABELS[overlapping.classroom] || overlapping.classroom;
      return {
        ok: false,
        message: `Hai già registrato la presenza in ${otherRoomName} per questo orario. Se hai toccato l'aula sbagliata, premi prima "Annulla" in alto.`,
      };
    }

    const nowIso = new Date().toISOString();
    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      user_id: currentUser.id,
      classroom: room,
      lesson_id: activeLesson.id,
      created_at: nowIso,
    };

    const feedItem: LiveFeedEvent = {
      id: `feed-${Date.now()}`,
      timestamp: nowIso,
      memberNumber: currentUser.member_number,
      memberName: currentUser.full_name,
      classroom: room,
      subject: activeLesson.subject,
      action: 'stamp',
    };

    setAttendance((prev) => [newRecord, ...prev]);
    setLiveFeed((prev) => [feedItem, ...prev.slice(0, 49)]);

    playSuccessSound(
      `Presenza registrata in ${CLASSROOM_LABELS[room]}`,
      voiceEnabled
    );

    return {
      ok: true,
      message: 'Presenza Registrata con Successo',
      attendanceId: newRecord.id,
      lesson: activeLesson,
    };
  };

  // Allows office staff in the classroom to stamp on behalf of a seated member
  const registerAssistedAttendance = (room: ClassroomKey, memberCardNumber: string) => {
    const cleanNum = memberCardNumber.trim();
    if (!cleanNum) return { ok: false, message: 'Inserisci il numero di tessera del socio.' };

    const activeLesson = getActiveLessonForRoom(room);
    if (!activeLesson) {
      return { ok: false, message: 'Nessuna lezione attiva in quest\'aula in questo orario.' };
    }

    let member = profiles.find(
      (p) => p.role === 'member' && p.member_number.toLowerCase() === cleanNum.toLowerCase()
    );

    if (!member) {
      member = {
        id: `u-${cleanNum}`,
        member_number: cleanNum,
        full_name: `Socio Tessera N° ${cleanNum}`,
        sede: room === 'polifunzionale' ? 'Soleminis' : 'Quartu',
        role: 'member',
        joined_year: new Date().getFullYear(),
      };
      setProfiles((prev) => [...prev, member!]);
    }

    const already = attendance.some(
      (a) =>
        a.user_id === member!.id &&
        a.lesson_id === activeLesson.id &&
        a.created_at.slice(0, 10) === todayIsoPrefix
    );

    if (already) {
      return {
        ok: false,
        message: `${member.full_name} (Tessera ${member.member_number}) risulta già registrato in quest'aula.`,
      };
    }

    const nowIso = new Date().toISOString();
    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      user_id: member.id,
      classroom: room,
      lesson_id: activeLesson.id,
      created_at: nowIso,
    };

    const feedItem: LiveFeedEvent = {
      id: `feed-${Date.now()}`,
      timestamp: nowIso,
      memberNumber: member.member_number,
      memberName: member.full_name,
      classroom: room,
      subject: activeLesson.subject,
      action: 'assisted',
    };

    setAttendance((prev) => [newRecord, ...prev]);
    setLiveFeed((prev) => [feedItem, ...prev.slice(0, 49)]);

    return {
      ok: true,
      message: `Registrata presenza per ${member.full_name} (Tessera N° ${member.member_number}).`,
    };
  };

  const cancelAttendance = (attendanceId: string) => {
    setAttendance((prev) => prev.filter((a) => a.id !== attendanceId));
  };

  const rateAttendance = (attendanceId: string, rating: 1 | 2 | 3) => {
    setAttendance((prev) =>
      prev.map((a) => (a.id === attendanceId ? { ...a, rating } : a))
    );
  };

  const setRoomVisualHeadcount = (room: ClassroomKey, count: number) => {
    const safeCount = Math.max(0, Math.min(500, Math.round(count)));
    setVisualHeadcounts((prev) => ({
      ...prev,
      [room]: safeCount,
    }));
  };

  const addMember = (
    member_number: string,
    full_name: string,
    sede: 'Quartu' | 'Soleminis',
    phone?: string
  ) => {
    const cleanNum = member_number.trim();
    if (!cleanNum) return { ok: false, message: 'Inserisci il numero di tessera.' };
    if (profiles.some((p) => p.member_number.toLowerCase() === cleanNum.toLowerCase())) {
      return { ok: false, message: 'Esiste già un socio con questo numero di tessera.' };
    }
    const newProfile: Profile = {
      id: `u-${Date.now()}`,
      member_number: cleanNum,
      full_name: full_name.trim() || `Socio ${cleanNum}`,
      sede,
      role: 'member',
      phone: phone?.trim() || '',
      joined_year: new Date().getFullYear(),
    };
    setProfiles((prev) => [...prev, newProfile]);
    return { ok: true };
  };

  const updateMember = (id: string, data: Partial<Profile>) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...data } : null));
    }
  };

  const deleteMember = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const addLesson = (lessonData: Omit<Lesson, 'id'>) => {
    const meta = getSubjectMeta(lessonData.subject);
    const newLesson: Lesson = {
      ...lessonData,
      category: lessonData.category || meta.category,
      id: `les-${Date.now()}`,
    };
    setLessons((prev) => [...prev, newLesson]);
  };

  const updateLesson = (id: string, data: Partial<Lesson>) => {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, ...data } : l)));
  };

  const deleteLesson = (id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
  };

  const saveSubjectNote = (note: SubjectDidacticNote) => {
    setSubjectNotes((prev) => {
      const exists = prev.some((n) => n.subject === note.subject);
      if (exists) {
        return prev.map((n) => (n.subject === note.subject ? note : n));
      }
      return [...prev, note];
    });
  };

  const resetDemoData = () => {
    setProfiles(INITIAL_PROFILES);
    setLessons(INITIAL_LESSONS);
    setAttendance(generateInitialAttendance());
    setSubjectNotes(INITIAL_SUBJECT_NOTES);
    setVisualHeadcounts(DEFAULT_HEADCOUNTS);
    setLiveFeed([]);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
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
        fontScale,
        setFontScale,
        lightTheme,
        setLightTheme,
        voiceEnabled,
        setVoiceEnabled,
        isSimulatingTime,
        setIsSimulatingTime,
        effectiveDay,
        setSimulatedDay,
        effectiveTime,
        setSimulatedTime,
        activeLessons,
        getActiveLessonForRoom,
        getTodayAttendanceCountForLesson,
        getTodayAttendancesForRoom,
        myTodayAttendance,
        signInMember,
        signInAdmin,
        signOut,
        registerAttendance,
        registerAssistedAttendance,
        cancelAttendance,
        rateAttendance,
        setRoomVisualHeadcount,
        addMember,
        updateMember,
        deleteMember,
        addLesson,
        updateLesson,
        deleteLesson,
        saveSubjectNote,
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
