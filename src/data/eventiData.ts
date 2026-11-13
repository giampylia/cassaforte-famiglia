// Modello dati e tipologie per la sezione "Prenotazione Eventi" del Portale Q3
// Gestisce tipologie dinamiche (Cinema, Gite, Conferenze, ecc.), capienza,
// timer di messa in onda (apertura/chiusura), lista d'attesa e prenotazione 1 o 2 posti.

export interface TipoAttivitaEvento {
  id: string;
  nome: string;
  descrizione?: string;
  colore: string; // 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan'
  icona: string;  // 'Film' | 'Compass' | 'Mic' | 'Theater' | 'Music' | 'BookOpen'
  created_at?: string;
}

export type StatoManualeEvento = 'pubblicato' | 'bozza' | 'annullato';

export interface Evento {
  id: string;
  titolo: string;
  tipo_id: string;
  tipo_nome: string;
  descrizione?: string;
  luogo?: string;
  data_evento: string; // YYYY-MM-DD
  ora_evento: string;  // HH:mm
  posti_totali: number;
  posti_online: number;
  max_posti_per_socio: 1 | 2;
  posti_lista_attesa: number;
  apertura_prenotazioni: string; // YYYY-MM-DDTHH:mm
  chiusura_prenotazioni: string; // YYYY-MM-DDTHH:mm
  costo: number; // 0 se gratuito
  richiede_pagamento_in_sede: boolean;
  note_pagamento?: string;
  locandina_url?: string;
  stato_manuale: StatoManualeEvento;
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
  data_prenotazione: string; // ISO string
  conferma_email_inviata?: boolean;
  note_staff?: string;
  created_at?: string;
  updated_at?: string;
}

// ----------------------------------------------------------------------------
// Tipologie iniziali richieste dall'utente (con possibilità di aggiungerne altre)
// ----------------------------------------------------------------------------
export const INITIAL_TIPI_ATTIVITA: TipoAttivitaEvento[] = [
  {
    id: 'tipo-cinema',
    nome: 'Cinema',
    descrizione: 'Proiezioni cinematografiche, cineforum e dibattiti d\'autore',
    colore: 'indigo',
    icona: 'Film',
    created_at: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'tipo-gite',
    nome: 'Gite naturalistiche',
    descrizione: 'Escursioni guidate, parchi naturali e percorsi archeologici',
    colore: 'emerald',
    icona: 'Compass',
    created_at: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'tipo-conferenze',
    nome: 'Conferenze',
    descrizione: 'Incontri culturali, lectio magistralis e tavole rotonde',
    colore: 'amber',
    icona: 'Mic',
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
    tipo_nome: 'Cinema',
    descrizione: 'Serata di cineforum dedicata al cinema sardo contemporaneo con introduzione del docente e dibattito finale.',
    luogo: 'Sala Magna — Sede Quartu Sant\'Elena',
    data_evento: '2026-11-28',
    ora_evento: '17:30',
    posti_totali: 90,
    posti_online: 70,
    max_posti_per_socio: 2,
    posti_lista_attesa: 15,
    apertura_prenotazioni: '2026-11-10T08:00',
    chiusura_prenotazioni: '2026-11-27T20:00',
    costo: 0,
    richiede_pagamento_in_sede: false,
    stato_manuale: 'pubblicato',
    created_at: '2026-11-10T08:00:00.000Z',
    updated_at: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'evt-gita-01',
    titolo: 'Gita Naturalistica: Sentiero dei Sette Fratelli e Foresta Demaniale',
    tipo_id: 'tipo-gite',
    tipo_nome: 'Gite naturalistiche',
    descrizione: 'Escursione a piedi di livello turistico (T) con guida botanica e pranzo al sacco tra i lecci secolari del Parco dei Sette Fratelli.',
    luogo: 'Partenza in pullman da Piazza Dessì (Quartu)',
    data_evento: '2026-12-05',
    ora_evento: '08:30',
    posti_totali: 54,
    posti_online: 50,
    max_posti_per_socio: 2,
    posti_lista_attesa: 10,
    apertura_prenotazioni: '2026-11-12T09:00',
    chiusura_prenotazioni: '2026-12-02T19:00',
    costo: 18.00,
    richiede_pagamento_in_sede: true,
    note_pagamento: 'Quota pullman e guida da versare in segreteria entro mercoledì 2 dicembre ore 18:00.',
    stato_manuale: 'pubblicato',
    created_at: '2026-11-12T09:00:00.000Z',
    updated_at: '2026-11-12T09:00:00.000Z',
  },
  {
    id: 'evt-conf-01',
    titolo: 'Conferenza Magistrale: Storia e Tradizioni della Sardegna',
    tipo_id: 'tipo-conferenze',
    tipo_nome: 'Conferenze',
    descrizione: 'Lectio magistralis aperta sui tesori archeologici e l\'identità culturale della nostra isola.',
    luogo: 'Auditorium Sede Centrale — Quartu',
    data_evento: '2026-12-12',
    ora_evento: '16:45',
    posti_totali: 110,
    posti_online: 100,
    max_posti_per_socio: 1,
    posti_lista_attesa: 20,
    apertura_prenotazioni: '2026-11-20T08:00', // Timer di messa in onda futuro per testare il countdown!
    chiusura_prenotazioni: '2026-12-11T20:00',
    costo: 0,
    richiede_pagamento_in_sede: false,
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
    data_prenotazione: '2026-11-11T10:15:00.000Z',
    conferma_email_inviata: true,
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
    data_prenotazione: '2026-11-13T14:30:00.000Z',
    conferma_email_inviata: true,
  },
];

// ----------------------------------------------------------------------------
// Funzioni di calcolo capienza e stato
// ----------------------------------------------------------------------------
export function calcolaPostiOccupatiConfermati(
  eventoId: string,
  prenotazioni: PrenotazioneEvento[]
): number {
  return prenotazioni
    .filter((p) => p.evento_id === eventoId && p.stato === 'confermata')
    .reduce((sum, p) => sum + (Number(p.num_posti) || 1), 0);
}

export function calcolaPostiInAttesa(
  eventoId: string,
  prenotazioni: PrenotazioneEvento[]
): number {
  return prenotazioni
    .filter((p) => p.evento_id === eventoId && p.stato === 'lista_attesa')
    .reduce((sum, p) => sum + (Number(p.num_posti) || 1), 0);
}

export function calcolaPostiResiduiOnline(
  evento: Evento,
  prenotazioni: PrenotazioneEvento[]
): number {
  const occupati = calcolaPostiOccupatiConfermati(evento.id, prenotazioni);
  return Math.max(0, evento.posti_online - occupati);
}

export type StatoLiveEvento =
  | 'in_arrivo'    // prima dell'apertura (countdown)
  | 'aperto'       // posti online disponibili
  | 'lista_attesa' // posti online finiti, ma lista d'attesa disponibile
  | 'sold_out'     // sia posti online che lista d'attesa esauriti
  | 'chiuso';      // scadenza termini di prenotazione o data superata

export function calcolaStatoLiveEvento(
  evento: Evento,
  prenotazioni: PrenotazioneEvento[],
  nowMs: number = Date.now()
): {
  stato: StatoLiveEvento;
  postiResidui: number;
  postiOccupati: number;
  postiAttesaOccupati: number;
  postiAttesaDisponibili: number;
  mancanoAllAperturaMs: number;
  mancanoAllaChiusuraMs: number;
} {
  const aperturaMs = new Date(evento.apertura_prenotazioni).getTime();
  const chiusuraMs = new Date(evento.chiusura_prenotazioni).getTime();

  const occupati = calcolaPostiOccupatiConfermati(evento.id, prenotazioni);
  const postiResidui = Math.max(0, evento.posti_online - occupati);

  const attesaOccupati = calcolaPostiInAttesa(evento.id, prenotazioni);
  const attesaDisponibili = Math.max(0, evento.posti_lista_attesa - attesaOccupati);

  const mancanoAllAperturaMs = aperturaMs - nowMs;
  const mancanoAllaChiusuraMs = chiusuraMs - nowMs;

  let stato: StatoLiveEvento;

  if (mancanoAllaChiusuraMs <= 0) {
    stato = 'chiuso';
  } else if (mancanoAllAperturaMs > 0) {
    stato = 'in_arrivo';
  } else if (postiResidui > 0) {
    stato = 'aperto';
  } else if (attesaDisponibili > 0) {
    stato = 'lista_attesa';
  } else {
    stato = 'sold_out';
  }

  return {
    stato,
    postiResidui,
    postiOccupati,
    postiAttesaOccupati,
    postiAttesaDisponibili,
    mancanoAllAperturaMs,
    mancanoAllaChiusuraMs,
  };
}
