import { describe, it } from "vitest";
import fc from "fast-check";
import { calculateBijtelling } from "./bijtelling";
import { calculateBpm } from "./bpm";
import { calculateAnnualMrb } from "./mrb";
import { computeBox1Tax } from "./incomeTax";
import { getTaxData } from "../taxData";
import type { Powertrain, Province } from "../types";

const data = getTaxData(2026);
const provinces = Object.keys(data.provinces) as Province[];

/**
 * Metamorphic tests verify *relationships* between outputs of multiple calls
 * rather than specific values. They are robust to rate changes (the JSON can
 * change without the tests needing updates) but still catch logic regressions.
 */
describe("bijtelling — metamorphic relations", () => {
  it("doubling catalogusprijs produces ≥ 2× bijtelling for EVs (cap pushes more revenue into 22% bracket)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1_000, max: 100_000, noNaN: true }),
        fc.integer({ min: 2025, max: 2027 }),
        (cat, detYear) => {
          const a = calculateBijtelling(
            {
              catalogusprijs: cat,
              powertrain: "ev",
              detYear,
              taxYear: detYear,
              privateKmPerYear: 5000,
              rittenregistratie: false,
            },
            data,
          );
          const b = calculateBijtelling(
            {
              catalogusprijs: cat * 2,
              powertrain: "ev",
              detYear,
              taxYear: detYear,
              privateKmPerYear: 5000,
              rittenregistratie: false,
            },
            data,
          );
          return b >= 2 * a - 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("combustion bijtelling is exactly linear in catalogusprijs", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200_000, noNaN: true }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        (cat, k) => {
          const a = calculateBijtelling(
            {
              catalogusprijs: cat,
              powertrain: "petrol",
              detYear: 2026,
              taxYear: 2026,
              privateKmPerYear: 5000,
              rittenregistratie: false,
            },
            data,
          );
          const b = calculateBijtelling(
            {
              catalogusprijs: cat * k,
              powertrain: "petrol",
              detYear: 2026,
              taxYear: 2026,
              privateKmPerYear: 5000,
              rittenregistratie: false,
            },
            data,
          );
          return Math.abs(b - a * k) < 1e-3;
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe("BPM — metamorphic relations", () => {
  it("petrol BPM crosses the EV fixed bedrag at CO₂ ≈ 72 g/km (counterintuitive low-emission BPM)", () => {
    // Surfaced by the explorer + metamorphic check: at very low CO₂, petrol BPM
    // (€440 + €2.5/g in bracket 1) is BELOW the EV fixed bedrag of €685.
    //   At co2 = 71 g/km: petrol = €440 + 71×€2.5 = €617.50 < €685 (EV).
    //   At co2 = 72 g/km: petrol = previous + 1 × €75 (bracket 2) = €692.50 > €685.
    // Above 72 g/km, petrol always exceeds EV.
    fc.assert(
      fc.property(fc.double({ min: 72, max: 400, noNaN: true }), (co2) => {
        const ev = calculateBpm({ powertrain: "ev", co2: 0 }, data);
        const petrol = calculateBpm({ powertrain: "petrol", co2 }, data);
        return petrol >= ev - 1e-6;
      }),
      { numRuns: 500 },
    );
    // And the inverse: petrol IS cheaper than EV at low CO₂.
    fc.assert(
      fc.property(fc.double({ min: 0, max: 70, noNaN: true }), (co2) => {
        const ev = calculateBpm({ powertrain: "ev", co2: 0 }, data);
        const petrol = calculateBpm({ powertrain: "petrol", co2 }, data);
        return petrol < ev;
      }),
      { numRuns: 200 },
    );
  });

  it("PHEV ≥ petrol ≥ LPG = petrol (orderings hold simultaneously at every CO₂)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 400, noNaN: true }), (co2) => {
        const lpg = calculateBpm({ powertrain: "lpg", co2 }, data);
        const petrol = calculateBpm({ powertrain: "petrol", co2 }, data);
        const phev = calculateBpm({ powertrain: "phev", co2 }, data);
        const diesel = calculateBpm({ powertrain: "diesel", co2 }, data);
        return (
          Math.abs(lpg - petrol) < 1e-6 &&
          phev >= petrol - 1e-6 &&
          diesel >= petrol - 1e-6
        );
      }),
      { numRuns: 500 },
    );
  });
});

describe("MRB — metamorphic relations", () => {
  it("ratio MRB(any province A) / MRB(province B) is independent of weight (multiplicative)", () => {
    // Provincial opcenten enter as a multiplicative factor — ratio between two
    // provinces should be the same at any weight.
    fc.assert(
      fc.property(
        fc.constantFrom<Powertrain>("petrol", "diesel", "ev"),
        fc.constantFrom(...provinces),
        fc.constantFrom(...provinces),
        fc.double({ min: 100, max: 3000, noNaN: true }),
        fc.double({ min: 100, max: 3000, noNaN: true }),
        (powertrain, pA, pB, w1, w2) => {
          if (data.provinces[pB] + 1 < 1e-6) return true;
          const r1 =
            calculateAnnualMrb(
              { weightKg: w1, powertrain, province: pA, taxYear: 2026 },
              data,
            ) /
            calculateAnnualMrb(
              { weightKg: w1, powertrain, province: pB, taxYear: 2026 },
              data,
            );
          const r2 =
            calculateAnnualMrb(
              { weightKg: w2, powertrain, province: pA, taxYear: 2026 },
              data,
            ) /
            calculateAnnualMrb(
              { weightKg: w2, powertrain, province: pB, taxYear: 2026 },
              data,
            );
          return Math.abs(r1 - r2) < 1e-9;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("MRB(diesel) / MRB(petrol) is exactly the diesel multiplier (1.30)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 3000, noNaN: true }),
        fc.constantFrom(...provinces),
        (w, p) => {
          const petrol = calculateAnnualMrb(
            { weightKg: w, powertrain: "petrol", province: p, taxYear: 2026 },
            data,
          );
          const diesel = calculateAnnualMrb(
            { weightKg: w, powertrain: "diesel", province: p, taxYear: 2026 },
            data,
          );
          return Math.abs(diesel / petrol - 1.3) < 1e-9;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("MRB(EV at year Y) / MRB(petrol same vehicle) = (1 − korting[Y]) (art. 23b)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 3000, noNaN: true }),
        fc.constantFrom(...provinces),
        fc.constantFrom(2026, 2027, 2028, 2029, 2030),
        (w, p, year) => {
          const petrol = calculateAnnualMrb(
            { weightKg: w, powertrain: "petrol", province: p, taxYear: year },
            data,
          );
          const ev = calculateAnnualMrb(
            { weightKg: w, powertrain: "ev", province: p, taxYear: year },
            data,
          );
          const korting = data.mrb.evKortingByYear[String(year)] ?? 0;
          const expected = 1 - korting;
          return Math.abs(ev / petrol - expected) < 1e-9;
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe("income tax — metamorphic relations", () => {
  it("computeBox1Tax is convex (the marginal rate never decreases with income)", () => {
    // Brackets are sorted by ascending rate, so the function must be convex.
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200_000, noNaN: true }),
        fc.double({ min: 0.01, max: 50_000, noNaN: true }),
        fc.double({ min: 0.01, max: 50_000, noNaN: true }),
        (income, d1, d2) => {
          const t0 = computeBox1Tax(income, data);
          const t1 = computeBox1Tax(income + d1, data);
          const t2 = computeBox1Tax(income + d1 + d2, data);
          const r1 = (t1 - t0) / d1;
          const r2 = (t2 - t1) / d2;
          // Marginal rate r2 ≥ r1 (within tolerance).
          return r2 >= r1 - 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("incremental tax over [a,b] equals tax(b) − tax(a) (sum-of-slices = whole)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        (a, dab, dbc) => {
          const b = a + dab;
          const c = b + dbc;
          const tA = computeBox1Tax(a, data);
          const tB = computeBox1Tax(b, data);
          const tC = computeBox1Tax(c, data);
          // tax(c) − tax(a) = (tax(c) − tax(b)) + (tax(b) − tax(a))
          return Math.abs(tC - tA - ((tC - tB) + (tB - tA))) < 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });
});
