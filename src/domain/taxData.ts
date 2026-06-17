import taxYear2026 from "../data/tax_year_2026.json";

export interface MrbBand {
  fromKg: number;
  base: number;
  per100Above: number;
}

export interface BijtellingRate {
  ev: number;
  evCap: number | null;
  above: number;
  combustion: number;
}

export interface TaxData {
  year: number;
  lastVerified: string;
  incomeTax: {
    withAow: boolean;
    brackets: { upTo: number | null; rate: number }[];
    algemeneHeffingskorting: {
      max: number;
      phaseOutStart: number;
      phaseOutEnd: number;
      phaseOutRate: number;
    };
    arbeidskorting: {
      buildupRate: number;
      max: number;
      phaseOutStart: number;
      phaseOutEnd: number;
      phaseOutRate: number;
    };
  };
  bijtelling: {
    ratesByRegistrationYear: Record<string, BijtellingRate>;
    hydrogenSolarRate: number;
    youngtimerRate: number;
    youngtimerMinAgeYears: number;
    lockMonths: number;
  };
  mrb: {
    // Quarterly rijksdeel (Wet MRB 1994 art. 23) and brandstoftoeslag (art. 23
    // lid 2/3) as weight bands. For an eigen massa rounded up to the next whole
    // 100 kg, pick the highest band with `fromKg ≤ weight`; the amount is
    // `base + ((weight − fromKg) / 100) × per100Above`.
    rijksdeel: MrbBand[];
    fuelSurcharge: {
      diesel: MrbBand[];
      // LPG / overige brandstof without a certified gas installation.
      lpg: MrbBand[];
      // LPG/CNG/LNG with a G3 or R115 installation (reduced toeslag).
      lpgG3: MrbBand[];
    };
    // Fijnstoftoeslag: a surcharge on (rijksdeel + dieseltoeslag) for diesels
    // whose fijnstof (PM) emission exceeds the limit — older diesels without a
    // particulate filter. Stored as a fraction (0.19 = 19%).
    dieselFijnstofToeslag: number;
    evKortingByYear: Record<string, number>;
  };
  provinces: Record<string, number>;
  bpm: {
    evFixed: number;
    hydrogenFixed: number;
    co2Brackets: {
      upToCo2: number | null;
      ratePerGram: number;
      fixed: number;
    }[];
    dieselSurchargePerGramAbove: { threshold: number; rate: number };
    phevSurchargePerGram: number;
  };
  reimbursement: {
    taxFreePerKm: number;
  };
  pseudoEindheffing: {
    fromYear: number;
    rate: number;
  };
}

const data: TaxData = taxYear2026 as TaxData;

export function getTaxData(year: number): TaxData {
  if (year !== 2026) {
    // For now only 2026; future years can be added by dropping in another JSON.
    return data;
  }
  return data;
}
