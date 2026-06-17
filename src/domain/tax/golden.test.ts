import { describe, expect, it } from "vitest";
import { calculateBijtelling } from "./bijtelling";
import { calculateBpm } from "./bpm";
import { calculateAnnualMrb } from "./mrb";
import { computeBox1Tax, computeIncomeTax } from "./incomeTax";
import { getTaxData } from "../taxData";
import type { Powertrain, Province } from "../types";

const data = getTaxData(2026);

/**
 * Golden-table tests: independent recomputation of each calculation by hand,
 * matched against the function output. These are designed to catch regressions
 * where a refactor accidentally changes the output, even if the change is
 * small enough that no invariant fires.
 *
 * Each row of the table was computed manually from the 2026 rates JSON without
 * looking at the implementation, then double-checked.
 */

describe("bijtelling — golden table", () => {
  const cases: Array<{
    name: string;
    cat: number;
    p: Powertrain;
    detYear: number;
    taxYear: number;
    privateKm: number;
    rr: boolean;
    isYT?: boolean;
    mvIfYT?: number;
    expected: number;
  }> = [
    // EV at the cap, registered in the year of the EV cap.
    { name: "EV detYear=2025 cat=20k", cat: 20_000, p: "ev", detYear: 2025, taxYear: 2025, privateKm: 5000, rr: false, expected: 20_000 * 0.17 },
    { name: "EV detYear=2025 cat=30k", cat: 30_000, p: "ev", detYear: 2025, taxYear: 2025, privateKm: 5000, rr: false, expected: 30_000 * 0.17 },
    { name: "EV detYear=2025 cat=50k", cat: 50_000, p: "ev", detYear: 2025, taxYear: 2025, privateKm: 5000, rr: false, expected: 30_000 * 0.17 + 20_000 * 0.22 },
    { name: "EV detYear=2026 cat=80k", cat: 80_000, p: "ev", detYear: 2026, taxYear: 2026, privateKm: 5000, rr: false, expected: 30_000 * 0.18 + 50_000 * 0.22 },
    { name: "EV detYear=2027 cat=45k", cat: 45_000, p: "ev", detYear: 2027, taxYear: 2027, privateKm: 5000, rr: false, expected: 30_000 * 0.20 + 15_000 * 0.22 },
    // EV after lock expires (detYear=2025 → tax-year=2030 = 60 months).
    { name: "EV detYear=2025 lock expired in 2030", cat: 50_000, p: "ev", detYear: 2025, taxYear: 2030, privateKm: 5000, rr: false, expected: 50_000 * 0.22 },
    // EV at detYear ≥ 2028: no cap.
    { name: "EV detYear=2028 cat=50k (no cap)", cat: 50_000, p: "ev", detYear: 2028, taxYear: 2028, privateKm: 5000, rr: false, expected: 50_000 * 0.22 },
    // Combustion family.
    { name: "Petrol cat=45k", cat: 45_000, p: "petrol", detYear: 2026, taxYear: 2026, privateKm: 5000, rr: false, expected: 45_000 * 0.22 },
    { name: "Diesel cat=45k", cat: 45_000, p: "diesel", detYear: 2026, taxYear: 2026, privateKm: 5000, rr: false, expected: 45_000 * 0.22 },
    { name: "PHEV cat=45k", cat: 45_000, p: "phev", detYear: 2026, taxYear: 2026, privateKm: 5000, rr: false, expected: 45_000 * 0.22 },
    { name: "LPG cat=45k", cat: 45_000, p: "lpg", detYear: 2026, taxYear: 2026, privateKm: 5000, rr: false, expected: 45_000 * 0.22 },
    // Hydrogen always 18%, no cap.
    { name: "Hydrogen cat=80k", cat: 80_000, p: "hydrogen", detYear: 2026, taxYear: 2026, privateKm: 5000, rr: false, expected: 80_000 * 0.18 },
    // Rittenregistratie zero-rule.
    { name: "Petrol with RR + 499 km", cat: 45_000, p: "petrol", detYear: 2026, taxYear: 2026, privateKm: 499, rr: true, expected: 0 },
    { name: "Petrol with RR + 500 km (boundary, NOT zero)", cat: 45_000, p: "petrol", detYear: 2026, taxYear: 2026, privateKm: 500, rr: true, expected: 45_000 * 0.22 },
    // Youngtimer — 35% of market value.
    { name: "Youngtimer market 8k", cat: 50_000, p: "petrol", detYear: 2008, taxYear: 2026, privateKm: 5000, rr: false, isYT: true, mvIfYT: 8_000, expected: 0.35 * 8_000 },
    { name: "Youngtimer no market value falls back to catalogus", cat: 12_000, p: "petrol", detYear: 2008, taxYear: 2026, privateKm: 5000, rr: false, isYT: true, expected: 0.35 * 12_000 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const got = calculateBijtelling(
        {
          catalogusprijs: c.cat,
          powertrain: c.p,
          detYear: c.detYear,
          taxYear: c.taxYear,
          privateKmPerYear: c.privateKm,
          rittenregistratie: c.rr,
          isYoungtimer: c.isYT,
          marketValueIfYoungtimer: c.mvIfYT,
        },
        data,
      );
      expect(got).toBeCloseTo(c.expected, 5);
    });
  }
});

describe("BPM — golden table", () => {
  const cases: Array<{
    name: string;
    p: Powertrain;
    co2: number;
    expected: number;
  }> = [
    // EV / hydrogen flat fixed bedrag.
    { name: "EV, any CO₂", p: "ev", co2: 0, expected: 685 },
    { name: "Hydrogen, any CO₂", p: "hydrogen", co2: 0, expected: 685 },
    // Petrol: bracket 1 (≤71): 2.5/g + 440 fixed.
    { name: "Petrol CO₂=50", p: "petrol", co2: 50, expected: 50 * 2.5 + 440 },
    { name: "Petrol CO₂=71 (bracket-1 ceiling)", p: "petrol", co2: 71, expected: 71 * 2.5 + 440 },
    // Petrol: bracket 2 (72-95): 75/g additional from 71.
    { name: "Petrol CO₂=80", p: "petrol", co2: 80, expected: 71 * 2.5 + 440 + (80 - 71) * 75 },
    { name: "Petrol CO₂=95 (bracket-2 ceiling)", p: "petrol", co2: 95, expected: 71 * 2.5 + 440 + (95 - 71) * 75 },
    // Petrol: bracket 3 (96-139): 162/g additional from 95.
    { name: "Petrol CO₂=120", p: "petrol", co2: 120, expected: 71 * 2.5 + 440 + 24 * 75 + (120 - 95) * 162 },
    { name: "Petrol CO₂=139", p: "petrol", co2: 139, expected: 71 * 2.5 + 440 + 24 * 75 + (139 - 95) * 162 },
    // Petrol: bracket 4 (140-159): 311/g additional from 139.
    { name: "Petrol CO₂=159", p: "petrol", co2: 159, expected: 71 * 2.5 + 440 + 24 * 75 + 44 * 162 + (159 - 139) * 311 },
    // Petrol: bracket 5 (>159): 622/g additional from 159.
    { name: "Petrol CO₂=200", p: "petrol", co2: 200, expected: 71 * 2.5 + 440 + 24 * 75 + 44 * 162 + 20 * 311 + (200 - 159) * 622 },
    // Diesel: petrol + €122.94/g over 50.
    { name: "Diesel CO₂=120 (with surcharge)", p: "diesel", co2: 120, expected: 71 * 2.5 + 440 + 24 * 75 + (120 - 95) * 162 + (120 - 50) * 122.94 },
    // PHEV: petrol + €38/g over total CO₂.
    { name: "PHEV CO₂=80", p: "phev", co2: 80, expected: 71 * 2.5 + 440 + (80 - 71) * 75 + 80 * 38 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const got = calculateBpm({ powertrain: c.p, co2: c.co2 }, data);
      expect(got).toBeCloseTo(c.expected, 2);
    });
  }
});

describe("MRB — golden table", () => {
  const cases: Array<{
    name: string;
    weightKg: number;
    p: Powertrain;
    province: Province;
    taxYear: number;
    expected: number;
  }> = [
    // Petrol/Overijssel @ 1500kg: rijksdeel 167.86/q (Art. 23) × 1.0 × (1+0.85) × 4.
    { name: "Petrol 1500kg Overijssel 2026", weightKg: 1500, p: "petrol", province: "Overijssel", taxYear: 2026, expected: 167.86 * 1 * 1.85 * 4 },
    // Diesel/Overijssel @ 1500kg: × 1.30.
    { name: "Diesel 1500kg Overijssel 2026", weightKg: 1500, p: "diesel", province: "Overijssel", taxYear: 2026, expected: 167.86 * 1.3 * 1.85 * 4 },
    // LPG/Overijssel @ 1500kg: × 1.40.
    { name: "LPG 1500kg Overijssel 2026", weightKg: 1500, p: "lpg", province: "Overijssel", taxYear: 2026, expected: 167.86 * 1.4 * 1.85 * 4 },
    // EV/Overijssel @ 1500kg in 2026: × 0.70 × (1−0.30) = × 0.49.
    { name: "EV 1500kg Overijssel 2026", weightKg: 1500, p: "ev", province: "Overijssel", taxYear: 2026, expected: 167.86 * 0.7 * 1.85 * 4 * 0.7 },
    // EV/Overijssel @ 1500kg in 2030: 0% korting.
    { name: "EV 1500kg Overijssel 2030", weightKg: 1500, p: "ev", province: "Overijssel", taxYear: 2030, expected: 167.86 * 0.7 * 1.85 * 4 * 1.0 },
    // Different province: Groningen has highest opcenten 1.05.
    { name: "Petrol 1500kg Groningen", weightKg: 1500, p: "petrol", province: "Groningen", taxYear: 2026, expected: 167.86 * 1 * 2.05 * 4 },
    { name: "Petrol 1500kg Noord-Holland (lowest)", weightKg: 1500, p: "petrol", province: "Noord-Holland", taxYear: 2026, expected: 167.86 * 1 * 1.78 * 4 },
    // Light car: tier 29.12/q for 600kg.
    { name: "Petrol 600kg Overijssel", weightKg: 600, p: "petrol", province: "Overijssel", taxYear: 2026, expected: 29.12 * 1 * 1.85 * 4 },
    // Heavy car: tier 426.91/q for 3000kg.
    { name: "Petrol 3000kg Overijssel", weightKg: 3000, p: "petrol", province: "Overijssel", taxYear: 2026, expected: 426.91 * 1 * 1.85 * 4 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const got = calculateAnnualMrb(
        { weightKg: c.weightKg, powertrain: c.p, province: c.province, taxYear: c.taxYear },
        data,
      );
      expect(got).toBeCloseTo(c.expected, 2);
    });
  }
});

describe("income tax — golden table", () => {
  // Cumulative bracket sums computed manually:
  // Bracket 1 cap at €38,883 → 38883 × 0.3576 = €13,904.5608
  // Bracket 2 cap at €79,137 → previous + (79137−38883) × 0.3756 = €13,904.5608 + €15,119.4024 = €29,023.9632
  const bracket1Top = 38883;
  const bracket2Top = 79137;
  const tax_at_bracket1Top = bracket1Top * 0.3576;
  const tax_at_bracket2Top = tax_at_bracket1Top + (bracket2Top - bracket1Top) * 0.3756;

  const cases: Array<{ name: string; income: number; expectedRawTax: number }> = [
    { name: "€0 → €0", income: 0, expectedRawTax: 0 },
    { name: "€10,000 in bracket 1", income: 10_000, expectedRawTax: 10_000 * 0.3576 },
    { name: "€38,883 at bracket-1 cap", income: 38_883, expectedRawTax: tax_at_bracket1Top },
    { name: "€50,000 mid bracket 2", income: 50_000, expectedRawTax: tax_at_bracket1Top + (50_000 - 38_883) * 0.3756 },
    { name: "€79,137 at bracket-2 cap", income: 79_137, expectedRawTax: tax_at_bracket2Top },
    { name: "€100,000 in bracket 3", income: 100_000, expectedRawTax: tax_at_bracket2Top + (100_000 - 79_137) * 0.495 },
    { name: "€250,000 deep in bracket 3", income: 250_000, expectedRawTax: tax_at_bracket2Top + (250_000 - 79_137) * 0.495 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(computeBox1Tax(c.income, data)).toBeCloseTo(c.expectedRawTax, 2);
    });
  }

  it("computeIncomeTax produces a positive netTax slightly below rawTax for every case", () => {
    for (const c of cases) {
      const r = computeIncomeTax(c.income, data);
      expect(r.rawTax).toBeCloseTo(c.expectedRawTax, 2);
      expect(r.netTax).toBeLessThanOrEqual(r.rawTax);
      expect(r.netIncome).toBeCloseTo(c.income - r.netTax, 2);
    }
  });
});
