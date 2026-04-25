import taxYear2026 from "../data/tax_year_2026.json";

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
    weightTable: { upTo: number; quarterly: number }[];
    powertrainMultipliers: Record<string, number>;
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
