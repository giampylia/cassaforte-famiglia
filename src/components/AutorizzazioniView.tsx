import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  MANAGED_MENU_SECTIONS,
  MANAGED_ROLES,
  ManagedRoleName,
  PermissionLevel,
} from '../data/permissionsData';
import {
  ShieldCheck,
  Eye,
  Edit3,
  EyeOff,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  Lock,
  Layers,
  ChevronRight,
  Hand,
  ClipboardCheck,
  Users,
  Wallet,
  BookOpen,
  Tv,
  Monitor,
  Compass,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Hand,
  ClipboardCheck,
  Users,
  Wallet,
  BookOpen,
  Tv,
  Monitor,
  Compass,
};

export const AutorizzazioniView: React.FC = () => {
  const {
    rolePermissions,
    updateRolePermission,
    resetRolePermissions,
    currentUser,
    isSuperAdmin,
  } = useApp();

  const [selectedRole, setSelectedRole] = useState<ManagedRoleName | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filteredSections = useMemo(() => {
    return MANAGED_MENU_SECTIONS.filter((sec) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        sec.label.toLowerCase().includes(term) ||
        sec.sublabel.toLowerCase().includes(term)
      );
    });
  }, [searchTerm]);

  const displayedRoles = useMemo(() => {
    if (selectedRole === 'ALL') return MANAGED_ROLES;
    return [selectedRole];
  }, [selectedRole]);

  // Gestione ciclo dei 3 stati al click: inibito -> sola lettura -> modifica -> inibito
  const cyclePermission = (sectionKey: string, roleName: ManagedRoleName) => {
    const currentLevel: PermissionLevel =
      rolePermissions[sectionKey]?.[roleName] || 'none';

    let nextLevel: PermissionLevel = 'none';
    if (currentLevel === 'none') nextLevel = 'view';
    else if (currentLevel === 'view') nextLevel = 'edit';
    else if (currentLevel === 'edit') nextLevel = 'none';

    updateRolePermission(sectionKey, roleName, nextLevel);
  };

  const handleSetRoleAll = (roleName: ManagedRoleName, level: PermissionLevel) => {
    for (const sec of MANAGED_MENU_SECTIONS) {
      updateRolePermission(sec.key, roleName, level);
    }
    showToast(`Impostato "${level === 'edit' ? 'Modifica' : level === 'view' ? 'Sola Lettura' : 'Inibito'}" per tutto il ruolo ${roleName}!`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Intestazione */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center shadow-md shadow-emerald-700/20">
            <ShieldCheck className="h-6 w-6 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Dashboard Autorizzazioni Ruoli
              </h1>
              <span className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                Solo Amministratore
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Configura per ciascuna voce del menu i permessi di visualizzazione, modifica o inibizione dei 10 ruoli.
            </p>
          </div>
        </div>

        {/* Pulsanti azioni globali */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reimposta Default</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 p-1.5 rounded-xl text-xs">
              <span className="text-amber-800 font-medium px-1">Confermi reset?</span>
              <button
                type="button"
                onClick={() => {
                  resetRolePermissions();
                  setConfirmReset(false);
                  showToast('Permessi ripristinati ai valori di fabbrica!');
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer"
              >
                Sì, Ripristina
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2 py-1 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Annulla
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast notifica rapida */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-medium border border-slate-700 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Legenda 3 Stati */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-rose-200 bg-rose-50/70">
          <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <EyeOff className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-bold text-rose-900">Inibito (Nessun Accesso)</p>
            <p className="text-[11px] text-rose-700">La voce di menu non appare e l'accesso è bloccato.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70">
          <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Eye className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-900">Sola Visualizzazione</p>
            <p className="text-[11px] text-amber-700">Menu visibile per consultare dati, modifiche disabilitate.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70">
          <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Edit3 className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-950">Modifica Completa</p>
            <p className="text-[11px] text-emerald-700">Accesso totale con inserimento, modifica e cancellazione.</p>
          </div>
        </div>
      </div>

      {/* Filtri Ruoli e Cerca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Selettore Tab Ruolo */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 shrink-0">
            Ruolo:
          </span>
          <button
            type="button"
            onClick={() => setSelectedRole('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedRole === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tutti i 10 Ruoli
          </button>
          {MANAGED_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRole(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedRole === r
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Campo Cerca Sezione */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca voce di menu..."
            className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* MATRICE INTERATTIVA DEI PERMESSI */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-punch overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-900 text-white border-b border-slate-800">
                <th className="py-4 px-4 sm:px-6 text-xs font-bold uppercase tracking-wider min-w-[220px] sticky left-0 bg-slate-900 z-10">
                  Voce di Menu ({filteredSections.length})
                </th>
                {displayedRoles.map((role) => (
                  <th
                    key={role}
                    className="py-4 px-3 text-center min-w-[125px] border-l border-slate-800"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold tracking-wide">
                        {role}
                      </div>
                      {/* Azioni rapide per la colonna ruolo */}
                      <div className="flex items-center justify-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSetRoleAll(role, 'edit')}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/50 cursor-pointer"
                          title={`Abilita tutte le sezioni in modifica per ${role}`}
                        >
                          Tutto ON
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetRoleAll(role, 'none')}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/50 cursor-pointer"
                          title={`Inibisci tutte le sezioni per ${role}`}
                        >
                          Tutto OFF
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSections.map((section, idx) => {
                const IconComponent = ICON_MAP[section.iconName] || Layers;
                return (
                  <tr
                    key={section.key}
                    className={`hover:bg-slate-50/80 transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                    }`}
                  >
                    {/* Colonna Voce di Menu (Bloccata a sinistra) */}
                    <td className="py-4 px-4 sm:px-6 sticky left-0 bg-white z-10 shadow-xs border-r border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                          <IconComponent className="h-5 w-5 stroke-[1.75]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 leading-snug">
                            {section.label}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-[260px]">
                            {section.sublabel}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Colonne Ruoli con selettore a 3 stati */}
                    {displayedRoles.map((role) => {
                      const level: PermissionLevel =
                        rolePermissions[section.key]?.[role] || 'none';

                      const isRoleAdmin = role === 'Amministratore';

                      return (
                        <td
                          key={role}
                          className="py-3 px-2 text-center align-middle border-l border-slate-100"
                        >
                          {isRoleAdmin ? (
                            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-xs">
                              <Lock className="h-3.5 w-3.5 text-emerald-700" />
                              <span>Modifica</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => cyclePermission(section.key, role)}
                              className={`group inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 shadow-xs ${
                                level === 'edit'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                  : level === 'view'
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              }`}
                              title="Tocca per cambiare stato: Inibito ➔ Sola Lettura ➔ Modifica"
                            >
                              {level === 'edit' && (
                                <>
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Modifica</span>
                                </>
                              )}
                              {level === 'view' && (
                                <>
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Lettura</span>
                                </>
                              )}
                              {level === 'none' && (
                                <>
                                  <EyeOff className="h-3.5 w-3.5 opacity-70" />
                                  <span>Inibito</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota informativa sul funzionamento dei permessi */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-blue-900">
          <p className="font-bold text-blue-950">Come vengono applicati i permessi nell'app:</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-800">
            <li>
              <strong>Un solo tocco per cambiare:</strong> tocca qualsiasi casella per alternare a rotazione tra <em>Inibito</em> ➔ <em>Sola Lettura</em> ➔ <em>Modifica</em>.
            </li>
            <li>
              <strong>Utenti con più ruoli:</strong> se un socio possiede più di un ruolo (es. Membro CD + Didattica), l'app applica automaticamente il permesso più elevato tra quelli assegnati.
            </li>
            <li>
              <strong>Amministratore protetto:</strong> il ruolo Amministratore e il Super Admin (7726) hanno sempre accesso completo a tutte le funzioni per garantire la continuità gestionale del portale.
            </li>
            <li>
              <strong>Sincronizzazione Cloud istantanea:</strong> ogni modifica effettuata viene salvata nel database cloud e propagata in tempo reale a tutti i dispositivi connessi.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
