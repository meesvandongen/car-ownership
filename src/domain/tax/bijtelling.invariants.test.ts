import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateBijtelling, type BijtellingInputs } from "./bijtelling";
import { getTaxData } from "../taxData";
import type { Powertrain } from "../types";

const data = getTaxData(2026);

const powertrains: Powertrain[] = ["ev", "hydrogen", "phev", "petrol", "diesel", "lpg"];

const arbBijtellingInput = (): fc.Arbitrary<BijtellingInputs> =>
  fc.record({
    catalogusprijs: fc.double({ min: 0, max: 500_000, noNaN: true }),
    powertrain: fc.constantFrom(...powertrains),
    detYear: fc.integer({ min: 2020, max: 2030 }),
    taxYear: fc.integer({ min: 2025, max: 2032 }),
    privateKmPerYear: fc.double({ min: 0, max: 100_000, noNaN: true }),
    rittenregistratie: fc.boolean(),
    hydrogenOrSolarEv: fc.boolean(),
    isYoungtimer: fc.boolean(),
    marketValueIfYoungtimer: fc.double({ min: 0, max: 200_000, noNaN: true }),
  });

/**
 * Property-based invariants for the Dutch bijtelling rule.
 *
 * The Dutch tax law guarantees several mathematical properties of the bijtelling
 * computation. Any violation indicates either a bug in our implementation or an
 * unforeseen edge case in the input domain.
 */
describe("bijtelling — property-based invariants", () => {
  it("is never negative for any input combination", () => {
    fc.assert(
      fc.property(arbBijtellingInput(), (input) => {
        const got = calculateBijtelling(input, data);
        return got >= 0 && Number.isFinite(got);
      }),
      { numRuns: 2000 },
    );
  });

  it("is never higher than catalogusprijs × highest configured rate", () => {
    // The highest rate anywhere in the law is the youngtimer rate (35%).
    // Any normal-rate computation must be bounded by 35% × catalogusprijs.
    const ceiling = data.bijtelling.youngtimerRate;
    fc.assert(
      fc.property(
        arbBijtellingInput().filter((i) => !i.isYoungtimer),
        (input) => {
          const got = calculateBijtelling(input, data);
          return got <= input.catalogusprijs * ceiling + 1e-6;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("scales linearly with catalogusprijs (homogeneity, holding everything else equal)", () => {
    fc.assert(
      fc.property(
        arbBijtellingInput().filter((i) => !i.isYoungtimer && !i.rittenregistratie),
        fc.double({ min: 1.0, max: 5.0, noNaN: true }),
        (input, k) => {
          const a = calculateBijtelling(input, data);
          const b = calculateBijtelling(
            { ...input, catalogusprijs: input.catalogusprijs * k },
            data,
          );
          // Result is piecewise-linear in catalogusprijs: scaling all inputs by k
          // should scale outputs by ≤ k (because the EV cap means upper-bracket
          // contribution grows faster, so b ≥ k * a is the strict relation).
          return b >= a * k - 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("is monotonic in catalogusprijs (cheaper car ≤ more expensive car, all else equal)", () => {
    fc.assert(
      fc.property(
        arbBijtellingInput().filter((i) => !i.isYoungtimer),
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        (input, delta) => {
          const a = calculateBijtelling(input, data);
          const b = calculateBijtelling(
            { ...input, catalogusprijs: input.catalogusprijs + delta },
            data,
          );
          return b >= a - 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("rittenregistratie + privateKm < 500 always returns exactly 0", () => {
    fc.assert(
      fc.property(
        arbBijtellingInput(),
        fc.double({ min: 0, max: 499.999, noNaN: true }),
        (input, km) => {
          const got = calculateBijtelling(
            { ...input, rittenregistratie: true, privateKmPerYear: km },
            data,
          );
          return got === 0;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("youngtimer rate equals exactly youngtimerRate × marketValue (or catalogus if missing)", () => {
    fc.assert(
      fc.property(
        arbBijtellingInput().filter((i) => i.privateKmPerYear >= 500),
        (input) => {
          const inputYT = { ...input, isYoungtimer: true, rittenregistratie: false };
          const got = calculateBijtelling(inputYT, data);
          const expected =
            (inputYT.marketValueIfYoungtimer ?? inputYT.catalogusprijs) *
            data.bijtelling.youngtimerRate;
          return Math.abs(got - expected) < 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("hydrogen always uses the hydrogen/solar rate regardless of registration year", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200_000, noNaN: true }),
        fc.integer({ min: 2020, max: 2032 }),
        fc.integer({ min: 2025, max: 2035 }),
        (cat, detYear, taxYear) => {
          const got = calculateBijtelling(
            {
              catalogusprijs: cat,
              powertrain: "hydrogen",
              detYear,
              taxYear,
              privateKmPerYear: 5000,
              rittenregistratie: false,
            },
            data,
          );
          return Math.abs(got - cat * data.bijtelling.hydrogenSolarRate) < 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("all combustion-like powertrains (petrol/diesel/lpg/phev) yield identical bijtelling", () => {
    // Bijtelling is a fiscal addition based on catalogusprijs only; fuel type
    // inside the combustion family must not change it.
    const combustion: Powertrain[] = ["petrol", "diesel", "lpg", "phev"];
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200_000, noNaN: true }),
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 2025, max: 2032 }),
        (cat, detYear, taxYear) => {
          const values = combustion.map((p) =>
            calculateBijtelling(
              {
                catalogusprijs: cat,
                powertrain: p,
                detYear,
                taxYear,
                privateKmPerYear: 5000,
                rittenregistratie: false,
              },
              data,
            ),
          );
          return values.every((v) => Math.abs(v - values[0]) < 1e-6);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("after the 60-month lock expires, EV bijtelling collapses to the 'above' rate × catalogus", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200_000, noNaN: true }),
        fc.integer({ min: 2020, max: 2026 }),
        (cat, detYear) => {
          const taxYear = detYear + 6; // ≥ 60 months later
          const got = calculateBijtelling(
            {
              catalogusprijs: cat,
              powertrain: "ev",
              detYear,
              taxYear,
              privateKmPerYear: 5000,
              rittenregistratie: false,
            },
            data,
          );
          const ratesEntry =
            data.bijtelling.ratesByRegistrationYear[String(detYear)] ??
            data.bijtelling.ratesByRegistrationYear["2030"];
          return Math.abs(got - cat * ratesEntry.above) < 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("EV cap behaviour: at catalogusprijs ≤ cap, no 'above' component is applied", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2025, max: 2027 }),
        fc.double({ min: 0, max: 30_000, noNaN: true }),
        (detYear, cat) => {
          const taxYear = detYear; // lock active
          const ratesEntry = data.bijtelling.ratesByRegistrationYear[String(detYear)];
          const got = calculateBijtelling(
            {
              catalogusprijs: cat,
              powertrain: "ev",
              detYear,
              taxYear,
              privateKmPerYear: 5000,
              rittenregistratie: false,
            },
            data,
          );
          return Math.abs(got - cat * ratesEntry.ev) < 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });
});
