// Modello dati e tipologie per la sezione "Prenotazione Eventi" del Portale Q3
// Gestisce tipologie dinamiche (Cinema, Gite, Conferenze, ecc.), capienza,
// timer di messa in onda (apertura/chiusura), lista d'attesa e prenotazione 1 o 2 posti.

export interface TipoAttivitaEvento {
  id: string;
  nome: string;
  descrizione?: string;
  colore: string; // Colore hex o classe (es. '#2563eb')
  icona?: string;
  is_default?: boolean;
  created_at?: string;
}

export type StatoManualeEvento = 'pubblicato' | 'bozza' | 'annullato';

export interface Evento {
  id: string;
  titolo: string;
  // Supporto completo di entrambi i formati di proprietà (compatibilità cloud-db e interfaccia)
  tipo_id?: string;
  tipo_attivita_id?: string;
  tipo_nome?: string;
  descrizione?: string;
  luogo?: string;
  data_evento?: string; // YYYY-MM-DD
  ora_evento?: string;  // HH:mm
  data_ora_evento?: string; // ISO string o YYYY-MM-DDTHH:mm
  data_ora_fine?: string;
  posti_totali?: number;
  totale_posti?: number;
  posti_online?: number;
  posti_prenotabili_online?: number;
  max_posti_per_socio?: 1 | 2;
  posti_lista_attesa?: number;
  limite_lista_attesa?: number;
  apertura_prenotazioni: string; // YYYY-MM-DDTHH:mm
  chiusura_prenotazioni: string; // YYYY-MM-DDTHH:mm
  costo?: number; // 0 se gratuito
  costo_biglietto?: number;
  richiede_pagamento_in_sede?: boolean;
  richiede_pagamento_sede?: boolean;
  note?: string;
  note_pagamento?: string;
  locandina_url?: string;
  immagine_url?: string;
  anno_accademico?: string;
  stato_manuale?: StatoManualeEvento;
  is_annullato?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type StatoPrenotazione = 'confermata' | 'lista_attesa' | 'annullata';
export type StatoPagamentoEvento = 'gratuito' | 'da_pagare_in_sede' | 'pagato';

export interface PrenotazioneEvento {
  id: string;
  evento_id: string;
  socio_id: string;
  socio_tessera: string;
  socio_nominativo: string;
  socio_email?: string;
  socio_telefono?: string;
  num_posti: 1 | 2;
  ospite_tessera?: string;
  ospite_nominativo?: string;
  stato: StatoPrenotazione;
  posizione_attesa?: number; // 1, 2, 3...
  stato_pagamento: StatoPagamentoEvento;
  quota_totale?: number;
  booking_code?: string;
  data_prenotazione?: string;
  conferma_email_inviata?: boolean;
  note_staff?: string;
  created_at?: string;
  updated_at?: string;
}

// ----------------------------------------------------------------------------
// Getter helper infallibili per campi con alias
// ----------------------------------------------------------------------------
export function getEventoDate(evento: Partial<Evento>): Date {
  if (evento.data_ora_evento) {
    const d = new Date(evento.data_ora_evento);
    if (!isNaN(d.getTime())) return d;
  }
  if (evento.data_evento) {
    const timeStr = evento.ora_evento ? `T${evento.ora_evento}:00` : 'T18:00:00';
    const d = new Date(`${evento.data_evento}${timeStr}`);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function getEventoTipoId(evento: Partial<Evento>): string {
  return evento.tipo_attivita_id || evento.tipo_id || 'tipo-cinema';
}

export function getEventoPostiOnline(evento: Partial<Evento>): number {
  return Number(evento.posti_prenotabili_online ?? evento.posti_online ?? 50);
}

export function getEventoPostiTotali(evento: Partial<Evento>): number {
  return Number(evento.totale_posti ?? evento.posti_totali ?? 60);
}

export function getEventoPostiAttesa(evento: Partial<Evento>): number {
  return Number(evento.limite_lista_attesa ?? evento.posti_lista_attesa ?? 15);
}

export function getEventoCosto(evento: Partial<Evento>): number {
  return Number(evento.costo_biglietto ?? evento.costo ?? 0);
}

export function getEventoRichiedePagamento(evento: Partial<Evento>): boolean {
  return Boolean(evento.richiede_pagamento_sede ?? evento.richiede_pagamento_in_sede);
}

// ----------------------------------------------------------------------------
// Tipologie iniziali richieste dall'utente (con possibilità di aggiungerne altre)
// ----------------------------------------------------------------------------
export const INITIAL_TIPI_ATTIVITA: TipoAttivitaEvento[] = [
  {
    id: 'tipo-cinema',
    nome: 'Cinema',
    descrizione: "Proiezioni cinematografiche, cineforum e dibattiti d'autore",
    colore: '#2563eb',
    icona: 'Film',
    is_default: true,
    created_at: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'tipo-gite',
    nome: 'Gite naturalistiche',
    descrizione: 'Escursioni guidate, parchi naturali e percorsi archeologici',
    colore: '#059669',
    icona: 'Compass',
    is_default: true,
    created_at: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'tipo-conferenze',
    nome: 'Conferenze',
    descrizione: 'Incontri culturali, lectio magistralis e tavole rotonde',
    colore: '#7c3aed',
    icona: 'Mic',
    is_default: true,
    created_at: '2026-11-01T10:00:00.000Z',
  },
];

// ----------------------------------------------------------------------------
// Eventi dimostrativi iniziali pronti all'uso
// ----------------------------------------------------------------------------
export const INITIAL_EVENTI: Evento[] = [
  {
    id: 'evt-cinema-01',
    titolo: 'Proiezione Cinema: "La Grazia" e dibattito con il critico',
    tipo_id: 'tipo-cinema',
    tipo_attivita_id: 'tipo-cinema',
    tipo_nome: 'Cinema',
    descrizione: 'Serata di cineforum dedicata al cinema sardo contemporaneo con introduzione del docente e dibattito finale.',
    luogo: "Sala Magna — Sede Quartu Sant'Elena",
    data_evento: '2026-11-28',
    ora_evento: '17:30',
    data_ora_evento: '2026-11-28T17:30',
    posti_totali: 90,
    totale_posti: 90,
    posti_online: 70,
    posti_prenotabili_online: 70,
    max_posti_per_socio: 2,
    posti_lista_attesa: 15,
    limite_lista_attesa: 15,
    apertura_prenotazioni: '2026-11-10T08:00',
    chiusura_prenotazioni: '2026-11-27T20:00',
    costo: 0,
    costo_biglietto: 0,
    richiede_pagamento_in_sede: false,
    richiede_pagamento_sede: false,
    anno_accademico: '2026/2027',
    stato_manuale: 'pubblicato',
    created_at: '2026-11-10T08:00:00.000Z',
    updated_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'evt-gita-01',
    titolo: 'Gita Naturalistica: Sentiero dei Sette Fratelli e Foresta Demaniale',
    tipo_id: 'tipo-gite',
    tipo_attivita_id: 'tipo-gite',
    tipo_nome: 'Gite naturalistiche',
    descrizione: 'Escursione a piedi di livello turistico (T) con guida botanica e pranzo al sacco tra i lecci secolari del Parco dei Sette Fratelli.',
    luogo: 'Partenza in pullman da Piazza Dessì (Quartu)',
    data_evento: '2026-12-05',
    ora_evento: '08:30',
    data_ora_evento: '2026-12-05T08:30',
    posti_totali: 54,
    totale_posti: 54,
    posti_online: 50,
    posti_prenotabili_online: 50,
    max_posti_per_socio: 2,
    posti_lista_attesa: 10,
    limite_lista_attesa: 10,
    apertura_prenotazioni: '2026-11-12T09:00',
    chiusura_prenotazioni: '2026-12-02T19:00',
    costo: 18.00,
    costo_biglietto: 18.00,
    richiede_pagamento_in_sede: true,
    richiede_pagamento_sede: true,
    note_pagamento: 'Quota pullman e guida da versare in segreteria entro mercoledì 2 dicembre ore 18:00.',
    anno_accademico: '2026/2027',
    stato_manuale: 'pubblicato',
    created_at: '2026-11-12T09:00:00.000Z',
    updated_at: '2026-11-12T09:00:00.000Z',
  },
  {
    id: 'evt-conf-01',
    titolo: 'Conferenza Magistrale: Storia e Tradizioni della Sardegna',
    tipo_id: 'tipo-conferenze',
    tipo_attivita_id: 'tipo-conferenze',
    tipo_nome: 'Conferenze',
    descrizione: "Lectio magistralis aperta sui tesori archeologici e l'identità culturale della nostra isola.",
    luogo: 'Auditorium Sede Centrale — Quartu',
    data_evento: '2026-12-12',
    ora_evento: '16:45',
    data_ora_evento: '2026-12-12T16:45',
    posti_totali: 110,
    totale_posti: 110,
    posti_online: 100,
    posti_prenotabili_online: 100,
    max_posti_per_socio: 1,
    posti_lista_attesa: 20,
    limite_lista_attesa: 20,
    apertura_prenotazioni: '2026-11-20T08:00',
    chiusura_prenotazioni: '2026-12-11T20:00',
    costo: 0,
    costo_biglietto: 0,
    richiede_pagamento_in_sede: false,
    richiede_pagamento_sede: false,
    anno_accademico: '2026/2027',
    stato_manuale: 'pubblicato',
    created_at: '2026-11-13T10:00:00.000Z',
    updated_at: '2026-11-13T10:00:00.000Z',
  },
];

export const INITIAL_PRENOTAZIONI: PrenotazioneEvento[] = [
  {
    id: 'pren-demo-01',
    evento_id: 'evt-cinema-01',
    socio_id: 'u-17',
    socio_tessera: '7726',
    socio_nominativo: 'Giampiero Lia',
    socio_email: 'giampiero.lia@gmail.com',
    num_posti: 2,
    ospite_tessera: '7727',
    ospite_nominativo: 'Lucia Demurtas',
    stato: 'confermata',
    stato_pagamento: 'gratuito',
    booking_code: 'Q3-CINE-7726',
    data_prenotazione: '2026-11-11T10:15:00.000Z',
    conferma_email_inviata: true,
    created_at: '2026-11-11T10:15:00.000Z',
    updated_at: '2026-11-11T10:15:00.000Z',
  },
  {
    id: 'pren-demo-02',
    evento_id: 'evt-gita-01',
    socio_id: 'u-17',
    socio_tessera: '7726',
    socio_nominativo: 'Giampiero Lia',
    socio_email: 'giampiero.lia@gmail.com',
    num_posti: 2,
    ospite_tessera: '7727',
    ospite_nominativo: 'Lucia Demurtas',
    stato: 'confermata',
    stato_pagamento: 'da_pagare_in_sede',
    booking_code: 'Q3-GITA-7726',
    quota_totale: 36.00,
    data_prenotazione: '2026-11-13T14:30:00.000Z',
    conferma_email_inviata: true,
    created_at: '2026-11-13T14:30:00.000Z',
    updated_at: '2026-11-13T14:30:00.000Z',
  },
];

// ----------------------------------------------------------------------------
// Funzioni di calcolo capienza e stato - TOTALMENTE PROTETTE CONTRO NULL/UNDEFINED
// ----------------------------------------------------------------------------
export function calcolaPostiOccupatiConfermati(
  eventoId: string,
  prenotazioni: PrenotazioneEvento[] = []
): number {
  if (!Array.isArray(prenotazioni)) return 0;
  return prenotazioni
    .filter((p) => p && p.evento_id === eventoId && p.stato === 'confermata')
    .reduce((sum, p) => sum + (Number(p.num_posti) || 1), 0);
}

export function calcolaPostiInAttesa(
  eventoId: string,
  prenotazioni: PrenotazioneEvento[] = []
): number {
  if (!Array.isArray(prenotazioni)) return 0;
  return prenotazioni
    .filter((p) => p && p.evento_id === eventoId && p.stato === 'lista_attesa')
    .reduce((sum, p) => sum + (Number(p.num_posti) || 1), 0);
}

export function calcolaPostiResiduiOnline(
  evento: Evento,
  prenotazioni: PrenotazioneEvento[] = []
): number {
  if (!evento) return 0;
  const safePren = Array.isArray(prenotazioni) ? prenotazioni : [];
  const occupati = calcolaPostiOccupatiConfermati(evento.id, safePren);
  const postiOnline = getEventoPostiOnline(evento);
  return Math.max(0, postiOnline - occupati);
}

export type StatoLiveEvento =
  | 'non_aperto'
  | 'aperto'
  | 'lista_attesa'
  | 'sold_out'
  | 'chiuso'
  | 'annullato';

export function calcolaStatoLiveEvento(
  evento: Evento,
  prenotazioni: PrenotazioneEvento[] = [],
  nowMs: number = Date.now()
): {
  stato: StatoLiveEvento;
  countdown: string;
  postiResidui: number;
  postiOccupati: number;
  postiAttesaOccupati: number;
  postiAttesaDisponibili: number;
  mancanoAllAperturaMs: number;
  mancanoAllaChiusuraMs: number;
} {
  if (!evento) {
    return {
      stato: 'chiuso',
      countdown: '',
      postiResidui: 0,
      postiOccupati: 0,
      postiAttesaOccupati: 0,
      postiAttesaDisponibili: 0,
      mancanoAllAperturaMs: 0,
      mancanoAllaChiusuraMs: 0,
    };
  }

  const safePren = Array.isArray(prenotazioni) ? prenotazioni : [];

  let aperturaMs = nowMs - 1000;
  if (evento.apertura_prenotazioni) {
    const d = new Date(evento.apertura_prenotazioni).getTime();
    if (!isNaN(d)) aperturaMs = d;
  }

  let chiusuraMs = nowMs + 86400000;
  if (evento.chiusura_prenotazioni) {
    const d = new Date(evento.chiusura_prenotazioni).getTime();
    if (!isNaN(d)) chiusuraMs = d;
  }

  const postiOccupati = calcolaPostiOccupatiConfermati(evento.id, safePren);
  const postiOnline = getEventoPostiOnline(evento);
  const postiResidui = Math.max(0, postiOnline - postiOccupati);

  const postiAttesaOccupati = calcolaPostiInAttesa(evento.id, safePren);
  const maxAttesa = getEventoPostiAttesa(evento);
  const postiAttesaDisponibili = Math.max(0, maxAttesa - postiAttesaOccupati);

  const mancanoAllAperturaMs = aperturaMs - nowMs;
  const mancanoAllaChiusuraMs = chiusuraMs - nowMs;

  let countdown = '';
  if (mancanoAllAperturaMs > 0) {
    const totalSec = Math.floor(mancanoAllAperturaMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (days > 0) {
      countdown = `${days}g ${hours}h ${mins}m ${secs}s`;
    } else {
      countdown = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }

  let stato: StatoLiveEvento;

  if (evento.is_annullato || evento.stato_manuale === 'annullato') {
    stato = 'annullato';
  } else if (mancanoAllAperturaMs > 0) {
    stato = 'non_aperto';
  } else if (mancanoAllaChiusuraMs <= 0) {
    stato = 'chiuso';
  } else if (postiResidui > 0) {
    stato = 'aperto';
  } else if (postiAttesaDisponibili > 0) {
    stato = 'lista_attesa';
  } else {
    stato = 'sold_out';
  }

  return {
    stato,
    countdown,
    postiResidui,
    postiOccupati,
    postiAttesaOccupati,
    postiAttesaDisponibili,
    mancanoAllAperturaMs,
    mancanoAllaChiusuraMs,
  };
}
