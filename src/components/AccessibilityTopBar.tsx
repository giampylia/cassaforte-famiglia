import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Smartphone, X, Share, PlusSquare, CheckCircle2, Type, Wifi, LogOut } from 'lucide-react';
import { useApp, FontScale } from '../context/AppContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const AccessibilityTopBar: React.FC = () => {
  const {
    currentUser,
    signOut,
    fontScale,
    setFontScale,
    voiceEnabled,
    setVoiceEnabled,
    cloudConnected,
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

  const fontLabel =
    fontScale === 'normal' ? 'Testo: Normale' : fontScale === 'large' ? 'Testo: Grande' : 'Testo: Molto Grande';

  return (
    <>
      <div className="w-full bg-white border-b border-slate-200 text-slate-700 px-3 py-2.5 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src="/q3-icon.jpeg"
              alt="Q3"
              className="h-7 w-7 rounded-lg object-cover border border-slate-200"
            />
            <span className="text-sm sm:text-base font-normal text-slate-700 tracking-normal">
              Università della Terza Età · Quartu Sant'Elena
            </span>
            <span
              className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-normal ${
                cloudConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
              title="Sincronizzazione Cloud in tempo reale attiva"
            >
              <Wifi className="h-3 w-3 text-emerald-600" />
              <span>Cloud in tempo reale</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dimensione caratteri */}
            <button
              type="button"
              onClick={cycleFontScale}
              title="Modifica la grandezza del testo"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 px-3 py-1.5 text-xs sm:text-sm font-normal text-slate-700 transition"
            >
              <Type className="h-4 w-4 text-emerald-700" />
              <span>{fontLabel}</span>
            </button>

            {/* Voce guida */}
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title="Attiva o disattiva voce di conferma"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-normal transition ${
                voiceEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4 text-emerald-700" /> : <VolumeX className="h-4 w-4" />}
              <span className="hidden md:inline">{voiceEnabled ? 'Audio attivo' : 'Audio disattivato'}</span>
            </button>

            {/* Installa App su iPhone / Android */}
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs sm:text-sm font-normal shadow-sm transition active:scale-95"
            >
              <Smartphone className="h-4 w-4" />
              <span>Installa sul telefono</span>
            </button>

            {/* Tasto Esci sempre visibile quando si è loggati */}
            {currentUser && (
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 text-xs sm:text-sm font-medium shadow-sm transition active:scale-95"
              >
                <LogOut className="h-4 w-4" />
                <span>Esci</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Finestra Istruzioni per installare l'App la prima volta su iPhone e Android */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-success-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/q3-icon.jpeg"
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
              {/* iPhone */}
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

              {/* Android */}
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
