import type { MrbBand, TaxData } from "../taxData";
import type { Powertrain, Province } from "../types";

export interface MrbInputs {
  weightKg: number;
  powertrain: Powertrain;
  province: Province;
  taxYear: number;
  /**
   * LPG only: true if the car has a certified G3/R115 gas installation, which
   * pays the much lower gas toeslag. Defaults to true (the modern standard).
   */
  lpgG3?: boolean;
  /**
   * Diesel only: true for older diesels whose fijnstof (PM) emission exceeds
   * the limit — i.e. no particulate filter — which owe the 19% fijnstoftoeslag.
   * Defaults to false.
   */
  dieselFijnstof?: boolean;
}

/**
 * Quarterly amount from a weight-band table. The art. 23 tariff counts only
 * complete 100 kg above a band's threshold, i.e. the eigen massa is rounded
 * DOWN to the next whole 100 kg (a 1440 kg car is taxed as 1400 kg), then the
 * highest band with `fromKg ≤ weight` applies: `base + (Δ100kg) × per100Above`.
 */
function bandAmount(weightKg: number, bands: MrbBand[]): number {
  const rounded = Math.floor(Math.max(weightKg, 0) / 100) * 100;
  let band = bands[0];
  for (const b of bands) {
    if (rounded >= b.fromKg) band = b;
  }
  return band.base + ((rounded - band.fromKg) / 100) * band.per100Above;
}

/**
 * Annual "hoofdsom" for the provinciale opcenten — the MRB base frozen at its
 * 1 April 1995 level (Provinciewet art. 222), by weight class. Discrete bands
 * up to 1650 kg; above that, a per-100 kg increment (eigen massa rounded up).
 */
function opcentenHoofdsom(weightKg: number, data: TaxData): number {
  const h = data.mrb.opcentenHoofdsom;
  for (const b of h.bands) {
    if (weightKg <= b.maxKg) return b.amount;
  }
  const steps = Math.ceil((weightKg - h.above.thresholdKg) / 100);
  return h.above.base + steps * h.above.per100Above;
}

/**
 * Annual MRB (motorrijtuigenbelasting) including provinciale opcenten.
 *
 * Structure (Wet MRB 1994 art. 23 / Provinciewet art. 222):
 *   annual = rijksdeel × 4 + brandstoftoeslag × 4 + opcenten% × hoofdsom₁₉₉₅
 * The rijksdeel and brandstoftoeslag are quarterly amounts (× 4 → annual). The
 * provinciale opcenten is a percentage of the frozen 1 April 1995 hoofdsom —
 * NOT the current rijksdeel, and never the brandstoftoeslag. Diesel and (non-G3)
 * LPG add an additive toeslag; EV/hydrogen receive the art. 23b korting.
 *
 * This returns the exact (unrounded) statutory annual amount. The belastingdienst
 * additionally rounds each tijdvak (quarter) down to whole euros before billing;
 * that rounding is applied where the actual cost is reported (the ownership
 * scenario), not here, so this stays a clean algebraic function.
 */
export function calculateAnnualMrb(input: MrbInputs, data: TaxData): number {
  const rijksdeelQuarterly = bandAmount(input.weightKg, data.mrb.rijksdeel);
  const opcenten = data.provinces[input.province] ?? 0;

  let toeslagQuarterly = 0;
  if (input.powertrain === "diesel") {
    toeslagQuarterly = bandAmount(input.weightKg, data.mrb.fuelSurcharge.diesel);
    if (input.dieselFijnstof) {
      // 19% fijnstoftoeslag over rijksdeel + dieseltoeslag (no opcenten).
      toeslagQuarterly +=
        (rijksdeelQuarterly + toeslagQuarterly) * data.mrb.dieselFijnstofToeslag;
    }
  } else if (input.powertrain === "lpg") {
    const table = (input.lpgG3 ?? true)
      ? data.mrb.fuelSurcharge.lpgG3
      : data.mrb.fuelSurcharge.lpg;
    toeslagQuarterly = bandAmount(input.weightKg, table);
  }

  const opcentenAnnual = opcenten * opcentenHoofdsom(input.weightKg, data);
  let annual = (rijksdeelQuarterly + toeslagQuarterly) * 4 + opcentenAnnual;

  if (input.powertrain === "ev" || input.powertrain === "hydrogen") {
    const korting = data.mrb.evKortingByYear[String(input.taxYear)] ?? 0;
    annual *= 1 - korting;
  }

  return annual;
}
