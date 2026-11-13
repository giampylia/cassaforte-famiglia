// Dati e tipologie per il modulo Bollette & Consumi Elettrici
// Importati fedelmente dalla banca dati di QUfficio3 con formula di ripartizione Alveas / Qu3

export interface ElectricBill {
  id: string;
  month_date: string; // YYYY-MM-DD
  month_end_date?: string | null;
  consumo_qu3_kw: number;
  kw_f1: number;
  kw_f2: number;
  kw_f3: number;
  consumo_fattura: number;
  // Componenti Tariffarie
  quota_fissa_commercializzazione: number;
  quota_energia_f0: number;
  maggior_prezzo_energia: number;
  corrispettivo_servizio_vendita: number;
  oneri_dispacciamento: number;
  perdite_rete: number;
  capacita_picco: number;
  corrispettivo_capacita: number;
  quota_fissa_rete: number;
  quota_potenza_rete: number;
  quota_energia_rete: number;
  asos_quota_fissa: number;
  arim_quota_fissa: number;
  asos_quota_energia: number;
  arim_quota_energia: number;
  asos_quota_potenza: number;
  arim_quota_potenza: number;
  reattiva_f3_capacitiva: number;
  accise_imposta_erariale: number;
  // Risultati Ripartizione
  importo_alveas: number;
  importo_qu3: number;
  totale_bolletta: number;
  // Allegati
  pdf_completo?: string | null;
  foto_contatore_qu3?: string | null;
  all_1?: string | null;
  all_2?: string | null;
  all_3?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SplitResult {
  importoAlveas: number;
  importoQu3: number;
  totaleBolletta: number;
  imponibileAlveas: number;
  imponibileQu3: number;
  totaleImponibile: number;
  ivaAlveas: number;
  ivaQu3: number;
  totaleIva: number;
  details: {
    label: string;
    totale: number;
    alveas: number;
    qu3: number;
    type: "fissa_50_50" | "energia_kwh" | "alveas_100";
  }[];
}

const roundEuro = (val: number) => Math.round(val * 100) / 100;

function splitByKwh(amount: number, totKwh: number, qu3Kwh: number) {
  if (totKwh <= 0) return { alveas: 0, qu3: 0 };
  const rate = amount / totKwh;
  const qu3Val = roundEuro(rate * qu3Kwh);
  return { alveas: roundEuro(amount - qu3Val), qu3: qu3Val };
}

function split5050(amount: number) {
  const qu3Val = roundEuro(amount * 0.5);
  return { alveas: roundEuro(amount - qu3Val), qu3: qu3Val };
}

function splitAlveas100(amount: number) {
  return { alveas: roundEuro(amount), qu3: 0 };
}

export function calculateElectricBillSplit(bill: Partial<ElectricBill>): SplitResult {
  const kwF1 = Number(bill.kw_f1) || 0;
  const kwF2 = Number(bill.kw_f2) || 0;
  const kwF3 = Number(bill.kw_f3) || 0;
  const totKwh = (Number(bill.consumo_fattura) || 0) || (kwF1 + kwF2 + kwF3);
  const qu3Kwh = Number(bill.consumo_qu3_kw) || 0;

  const lines = [
    { label: "Quota fissa commercializzazione", amount: Number(bill.quota_fissa_commercializzazione) || 0, split: split5050(Number(bill.quota_fissa_commercializzazione) || 0), type: "fissa_50_50" as const },
    { label: "Quota energia F0", amount: Number(bill.quota_energia_f0) || 0, split: splitByKwh(Number(bill.quota_energia_f0) || 0, totKwh, qu3Kwh), type: "energia_kwh" as const },
    { label: "Maggior prezzo energia", amount: Number(bill.maggior_prezzo_energia) || 0, split: splitByKwh(Number(bill.maggior_prezzo_energia) || 0, totKwh, qu3Kwh), type: "energia_kwh" as const },
    { label: "Corrispettivo servizio vendita", amount: Number(bill.corrispettivo_servizio_vendita) || 0, split: splitByKwh(Number(bill.corrispettivo_servizio_vendita) || 0, totKwh, qu3Kwh), type: "energia_kwh" as const },
    { label: "Oneri dispacciamento", amount: Number(bill.oneri_dispacciamento) || 0, split: splitByKwh(Number(bill.oneri_dispacciamento) || 0, totKwh, qu3Kwh), type: "energia_kwh" as const },
    { label: "Perdite di rete", amount: Number(bill.perdite_rete) || 0, split: split5050(Number(bill.perdite_rete) || 0), type: "fissa_50_50" as const },
    { label: "Capacità di picco", amount: Number(bill.capacita_picco) || 0, split: splitAlveas100(Number(bill.capacita_picco) || 0), type: "alveas_100" as const },
    { label: "Corrispettivo capacità", amount: Number(bill.corrispettivo_capacita) || 0, split: splitAlveas100(Number(bill.corrispettivo_capacita) || 0), type: "alveas_100" as const },
    { label: "Quota fissa trasporto rete", amount: Number(bill.quota_fissa_rete) || 0, split: split5050(Number(bill.quota_fissa_rete) || 0), type: "fissa_50_50" as const },
    { label: "Quota potenza trasporto rete", amount: Number(bill.quota_potenza_rete) || 0, split: split5050(Number(bill.quota_potenza_rete) || 0), type: "fissa_50_50" as const },
    { label: "Quota energia trasporto rete", amount: Number(bill.quota_energia_rete) || 0, split: splitByKwh(Number(bill.quota_energia_rete) || 0, totKwh, qu3Kwh), type: "energia_kwh" as const },
    { label: "ASOS quota fissa", amount: Number(bill.asos_quota_fissa) || 0, split: split5050(Number(bill.asos_quota_fissa) || 0), type: "fissa_50_50" as const },
    { label: "ARIM quota fissa", amount: Number(bill.arim_quota_fissa) || 0, split: split5050(Number(bill.arim_quota_fissa) || 0), type: "fissa_50_50" as const },
    { label: "ASOS quota energia", amount: Number(bill.asos_quota_energia) || 0, split: splitByKwh(Number(bill.asos_quota_energia) || 0, totKwh, qu3Kwh), type: "energia_kwh" as const },
    { label: "ARIM quota energia", amount: Number(bill.arim_quota_energia) || 0, split: splitByKwh(Number(bill.arim_quota_energia) || 0, totKwh, qu3Kwh), type: "energia_kwh" as const },
    { label: "ASOS quota potenza", amount: Number(bill.asos_quota_potenza) || 0, split: split5050(Number(bill.asos_quota_potenza) || 0), type: "fissa_50_50" as const },
    { label: "ARIM quota potenza", amount: Number(bill.arim_quota_potenza) || 0, split: split5050(Number(bill.arim_quota_potenza) || 0), type: "fissa_50_50" as const },
    { label: "Energia reattiva F3", amount: Number(bill.reattiva_f3_capacitiva) || 0, split: splitAlveas100(Number(bill.reattiva_f3_capacitiva) || 0), type: "alveas_100" as const },
    { label: "Accise e imposta erariale", amount: Number(bill.accise_imposta_erariale) || 0, split: splitByKwh(Number(bill.accise_imposta_erariale) || 0, totKwh, qu3Kwh), type: "energia_kwh" as const },
  ];

  let impAlveas = 0;
  let impQu3 = 0;
  const details = [];

  for (const line of lines) {
    impAlveas += line.split.alveas;
    impQu3 += line.split.qu3;
    details.push({
      label: line.label,
      totale: roundEuro(line.amount),
      alveas: line.split.alveas,
      qu3: line.split.qu3,
      type: line.type,
    });
  }

  impAlveas = roundEuro(impAlveas);
  impQu3 = roundEuro(impQu3);
  const totImponibile = roundEuro(impAlveas + impQu3);

  const ivaAlveas = roundEuro(impAlveas * 0.22);
  const ivaQu3 = roundEuro(impQu3 * 0.22);
  const totIva = roundEuro(ivaAlveas + ivaQu3);

  const totAlveas = roundEuro(impAlveas + ivaAlveas);
  const totQu3 = roundEuro(impQu3 + ivaQu3);
  const totFattura = roundEuro(totAlveas + totQu3);

  return {
    importoAlveas: totAlveas,
    importoQu3: totQu3,
    totaleBolletta: totFattura,
    imponibileAlveas: impAlveas,
    imponibileQu3: impQu3,
    totaleImponibile: totImponibile,
    ivaAlveas,
    ivaQu3,
    totaleIva: totIva,
    details,
  };
}

export const INITIAL_ELECTRIC_BILLS: ElectricBill[] = [
  {
    "id": "dc341cb1-873f-4f99-b868-aaba86833a8b",
    "month_date": "2025-09-01",
    "consumo_qu3_kw": 99.2,
    "kw_f1": 449,
    "kw_f2": 312,
    "kw_f3": 372,
    "importo_alveas": 0,
    "importo_qu3": 0,
    "totale_bolletta": 0,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-03-10T12:00:10.81065+00:00",
    "updated_at": "2026-03-10T12:00:10.81065+00:00",
    "month_end_date": "2025-09-01",
    "consumo_fattura": 1133,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 125.38,
    "maggior_prezzo_energia": 2.27,
    "corrispettivo_servizio_vendita": 9.97,
    "oneri_dispacciamento": 12.21,
    "all_1": "dc341cb1-873f-4f99-b868-aaba86833a8b/pdf_completo_1773305591429.pdf",
    "all_2": "dc341cb1-873f-4f99-b868-aaba86833a8b/all_2_1773144730906.pdf",
    "all_3": "dc341cb1-873f-4f99-b868-aaba86833a8b/all_3_1773144811769.pdf",
    "perdite_rete": 12.77,
    "corrispettivo_capacita": 4.53,
    "capacita_picco": 0,
    "quota_fissa_rete": 2.43,
    "quota_potenza_rete": 29.96,
    "quota_energia_rete": 16.12,
    "asos_quota_fissa": 1,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 0,
    "arim_quota_energia": 1.68,
    "asos_quota_potenza": 12.28,
    "arim_quota_potenza": 3.12,
    "reattiva_f3_capacitiva": 12.07,
    "accise_imposta_erariale": 14.16,
    "foto_contatore_qu3": "dc341cb1-873f-4f99-b868-aaba86833a8b/foto_contatore_1773513911283.jpeg"
  },
  {
    "id": "c2406313-4bb7-4816-8ca5-4c452fb5c55d",
    "month_date": "2025-10-01",
    "consumo_qu3_kw": 384.8,
    "kw_f1": 452,
    "kw_f2": 350,
    "kw_f3": 466,
    "importo_alveas": 286.14,
    "importo_qu3": 137.64,
    "totale_bolletta": 423.78,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-03-17T15:07:02.238185+00:00",
    "updated_at": "2026-03-17T15:07:02.238185+00:00",
    "month_end_date": "2025-10-01",
    "consumo_fattura": 1268,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 146.52,
    "maggior_prezzo_energia": 2.54,
    "corrispettivo_servizio_vendita": 11.16,
    "oneri_dispacciamento": 13.67,
    "all_1": "c2406313-4bb7-4816-8ca5-4c452fb5c55d/pdf_completo_1773760022312.pdf",
    "all_2": null,
    "all_3": null,
    "perdite_rete": 14.9,
    "corrispettivo_capacita": 5.96,
    "capacita_picco": 0,
    "quota_fissa_rete": 2.43,
    "quota_potenza_rete": 24.97,
    "quota_energia_rete": 18.05,
    "asos_quota_fissa": 1,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 53.62,
    "arim_quota_energia": 1.88,
    "asos_quota_potenza": 10.23,
    "arim_quota_potenza": 2.6,
    "reattiva_f3_capacitiva": 12.31,
    "accise_imposta_erariale": 15.85,
    "foto_contatore_qu3": "c2406313-4bb7-4816-8ca5-4c452fb5c55d/foto_contatore_1773760022964.jpeg"
  },
  {
    "id": "845c575e-733b-4445-a430-4b812dee84ce",
    "month_date": "2025-11-01",
    "consumo_qu3_kw": 758.5,
    "kw_f1": 541,
    "kw_f2": 388,
    "kw_f3": 600,
    "importo_alveas": 272.96,
    "importo_qu3": 245.06,
    "totale_bolletta": 518.02,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-03-17T15:07:38.062424+00:00",
    "updated_at": "2026-03-17T15:07:38.062424+00:00",
    "month_end_date": "2025-11-01",
    "consumo_fattura": 1529,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 187.3,
    "maggior_prezzo_energia": 3.06,
    "corrispettivo_servizio_vendita": 13.46,
    "oneri_dispacciamento": 16.48,
    "all_1": "845c575e-733b-4445-a430-4b812dee84ce/pdf_completo_1773760058129.pdf",
    "all_2": null,
    "all_3": null,
    "perdite_rete": 19.04,
    "corrispettivo_capacita": 7.19,
    "capacita_picco": 0,
    "quota_fissa_rete": 2.43,
    "quota_potenza_rete": 29.08,
    "quota_energia_rete": 21.77,
    "asos_quota_fissa": 1,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 64.65,
    "arim_quota_energia": 2.26,
    "asos_quota_potenza": 11.92,
    "arim_quota_potenza": 3.03,
    "reattiva_f3_capacitiva": 13.16,
    "accise_imposta_erariale": 19.11,
    "foto_contatore_qu3": "845c575e-733b-4445-a430-4b812dee84ce/foto_contatore_1773760058698.jpeg"
  },
  {
    "id": "cf88637a-9f75-4b57-854d-ecbe1ebc3597",
    "month_date": "2025-12-01",
    "consumo_qu3_kw": 1100,
    "kw_f1": 634,
    "kw_f2": 479,
    "kw_f3": 887,
    "importo_alveas": 321.25,
    "importo_qu3": 330.12,
    "totale_bolletta": 651.37,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-03-17T15:08:38.40223+00:00",
    "updated_at": "2026-03-17T15:08:38.40223+00:00",
    "month_end_date": "2025-12-01",
    "consumo_fattura": 2000,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 237.54,
    "maggior_prezzo_energia": 4,
    "corrispettivo_servizio_vendita": 17.6,
    "oneri_dispacciamento": 21.56,
    "all_1": "cf88637a-9f75-4b57-854d-ecbe1ebc3597/pdf_completo_1773760118414.pdf",
    "all_2": null,
    "all_3": null,
    "perdite_rete": 24.15,
    "corrispettivo_capacita": 8.58,
    "capacita_picco": 11.37,
    "quota_fissa_rete": 2.43,
    "quota_potenza_rete": 26.44,
    "quota_energia_rete": 28.46,
    "asos_quota_fissa": 1,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 84.57,
    "arim_quota_energia": 2.96,
    "asos_quota_potenza": 10.83,
    "arim_quota_potenza": 2.75,
    "reattiva_f3_capacitiva": 15,
    "accise_imposta_erariale": 25,
    "foto_contatore_qu3": "cf88637a-9f75-4b57-854d-ecbe1ebc3597/foto_contatore_1773760119193.jpeg"
  },
  {
    "id": "21ef5ac7-4af9-4ebc-a844-5f3f14c955c9",
    "month_date": "2026-01-01",
    "consumo_qu3_kw": 1300,
    "kw_f1": 821,
    "kw_f2": 685,
    "kw_f3": 1102,
    "importo_alveas": 494.77,
    "importo_qu3": 426.73,
    "totale_bolletta": 921.5,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-03-17T15:09:35.003206+00:00",
    "updated_at": "2026-03-17T15:09:35.003206+00:00",
    "month_end_date": "2026-01-01",
    "consumo_fattura": 2608,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 358.22,
    "maggior_prezzo_energia": 5.22,
    "corrispettivo_servizio_vendita": 22.95,
    "oneri_dispacciamento": 30.58,
    "all_1": "21ef5ac7-4af9-4ebc-a844-5f3f14c955c9/pdf_completo_1773760175021.pdf",
    "all_2": null,
    "all_3": null,
    "perdite_rete": 36.34,
    "corrispettivo_capacita": 7.13,
    "capacita_picco": 31.89,
    "quota_fissa_rete": 2.41,
    "quota_potenza_rete": 32.38,
    "quota_energia_rete": 40.14,
    "asos_quota_fissa": 0.99,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 108.9,
    "arim_quota_energia": 4.21,
    "asos_quota_potenza": 13.38,
    "arim_quota_potenza": 3.39,
    "reattiva_f3_capacitiva": 14.93,
    "accise_imposta_erariale": 32.6,
    "foto_contatore_qu3": "21ef5ac7-4af9-4ebc-a844-5f3f14c955c9/foto_contatore_1773760175423.jpeg"
  },
  {
    "id": "6177ebb9-9768-4068-afb0-b256d904540a",
    "month_date": "2026-03-01",
    "consumo_qu3_kw": 561.11,
    "kw_f1": 551,
    "kw_f2": 448,
    "kw_f3": 692,
    "importo_alveas": 457.35,
    "importo_qu3": 244.84,
    "totale_bolletta": 702.19,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-06-11T09:13:42.130337+00:00",
    "updated_at": "2026-06-11T09:13:42.130337+00:00",
    "month_end_date": "2026-03-01",
    "consumo_fattura": 1691,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 325.38,
    "maggior_prezzo_energia": 0,
    "corrispettivo_servizio_vendita": 0,
    "oneri_dispacciamento": 0,
    "all_1": "6177ebb9-9768-4068-afb0-b256d904540a/pdf_completo_1781169213217.pdf",
    "all_2": null,
    "all_3": null,
    "perdite_rete": 0,
    "corrispettivo_capacita": 0,
    "capacita_picco": 0,
    "quota_fissa_rete": 3.65,
    "quota_potenza_rete": 32.49,
    "quota_energia_rete": 99.37,
    "asos_quota_fissa": 0.99,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 69.4,
    "arim_quota_energia": 2.68,
    "asos_quota_potenza": 8.62,
    "arim_quota_potenza": 2.18,
    "reattiva_f3_capacitiva": 0,
    "accise_imposta_erariale": 21.14,
    "foto_contatore_qu3": null
  },
  {
    "id": "b14e82b0-381a-4afd-a1b1-08789a5ed79f",
    "month_date": "2026-04-01",
    "consumo_qu3_kw": 363.62,
    "kw_f1": 351,
    "kw_f2": 364,
    "kw_f3": 630,
    "importo_alveas": 312.02,
    "importo_qu3": 138.65,
    "totale_bolletta": 450.67,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-06-11T09:07:08.95236+00:00",
    "updated_at": "2026-06-11T09:07:08.95236+00:00",
    "month_end_date": "2026-04-01",
    "consumo_fattura": 1345,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 184.74,
    "maggior_prezzo_energia": 2.69,
    "corrispettivo_servizio_vendita": 11.84,
    "oneri_dispacciamento": 15.53,
    "all_1": "b14e82b0-381a-4afd-a1b1-08789a5ed79f/pdf_completo_1781169728694.pdf",
    "all_2": null,
    "all_3": null,
    "perdite_rete": 18.74,
    "corrispettivo_capacita": 5.35,
    "capacita_picco": 0,
    "quota_fissa_rete": 2.41,
    "quota_potenza_rete": 24.7,
    "quota_energia_rete": 20.7,
    "asos_quota_fissa": 0.99,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 37.62,
    "arim_quota_energia": 2.17,
    "asos_quota_potenza": 10.21,
    "arim_quota_potenza": 2.59,
    "reattiva_f3_capacitiva": 2.64,
    "accise_imposta_erariale": 16.81,
    "foto_contatore_qu3": null
  },
  {
    "id": "d6aa8e4a-e939-45cf-b9fc-aca3d796dc6a",
    "month_date": "2026-02-01",
    "consumo_qu3_kw": 779.48,
    "kw_f1": 650,
    "kw_f2": 517,
    "kw_f3": 851,
    "importo_alveas": 419.97,
    "importo_qu3": 253,
    "totale_bolletta": 672.97,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-06-11T09:24:36.809513+00:00",
    "updated_at": "2026-06-11T09:24:36.809513+00:00",
    "month_end_date": "2026-02-01",
    "consumo_fattura": 2018,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 242.17,
    "maggior_prezzo_energia": 4.04,
    "corrispettivo_servizio_vendita": 17.76,
    "oneri_dispacciamento": 23.66,
    "all_1": "d6aa8e4a-e939-45cf-b9fc-aca3d796dc6a/pdf_completo_1781169867854.pdf",
    "all_2": null,
    "all_3": null,
    "perdite_rete": 24.62,
    "corrispettivo_capacita": 5.72,
    "capacita_picco": 20.16,
    "quota_fissa_rete": 2.41,
    "quota_potenza_rete": 28.81,
    "quota_energia_rete": 31.05,
    "asos_quota_fissa": 0.99,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 84.27,
    "arim_quota_energia": 3.26,
    "asos_quota_potenza": 11.91,
    "arim_quota_potenza": 3.02,
    "reattiva_f3_capacitiva": 12.88,
    "accise_imposta_erariale": 25.22,
    "foto_contatore_qu3": null
  },
  {
    "id": "2b1502b9-e0be-46e6-b8e6-8ad687a7f352",
    "month_date": "2026-05-01",
    "consumo_qu3_kw": 287.19,
    "kw_f1": 196,
    "kw_f2": 318,
    "kw_f3": 581,
    "importo_alveas": 263.32,
    "importo_qu3": 114.74,
    "totale_bolletta": 378.06,
    "created_by": "52f776eb-3109-4786-a506-2014d3a9cf49",
    "created_at": "2026-06-25T09:23:25.252119+00:00",
    "updated_at": "2026-06-25T09:23:25.252119+00:00",
    "month_end_date": "2026-05-01",
    "consumo_fattura": 1095,
    "quota_fissa_commercializzazione": 9.42,
    "quota_energia_f0": 154.43,
    "maggior_prezzo_energia": 2.19,
    "corrispettivo_servizio_vendita": 9.63,
    "oneri_dispacciamento": 12.65,
    "all_1": "2b1502b9-e0be-46e6-b8e6-8ad687a7f352/pdf_completo_1782379405345.pdf",
    "all_2": null,
    "all_3": null,
    "perdite_rete": 15.66,
    "corrispettivo_capacita": 4.36,
    "capacita_picco": 0,
    "quota_fissa_rete": 2.41,
    "quota_potenza_rete": 21.4,
    "quota_energia_rete": 16.85,
    "asos_quota_fissa": 0.99,
    "arim_quota_fissa": 0.25,
    "asos_quota_energia": 30.62,
    "arim_quota_energia": 1.77,
    "asos_quota_potenza": 8.85,
    "arim_quota_potenza": 2.24,
    "reattiva_f3_capacitiva": 2.48,
    "accise_imposta_erariale": 13.69,
    "foto_contatore_qu3": null
  }
];
