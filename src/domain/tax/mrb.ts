import type { TaxData } from "../taxData";
import type { Powertrain, Province } from "../types";

export interface MrbInputs {
  weightKg: number;
  powertrain: Powertrain;
  province: Province;
  taxYear: number;
}

/**
 * Annual MRB (motorrijtuigenbelasting) including provinciale opcenten.
 *
 * Computation:
 *   quarterly rijksdeel × powertrain multiplier × (1 + opcenten %) × 4
 * The quarterly base is the rijksdeel (national part) per the Wet MRB 1994
 * art. 23 personenauto schedule: €64.24 + €17.27 per 100 kg above 900 kg.
 * EVs additionally receive a korting per the schedule (30% in 2026, decreasing).
 */
export function calculateAnnualMrb(input: MrbInputs, data: TaxData): number {
  const tier =
    data.mrb.weightTable.find((t) => input.weightKg <= t.upTo) ??
    data.mrb.weightTable[data.mrb.weightTable.length - 1];
  const baseQuarterly = tier.quarterly;
  const multiplier = data.mrb.powertrainMultipliers[input.powertrain] ?? 1;
  const opcenten = data.provinces[input.province] ?? 1;

  // Provincial opcenten is a percentage surcharge on the rijksdeel.
  // Total = rijksdeel × (1 + opcenten). Stored as fraction (0.85 = 85% surcharge).
  let annual = baseQuarterly * multiplier * (1 + opcenten) * 4;

  if (input.powertrain === "ev" || input.powertrain === "hydrogen") {
    const korting = data.mrb.evKortingByYear[String(input.taxYear)] ?? 0;
    annual *= 1 - korting;
  }

  return annual;
}
