import React, { useState } from 'react';
import {
  LogIn,
  Delete,
  Lock,
  X,
  KeyRound,
  ArrowLeft,
  Smartphone,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Profile } from '../data/initialData';

export const LoginView: React.FC = () => {
  const {
    signInMember,
    signInAdmin,
    rememberedMember,
    quickLoginRemembered,
    forgetRememberedMember,
  } = useApp();
  const [cardNumber, setCardNumber] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDifferentCardInput, setShowDifferentCardInput] = useState(false);

  // Modal riservato esclusivamente al personale dell'Ufficio Presenze / Didattica
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [staffError, setStaffError] = useState<string | null>(null);

  const isPasswordStep = pendingProfile !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isPasswordStep && pendingProfile) {
      const cleanPw = userPassword.trim();
      if (!cleanPw) {
        setError('Inserisci la tua password a 4 cifre.');
        return;
      }
      const res = signInMember(pendingProfile.member_number, cleanPw);
      if (res.error) {
        setError(res.error);
      } else {
        setError(null);
        setPendingProfile(null);
        setUserPassword('');
      }
      return;
    }

    const cleanCard = cardNumber.trim();
    if (!cleanCard) {
      setError('Digita il numero della tua tessera per entrare.');
      return;
    }

    const res = signInMember(cleanCard);
    if (res.requiresPassword && res.targetProfile) {
      setError(null);
      setPendingProfile(res.targetProfile);
      setUserPassword('');
      return;
    }

    if (res.error) {
      setError(res.error);
    } else {
      setError(null);
    }
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = signInAdmin(staffPin);
    if (res.error) {
      setStaffError(res.error);
    } else {
      setStaffError(null);
      setShowStaffModal(false);
    }
  };

  const appendDigit = (digit: string) => {
    setError(null);
    if (isPasswordStep) {
      setUserPassword((prev) => (prev.length < 4 ? prev + digit : prev));
    } else {
      setCardNumber((prev) => (prev.length < 10 ? prev + digit : prev));
    }
  };

  const backspace = () => {
    setError(null);
    if (isPasswordStep) {
      setUserPassword((prev) => prev.slice(0, -1));
    } else {
      setCardNumber((prev) => prev.slice(0, -1));
    }
  };

  const clearInput = () => {
    setError(null);
    if (isPasswordStep) {
      setUserPassword('');
    } else {
      setCardNumber('');
    }
  };

  const cancelPasswordStep = () => {
    setError(null);
    setPendingProfile(null);
    setUserPassword('');
  };

  return (
    <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-between bg-slate-50 px-4 py-8 text-slate-800">
      <div className="w-full max-w-md my-auto">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src="/q3-icon-512.png?v=9"
              alt="Logo Q3"
              className="w-24 h-24 rounded-2xl object-cover shadow-sm border border-slate-200"
            />
          </div>

          {/* SCHEDA ACCESSO RAPIDO: SOCIO MEMORIZZATO SU QUESTO TELEFONO */}
          {rememberedMember && !isPasswordStep && (
            <div className="mb-6 rounded-3xl border-2 border-emerald-400 bg-emerald-50/90 p-5 sm:p-6 text-center shadow-md animate-in fade-in duration-200">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                <Smartphone className="h-7 w-7" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                Socio memorizzato su questo telefono
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-0.5">
                {rememberedMember.fullName}
              </h2>
              <p className="text-sm font-medium text-emerald-900 mb-4">
                Tessera N° <span className="font-mono font-bold text-base">{rememberedMember.memberNumber}</span>
              </p>

              {error && (
                <div className="mb-3 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-sm font-normal text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  const res = quickLoginRemembered();
                  if (!res.ok && res.error) {
                    setError(res.error);
                  }
                }}
                className="w-full min-h-[64px] sm:min-h-[70px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xl sm:text-2xl font-bold shadow-md flex items-center justify-center gap-3 active:scale-[0.99] transition mb-3"
              >
                <Zap className="h-6 w-6 text-amber-300 fill-amber-300" />
                <span>Entra subito</span>
              </button>
              <p className="text-xs text-slate-500 mb-3">
                Accesso immediato con 1 tocco, senza dover ridigitare tessera e password.
              </p>

              <div className="flex items-center justify-between text-xs pt-3 border-t border-emerald-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setShowDifferentCardInput((prev) => !prev);
                  }}
                  className="text-emerald-900 font-semibold underline hover:text-emerald-950"
                >
                  {showDifferentCardInput ? '▲ Nascondi tastierino' : '▼ Accedi con un\'altra tessera'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    forgetRememberedMember();
                  }}
                  className="text-slate-500 hover:text-rose-600 hover:underline"
                  title="Rimuovi la memorizzazione automatica da questo smartphone"
                >
                  Dimentica
                </button>
              </div>
            </div>
          )}

          {/* TASTIERINO E FORM DI LOGIN: Mostrato se non c'è socio memorizzato, oppure se si è espanso il cambio tessera, o durante il passo PIN */}
          {(!rememberedMember || showDifferentCardInput || isPasswordStep) && (
            <>
              {!isPasswordStep ? (
                <>
                  <h1 className="text-2xl sm:text-3xl font-medium text-slate-900 tracking-normal">
                    Q3 — Portale Soci
                  </h1>
                  <p className="mt-1 text-base font-normal text-emerald-700">
                    Università della Terza Età · Quartu Sant'Elena
                  </p>

                  <div className="mt-6 mb-3">
                    <label
                      htmlFor="member-card-input"
                      className="block text-xl sm:text-2xl font-normal text-slate-800"
                    >
                      Digita il numero della tua tessera
                    </label>
                    <p className="mt-1 text-sm font-normal text-slate-500">
                      Inserisci le cifre riportate sul tuo tesserino socio
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Profilo con password personalizzata riconosciuto */}
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 mb-3 text-left flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-slate-900">
                        {pendingProfile.full_name}
                      </p>
                      <p className="text-xs text-slate-600">
                        Tessera N° <strong className="text-slate-800 font-semibold">{pendingProfile.member_number}</strong>
                      </p>
                    </div>
                    <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      PIN Attivo
                    </span>
                  </div>

                  <div className="mt-2 mb-3">
                    <label
                      htmlFor="member-password-input"
                      className="block text-xl sm:text-2xl font-normal text-slate-800 flex items-center justify-center gap-2"
                    >
                      <KeyRound className="h-6 w-6 text-emerald-700" />
                      <span>Digita la tua Password</span>
                    </label>
                    <p className="mt-1 text-sm font-normal text-slate-500">
                      Inserisci il tuo PIN personale a 4 cifre
                    </p>
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  {!isPasswordStep ? (
                    <input
                      id="member-card-input"
                      type="text"
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(e) => {
                        setError(null);
                        setCardNumber(e.target.value.replace(/[^\d]/g, ''));
                      }}
                      placeholder="Numero della tua tessera"
                      aria-label="Digita il numero della tua tessera"
                      className="w-full h-16 sm:h-20 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-center text-2xl sm:text-3xl font-normal tabular-nums tracking-wide text-slate-900 placeholder:text-slate-400 placeholder:text-lg sm:placeholder:text-xl focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition"
                    />
                  ) : (
                    <input
                      id="member-password-input"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={userPassword}
                      onChange={(e) => {
                        setError(null);
                        setUserPassword(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
                      }}
                      placeholder="PIN a 4 cifre (••••)"
                      aria-label="Digita il tuo PIN a 4 cifre"
                      autoFocus
                      className="w-full h-16 sm:h-20 rounded-2xl border border-emerald-400 bg-emerald-50/40 px-4 text-center text-3xl font-bold tracking-[0.5em] text-slate-900 placeholder:text-slate-400 placeholder:text-lg sm:placeholder:text-xl placeholder:tracking-normal focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition"
                    />
                  )}
                </div>

                {/* Tastierino Numerico Univoco per Tutti */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => appendDigit(num)}
                      className="h-14 sm:h-16 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-2xl sm:text-3xl font-normal tabular-nums text-slate-800 shadow-sm active:scale-95 transition"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearInput}
                    className="h-14 sm:h-16 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm sm:text-base font-normal text-slate-600 active:scale-95 transition"
                  >
                    Pulisci
                  </button>
                  <button
                    type="button"
                    onClick={() => appendDigit('0')}
                    className="h-14 sm:h-16 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-2xl sm:text-3xl font-normal tabular-nums text-slate-800 shadow-sm active:scale-95 transition"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={backspace}
                    aria-label="Cancella ultima cifra"
                    className="h-14 sm:h-16 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition"
                  >
                    <Delete className="h-6 w-6 stroke-[1.75]" />
                  </button>
                </div>

                {error && (
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-base font-normal text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isPasswordStep ? !cardNumber.trim() : !userPassword.trim()}
                  className="w-full min-h-[68px] sm:min-h-[74px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xl sm:text-2xl font-normal tracking-normal shadow-sm flex items-center justify-center gap-3 active:scale-[0.99] transition"
                >
                  <LogIn className="h-6 w-6 stroke-[1.75]" />
                  <span>{isPasswordStep ? 'Conferma Password ed Entra' : "Entra nell'App"}</span>
                </button>

                {isPasswordStep && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={cancelPasswordStep}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 underline transition"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Torna indietro / Cambia tessera</span>
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>

      {/* Footer minimale */}
      <footer className="mt-8 text-center">
        <button
          type="button"
          onClick={() => {
            setStaffPin('');
            setStaffError(null);
            setShowStaffModal(true);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-normal text-slate-400 hover:text-slate-600 transition"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Area riservata Ufficio Presenze e Settore Didattica</span>
        </button>
      </footer>

      {/* Modal ufficio presenze */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-success-in">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-700" />
                <h2 className="text-lg font-medium text-slate-900">
                  Accesso Ufficio Presenze
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm font-normal text-slate-600 mb-4">
              Inserisci il codice riservato al personale della segreteria e del settore didattica.
            </p>

            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <input
                type="password"
                value={staffPin}
                onChange={(e) => {
                  setStaffError(null);
                  setStaffPin(e.target.value);
                }}
                placeholder="Codice riservato ufficio"
                autoFocus
                className="w-full h-12 rounded-xl border border-slate-300 bg-slate-50 px-4 text-center text-lg font-normal text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
              />

              {staffError && (
                <p className="text-sm font-normal text-rose-600 text-center">
                  {staffError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 text-sm font-normal text-slate-700 hover:bg-slate-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-normal text-white shadow-sm"
                >
                  Accedi come Ufficio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
