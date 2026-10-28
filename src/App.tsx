import React, { useState } from 'react';
import {
  Wallet,
  BookOpen,
  LayoutDashboard,
  X,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Hand,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { AccessibilityTopBar } from './components/AccessibilityTopBar';
import { LoginView } from './components/LoginView';
import { MemberView } from './components/MemberView';
import { AdminDashboard } from './components/AdminDashboard';
import { PiccolaCassaView } from './components/PiccolaCassaView';

const MainRouter: React.FC = () => {
  const {
    currentUser,
    isSuperAdmin,
    isCDMember,
    activeSection,
    setActiveSection,
    signOut,
  } = useApp();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <AccessibilityTopBar />
        <LoginView />
      </div>
    );
  }

  // Mostra il Menu Laterale solo ai soci con ruolo CD e all'Amministratore Generale 7796 (Giampiero Pilia)
  const showCDSideMenu = isCDMember || isSuperAdmin;

  const menuItems = [
    {
      key: 'presenze' as const,
      shortLabel: 'Timbra Aule',
      label: 'Timbratura e Corsi',
      sublabel: 'Ingresso Aule e Orario Lezioni',
      icon: Hand,
    },
    {
      key: 'piccola_cassa' as const,
      shortLabel: 'Piccola Cassa',
      label: 'Piccola Cassa',
      sublabel: 'Rimborsi, Versamenti e Scontrini',
      icon: Wallet,
    },
    ...(currentUser.role === 'admin' || isSuperAdmin
      ? [
          {
            key: 'admin_dashboard' as const,
            shortLabel: 'Amministrazione',
            label: 'Amministrazione & Soci',
            sublabel: 'Aule Live, Ruoli CD e Registri',
            icon: LayoutDashboard,
          },
        ]
      : []),
  ];

  // Se l'utente NON è del CD (es. socio ordinario o ufficio presenze base 000)
  if (!showCDSideMenu) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <AccessibilityTopBar />
        {currentUser.role === 'admin' ? <AdminDashboard /> : <MemberView />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AccessibilityTopBar
        showMenuButton={true}
        onOpenSideMenu={() => setMobileDrawerOpen(true)}
      />

      {/* Selettore rapido su mobile: griglia pulita senza barre di scorrimento né scritte tagliate */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2">
        <div
          className={`mx-auto max-w-4xl grid gap-1.5 ${
            menuItems.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs sm:text-sm font-medium transition border ${
                  active
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenitore principale: Menu Laterale a sinistra (su schermi grandi) + Contenuto */}
      <div className="flex-1 flex">
        {/* MENU LATERALE DESKTOP */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4">
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
                <span className="text-xs font-medium text-emerald-900">
                  {isSuperAdmin ? 'Amministratore Generale' : 'Consiglio Direttivo (CD)'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {(currentUser.roles && currentUser.roles.length > 0
                  ? currentUser.roles
                  : ['Socio', 'CD']
                ).map((r) => (
                  <span
                    key={r}
                    className="rounded-md bg-white border border-emerald-200 px-2 py-0.5 text-[11px] font-normal text-emerald-900"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Sezioni Disponibili
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
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p
                          className={`text-[11px] font-normal truncate ${
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

          <div className="pt-4 border-t border-slate-100">
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

        {/* DRAWER MENU LATERALE A SCOMPARSA (Quando si tocca "☰ Menu" in alto a sinistra) */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative z-10 w-72 max-w-[85vw] bg-white h-full p-4 flex flex-col justify-between shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/q3-icon-512.png?v=8"
                      alt="Q3"
                      className="h-8 w-8 rounded-lg border border-slate-200"
                    />
                    <span className="text-base font-medium text-slate-900">
                      Menu Q3
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-1">
                  <p className="text-sm font-medium text-slate-900">{currentUser.full_name}</p>
                  <p className="text-xs text-emerald-800">
                    Tessera N° {currentUser.member_number} ·{' '}
                    {isSuperAdmin ? 'Amministratore' : 'Consiglio Direttivo'}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="px-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                    Sezioni
                  </p>
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setActiveSection(item.key);
                          setMobileDrawerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-3 text-left transition border ${
                          isActive
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`h-5 w-5 shrink-0 ${
                              isActive ? 'text-white' : 'text-emerald-700'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            <p
                              className={`text-xs font-normal truncate ${
                                isActive ? 'text-emerald-100' : 'text-slate-500'
                              }`}
                            >
                              {item.sublabel}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  signOut();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 text-white py-3 text-sm font-medium"
              >
                <LogOut className="h-4 w-4" />
                <span>Esci</span>
              </button>
            </div>
          </div>
        )}

        {/* Area Contenuto Principale */}
        <div className="flex-1 min-w-0">
          {activeSection === 'piccola_cassa' ? (
            <PiccolaCassaView />
          ) : activeSection === 'admin_dashboard' &&
            (currentUser.role === 'admin' || isSuperAdmin) ? (
            <AdminDashboard />
          ) : (
            <MemberView />
          )}
        </div>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}

export default App;
