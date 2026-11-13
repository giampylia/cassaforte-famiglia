import React from 'react';
import {
  X,
  RotateCw,
  LogOut,
  ShieldCheck,
  Building,
  Volume2,
  VolumeX,
  Type,
  CheckCircle2,
  Hand,
  ClipboardCheck,
  Users,
  Wallet,
  BookOpen,
  Tv,
  Monitor,
  Key,
} from 'lucide-react';
import { useApp, AppSection, FontScale } from '../context/AppContext';
import { Profile } from '../data/initialData';

interface MenuItemConfig {
  key: AppSection;
  label: string;
  shortLabel: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MobileGlassMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  currentUser: Profile;
  userRoleLabel: string;
  appVersion: string;
  isUpdatingApp: boolean;
  onForceUpdate: () => void;
  onSignOut: () => void;
  canSeePresenze: boolean;
  canSeeTimbratureAule: boolean;
  canSeeAnagraficaSoci: boolean;
  canSeePiccolaCassa: boolean;
  canSeeBiblioteca: boolean;
  canSeeAvvisiVideo: boolean;
  canSeeEliminacode: boolean;
  canSeeAutorizzazioni: boolean;
}

export const MobileGlassMenu: React.FC<MobileGlassMenuProps> = ({
  isOpen,
  onClose,
  activeSection,
  onSelectSection,
  currentUser,
  userRoleLabel,
  appVersion,
  isUpdatingApp,
  onForceUpdate,
  onSignOut,
  canSeePresenze,
  canSeeTimbratureAule,
  canSeeAnagraficaSoci,
  canSeePiccolaCassa,
  canSeeBiblioteca,
  canSeeAvvisiVideo,
  canSeeEliminacode,
  canSeeAutorizzazioni,
}) => {
  const {
    fontScale,
    setFontScale,
    voiceEnabled,
    setVoiceEnabled,
    cloudConnected,
  } = useApp();

  if (!isOpen) return null;

  const cycleFontScale = (e: React.MouseEvent) => {
    e.stopPropagation();
    const order: FontScale[] = ['normal', 'large', 'xlarge'];
    const next = order[(order.indexOf(fontScale) + 1) % order.length];
    setFontScale(next);
  };

  const fontShortLabel =
    fontScale === 'normal' ? 'Aa' : fontScale === 'large' ? 'Aa+' : 'Aa++';

  // Configurazione dinamica dei tasti autorizzati per il ruolo
  const menuGridItems: MenuItemConfig[] = [
    ...(canSeePresenze
      ? [
          {
            key: 'presenze' as AppSection,
            label: 'Timbratura e Corsi',
            shortLabel: 'TIMBRATURA',
            sublabel: 'Ingresso Aule e Corsi',
            icon: Hand,
          },
        ]
      : []),
    ...(canSeeTimbratureAule
      ? [
          {
            key: 'admin_dashboard' as AppSection,
            label: 'Gestione Timbrature Aule',
            shortLabel: 'GESTIONE AULE',
            sublabel: 'Riscontri e Turni',
            icon: ClipboardCheck,
          },
        ]
      : []),
    ...(canSeeAnagraficaSoci
      ? [
          {
            key: 'anagrafica_soci' as AppSection,
            label: 'Anagrafica Soci',
            shortLabel: 'ANAGRAFICA',
            sublabel: 'Elenco Soci e Ruoli',
            icon: Users,
          },
        ]
      : []),
    ...(canSeePiccolaCassa
      ? [
          {
            key: 'piccola_cassa' as AppSection,
            label: 'Piccola Cassa',
            shortLabel: 'PICCOLA CASSA',
            sublabel: 'Movimenti e Saldo',
            icon: Wallet,
          },
        ]
      : []),
    ...(canSeeBiblioteca
      ? [
          {
            key: 'biblioteca' as AppSection,
            label: 'Biblioteca',
            shortLabel: 'BIBLIOTECA',
            sublabel: 'Catalogo Libri',
            icon: BookOpen,
          },
        ]
      : []),
    ...(canSeeAvvisiVideo
      ? [
          {
            key: 'avvisi_video' as AppSection,
            label: 'Avvisi Video',
            shortLabel: 'AVVISI VIDEO',
            sublabel: 'Monitor e Slide',
            icon: Tv,
          },
        ]
      : []),
    ...(canSeeEliminacode
      ? [
          {
            key: 'eliminacode' as AppSection,
            label: 'Eliminacode',
            shortLabel: 'ELIMINACODE',
            sublabel: 'Chiamata Turni',
            icon: Monitor,
          },
        ]
      : []),
    ...(canSeeAutorizzazioni
      ? [
          {
            key: 'autorizzazioni' as AppSection,
            label: 'Autorizzazioni',
            shortLabel: 'AUTORIZZAZIONI',
            sublabel: 'Permessi Ruoli',
            icon: Key,
          },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto bg-gradient-to-b from-[#064e3b] via-[#043d2f] to-[#022c22] text-white p-4 sm:p-6 select-none animate-fadeIn">
      {/* SFONDO SPLASH CON LOGO STILIZZATO GRANDE IN FILIGRANA */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        <img
          src="/logo-associazione-qu3.png?v=15"
          alt="Watermark Q3"
          className="w-80 h-80 sm:w-[450px] sm:h-[450px] object-contain opacity-15 filter drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)] select-none pointer-events-none"
        />
        {/* Glow circolare smeraldo d'atmosfera */}
        <div className="absolute w-[360px] h-[360px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* CONTENUTO PRINCIPALE IN PRIMO PIANO */}
      <div className="relative z-10 flex flex-col justify-between min-h-full max-w-md mx-auto w-full space-y-4">
        {/* 1. TESTATA SUPERIORE CON TITOLO ELEGANTE + PULSANTE CHIUSURA X */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex-1 text-center pl-9">
            <h1
              className="font-serif italic text-2xl sm:text-3xl font-normal text-emerald-100 tracking-wide drop-shadow-md"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Portale Soci Q3
            </h1>
            <p className="text-[11px] font-semibold text-emerald-200/80 uppercase tracking-[0.22em] mt-0.5">
              Università della Terza Età
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/15 hover:bg-white/25 active:scale-90 border border-white/25 p-2 text-white backdrop-blur-md shadow-md transition shrink-0 cursor-pointer"
            title="Chiudi Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2. CAPSULA SUPERIORE ACCESSORIE & RAPIDE (Stile bandiere immagine) */}
        <div className="rounded-full bg-white/12 backdrop-blur-md border border-white/25 px-4 py-2 flex items-center justify-between text-xs text-emerald-100 shadow-md">
          {/* Sede attiva */}
          <div className="flex items-center gap-1.5 font-medium">
            <Building className="h-3.5 w-3.5 text-emerald-300" />
            <span>Sede {currentUser.sede || 'Quartu'}</span>
          </div>

          {/* Stato Cloud */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className={`h-2 w-2 rounded-full ${
                cloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-white font-medium">
              {cloudConnected ? 'Online' : 'Locale'}
            </span>
          </div>

          {/* Tasti Rapidi Aa e Audio */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cycleFontScale}
              className="rounded-lg bg-white/15 hover:bg-white/25 px-2 py-0.5 text-[11px] font-bold text-white transition active:scale-95"
              title="Dimensione caratteri"
            >
              {fontShortLabel}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVoiceEnabled(!voiceEnabled);
              }}
              className="rounded-lg bg-white/15 hover:bg-white/25 p-1 text-white transition active:scale-95"
              title={voiceEnabled ? 'Disattiva voce' : 'Attiva voce'}
            >
              {voiceEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-slate-300 opacity-60" />
              )}
            </button>
          </div>
        </div>

        {/* 3. SCHEDA RIEPILOGO UTENTE E RUOLO IN VETRO */}
        <div className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-3 shadow-md flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate drop-shadow-xs">
              {currentUser.full_name}
            </p>
            <p className="text-[11px] text-emerald-200/90 font-medium">
              Tessera N° {currentUser.member_number} · {userRoleLabel}
            </p>
          </div>
          <span className="rounded-full bg-emerald-400/20 border border-emerald-300/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 shrink-0">
            {appVersion}
          </span>
        </div>

        {/* 4. GRIGLIA PRINCIPALE DEI TASTI QUADRATI SEMITRASPARENTI (3 COLONNE) */}
        <div className="py-2">
          <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full">
            {menuGridItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSelectSection(item.key);
                    onClose();
                  }}
                  className={`group relative aspect-square rounded-3xl transition-all duration-200 active:scale-95 flex flex-col items-center justify-center p-2 text-center cursor-pointer select-none shadow-xl ${
                    isActive
                      ? 'bg-white/30 border-2 border-emerald-300 backdrop-blur-xl shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                      : 'bg-white/14 hover:bg-white/24 active:bg-white/30 backdrop-blur-md border border-white/25 hover:border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]'
                  }`}
                >
                  {/* Icona a linea in bianco */}
                  <div className="relative flex items-center justify-center mb-1.5">
                    <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-white stroke-[1.6] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-200" />
                  </div>

                  {/* Etichetta in maiuscolo centrata sotto l'icona */}
                  <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-wider uppercase leading-tight line-clamp-2 px-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                    {item.shortLabel}
                  </span>

                  {/* Indicatore luminoso attivo in basso */}
                  {isActive && (
                    <span className="absolute bottom-1.5 h-1 w-6 rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. AZIONI RAPIDE INFERIORI (FORZA AGGIORNAMENTO + LOGOUT) */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={onForceUpdate}
            disabled={isUpdatingApp}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white/12 hover:bg-white/20 active:bg-white/25 backdrop-blur-md border border-white/25 py-2.5 px-4 text-xs font-semibold text-emerald-100 shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Svuota la cache e aggiorna l'app all'ultima versione"
          >
            <RotateCw
              className={`h-3.5 w-3.5 text-emerald-300 ${isUpdatingApp ? 'animate-spin' : ''}`}
            />
            <span>
              {isUpdatingApp ? 'Aggiornamento in corso...' : `Forza Aggiornamento (${appVersion})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-500/25 hover:bg-rose-500/35 active:bg-rose-500/45 backdrop-blur-md border border-rose-300/35 py-3 px-4 text-xs font-semibold text-rose-100 shadow-md transition active:scale-95 cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-rose-200" />
            <span>Esci dalla sessione</span>
          </button>
        </div>
      </div>
    </div>
  );
};
