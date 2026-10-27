import React, { useState } from 'react';
import {
  Wallet,
  BookOpen,
  LayoutDashboard,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
  LogOut,
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
    cashMovements,
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
  const pendingCassaCount = cashMovements.filter((m) => m.status === 'inviato').length;

  const menuItems = [
    ...(currentUser.role === 'admin' || isSuperAdmin
      ? [
          {
            key: 'admin_dashboard' as const,
            label: 'Gestione Soci & Ruoli',
            sublabel: 'Anagrafica, Check CD e Presenze',
            icon: LayoutDashboard,
            badge: isSuperAdmin ? 'Admin 7796' : 'Ufficio',
          },
        ]
      : []),
    {
      key: 'piccola_cassa' as const,
      label: 'Piccola Cassa',
      sublabel: 'Rimborsi, Versamenti e Scontrini',
      icon: Wallet,
      badge: pendingCassaCount > 0 ? `${pendingCassaCount} in attesa` : 'Attivo',
    },
    {
      key: 'presenze' as const,
      label: 'Timbratura e Corsi',
      sublabel: 'Ingresso Aule e Orario Lezioni',
      icon: BookOpen,
      badge: 'Aule',
    },
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
      <AccessibilityTopBar />

      {/* Barra rapida mobile per aprire il Menu Laterale CD / passare a Piccola Cassa */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2.5 flex items-center justify-between gap-2 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs sm:text-sm font-normal text-white shadow-xs transition"
        >
          <Menu className="h-4 w-4" />
          <span>Menu Laterale CD</span>
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-normal border whitespace-nowrap transition ${
                  active
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenitore principale: Menu Laterale a sinistra + Contenuto a destra */}
      <div className="flex-1 flex">
        {/* MENU LATERALE DESKTOP (Fisso a sinistra per Soci CD e Admin 7796) */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4">
          <div className="space-y-5">
            {/* Profilo Utente CD / Super Admin */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {currentUser.full_name}
                  </p>
                  <p className="text-xs font-normal text-emerald-800">
                    Tessera N° {currentUser.member_number}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
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

            {/* Voci Menu Laterale */}
            <div className="space-y-1.5">
              <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Menu Consiglio Direttivo
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
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
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

          <div className="pt-4 border-t border-slate-100 space-y-2">
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

        {/* DRAWER MENU LATERALE MOBILE */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative z-10 w-76 max-w-[85vw] bg-white h-full p-4 flex flex-col justify-between shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/q3-icon-512.png?v=8"
                      alt="Q3"
                      className="h-8 w-8 rounded-lg border border-slate-200"
                    />
                    <span className="text-sm font-medium text-slate-900">
                      Menu Consiglio Direttivo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-1">
                  <p className="text-sm font-medium text-slate-900">{currentUser.full_name}</p>
                  <p className="text-xs text-emerald-800">
                    Tessera N° {currentUser.member_number}
                  </p>
                </div>

                <div className="space-y-1.5">
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
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
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
                              className={`text-[11px] font-normal truncate ${
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 text-white py-2.5 text-sm font-normal"
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
