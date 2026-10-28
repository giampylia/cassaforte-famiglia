import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Smartphone,
  X,
  Share,
  PlusSquare,
  CheckCircle2,
  Type,
  LogOut,
  Menu,
} from 'lucide-react';
import { useApp, FontScale } from '../context/AppContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface AccessibilityTopBarProps {
  onOpenSideMenu?: () => void;
  showMenuButton?: boolean;
}

export const AccessibilityTopBar: React.FC<AccessibilityTopBarProps> = ({
  onOpenSideMenu,
  showMenuButton = false,
}) => {
  const {
    currentUser,
    signOut,
    fontScale,
    setFontScale,
    voiceEnabled,
    setVoiceEnabled,
  } = useApp();

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleAndroidInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      setDeferredPrompt(null);
      setShowInstallModal(false);
    }
  };

  const cycleFontScale = () => {
    const order: FontScale[] = ['normal', 'large', 'xlarge'];
    const next = order[(order.indexOf(fontScale) + 1) % order.length];
    setFontScale(next);
  };

  const fontShortLabel =
    fontScale === 'normal' ? 'Aa' : fontScale === 'large' ? 'Aa+' : 'Aa++';

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200 text-slate-800 px-3 py-2.5 shadow-2xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          {/* Lato Sinistro: Pulsante Menu Laterale (se CD/Admin) + Logo Q3 + Nome Utente o Titolo */}
          <div className="flex items-center gap-2.5 min-w-0">
            {showMenuButton && onOpenSideMenu && (
              <button
                type="button"
                onClick={onOpenSideMenu}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-xs sm:text-sm font-medium shadow-xs transition active:scale-95 shrink-0"
                title="Apri Menu Laterale"
              >
                <Menu className="h-5 w-5" />
                <span>Menu</span>
              </button>
            )}

            <img
              src="/q3-icon-512.png?v=8"
              alt="Q3"
              className="h-9 w-9 rounded-xl object-cover border border-slate-200 shrink-0"
            />

            {currentUser ? (
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-medium text-slate-900 truncate leading-tight">
                  {currentUser.full_name}
                </p>
                <p className="text-xs font-normal text-slate-500 truncate leading-tight">
                  Tessera {currentUser.member_number} · {currentUser.sede || 'Quartu'}
                </p>
              </div>
            ) : (
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-medium text-slate-800 truncate">
                  Q3 · Università Terza Età
                </p>
                <p className="text-xs font-normal text-slate-500 truncate">
                  Quartu Sant'Elena e Soleminis
                </p>
              </div>
            )}
          </div>

          {/* Lato Destro: Controlli compatti su una sola riga */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dimensione caratteri compatta */}
            <button
              type="button"
              onClick={cycleFontScale}
              title="Cambia grandezza testo"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 px-2.5 py-2 text-xs sm:text-sm font-medium text-slate-700 transition"
            >
              <Type className="h-4 w-4 text-emerald-700" />
              <span>{fontShortLabel}</span>
            </button>

            {/* Audio */}
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? 'Audio attivo' : 'Audio disattivato'}
              className={`inline-flex items-center justify-center rounded-xl border p-2 transition ${
                voiceEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {voiceEnabled ? (
                <Volume2 className="h-4 w-4 text-emerald-700" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>

            {/* Pulsante Installa visibile nella schermata di Login per non affollare la Home interna */}
            {!currentUser && (
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-xs sm:text-sm font-normal shadow-xs transition active:scale-95"
              >
                <Smartphone className="h-4 w-4" />
                <span>Installa</span>
              </button>
            )}

            {/* Unico Tasto Esci pulito e sempre visibile quando si è loggati */}
            {currentUser && (
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-xs sm:text-sm font-medium shadow-xs transition active:scale-95"
              >
                <LogOut className="h-4 w-4" />
                <span>Esci</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Finestra Istruzioni per installare l'App la prima volta su iPhone e Android */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-success-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/q3-icon-512.png?v=8"
                  alt="Q3"
                  className="h-14 w-14 rounded-2xl border border-slate-200 shadow-sm"
                />
                <div>
                  <h2 className="text-xl font-medium text-slate-900">
                    Installa Q3 sul tuo Smartphone
                  </h2>
                  <p className="text-sm font-normal text-slate-500">
                    Basta farlo solo la prima volta su iPhone o Android
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Chiudi"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-medium text-slate-900 flex items-center gap-2 mb-2">
                  🍎 Procedura per iPhone e iPad
                </h3>
                <ol className="space-y-2.5 text-sm sm:text-base font-normal text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white text-xs mt-0.5">
                      1
                    </span>
                    <span>
                      Apri questo link con <strong>Safari</strong> e tocca l'icona{' '}
                      <span className="inline-flex items-center gap-1 underline">
                        Condividi <Share className="h-4 w-4 inline" />
                      </span>{' '}
                      in basso sullo schermo.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white text-xs mt-0.5">
                      2
                    </span>
                    <span>
                      Scorri l'elenco e tocca{' '}
                      <span className="inline-flex items-center gap-1">
                        "Aggiungi alla schermata Home" <PlusSquare className="h-4 w-4 inline" />
                      </span>
                      .
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white text-xs mt-0.5">
                      3
                    </span>
                    <span>
                      Conferma toccando "Aggiungi" in alto a destra: l'icona Q3 resterà sempre sul tuo telefono.
                    </span>
                  </li>
                </ol>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-medium text-slate-900 flex items-center gap-2 mb-2">
                  🤖 Procedura per Smartphone Android
                </h3>
                {deferredPrompt ? (
                  <button
                    onClick={handleAndroidInstall}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-normal py-3.5 px-4 text-base shadow-sm transition"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Installa subito l'applicazione
                  </button>
                ) : (
                  <ol className="space-y-2.5 text-sm sm:text-base font-normal text-slate-700">
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-700 text-white text-xs mt-0.5">
                        1
                      </span>
                      <span>
                        Tocca i tre puntini <strong>⋮</strong> in alto a destra nel browser Chrome.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-700 text-white text-xs mt-0.5">
                        2
                      </span>
                      <span>
                        Tocca "Installa app" oppure "Aggiungi a schermata Home".
                      </span>
                    </li>
                  </ol>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="mt-5 w-full rounded-2xl bg-slate-800 hover:bg-slate-900 py-3.5 text-base font-normal text-white transition"
            >
              Chiudi finestra
            </button>
          </div>
        </div>
      )}
    </>
  );
};
