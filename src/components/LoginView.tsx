import React, { useState, useMemo } from 'react';
import {
  LogIn,
  Delete,
  Lock,
  X,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  Users,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Profile, isCdMemberProfile, getMemberParts, isValidCdPassword } from '../data/initialData';

export const LoginView: React.FC = () => {
  const { signInMember, signInAdmin, profiles } = useApp();
  const [cardNumber, setCardNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modal per password CD quando viene inserita una tessera di un componente CD
  const [showCdPasswordModal, setShowCdPasswordModal] = useState(false);
  const [pendingCdProfile, setPendingCdProfile] = useState<Profile | null>(null);
  const [cdPassword, setCdPassword] = useState('');
  const [cdPasswordError, setCdPasswordError] = useState<string | null>(null);
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Modal selezione profilo CD (quando si digita direttamente "Qu3" o si clicca "Accesso CD")
  const [showCdSelectorModal, setShowCdSelectorModal] = useState(false);
  const [cdDirectPasswordInput, setCdDirectPasswordInput] = useState('');
  const [cdDirectPasswordValidated, setCdDirectPasswordValidated] = useState(false);
  const [cdDirectError, setCdDirectError] = useState<string | null>(null);

  // Modal riservato esclusivamente al personale dell'Ufficio Presenze / Didattica
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [staffError, setStaffError] = useState<string | null>(null);

  // Elenco componenti del Consiglio Direttivo
  const cdMembersList = useMemo(() => {
    const list = (profiles || []).filter((p) => isCdMemberProfile(p));
    return list.sort((a, b) => {
      if (a.member_number === '2406') return -1;
      if (b.member_number === '2406') return 1;
      if (a.member_number === '0000') return -1;
      if (b.member_number === '0000') return 1;
      if (a.member_number === '7726') return -1;
      if (b.member_number === '7726') return 1;
      return a.full_name.localeCompare(b.full_name, 'it');
    });
  }, [profiles]);

  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cardNumber.trim();
    if (!clean) return;

    // Se digita direttamente la password CD "Qu3"
    if (isValidCdPassword(clean)) {
      setError(null);
      setCdDirectPasswordValidated(true);
      setShowCdSelectorModal(true);
      return;
    }

    const res = signInMember(clean);
    if (res.isCdDirectAccess) {
      setError(null);
      setCdDirectPasswordValidated(true);
      setShowCdSelectorModal(true);
      return;
    }

    if (res.requiresPassword && res.targetProfile) {
      setError(null);
      setPendingCdProfile(res.targetProfile);
      setCdPassword('');
      setCdPasswordError(null);
      setShowCdPasswordModal(true);
      return;
    }

    if (res.error) {
      setError(res.error);
    } else {
      setError(null);
    }
  };

  const handleCdPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCdProfile) return;
    const res = signInMember(pendingCdProfile.member_number, cdPassword);
    if (res.error) {
      setCdPasswordError(res.error);
    } else {
      setCdPasswordError(null);
      setShowCdPasswordModal(false);
      setPendingCdProfile(null);
    }
  };

  const handleSelectCdMemberDirect = (p: Profile) => {
    const res = signInMember(p.member_number, 'Qu3');
    if (res.error) {
      setCdDirectError(res.error);
    } else {
      setShowCdSelectorModal(false);
    }
  };

  const handleValidateDirectPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidCdPassword(cdDirectPasswordInput)) {
      setCdDirectPasswordValidated(true);
      setCdDirectError(null);
    } else {
      setCdDirectError('Password errata. La password per i componenti CD è Qu3.');
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
    setCardNumber((prev) => (prev.length < 10 ? prev + digit : prev));
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
              src="/q3-icon-512.png?v=9"
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
              Inserisci la tua tessera socio (per i componenti CD la password è <strong className="text-slate-700 font-semibold">Qu3</strong>)
            </p>
          </div>

          <form onSubmit={handleMemberSubmit} className="space-y-4">
            <div className="relative">
              <input
                id="member-card-input"
                type="text"
                value={cardNumber}
                onChange={(e) => {
                  setError(null);
                  setCardNumber(e.target.value);
                }}
                placeholder="Numero tessera (oppure Qu3)"
                aria-label="Digita il numero della tua tessera"
                className="w-full h-16 sm:h-20 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-center text-2xl sm:text-3xl font-normal tracking-wide text-slate-900 placeholder:text-slate-400 placeholder:text-lg sm:placeholder:text-xl focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition"
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

      {/* Link a piè di pagina: Accesso Rapido CD con Qu3 & Area Ufficio */}
      <footer className="mt-8 text-center space-y-2">
        <div>
          <button
            type="button"
            onClick={() => {
              setCdDirectPasswordInput('');
              setCdDirectPasswordValidated(false);
              setCdDirectError(null);
              setShowCdSelectorModal(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200/90 border border-emerald-300 px-3.5 py-1.5 rounded-full transition shadow-xs"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span>Accesso Consiglio Direttivo (Password: Qu3)</span>
          </button>
        </div>

        <div>
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
        </div>
      </footer>

      {/* MODAL 1: RICHIESTA PASSWORD CD ("Qu3") PER COMPONENTE CD */}
      {showCdPasswordModal && pendingCdProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-success-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Accesso Consiglio Direttivo
                  </h2>
                  <p className="text-xs text-slate-500">
                    Password riservata richiesta
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCdPasswordModal(false);
                  setPendingCdProfile(null);
                }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scheda Nominativo Rilevato */}
            <div className="mb-4 rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {pendingCdProfile.full_name}
                </p>
                <p className="text-xs text-slate-600">
                  Tessera N° {pendingCdProfile.member_number} · Ruolo: {getMemberParts(pendingCdProfile).primaryRole}
                </p>
              </div>
              <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                CD = Sì
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
              Per tutti i componenti con <strong>CD = Sì</strong> la password di accesso è <strong className="text-emerald-800 font-bold">Qu3</strong> (non più il numero del badge).
            </p>

            <form onSubmit={handleCdPasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={cdPassword}
                  onChange={(e) => {
                    setCdPasswordError(null);
                    setCdPassword(e.target.value);
                  }}
                  placeholder="Inserisci la password (Qu3)"
                  autoFocus
                  className="w-full h-14 rounded-xl border border-slate-300 bg-slate-50 px-4 pr-11 text-center text-xl font-bold tracking-wider text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title={showPasswordText ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPasswordText ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {cdPasswordError && (
                <p className="text-sm font-medium text-rose-600 text-center">
                  {cdPasswordError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCdPasswordModal(false);
                    setPendingCdProfile(null);
                  }}
                  className="flex-1 h-12 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!cdPassword.trim()}
                  className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-sm font-bold text-white shadow-sm flex items-center justify-center gap-1.5"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Accedi come CD</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SELETTORE RAPIDO COMPONENTI CD CON PASSWORD Qu3 */}
      {showCdSelectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-success-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 text-slate-800 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Consiglio Direttivo
                  </h2>
                  <p className="text-xs text-slate-500">
                    Accesso rapido con password Qu3
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCdSelectorModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!cdDirectPasswordValidated ? (
              <form onSubmit={handleValidateDirectPassword} className="space-y-4 my-auto py-4">
                <p className="text-sm text-slate-600 text-center">
                  Digita la password del Consiglio Direttivo per visualizzare i componenti autorizzati:
                </p>
                <div className="relative max-w-xs mx-auto">
                  <input
                    type="password"
                    value={cdDirectPasswordInput}
                    onChange={(e) => {
                      setCdDirectError(null);
                      setCdDirectPasswordInput(e.target.value);
                    }}
                    placeholder="Password (Qu3)"
                    autoFocus
                    className="w-full h-14 rounded-xl border border-slate-300 bg-slate-50 px-4 text-center text-xl font-bold tracking-wider text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {cdDirectError && (
                  <p className="text-sm font-medium text-rose-600 text-center">
                    {cdDirectError}
                  </p>
                )}

                <div className="flex gap-2 max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={() => setShowCdSelectorModal(false)}
                    className="flex-1 h-12 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={!cdDirectPasswordInput.trim()}
                    className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-sm font-bold text-white shadow-sm"
                  >
                    Verifica Qu3
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-900">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                    Password Qu3 verificata! Tocca il tuo nome per entrare:
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                  {cdMembersList.map((m) => {
                    const parts = getMemberParts(m);
                    return (
                      <button
                        key={m.id || m.member_number}
                        type="button"
                        onClick={() => handleSelectCdMemberDirect(m)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-emerald-50/80 active:bg-emerald-100 text-left transition border border-transparent hover:border-emerald-200 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-900 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                            {parts.firstName.charAt(0)}
                            {parts.lastName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-950 truncate">
                              {m.full_name}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-2">
                              <span>Tessera: <strong className="text-slate-700">{m.member_number}</strong></span>
                              <span>·</span>
                              <span className="text-emerald-700 font-semibold">{parts.primaryRole}</span>
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-700 shrink-0 group-hover:translate-x-0.5 transition" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: FINESTRA UFFICIO PRESENZE (STAFF MODAL) */}
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
