import type { TaxData } from "../taxData";
import type { Powertrain } from "../types";

export interface BijtellingInputs {
  catalogusprijs: number;
  powertrain: Powertrain;
  detYear: number;
  taxYear: number;
  privateKmPerYear: number;
  rittenregistratie: boolean;
  hydrogenOrSolarEv?: boolean;
  isYoungtimer?: boolean;
  marketValueIfYoungtimer?: number;
}

/**
 * Compute the annual gross bijtelling amount (the addition to taxable income).
 * Returns 0 if private use is below 500 km/year and a rittenregistratie is maintained.
 */
export function calculateBijtelling(input: BijtellingInputs, data: TaxData): number {
  if (input.rittenregistratie && input.privateKmPerYear < 500) {
    return 0;
  }

  if (input.isYoungtimer) {
    const value = input.marketValueIfYoungtimer ?? input.catalogusprijs;
    return value * data.bijtelling.youngtimerRate;
  }

  // 60-month lock: rate is determined by the registration year, applied for 5 years.
  // After the 60 months, the rate for that car-year shifts to the standard "above" rate (22%).
  const monthsSinceDet = (input.taxYear - input.detYear) * 12;
  const lockExpired = monthsSinceDet >= data.bijtelling.lockMonths;

  const ratesEntry =
    data.bijtelling.ratesByRegistrationYear[String(input.detYear)] ??
    data.bijtelling.ratesByRegistrationYear[
      String(Math.max(...Object.keys(data.bijtelling.ratesByRegistrationYear).map(Number)))
    ];

  if (input.powertrain === "hydrogen" || input.hydrogenOrSolarEv) {
    return input.catalogusprijs * data.bijtelling.hydrogenSolarRate;
  }

  if (input.powertrain === "ev") {
    if (lockExpired) {
      return input.catalogusprijs * ratesEntry.above;
    }
    if (ratesEntry.evCap === null) {
      return input.catalogusprijs * ratesEntry.ev;
    }
    const cap = ratesEntry.evCap;
    const lower = Math.min(input.catalogusprijs, cap);
    const upper = Math.max(0, input.catalogusprijs - cap);
    return lower * ratesEntry.ev + upper * ratesEntry.above;
  }

  // All combustion-like powertrains (petrol, diesel, lpg, phev) use the combustion rate.
  return input.catalogusprijs * ratesEntry.combustion;
}
