import React, { useState } from 'react';
import { LogIn, Delete, Lock, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LoginView: React.FC = () => {
  const { signInMember, signInAdmin } = useApp();
  const [cardNumber, setCardNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modal riservato esclusivamente al personale dell'Ufficio Presenze / Didattica
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [staffError, setStaffError] = useState<string | null>(null);

  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = signInMember(cardNumber);
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
    setCardNumber((prev) => (prev.length < 8 ? prev + digit : prev));
  };

  const backspace = () => {
    setError(null);
    setCardNumber((prev) => prev.slice(0, -1));
  };

  return (
    <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-between bg-slate-50 px-4 py-8 text-slate-800">
      <div className="w-full max-w-md my-auto">
        {/* Scheda Pulita Accesso Socio su Sfondo Bianco */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src="/q3-icon-512.png?v=8"
              alt="Logo Q3"
              className="w-24 h-24 rounded-2xl object-cover shadow-sm border border-slate-200"
            />
          </div>

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
              Inserisci le cifre riportate sul tuo tesserino socio per vedere i corsi e timbrare la presenza
            </p>
          </div>

          <form onSubmit={handleMemberSubmit} className="space-y-4">
            <div className="relative">
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
            </div>

            {/* Tastierino Numerico Sobrio e Lineare per Soci */}
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
                onClick={() => {
                  setError(null);
                  setCardNumber('');
                }}
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
              disabled={!cardNumber.trim()}
              className="w-full min-h-[68px] sm:min-h-[74px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xl sm:text-2xl font-normal tracking-normal shadow-sm flex items-center justify-center gap-3 active:scale-[0.99] transition"
            >
              <LogIn className="h-6 w-6 stroke-[1.75]" />
              <span>Entra nell'App</span>
            </button>
          </form>
        </div>
      </div>

      {/* Link discreto a piè di pagina riservato al personale dell'Ufficio Presenze / Didattica */}
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

      {/* Finestra Protetta da Codice per il Personale dell'Ufficio Presenze */}
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
