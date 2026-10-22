export type ClassroomKey =
  | 'verde'
  | 'gialla'
  | 'rossa'
  | 'rocchitta'
  | 'san_benedetto'
  | 'biblioteca'
  | 'ferrini'
  | 'polifunzionale';

export interface ClassroomInfo {
  key: ClassroomKey;
  name: string;
  fullName: string;
  image: string;
  colorType: 'verde' | 'gialla' | 'rossa' | 'blue';
  bgColor: string;
  badgeColor: string;
  sede: 'Quartu' | 'Soleminis';
  capacity: number;
  locationNote: string;
}

export interface Profile {
  id: string;
  member_number: string;
  full_name: string;
  sede: 'Quartu' | 'Soleminis';
  role: 'member' | 'admin';
  phone?: string;
  joined_year?: number;
}

export interface Lesson {
  id: string;
  classroom: ClassroomKey;
  subject: string;
  teacher: string;
  category: string;
  day_of_week: number; // 0 = Domenica, 1 = Lunedì ... 6 = Sabato
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  classroom: ClassroomKey;
  lesson_id: string;
  created_at: string; // ISO string
  rating?: 1 | 2 | 3; // 1 = Da migliorare, 2 = Interessante, 3 = Molto utile e chiara
}

export interface SubjectDidacticNote {
  subject: string;
  didactic_goal: string;
  staff_note: string;
  manual_utility_boost?: number; // -10 to +10
  updated_at: string;
}

export const DAYS_IT = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
];

export const CLASSROOMS: ClassroomInfo[] = [
  {
    key: 'verde',
    name: 'Verde',
    fullName: 'Aula Verde',
    image: '/assets/aula-verde.png',
    colorType: 'verde',
    bgColor: '#15803d',
    badgeColor: '#16a34a',
    sede: 'Quartu',
    capacity: 45,
    locationNote: 'Piano Terra · Ingresso Principale',
  },
  {
    key: 'gialla',
    name: 'Gialla',
    fullName: 'Aula Gialla',
    image: '/assets/aula-gialla.png',
    colorType: 'gialla',
    bgColor: '#ca8a04',
    badgeColor: '#eab308',
    sede: 'Quartu',
    capacity: 38,
    locationNote: 'Piano Terra · Ala Est',
  },
  {
    key: 'rossa',
    name: 'Rossa',
    fullName: 'Aula Rossa',
    image: '/assets/aula-rossa.png',
    colorType: 'rossa',
    bgColor: '#b91c1c',
    badgeColor: '#dc2626',
    sede: 'Quartu',
    capacity: 50,
    locationNote: 'Piano Terra · Sala Conferenze',
  },
  {
    key: 'rocchitta',
    name: 'Rocchitta',
    fullName: 'Aula Rocchitta',
    image: '/assets/aula-rocchitta.png',
    colorType: 'blue',
    bgColor: '#1d4ed8',
    badgeColor: '#2563eb',
    sede: 'Quartu',
    capacity: 35,
    locationNote: 'Sede Via Rocchitta · Quartu',
  },
  {
    key: 'san_benedetto',
    name: 'S. Benedetto',
    fullName: 'Aula San Benedetto',
    image: '/assets/aula-san-benedetto.png',
    colorType: 'blue',
    bgColor: '#1e40af',
    badgeColor: '#3b82f6',
    sede: 'Quartu',
    capacity: 42,
    locationNote: 'Polo San Benedetto · Quartu',
  },
  {
    key: 'biblioteca',
    name: 'Biblioteca',
    fullName: 'Aula Biblioteca',
    image: '/assets/aula-biblioteca.png',
    colorType: 'blue',
    bgColor: '#0f766e',
    badgeColor: '#14b8a6',
    sede: 'Quartu',
    capacity: 28,
    locationNote: 'Sala Lettura & Studi · Quartu',
  },
  {
    key: 'ferrini',
    name: 'Ferrini',
    fullName: 'Aula Ferrini',
    image: '/assets/aula-ferrini.png',
    colorType: 'blue',
    bgColor: '#4338ca',
    badgeColor: '#6366f1',
    sede: 'Quartu',
    capacity: 40,
    locationNote: 'Complesso Ferrini · Quartu',
  },
  {
    key: 'polifunzionale',
    name: 'Polifunzionale',
    fullName: 'Aula Polifunzionale',
    image: '/assets/aula-polifunzionale.png',
    colorType: 'blue',
    bgColor: '#6d28d9',
    badgeColor: '#8b5cf6',
    sede: 'Soleminis',
    capacity: 45,
    locationNote: 'Centro Culturale · Sede di Soleminis',
  },
];

export const CLASSROOM_LABELS: Record<ClassroomKey, string> = {
  verde: 'Aula Verde',
  gialla: 'Aula Gialla',
  rossa: 'Aula Rossa',
  rocchitta: 'Aula Rocchitta',
  san_benedetto: 'Aula S. Benedetto',
  biblioteca: 'Aula Biblioteca',
  ferrini: 'Aula Ferrini',
  polifunzionale: 'Aula Polifunzionale',
};

export interface SubjectMeta {
  emoji: string;
  category: string;
  shortDesc: string;
}

export function getSubjectMeta(subject: string): SubjectMeta {
  const s = subject.toLowerCase();
  if (s.includes('informatica') || s.includes('smartphone') || s.includes('digitale')) {
    return { emoji: '📱', category: 'Competenze Digitali', shortDesc: 'Uso pratico di smartphone, SPID e internet sicuro' };
  }
  if (s.includes('inglese') || s.includes('spagnolo') || s.includes('francese') || s.includes('lingua')) {
    return { emoji: '🗣️', category: 'Lingue Straniere', shortDesc: 'Conversazione, ascolto e memoria linguistica attiva' };
  }
  if (s.includes('ginnastica') || s.includes('posturale') || s.includes('motoria') || s.includes('ballo') || s.includes('yoga')) {
    return { emoji: '🧘', category: 'Benessere & Movimento', shortDesc: 'Mobilità articolare, equilibrio e socializzazione motoria' };
  }
  if (s.includes('storia') || s.includes('sardegna') || s.includes('archeologia') || s.includes('sarda')) {
    return { emoji: '🏛️', category: 'Storia e Cultura Sarda', shortDesc: 'Radici storiche, identità culturale e territorio' };
  }
  if (s.includes('arte') || s.includes('pittura') || s.includes('disegno') || s.includes('fotografia')) {
    return { emoji: '🎨', category: 'Arte e Creatività', shortDesc: 'Espressione artistica, storia dei capolavori e manualità' };
  }
  if (s.includes('letteratura') || s.includes('poesia') || s.includes('scrittura') || s.includes('filosofia')) {
    return { emoji: '📚', category: 'Umanistica e Lettere', shortDesc: 'Lettura critica, dibattito culturale e memoria storica' };
  }
  if (s.includes('psicologia') || s.includes('medicina') || s.includes('salute') || s.includes('nutrizione') || s.includes('mente')) {
    return { emoji: '🩺', category: 'Salute e Prevenzione', shortDesc: 'Invecchiamento attivo, memoria e benessere psicofisico' };
  }
  if (s.includes('teatro') || s.includes('coro') || s.includes('musica') || s.includes('canto')) {
    return { emoji: '🎭', category: 'Musica e Spettacolo', shortDesc: 'Espressione vocale, recitazione e lavoro di gruppo' };
  }
  return { emoji: '🎓', category: 'Cultura Generale', shortDesc: 'Approfondimento interdisciplinare e partecipazione attiva' };
}

export const INITIAL_PROFILES: Profile[] = [
  { id: 'admin-1', member_number: 'admin', full_name: 'Segreteria Settore Didattica QU3', sede: 'Quartu', role: 'admin', phone: '070 881234', joined_year: 2018 },
  { id: 'u-101', member_number: '101', full_name: 'Maria Bonaria Melis', sede: 'Quartu', role: 'member', phone: '347 1122334', joined_year: 2021 },
  { id: 'u-102', member_number: '102', full_name: 'Efisio Piras', sede: 'Quartu', role: 'member', phone: '348 2233445', joined_year: 2020 },
  { id: 'u-103', member_number: '103', full_name: 'Anna Rita Cao', sede: 'Quartu', role: 'member', phone: '349 3344556', joined_year: 2022 },
  { id: 'u-104', member_number: '104', full_name: 'Giampaolo Sanna', sede: 'Quartu', role: 'member', phone: '340 4455667', joined_year: 2019 },
  { id: 'u-105', member_number: '105', full_name: 'Rosalba Atzeni', sede: 'Quartu', role: 'member', phone: '333 5566778', joined_year: 2023 },
  { id: 'u-106', member_number: '106', full_name: 'Salvatore Palmas', sede: 'Quartu', role: 'member', phone: '335 6677889', joined_year: 2021 },
  { id: 'u-107', member_number: '107', full_name: 'Graziella Lai', sede: 'Quartu', role: 'member', phone: '338 7788990', joined_year: 2022 },
  { id: 'u-108', member_number: '108', full_name: 'Antonio Luigi Deiana', sede: 'Quartu', role: 'member', phone: '339 8899001', joined_year: 2020 },
  { id: 'u-109', member_number: '109', full_name: 'Franca Murgia', sede: 'Quartu', role: 'member', phone: '328 9900112', joined_year: 2024 },
  { id: 'u-110', member_number: '110', full_name: 'Vincenzo Fadda', sede: 'Quartu', role: 'member', phone: '329 1011121', joined_year: 2021 },
  { id: 'u-111', member_number: '111', full_name: 'Lucia Serra', sede: 'Quartu', role: 'member', phone: '347 2021223', joined_year: 2023 },
  { id: 'u-112', member_number: '112', full_name: 'Raimondo Vacca', sede: 'Quartu', role: 'member', phone: '348 3031324', joined_year: 2022 },
  { id: 'u-113', member_number: '113', full_name: 'Teresa Usai', sede: 'Quartu', role: 'member', phone: '349 4041425', joined_year: 2020 },
  { id: 'u-114', member_number: '114', full_name: 'Pietro Paolo Loi', sede: 'Quartu', role: 'member', phone: '340 5051526', joined_year: 2024 },
  { id: 'u-201', member_number: '201', full_name: 'Assunta Corda', sede: 'Soleminis', role: 'member', phone: '333 6061627', joined_year: 2022 },
  { id: 'u-202', member_number: '202', full_name: 'Ignazio Spiga', sede: 'Soleminis', role: 'member', phone: '338 7071728', joined_year: 2021 },
  { id: 'u-203', member_number: '203', full_name: 'Caterina Mura', sede: 'Soleminis', role: 'member', phone: '347 8081829', joined_year: 2023 },
  { id: 'u-204', member_number: '204', full_name: 'Gavino Carta', sede: 'Soleminis', role: 'member', phone: '349 9091920', joined_year: 2022 },
];

export const INITIAL_LESSONS: Lesson[] = [
  // LUNEDÌ (1)
  { id: 'les-mon-1', classroom: 'verde', subject: 'Smartphone e Servizi Digitali (SPID/FSE)', teacher: 'Ing. Marco Siddi', category: 'Competenze Digitali', day_of_week: 1, start_time: '09:00', end_time: '11:00' },
  { id: 'les-mon-2', classroom: 'rossa', subject: 'Storia e Archeologia della Sardegna', teacher: 'Prof.ssa Paola Dessì', category: 'Storia e Cultura Sarda', day_of_week: 1, start_time: '09:30', end_time: '11:30' },
  { id: 'les-mon-3', classroom: 'gialla', subject: 'Inglese Base per Viaggiare', teacher: 'Dott.ssa Sara Floris', category: 'Lingue Straniere', day_of_week: 1, start_time: '10:00', end_time: '12:00' },
  { id: 'les-mon-4', classroom: 'san_benedetto', subject: 'Ginnastica Dolce e Posturale', teacher: 'Prof. Luca Cabras', category: 'Benessere & Movimento', day_of_week: 1, start_time: '09:00', end_time: '11:00' },
  { id: 'les-mon-5', classroom: 'verde', subject: 'Psicologia e Memoria Attiva', teacher: 'Dott.ssa Elena Pinna', category: 'Salute e Prevenzione', day_of_week: 1, start_time: '15:30', end_time: '17:30' },
  { id: 'les-mon-6', classroom: 'rossa', subject: 'Letteratura Italiana del Novecento', teacher: 'Prof. Giorgio Orrù', category: 'Umanistica e Lettere', day_of_week: 1, start_time: '16:00', end_time: '18:00' },
  { id: 'les-mon-7', classroom: 'polifunzionale', subject: 'Ginnastica Dolce e Movimento (Soleminis)', teacher: 'Prof. Luca Cabras', category: 'Benessere & Movimento', day_of_week: 1, start_time: '16:00', end_time: '18:00' },

  // MARTEDÌ (2)
  { id: 'les-tue-1', classroom: 'rossa', subject: 'Medicina Preventiva e Longevità', teacher: 'Dott. Alberto Congiu', category: 'Salute e Prevenzione', day_of_week: 2, start_time: '09:00', end_time: '11:00' },
  { id: 'les-tue-2', classroom: 'gialla', subject: 'Spagnolo Lingua e Cultura', teacher: 'Prof.ssa Carmen Mereu', category: 'Lingue Straniere', day_of_week: 2, start_time: '09:30', end_time: '11:30' },
  { id: 'les-tue-3', classroom: 'rocchitta', subject: 'Pittura ad Acquerello e Disegno', teacher: 'Maestro Roberto Lilliu', category: 'Arte e Creatività', day_of_week: 2, start_time: '09:30', end_time: '12:00' },
  { id: 'les-tue-4', classroom: 'biblioteca', subject: 'Lingua e Poesia Sarda Campidanese', teacher: 'Prof. Tonino Puddu', category: 'Storia e Cultura Sarda', day_of_week: 2, start_time: '15:30', end_time: '17:30' },
  { id: 'les-tue-5', classroom: 'ferrini', subject: 'Laboratorio Teatrale e Dizione', teacher: 'Regista Carla Manca', category: 'Musica e Spettacolo', day_of_week: 2, start_time: '16:00', end_time: '18:30' },

  // MERCOLEDÌ (3)
  { id: 'les-wed-1', classroom: 'verde', subject: 'Smartphone e Servizi Digitali (SPID/FSE)', teacher: 'Ing. Marco Siddi', category: 'Competenze Digitali', day_of_week: 3, start_time: '09:00', end_time: '11:00' },
  { id: 'les-wed-2', classroom: 'san_benedetto', subject: 'Ginnastica Dolce e Posturale', teacher: 'Prof. Luca Cabras', category: 'Benessere & Movimento', day_of_week: 3, start_time: '09:00', end_time: '11:00' },
  { id: 'les-wed-3', classroom: 'rossa', subject: 'Storia dell\'Arte e Monumenti Sardi', teacher: 'Prof.ssa Valeria Porcu', category: 'Arte e Creatività', day_of_week: 3, start_time: '10:00', end_time: '12:00' },
  { id: 'les-wed-4', classroom: 'gialla', subject: 'Inglese Conversazione Intermedia', teacher: 'Dott.ssa Sara Floris', category: 'Lingue Straniere', day_of_week: 3, start_time: '15:30', end_time: '17:30' },
  { id: 'les-wed-5', classroom: 'ferrini', subject: 'Canto Corale Polifonico QU3', teacher: 'Maestro Davide Marongiu', category: 'Musica e Spettacolo', day_of_week: 3, start_time: '16:00', end_time: '18:00' },
  { id: 'les-wed-6', classroom: 'polifunzionale', subject: 'Storia e Tradizioni di Sardegna (Soleminis)', teacher: 'Prof.ssa Paola Dessì', category: 'Storia e Cultura Sarda', day_of_week: 3, start_time: '16:00', end_time: '18:00' },

  // GIOVEDÌ (4)
  { id: 'les-thu-1', classroom: 'verde', subject: 'Psicologia e Memoria Attiva', teacher: 'Dott.ssa Elena Pinna', category: 'Salute e Prevenzione', day_of_week: 4, start_time: '08:30', end_time: '18:30' },
  { id: 'les-thu-2', classroom: 'gialla', subject: 'Inglese Base per Viaggiare', teacher: 'Dott.ssa Sara Floris', category: 'Lingue Straniere', day_of_week: 4, start_time: '08:30', end_time: '18:30' },
  { id: 'les-thu-3', classroom: 'rossa', subject: 'Storia e Archeologia della Sardegna', teacher: 'Prof.ssa Paola Dessì', category: 'Storia e Cultura Sarda', day_of_week: 4, start_time: '08:30', end_time: '18:30' },
  { id: 'les-thu-4', classroom: 'rocchitta', subject: 'Pittura ad Acquerello e Disegno', teacher: 'Maestro Roberto Lilliu', category: 'Arte e Creatività', day_of_week: 4, start_time: '08:30', end_time: '18:30' },
  { id: 'les-thu-5', classroom: 'san_benedetto', subject: 'Ginnastica Dolce e Posturale', teacher: 'Prof. Luca Cabras', category: 'Benessere & Movimento', day_of_week: 4, start_time: '08:30', end_time: '18:30' },
  { id: 'les-thu-6', classroom: 'biblioteca', subject: 'Lingua e Poesia Sarda Campidanese', teacher: 'Prof. Tonino Puddu', category: 'Storia e Cultura Sarda', day_of_week: 4, start_time: '08:30', end_time: '18:30' },
  { id: 'les-thu-7', classroom: 'ferrini', subject: 'Fotografia con lo Smartphone', teacher: 'Dott. Stefano Argiolas', category: 'Arte e Creatività', day_of_week: 4, start_time: '15:00', end_time: '18:30' },
  { id: 'les-thu-8', classroom: 'polifunzionale', subject: 'Smartphone e Servizi Digitali (Soleminis)', teacher: 'Ing. Marco Siddi', category: 'Competenze Digitali', day_of_week: 4, start_time: '08:30', end_time: '18:30' },

  // VENERDÌ (5)
  { id: 'les-fri-1', classroom: 'rossa', subject: 'Medicina Preventiva e Longevità', teacher: 'Dott. Alberto Congiu', category: 'Salute e Prevenzione', day_of_week: 5, start_time: '09:00', end_time: '11:00' },
  { id: 'les-fri-2', classroom: 'verde', subject: 'Smartphone e Servizi Digitali (SPID/FSE)', teacher: 'Ing. Marco Siddi', category: 'Competenze Digitali', day_of_week: 5, start_time: '09:30', end_time: '11:30' },
  { id: 'les-fri-3', classroom: 'san_benedetto', subject: 'Balli di Gruppo e Coordinazione', teacher: 'Ins. Claudia Mascia', category: 'Benessere & Movimento', day_of_week: 5, start_time: '10:00', end_time: '12:00' },
  { id: 'les-fri-4', classroom: 'biblioteca', subject: 'Filosofia del Quotidiano e Dialogo', teacher: 'Prof. Giorgio Orrù', category: 'Umanistica e Lettere', day_of_week: 5, start_time: '15:30', end_time: '17:30' },
  { id: 'les-fri-5', classroom: 'ferrini', subject: 'Canto Corale Polifonico QU3', teacher: 'Maestro Davide Marongiu', category: 'Musica e Spettacolo', day_of_week: 5, start_time: '16:00', end_time: '18:00' },

  // SABATO (6)
  { id: 'les-sat-1', classroom: 'rossa', subject: 'Storia dell\'Arte e Monumenti Sardi', teacher: 'Prof.ssa Valeria Porcu', category: 'Arte e Creatività', day_of_week: 6, start_time: '09:30', end_time: '11:30' },
  { id: 'les-sat-2', classroom: 'rocchitta', subject: 'Fotografia con lo Smartphone', teacher: 'Dott. Stefano Argiolas', category: 'Arte e Creatività', day_of_week: 6, start_time: '09:30', end_time: '11:30' },
];

export const INITIAL_SUBJECT_NOTES: SubjectDidacticNote[] = [
  {
    subject: 'Smartphone e Servizi Digitali (SPID/FSE)',
    didactic_goal: 'Autonomia digitale dei soci nell\'uso di SPID, Fascicolo Sanitario Elettronico, WhatsApp e prenotazioni CUP.',
    staff_note: 'Corso ad altissima utilità pratica. I soci chiedono esercitazioni pratiche individuali passo-passo.',
    manual_utility_boost: 8,
    updated_at: '2026-10-18',
  },
  {
    subject: 'Ginnastica Dolce e Posturale',
    didactic_goal: 'Prevenzione cadute, mantenimento mobilità articolare e socializzazione attiva.',
    staff_note: 'Affluenza sempre vicina alla capienza massima dell\'Aula S. Benedetto. Ottima costanza.',
    manual_utility_boost: 7,
    updated_at: '2026-10-19',
  },
  {
    subject: 'Storia e Archeologia della Sardegna',
    didactic_goal: 'Conoscenza approfondita del patrimonio nuragico, giudicale e storico del Campidano.',
    staff_note: 'Molto seguito; consigliato abbinare uscite didattiche mensili ai siti archeologici.',
    manual_utility_boost: 6,
    updated_at: '2026-10-15',
  },
  {
    subject: 'Psicologia e Memoria Attiva',
    didactic_goal: 'Training cognitivo, esercizi di memoria e benessere emotivo nella terza età.',
    staff_note: 'Eccellente riscontro qualitativo nei questionari soci. Altissima fidelizzazione.',
    manual_utility_boost: 9,
    updated_at: '2026-10-20',
  },
  {
    subject: 'Inglese Base per Viaggiare',
    didactic_goal: 'Apprendimento di frasi chiave per viaggi, ascolto e stimolazione cognitiva linguistica.',
    staff_note: 'Buona partecipazione; utile fornire dispense cartacee con caratteri grandi (16pt).',
    manual_utility_boost: 4,
    updated_at: '2026-10-14',
  },
  {
    subject: 'Medicina Preventiva e Longevità',
    didactic_goal: 'Educazione sanitaria, corretta alimentazione e prevenzione cardiovascolare.',
    staff_note: 'Lezioni molto apprezzate per la chiarezza divulgativa del medico relatore.',
    manual_utility_boost: 8,
    updated_at: '2026-10-17',
  },
  {
    subject: 'Fotografia con lo Smartphone',
    didactic_goal: 'Imparare a scattare, archiviare e condividere foto dei nipoti e del territorio.',
    staff_note: 'Orario pomeridiano meno frequentato nei mesi autunnali; valutare spostamento al mattino.',
    manual_utility_boost: 0,
    updated_at: '2026-10-12',
  },
];

export function generateInitialAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const memberIdsQuartu = INITIAL_PROFILES.filter((p) => p.role === 'member' && p.sede === 'Quartu').map((p) => p.id);
  const memberIdsSoleminis = INITIAL_PROFILES.filter((p) => p.role === 'member' && p.sede === 'Soleminis').map((p) => p.id);

  // Presenze di OGGI (per mostrare subito i contatori attivi nelle aule!)
  const todayLessons = [
    { lessonId: 'les-thu-1', classroom: 'verde' as ClassroomKey, count: 14, ratingBias: 3 as const },
    { lessonId: 'les-thu-2', classroom: 'gialla' as ClassroomKey, count: 9, ratingBias: 3 as const },
    { lessonId: 'les-thu-3', classroom: 'rossa' as ClassroomKey, count: 12, ratingBias: 3 as const },
    { lessonId: 'les-thu-4', classroom: 'rocchitta' as ClassroomKey, count: 7, ratingBias: 2 as const },
    { lessonId: 'les-thu-5', classroom: 'san_benedetto' as ClassroomKey, count: 13, ratingBias: 3 as const },
    { lessonId: 'les-thu-6', classroom: 'biblioteca' as ClassroomKey, count: 6, ratingBias: 3 as const },
  ];

  todayLessons.forEach((tl, groupIdx) => {
    for (let i = 0; i < Math.min(tl.count, memberIdsQuartu.length); i++) {
      const uid = memberIdsQuartu[(i + groupIdx * 2) % memberIdsQuartu.length];
      // Evita di pre-timbrare il socio 101 in tutte le aule così l'utente può testare subito la timbratura con 101!
      if (uid === 'u-101') continue;
      const minuteOffset = (i * 3) % 45;
      const dt = new Date(`${todayStr}T09:${String(10 + minuteOffset).padStart(2, '0')}:00`);
      records.push({
        id: `att-today-${tl.lessonId}-${i}`,
        user_id: uid,
        classroom: tl.classroom,
        lesson_id: tl.lessonId,
        created_at: dt.toISOString(),
        rating: i % 5 === 0 ? 2 : tl.ratingBias,
      });
    }
  });

  // Presenze Soleminis oggi
  memberIdsSoleminis.slice(1).forEach((uid, idx) => {
    records.push({
      id: `att-today-soleminis-${idx}`,
      user_id: uid,
      classroom: 'polifunzionale',
      lesson_id: 'les-thu-8',
      created_at: new Date(`${todayStr}T09:${String(15 + idx * 4).padStart(2, '0')}:00`).toISOString(),
      rating: 3,
    });
  });

  // Storico ultime 4 settimane per analisi trend, assiduità soci ed efficacia materie
  const historicalSpec: { lessonId: string; classroom: ClassroomKey; daysAgo: number; attendees: number; avgRating: 1 | 2 | 3 }[] = [
    { lessonId: 'les-mon-1', classroom: 'verde', daysAgo: 3, attendees: 14, avgRating: 3 },
    { lessonId: 'les-mon-1', classroom: 'verde', daysAgo: 10, attendees: 13, avgRating: 3 },
    { lessonId: 'les-mon-1', classroom: 'verde', daysAgo: 17, attendees: 12, avgRating: 3 },
    { lessonId: 'les-mon-2', classroom: 'rossa', daysAgo: 3, attendees: 12, avgRating: 3 },
    { lessonId: 'les-mon-2', classroom: 'rossa', daysAgo: 10, attendees: 11, avgRating: 3 },
    { lessonId: 'les-mon-3', classroom: 'gialla', daysAgo: 3, attendees: 9, avgRating: 2 },
    { lessonId: 'les-mon-3', classroom: 'gialla', daysAgo: 10, attendees: 10, avgRating: 3 },
    { lessonId: 'les-mon-4', classroom: 'san_benedetto', daysAgo: 3, attendees: 14, avgRating: 3 },
    { lessonId: 'les-mon-4', classroom: 'san_benedetto', daysAgo: 10, attendees: 14, avgRating: 3 },
    { lessonId: 'les-tue-1', classroom: 'rossa', daysAgo: 2, attendees: 13, avgRating: 3 },
    { lessonId: 'les-tue-1', classroom: 'rossa', daysAgo: 9, attendees: 12, avgRating: 3 },
    { lessonId: 'les-tue-2', classroom: 'gialla', daysAgo: 2, attendees: 8, avgRating: 2 },
    { lessonId: 'les-tue-3', classroom: 'rocchitta', daysAgo: 2, attendees: 10, avgRating: 3 },
    { lessonId: 'les-tue-4', classroom: 'biblioteca', daysAgo: 2, attendees: 9, avgRating: 3 },
    { lessonId: 'les-tue-5', classroom: 'ferrini', daysAgo: 2, attendees: 7, avgRating: 2 },
    { lessonId: 'les-wed-1', classroom: 'verde', daysAgo: 1, attendees: 14, avgRating: 3 },
    { lessonId: 'les-wed-2', classroom: 'san_benedetto', daysAgo: 1, attendees: 13, avgRating: 3 },
    { lessonId: 'les-wed-3', classroom: 'rossa', daysAgo: 1, attendees: 11, avgRating: 3 },
    { lessonId: 'les-wed-5', classroom: 'ferrini', daysAgo: 1, attendees: 10, avgRating: 3 },
    { lessonId: 'les-thu-7', classroom: 'ferrini', daysAgo: 7, attendees: 4, avgRating: 2 },
    { lessonId: 'les-thu-7', classroom: 'ferrini', daysAgo: 14, attendees: 6, avgRating: 2 },
    { lessonId: 'les-fri-4', classroom: 'biblioteca', daysAgo: 6, attendees: 5, avgRating: 2 },
  ];

  historicalSpec.forEach((h, hIdx) => {
    const d = new Date(now);
    d.setDate(d.getDate() - h.daysAgo);
    const datePart = d.toISOString().slice(0, 10);
    for (let i = 0; i < Math.min(h.attendees, memberIdsQuartu.length); i++) {
      const uid = memberIdsQuartu[(i + hIdx) % memberIdsQuartu.length];
      records.push({
        id: `att-hist-${hIdx}-${i}`,
        user_id: uid,
        classroom: h.classroom,
        lesson_id: h.lessonId,
        created_at: new Date(`${datePart}T10:${String(5 + (i * 3) % 50).padStart(2, '0')}:00`).toISOString(),
        rating: i % 6 === 0 ? 2 : h.avgRating,
      });
    }
  });

  return records;
}
