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
 * Quarterly amount from a weight-band table. The eigen massa is rounded up to
 * the next whole 100 kg (a 1250 kg car is taxed as 1300 kg), then the highest
 * band with `fromKg ≤ weight` applies: `base + (Δ100kg) × per100Above`.
 */
function bandAmount(weightKg: number, bands: MrbBand[]): number {
  const rounded = Math.ceil(Math.max(weightKg, 0) / 100) * 100;
  let band = bands[0];
  for (const b of bands) {
    if (rounded >= b.fromKg) band = b;
  }
  return band.base + ((rounded - band.fromKg) / 100) * band.per100Above;
}

/**
 * Annual MRB (motorrijtuigenbelasting) including provinciale opcenten.
 *
 * Structure (per Wet MRB 1994 art. 23 / Provinciewet art. 222):
 *   quarterly = rijksdeel × (1 + opcenten) + brandstoftoeslag
 *   annual    = quarterly × 4
 * The provinciale opcenten is levied on the rijksdeel basistarief only — never
 * on the brandstoftoeslag. Diesel and (non-G3) LPG add an additive toeslag;
 * EV/hydrogen instead receive the art. 23b korting (pay 1 − korting).
 */
export function calculateAnnualMrb(input: MrbInputs, data: TaxData): number {
  const rijksdeel = bandAmount(input.weightKg, data.mrb.rijksdeel);
  const opcenten = data.provinces[input.province] ?? 0;

  let quarterly = rijksdeel * (1 + opcenten);

  if (input.powertrain === "diesel") {
    let dieselToeslag = bandAmount(input.weightKg, data.mrb.fuelSurcharge.diesel);
    if (input.dieselFijnstof) {
      // 19% fijnstoftoeslag over rijksdeel + dieseltoeslag (no opcenten).
      dieselToeslag += (rijksdeel + dieselToeslag) * data.mrb.dieselFijnstofToeslag;
    }
    quarterly += dieselToeslag;
  } else if (input.powertrain === "lpg") {
    const table = (input.lpgG3 ?? true)
      ? data.mrb.fuelSurcharge.lpgG3
      : data.mrb.fuelSurcharge.lpg;
    quarterly += bandAmount(input.weightKg, table);
  }

  let annual = quarterly * 4;

  if (input.powertrain === "ev" || input.powertrain === "hydrogen") {
    const korting = data.mrb.evKortingByYear[String(input.taxYear)] ?? 0;
    annual *= 1 - korting;
  }

  return annual;
}
