// Configurazione e tipi per la gestione dinamica delle Autorizzazioni per Ruolo

export type PermissionLevel = 'none' | 'view' | 'edit';

export interface MenuSectionDef {
  key: string;
  label: string;
  sublabel: string;
  iconName: string;
}

export const MANAGED_MENU_SECTIONS: MenuSectionDef[] = [
  {
    key: 'presenze',
    label: 'Timbratura e Corsi',
    sublabel: 'Ingresso Aule e Orario Lezioni',
    iconName: 'Hand',
  },
  {
    key: 'admin_dashboard',
    label: 'Gestione Timbrature Aule',
    sublabel: 'Riscontri Aule Live, Orari e Registri',
    iconName: 'ClipboardCheck',
  },
  {
    key: 'anagrafica_soci',
    label: 'Anagrafica Soci',
    sublabel: 'Elenco, Import CSV/Excel e Ruoli',
    iconName: 'Users',
  },
  {
    key: 'piccola_cassa',
    label: 'Piccola Cassa',
    sublabel: 'Rimborsi, Versamenti e Scontrini',
    iconName: 'Wallet',
  },
  {
    key: 'biblioteca',
    label: 'Biblioteca',
    sublabel: 'Catalogo Libri e Pubblicazioni',
    iconName: 'BookOpen',
  },
  {
    key: 'avvisi_video',
    label: 'Avvisi Video',
    sublabel: 'Proiezione Monitor, Ticker e Slide',
    iconName: 'Tv',
  },
  {
    key: 'eliminacode',
    label: 'Eliminacode',
    sublabel: 'Telecomando e Monitor Numeri PDF',
    iconName: 'Monitor',
  },
  {
    key: 'lezioni_campo',
    label: 'Lezioni sul Campo',
    sublabel: 'Gestione Escursioni, Preventivi e Spese',
    iconName: 'Compass',
  },
  {
    key: 'bollette',
    label: 'Bollette e Consumi',
    sublabel: 'Ripartizione Luce Sede Alveas / Qu3',
    iconName: 'Zap',
  },
  {
    key: 'bilancio',
    label: 'Bilanci',
    sublabel: 'Consuntivo ETS, Preventivo e Liquidità',
    iconName: 'Scale',
  },
];

export const MANAGED_ROLES = [
  'Solo CD',
  'Socio',
  'Segreteria',
  'Amministrativo',
  'Didattica',
  'Viaggi',
  'Amministratore',
  'Biblioteca',
  'Presidenza',
  'LsC',
] as const;

export type ManagedRoleName = typeof MANAGED_ROLES[number];

// Mappa: { [sectionKey]: { [roleName]: PermissionLevel } }
export type RolePermissionsMap = Record<string, Record<string, PermissionLevel>>;

// Configurazione predefinita fedele ai permessi storici di Q3
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  presenze: {
    'Solo CD': 'edit',
    'Socio': 'edit',
    'Segreteria': 'edit',
    'Amministrativo': 'edit',
    'Didattica': 'edit',
    'Viaggi': 'edit',
    'Amministratore': 'edit',
    'Biblioteca': 'edit',
    'Presidenza': 'edit',
    'LsC': 'edit',
  },
  admin_dashboard: {
    'Solo CD': 'none',
    'Socio': 'none',
    'Segreteria': 'view',
    'Amministrativo': 'view',
    'Didattica': 'edit',
    'Viaggi': 'none',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'view',
    'LsC': 'none',
  },
  anagrafica_soci: {
    'Solo CD': 'view',
    'Socio': 'none',
    'Segreteria': 'edit',
    'Amministrativo': 'view',
    'Didattica': 'none',
    'Viaggi': 'none',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'view',
    'LsC': 'none',
  },
  piccola_cassa: {
    'Solo CD': 'edit',
    'Socio': 'none',
    'Segreteria': 'none',
    'Amministrativo': 'edit',
    'Didattica': 'none',
    'Viaggi': 'none',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'view',
    'LsC': 'none',
  },
  biblioteca: {
    'Solo CD': 'edit',
    'Socio': 'edit',
    'Segreteria': 'edit',
    'Amministrativo': 'edit',
    'Didattica': 'edit',
    'Viaggi': 'edit',
    'Amministratore': 'edit',
    'Biblioteca': 'edit',
    'Presidenza': 'edit',
    'LsC': 'edit',
  },
  avvisi_video: {
    'Solo CD': 'edit',
    'Socio': 'none',
    'Segreteria': 'none',
    'Amministrativo': 'none',
    'Didattica': 'none',
    'Viaggi': 'none',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'view',
    'LsC': 'none',
  },
  eliminacode: {
    'Solo CD': 'none',
    'Socio': 'none',
    'Segreteria': 'edit',
    'Amministrativo': 'none',
    'Didattica': 'none',
    'Viaggi': 'none',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'view',
    'LsC': 'none',
  },
  lezioni_campo: {
    'Solo CD': 'view',
    'Socio': 'none',
    'Segreteria': 'view',
    'Amministrativo': 'view',
    'Didattica': 'view',
    'Viaggi': 'edit',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'view',
    'LsC': 'edit',
  },
  bollette: {
    'Solo CD': 'view',
    'Socio': 'none',
    'Segreteria': 'view',
    'Amministrativo': 'edit',
    'Didattica': 'none',
    'Viaggi': 'none',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'view',
    'LsC': 'none',
  },
  bilancio: {
    'Solo CD': 'view',
    'Socio': 'none',
    'Segreteria': 'view',
    'Amministrativo': 'edit',
    'Didattica': 'none',
    'Viaggi': 'none',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'view',
    'LsC': 'none',
  },
};

/**
 * Normalizza il nome del ruolo per matchare con la mappa permessi
 */
export function normalizeRoleKey(role: string): ManagedRoleName {
  const clean = String(role || '').trim().toLowerCase();
  if (clean === 'cd' || clean === 'solo cd' || clean === 'membro cd' || clean === 'consiglio direttivo') return 'Solo CD';
  if (clean === 'socio') return 'Socio';
  if (clean === 'segreteria') return 'Segreteria';
  if (clean === 'amministrativo') return 'Amministrativo';
  if (clean === 'didattica') return 'Didattica';
  if (clean === 'viaggi') return 'Viaggi';
  if (clean === 'amministratore' || clean === 'admin' || clean === 'superadmin') return 'Amministratore';
  if (clean === 'biblioteca') return 'Biblioteca';
  if (clean === 'presidenza' || clean === 'presidente') return 'Presidenza';
  if (clean === 'lsc' || clean === 'ls c') return 'LsC';
  return 'Socio';
}

/**
 * Calcola il permesso effettivo di un utente per una data sezione.
 * L'Amministratore ha SEMPRE accesso 'edit'.
 * Se l'utente ha più ruoli, prevale il permesso più elevato: edit > view > none.
 */
export function computeUserSectionPermission(
  sectionKey: string,
  user: { role?: string; is_super_admin?: boolean; is_cd?: boolean; roles?: string[] } | null | undefined,
  permissionsMap?: RolePermissionsMap
): PermissionLevel {
  if (!user) return 'none';

  // L'Amministratore/SuperAdmin ha SEMPRE tutti i permessi
  if (user.is_super_admin || user.role === 'admin') {
    return 'edit';
  }

  const map = permissionsMap || DEFAULT_ROLE_PERMISSIONS;
  const sectionPerms = map[sectionKey] || DEFAULT_ROLE_PERMISSIONS[sectionKey] || {};

  // Raccogli tutti i ruoli posseduti dall'utente
  const userRoles: ManagedRoleName[] = [];

  if (user.is_cd) {
    userRoles.push('Solo CD');
  }

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    for (const r of user.roles) {
      userRoles.push(normalizeRoleKey(r));
    }
  } else {
    userRoles.push('Socio');
  }

  // Se l'utente ha il ruolo esplicito Amministratore
  if (userRoles.includes('Amministratore')) {
    return 'edit';
  }

  let highest: PermissionLevel = 'none';
  for (const role of userRoles) {
    const level = sectionPerms[role] || 'none';
    if (level === 'edit') return 'edit';
    if (level === 'view') highest = 'view';
  }

  return highest;
}
