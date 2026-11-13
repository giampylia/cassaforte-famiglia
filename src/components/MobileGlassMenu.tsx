import React from 'react';
import {
  X,
  RotateCw,
  LogOut,
  Volume2,
  VolumeX,
  Type,
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
  onClose?: () => void;
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
  showCloseButton?: boolean;
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
  showCloseButton = false,
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

  // Attivazione sintesi vocale con feedback sonoro immediato per spiegare chiaramente all'utente cosa fa
  const handleToggleVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !voiceEnabled;
    setVoiceEnabled(nextState);

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const text = nextState
          ? 'Sintesi vocale attivata'
          : 'Sintesi vocale disattivata';
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'it-IT';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch {}
    }
  };

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
    <div className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto bg-[#112825] text-white p-3.5 sm:p-5 select-none animate-fadeIn">
      {/* SFONDO SPLASH CON LOGO STILIZZATO MODERNO (MONOGRAMMA ORO Q3) */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        <img
          src="/q3-icon-512.png?v=8"
          alt="Logo Stilizzato Q3"
          className="w-72 h-72 sm:w-96 sm:h-96 object-contain opacity-40 mix-blend-screen select-none pointer-events-none drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
        />
        {/* Alone smeraldo / oro profondo */}
        <div className="absolute w-[380px] h-[380px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* CONTENUTO PRINCIPALE IN PRIMO PIANO */}
      <div className="relative z-10 flex flex-col justify-between min-h-full max-w-md mx-auto w-full space-y-3 sm:space-y-4">
        {/* 1. TESTATA SUPERIORE PULITA ED ELEGANTE (COME RICHIESTO DALL'UTENTE) */}
        <header className="relative pt-2 pb-1 text-center">
          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 top-1 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 border border-white/25 p-2 text-white backdrop-blur-md shadow-md transition cursor-pointer"
              title="Chiudi Menu"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}

          <h1
            className="font-serif italic text-2xl sm:text-3xl font-normal text-emerald-100 tracking-wide drop-shadow-md"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Portale Soci Q3
          </h1>
          <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-200/90 uppercase tracking-[0.18em] mt-0.5">
            Università della Terza Età di Quartu Sant&apos;Elena APS
          </p>

          {/* Saluto personalizzato con nome socio */}
          <div className="mt-2 inline-flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1 text-xs sm:text-sm font-medium text-white shadow-xs">
            <span>Benvenuto/a, <strong className="font-bold text-emerald-200">{currentUser.full_name}</strong></span>
          </div>
        </header>

        {/* 2. GRIGLIA CENTRALE DEI TASTI QUADRATI SEMITRASPARENTI (3 COLONNE) */}
        <main className="py-1 sm:py-2">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 w-full">
            {menuGridItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSelectSection(item.key);
                    if (onClose) onClose();
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
        </main>

        {/* 3. PARTE BASSA RAGGRUPPATA IN MODO ORDINATO E SOBRIO */}
        <footer className="space-y-2 pt-1">
          {/* Scheda dati socio: tessera, ruolo, sede, cloud ordinati */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2.5 sm:p-3 text-[11px] sm:text-xs text-emerald-100 shadow-md space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-white truncate">
                {currentUser.full_name}
              </span>
              <span className="shrink-0 text-emerald-200 font-bold">
                Tessera N° {currentUser.member_number}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-emerald-200/80">
              <span className="truncate">
                Ruolo: <strong className="text-white font-medium">{userRoleLabel}</strong> · Sede {currentUser.sede || 'Quartu'}
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 font-medium text-emerald-300">
                <span className={`h-1.5 w-1.5 rounded-full ${cloudConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {cloudConnected ? 'Online Cloud' : 'Locale'}
              </span>
            </div>
          </div>

          {/* Barra comandi rapidi: Zoom caratteri, Sintesi Vocale (con spiegazione audio), Forza Aggiornamento ed Esci */}
          <div className="grid grid-cols-4 gap-2">
            {/* Tasto Caratteri Aa */}
            <button
              type="button"
              onClick={cycleFontScale}
              className="flex items-center justify-center gap-1 rounded-xl bg-white/12 hover:bg-white/20 active:bg-white/25 border border-white/20 py-2 px-1 text-xs font-bold text-white backdrop-blur-md shadow-xs transition active:scale-95 cursor-pointer"
              title="Ingrandisci o rimpicciolisci i caratteri del testo"
            >
              <Type className="h-3.5 w-3.5 text-emerald-300" />
              <span>{fontShortLabel}</span>
            </button>

            {/* Tasto Sintesi Vocale con annuncio vocale immediato */}
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`flex items-center justify-center gap-1 rounded-xl border py-2 px-1 text-xs font-bold backdrop-blur-md shadow-xs transition active:scale-95 cursor-pointer ${
                voiceEnabled
                  ? 'bg-emerald-500/30 border-emerald-300 text-emerald-200'
                  : 'bg-white/12 hover:bg-white/20 border-white/20 text-slate-300'
              }`}
              title={voiceEnabled ? 'Sintesi Vocale Attiva (clicca per disattivare)' : 'Sintesi Vocale Disattivata (clicca per attivare)'}
            >
              {voiceEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 opacity-60" />
              )}
              <span>{voiceEnabled ? 'Voce ON' : 'Voce OFF'}</span>
            </button>

            {/* Tasto Forza Aggiornamento */}
            <button
              type="button"
              onClick={onForceUpdate}
              disabled={isUpdatingApp}
              className="flex items-center justify-center gap-1 rounded-xl bg-white/12 hover:bg-white/20 active:bg-white/25 border border-white/20 py-2 px-1 text-xs font-semibold text-emerald-100 backdrop-blur-md shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Aggiorna l'applicazione all'ultima versione disponibile"
            >
              <RotateCw className={`h-3 w-3 text-emerald-300 ${isUpdatingApp ? 'animate-spin' : ''}`} />
              <span>{appVersion}</span>
            </button>

            {/* Tasto Esci */}
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center justify-center gap-1 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 active:bg-rose-500/45 border border-rose-300/30 py-2 px-1 text-xs font-semibold text-rose-200 backdrop-blur-md shadow-xs transition active:scale-95 cursor-pointer"
              title="Esci dalla sessione"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-300" />
              <span>Esci</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
