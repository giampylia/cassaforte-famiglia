import React, { useState } from 'react';
import {
  Wallet,
  X,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Hand,
  ClipboardCheck,
  Users,
  Monitor,
  Tv,
  BookOpen,
  RotateCw,
  Key,
  Home,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { getMemberParts, isProtectedSegreteriaMember } from './data/initialData';
import { AccessibilityTopBar } from './components/AccessibilityTopBar';
import { LoginView } from './components/LoginView';
import { MemberView } from './components/MemberView';
import { AdminDashboard } from './components/AdminDashboard';
import { PiccolaCassaView } from './components/PiccolaCassaView';
import { AnagraficaSociView } from './components/AnagraficaSociView';
import { EliminacodeView } from './components/EliminacodeView';
import { AvvisiVideoView } from './components/AvvisiVideoView';
import { BibliotecaView } from './components/BibliotecaView';
import { AutorizzazioniView } from './components/AutorizzazioniView';
import { MobileGlassMenu } from './components/MobileGlassMenu';

const MainRouter: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    isCDMember,
    isDidatticaMember,
    isSegreteriaMember,
    activeSection,
    setActiveSection,
    getUserSectionPermission,
    signOut,
  } = useApp();

  const CURRENT_APP_VERSION = 'v54';
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  const forceAppUpdate = async () => {
    setIsUpdatingApp(true);
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const names = await caches.keys();
        for (const name of names) {
          await caches.delete(name);
        }
      }
      localStorage.removeItem('quartimbra_active_section');
    } catch {}
    window.location.reload();
  };

  // Permette di aprire direttamente lo schermo del Monitor Sala d'Attesa tramite /monitor, /sala o ?monitor=eliminacode senza login
  const isDirectMonitorUrl =
    typeof window !== 'undefined' &&
    (['/monitor', '/sala', '/coda', '/eliminacode'].includes(
      window.location.pathname.toLowerCase().replace(/\/+$/, '')
    ) ||
      new URLSearchParams(window.location.search).get('monitor') === 'eliminacode' ||
      new URLSearchParams(window.location.search).get('eliminacode') === 'monitor');

  if (isDirectMonitorUrl) {
    return <EliminacodeView forceMonitorMode={true} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <AccessibilityTopBar />
        <LoginView />
      </div>
    );
  }

  // Riconoscimento infallibile membri Segreteria (Nives Cocco 9999 e Josh Ronald Cocco 9998)
  const isSegreteriaUser =
    !isSuperAdmin &&
    (isProtectedSegreteriaMember(currentUser) ||
      isSegreteriaMember ||
      currentUser?.member_number === '9999' ||
      currentUser?.member_number === '9998' ||
      Boolean(
        currentUser &&
          currentUser.roles &&
          currentUser.roles.some((r) => r.trim().toLowerCase() === 'segreteria')
      ));

  const isSegreteriaOnly = isSegreteriaUser;

  // Mostra il Menu Laterale a tutti gli utenti registrati (tutti i soci hanno accesso a Timbratura e Biblioteca)
  const showSideMenu = true;

  // Calcola l'unico ruolo principale da mostrare chiaramente sotto il nome dell'utente
  const userSingleRoleLabel = isSuperAdmin
    ? 'Amministratore'
    : currentUser.role === 'admin'
    ? 'Ufficio Presenze / Admin'
    : isSegreteriaUser
    ? 'Segreteria'
    : getMemberParts(currentUser).primaryRole;

  // Controllo autorizzazioni dinamiche per ciascuna sezione del menu
  const canSeePresenze = getUserSectionPermission('presenze') !== 'none';
  const canSeeTimbratureAule = getUserSectionPermission('admin_dashboard') !== 'none';
  const canSeeAnagraficaSoci = getUserSectionPermission('anagrafica_soci') !== 'none';
  const canSeePiccolaCassa = getUserSectionPermission('piccola_cassa') !== 'none';
  const canSeeBiblioteca = getUserSectionPermission('biblioteca') !== 'none';
  const canSeeAvvisiVideo = getUserSectionPermission('avvisi_video') !== 'none';
  const canSeeEliminacode = getUserSectionPermission('eliminacode') !== 'none';

  // Autorizzazioni visibile esclusivamente ad Amministratore (7726 o role === 'admin')
  const canSeeAutorizzazioni = isSuperAdmin || currentUser.role === 'admin';

  const menuItems = [
    {
      key: 'menu' as const,
      label: 'Home / Menu Tasti',
      sublabel: 'Dashboard con Tasti Glass',
      icon: Home,
    },
    ...(canSeePresenze
      ? [
          {
            key: 'presenze' as const,
            label: 'Timbratura e Corsi',
            sublabel: 'Ingresso Aule e Orario Lezioni',
            icon: Hand,
          },
        ]
      : []),
    ...(canSeeTimbratureAule
      ? [
          {
            key: 'admin_dashboard' as const,
            label: 'Gestione Timbrature Aule',
            sublabel: 'Riscontri Aule Live, Orari e Registri',
            icon: ClipboardCheck,
          },
        ]
      : []),
    ...(canSeeAnagraficaSoci
      ? [
          {
            key: 'anagrafica_soci' as const,
            label: 'Anagrafica Soci',
            sublabel: 'Elenco, Import CSV/Excel e Ruoli',
            icon: Users,
          },
        ]
      : []),
    ...(canSeePiccolaCassa
      ? [
          {
            key: 'piccola_cassa' as const,
            label: 'Piccola Cassa',
            sublabel: 'Rimborsi, Versamenti e Scontrini',
            icon: Wallet,
          },
        ]
      : []),
    ...(canSeeBiblioteca
      ? [
          {
            key: 'biblioteca' as const,
            label: 'Biblioteca',
            sublabel: 'Catalogo Libri e Pubblicazioni',
            icon: BookOpen,
          },
        ]
      : []),
    ...(canSeeAvvisiVideo
      ? [
          {
            key: 'avvisi_video' as const,
            label: 'Avvisi Video',
            sublabel: 'Proiezione Monitor, Ticker e Slide',
            icon: Tv,
          },
        ]
      : []),
    ...(canSeeEliminacode
      ? [
          {
            key: 'eliminacode' as const,
            label: 'Eliminacode',
            sublabel: 'Telecomando e Monitor Numeri PDF',
            icon: Monitor,
          },
        ]
      : []),
    ...(canSeeAutorizzazioni
      ? [
          {
            key: 'autorizzazioni' as const,
            label: 'Autorizzazioni',
            sublabel: 'Gestione Permessi per Singolo Ruolo',
            icon: Key,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AccessibilityTopBar
        showMenuButton={true}
        onOpenSideMenu={() => setMobileDrawerOpen(true)}
      />

      {/* Contenitore principale: Menu Laterale a sinistra (su PC) + Contenuto */}
      <div className="flex-1 flex">
        {/* MENU LATERALE DESKTOP */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 overflow-y-auto max-h-screen sticky top-0">
          <div className="space-y-5">
            {/* Riepilogo Utente essenziale con UN SOLO RUOLO indicato chiaramente */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900 leading-snug">
                  {currentUser.full_name}
                </p>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                  {CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="text-xs font-normal text-slate-600">
                Tessera N° {currentUser.member_number} · Sede {currentUser.sede}
              </p>
              <div className="flex items-center gap-1.5 pt-1 text-xs font-medium text-emerald-800">
                <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>Ruolo nell&apos;app: {userSingleRoleLabel}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Menu Principale
              </p>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveSection(item.key)}
                    className={`w-full flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-3 text-left transition border ${
                      isActive
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-transparent hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`h-5 w-5 shrink-0 stroke-[1.75] ${
                          isActive ? 'text-white' : 'text-emerald-700'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{item.label}</p>
                        <p
                          className={`text-[11px] font-normal leading-snug ${
                            isActive ? 'text-emerald-100' : 'text-slate-500'
                          }`}
                        >
                          {item.sublabel}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <button
              type="button"
              onClick={forceAppUpdate}
              disabled={isUpdatingApp}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2 text-xs font-medium text-slate-600 transition cursor-pointer active:scale-95 disabled:opacity-60"
              title="Svuota la cache e aggiorna l'app all'ultima versione"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isUpdatingApp ? 'animate-spin text-emerald-700' : ''}`} />
              <span>{isUpdatingApp ? 'Aggiornamento in corso...' : `Forza Aggiornamento (${CURRENT_APP_VERSION})`}</span>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 py-2.5 text-xs font-medium text-rose-700 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Esci dalla sessione</span>
            </button>
          </div>
        </aside>

        {/* MENU PER SMARTPHONE IN STILE GLASSMORPHISM (SFONDO VERDE SCURO SPLASH + TASTI SEMITRASPARENTI) */}
        <MobileGlassMenu
          isOpen={activeSection === 'menu' || mobileDrawerOpen}
          onClose={() => {
            setMobileDrawerOpen(false);
            if (activeSection === 'menu') {
              setActiveSection('presenze');
            }
          }}
          activeSection={activeSection}
          onSelectSection={(section) => {
            setActiveSection(section);
            setMobileDrawerOpen(false);
          }}
          currentUser={currentUser}
          userRoleLabel={userSingleRoleLabel}
          appVersion={CURRENT_APP_VERSION}
          isUpdatingApp={isUpdatingApp}
          onForceUpdate={forceAppUpdate}
          onSignOut={signOut}
          canSeePresenze={canSeePresenze}
          canSeeTimbratureAule={canSeeTimbratureAule}
          canSeeAnagraficaSoci={canSeeAnagraficaSoci}
          canSeePiccolaCassa={canSeePiccolaCassa}
          canSeeBiblioteca={canSeeBiblioteca}
          canSeeAvvisiVideo={canSeeAvvisiVideo}
          canSeeEliminacode={canSeeEliminacode}
          canSeeAutorizzazioni={canSeeAutorizzazioni}
          showCloseButton={mobileDrawerOpen && activeSection !== 'menu'}
        />

        {/* Area Contenuto Principale */}
        <div className="flex-1 min-w-0">
          {activeSection === 'menu' ? (
            <div className="hidden lg:block">
              <MemberView />
            </div>
          ) : activeSection === 'autorizzazioni' && canSeeAutorizzazioni ? (
            <AutorizzazioniView />
          ) : activeSection === 'eliminacode' && canSeeEliminacode ? (
            <EliminacodeView />
          ) : activeSection === 'avvisi_video' && canSeeAvvisiVideo ? (
            <AvvisiVideoView />
          ) : activeSection === 'biblioteca' && canSeeBiblioteca ? (
            <BibliotecaView />
          ) : activeSection === 'anagrafica_soci' && canSeeAnagraficaSoci ? (
            <AnagraficaSociView />
          ) : activeSection === 'piccola_cassa' && canSeePiccolaCassa ? (
            <PiccolaCassaView />
          ) : activeSection === 'admin_dashboard' && canSeeTimbratureAule ? (
            <AdminDashboard />
          ) : isSegreteriaOnly ? (
            <EliminacodeView />
          ) : (
            <MemberView />
          )}
        </div>
      </div>
    </div>
  );
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('App Error caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6 text-white text-center font-sans">
          <div className="max-w-md w-full bg-slate-800 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl space-y-4">
            <img src="/q3-icon-192.png?v=8" alt="Q3" className="w-16 h-16 mx-auto rounded-2xl bg-white p-1" />
            <h2 className="text-xl font-bold text-white">Ripristino Applicazione Q3</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              È stato rilevato un problema temporaneo di caricamento. Clicca il pulsante in basso per ripristinare e accedere al Portale.
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem('quartimbra_active_section');
                } catch {}
                window.location.reload();
              }}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 text-sm transition cursor-pointer"
            >
              Riavvia Portale Q3
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainRouter />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
