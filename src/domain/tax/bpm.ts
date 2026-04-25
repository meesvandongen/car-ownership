import type { TaxData } from "../taxData";
import type { Powertrain } from "../types";

export interface BpmInputs {
  powertrain: Powertrain;
  co2: number;
}

/**
 * One-time BPM (purchase tax). Only relevant for new purchases.
 */
export function calculateBpm(input: BpmInputs, data: TaxData): number {
  if (input.powertrain === "ev") return data.bpm.evFixed;
  if (input.powertrain === "hydrogen") return data.bpm.hydrogenFixed;

  let bpm = 0;
  let prevThreshold = 0;
  for (const bracket of data.bpm.co2Brackets) {
    const ceiling = bracket.upToCo2 ?? Infinity;
    if (input.co2 > prevThreshold) {
      const slice = Math.min(input.co2, ceiling) - prevThreshold;
      bpm += slice * bracket.ratePerGram + bracket.fixed;
    }
    if (input.co2 <= ceiling) break;
    prevThreshold = ceiling;
  }

  if (input.powertrain === "diesel") {
    const surcharge = data.bpm.dieselSurchargePerGramAbove;
    if (input.co2 > surcharge.threshold) {
      bpm += (input.co2 - surcharge.threshold) * surcharge.rate;
    }
  }

  if (input.powertrain === "phev") {
    bpm += input.co2 * data.bpm.phevSurchargePerGram;
  }

  return Math.max(0, bpm);
}
