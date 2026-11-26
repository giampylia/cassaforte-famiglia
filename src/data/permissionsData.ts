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
    key: 'anagrafica_soci',
    label: 'Anagrafica Soci',
    sublabel: 'Elenco, Import CSV/Excel e Ruoli',
    iconName: 'Users',
  },
  {
    key: 'presenze',
    label: 'Timbrature',
    sublabel: 'Ingresso Aule e Orario Lezioni',
    iconName: 'Hand',
  },
  {
    key: 'admin_dashboard',
    label: 'Gestione Aule',
    sublabel: 'Riscontri Aule Live, Orari e Registri',
    iconName: 'ClipboardCheck',
  },
  {
    key: 'biblioteca',
    label: 'Biblioteca',
    sublabel: 'Catalogo Libri e Pubblicazioni',
    iconName: 'BookOpen',
  },
  {
    key: 'lezioni_campo',
    label: 'Lezioni sul Campo',
    sublabel: 'Gestione Escursioni, Preventivi e Spese',
    iconName: 'Compass',
  },
  {
    key: 'prenotazione_eventi',
    label: 'Prenotazioni',
    sublabel: 'Cinema, Gite, Conferenze e Lista Ospiti',
    iconName: 'Ticket',
  },
  {
    key: 'avvisi_video',
    label: 'Avvisi Video',
    sublabel: 'Proiezione Monitor, Ticker e Slide',
    iconName: 'Tv',
  },
  {
    key: 'eliminacode',
    label: 'Elimina Code',
    sublabel: 'Telecomando e Monitor Numeri PDF',
    iconName: 'Monitor',
  },
  {
    key: 'piccola_cassa',
    label: 'Piccola Cassa',
    sublabel: 'Rimborsi, Versamenti e Scontrini',
    iconName: 'Wallet',
  },
  {
    key: 'bollette',
    label: 'Bollette',
    sublabel: 'Ripartizione Luce Sede Alveas / Qu3',
    iconName: 'Zap',
  },
  {
    key: 'bilancio',
    label: 'Bilancio',
    sublabel: 'Consuntivo ETS, Preventivo e Liquidità',
    iconName: 'Scale',
  },
  {
    key: 'report',
    label: 'Report',
    sublabel: 'Cassa, Docenti, Presenze, Escursioni e Bilanci',
    iconName: 'FileSpreadsheet',
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
    'Segreteria': 'edit',
    'Amministrativo': 'edit',
    'Didattica': 'edit',
    'Viaggi': 'edit',
    'Amministratore': 'edit',
    'Biblioteca': 'edit',
    'Presidenza': 'edit',
    'LsC': 'edit',
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
  prenotazione_eventi: {
    'Solo CD': 'edit',
    'Socio': 'view',
    'Segreteria': 'edit',
    'Amministrativo': 'edit',
    'Didattica': 'view',
    'Viaggi': 'edit',
    'Amministratore': 'edit',
    'Biblioteca': 'view',
    'Presidenza': 'edit',
    'LsC': 'view',
  },
  report: {
    'Solo CD': 'edit',
    'Socio': 'none',
    'Segreteria': 'edit',
    'Amministrativo': 'edit',
    'Didattica': 'view',
    'Viaggi': 'view',
    'Amministratore': 'edit',
    'Biblioteca': 'none',
    'Presidenza': 'edit',
    'LsC': 'view',
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
  user:
    | {
        id?: string;
        member_number?: string;
        role?: string;
        is_super_admin?: boolean;
        is_cd?: boolean;
        roles?: string[];
      }
    | null
    | undefined,
  permissionsMap?: RolePermissionsMap
): PermissionLevel {
  if (!user) return 'none';

  // L'Amministratore/SuperAdmin ha SEMPRE tutti i permessi
  if (user.is_super_admin || user.role === 'admin') {
    return 'edit';
  }

  // Piccola Cassa: accessibile esclusivamente a Socio 2406/7726, Ruolo Amministrativo (9996) e Soci CD
  if (sectionKey === 'piccola_cassa') {
    return canAccessPiccolaCassa(user) ? 'edit' : 'none';
  }

  const map = permissionsMap || DEFAULT_ROLE_PERMISSIONS;
  const sectionPerms = map[sectionKey] || DEFAULT_ROLE_PERMISSIONS[sectionKey] || {};

  // Ruoli operativi specifici assegnati all'utente (es. LsC, Didattica, Segreteria, Biblioteca, Viaggi, Amministrativo, Presidenza)
  const explicitRoles: ManagedRoleName[] = (Array.isArray(user.roles) ? user.roles : [])
    .map(normalizeRoleKey)
    .filter((r) => r !== 'Socio');

  // Se l'utente ha il ruolo esplicito Amministratore
  if (explicitRoles.includes('Amministratore')) {
    return 'edit';
  }

  // Raccogli i ruoli effettivi:
  // Se l'utente ha ruoli operativi specifici (es. LsC), sono questi a governare i suoi accessi.
  // Se è membro del CD senza altri ruoli operativi specifici, si applica 'Solo CD'.
  // Altrimenti è un semplice 'Socio'.
  const userRoles: ManagedRoleName[] = [];
  if (explicitRoles.length > 0) {
    userRoles.push(...explicitRoles);
  } else if (user.is_cd) {
    userRoles.push('Solo CD');
  } else {
    userRoles.push('Socio');
  }

  let highest: PermissionLevel = 'none';
  for (const role of userRoles) {
    const level = sectionPerms[role] || 'none';
    if (level === 'edit') return 'edit';
    if (level === 'view') highest = 'view';
  }

  return highest;
}

/**
 * Determina se un profilo è Amministratore o ha il Ruolo Amministrativo
 * (es. Giampiero Pilia 7726, badge 2406, superadmin, o con ruolo Amministrativo/Amministratore)
 */
export function isAmministrativoOrAdmin(
  user?: {
    id?: string;
    member_number?: string;
    role?: string;
    is_super_admin?: boolean;
    roles?: string[];
  } | null
): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  const cleanRole = String(user.role || '').trim().toLowerCase();
  if (cleanRole === 'admin' || cleanRole === 'amministratore' || cleanRole === 'amministrativo') return true;
  const num = String(user.member_number || '').trim();
  if (num === '2406' || num === '7726' || num === '7796') return true;
  if (user.id === 'admin-2406' || user.id === 'admin-7726') return true;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.some((r) => {
    const clean = String(r || '').trim().toLowerCase();
    return (
      clean === 'amministrativo' ||
      clean === 'amministratore' ||
      clean === 'admin' ||
      clean === 'amministrazione' ||
      clean.includes('amministra') ||
      clean === 'contabilità' ||
      clean === 'contabilita' ||
      clean === 'tesoriere' ||
      clean === 'tesoreria'
    );
  });
}

/**
 * TIER 1 PICCOLA CASSA: ESCLUSIVAMENTE Socio 7726 e Socio 2406.
 * Possono fare tutto con le piccole spese: vedere tutto, modificare, cancellare, inserire,
 * approvare e mettere in stato PAGATO.
 */
export function isPiccolaCassaFullAdmin(
  user?: {
    id?: string;
    member_number?: string;
    role?: string;
    is_super_admin?: boolean;
  } | null
): boolean {
  if (!user) return false;
  const num = String(user.member_number || '').trim();
  if (num === '2406' || num === '7726') return true;
  if (user.id === 'admin-2406' || user.id === 'admin-7726') return true;
  if (user.is_super_admin) return true;
  return false;
}

/**
 * TIER 2 PICCOLA CASSA: Socio Ruolo Amministrativo (es. 9996, ma NON 7726/2406).
 * Può vedere tutte le richieste e inserire richieste per sé o per altri Soci CD,
 * MA NON può cancellare, modificare, approvare o mettere in stato pagato.
 */
export function isPiccolaCassaAmministrativoViewer(
  user?: {
    id?: string;
    member_number?: string;
    role?: string;
    is_super_admin?: boolean;
    roles?: string[];
  } | null
): boolean {
  if (!user) return false;
  if (isPiccolaCassaFullAdmin(user)) return false;
  const num = String(user.member_number || '').trim();
  if (num === '9996') return true;
  const cleanRole = String(user.role || '').trim().toLowerCase();
  if (cleanRole === 'amministrativo') return true;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.some((r) => {
    const clean = String(r || '').trim().toLowerCase();
    return clean === 'amministrativo';
  });
}

/**
 * Chi può accedere alla Piccola Cassa ed essere titolare di richieste di rimborso:
 * ESCLUSIVAMENTE Socio 2406/7726, Ruolo Amministrativo (9996) e i Soci CD (is_cd === true).
 */
export function canAccessPiccolaCassa(
  user?: {
    id?: string;
    member_number?: string;
    role?: string;
    is_super_admin?: boolean;
    is_cd?: boolean;
    roles?: string[];
  } | null
): boolean {
  if (!user) return false;
  return Boolean(
    isPiccolaCassaFullAdmin(user) ||
      isPiccolaCassaAmministrativoViewer(user) ||
      user.is_cd
  );
}


