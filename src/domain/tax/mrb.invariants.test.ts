import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateAnnualMrb } from "./mrb";
import { getTaxData } from "../taxData";
import type { Powertrain, Province } from "../types";

const data = getTaxData(2026);

const provinces = Object.keys(data.provinces) as Province[];
const powertrains: Powertrain[] = ["ev", "hydrogen", "phev", "petrol", "diesel", "lpg"];
const evLikePowertrains: Powertrain[] = ["ev", "hydrogen"];
const nonEvPowertrains: Powertrain[] = ["phev", "petrol", "diesel", "lpg"];

describe("MRB — property-based invariants", () => {
  it("is always strictly positive for any positive weight (cars always pay something)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 3500, noNaN: true }),
        fc.constantFrom(...powertrains),
        fc.constantFrom(...provinces),
        fc.integer({ min: 2026, max: 2030 }),
        (weightKg, powertrain, province, taxYear) => {
          const got = calculateAnnualMrb(
            { weightKg, powertrain, province, taxYear },
            data,
          );
          return got > 0 && Number.isFinite(got);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("monotonically non-decreasing in weight (heavier car ≥ lighter car, ceteris paribus)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 2900, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.constantFrom(...powertrains),
        fc.constantFrom(...provinces),
        fc.integer({ min: 2026, max: 2030 }),
        (weightKg, delta, powertrain, province, taxYear) => {
          const a = calculateAnnualMrb(
            { weightKg, powertrain, province, taxYear },
            data,
          );
          const b = calculateAnnualMrb(
            { weightKg: weightKg + delta, powertrain, province, taxYear },
            data,
          );
          return b >= a - 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("higher opcenten province → ≥ MRB at the same weight/powertrain/year", () => {
    // Sort provinces ascending by opcenten and check pairwise monotonicity.
    const sorted = [...provinces].sort((a, b) => data.provinces[a] - data.provinces[b]);
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 3500, noNaN: true }),
        fc.constantFrom(...powertrains),
        fc.integer({ min: 2026, max: 2030 }),
        (weightKg, powertrain, taxYear) => {
          for (let i = 1; i < sorted.length; i++) {
            const lo = calculateAnnualMrb(
              { weightKg, powertrain, province: sorted[i - 1], taxYear },
              data,
            );
            const hi = calculateAnnualMrb(
              { weightKg, powertrain, province: sorted[i], taxYear },
              data,
            );
            if (hi < lo - 1e-6) return false;
          }
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("EV/hydrogen MRB ≤ petrol MRB for the same weight, province, and year", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 3500, noNaN: true }),
        fc.constantFrom(...evLikePowertrains),
        fc.constantFrom(...provinces),
        fc.integer({ min: 2026, max: 2030 }),
        (weightKg, ev, province, taxYear) => {
          const evMrb = calculateAnnualMrb(
            { weightKg, powertrain: ev, province, taxYear },
            data,
          );
          const petrolMrb = calculateAnnualMrb(
            { weightKg, powertrain: "petrol", province, taxYear },
            data,
          );
          return evMrb <= petrolMrb + 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("diesel and LPG MRB ≥ petrol MRB for the same weight (heavy-fuel surcharge)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 3500, noNaN: true }),
        fc.constantFrom(...provinces),
        fc.integer({ min: 2026, max: 2030 }),
        (weightKg, province, taxYear) => {
          const petrol = calculateAnnualMrb(
            { weightKg, powertrain: "petrol", province, taxYear },
            data,
          );
          const diesel = calculateAnnualMrb(
            { weightKg, powertrain: "diesel", province, taxYear },
            data,
          );
          const lpg = calculateAnnualMrb(
            { weightKg, powertrain: "lpg", province, taxYear },
            data,
          );
          return diesel >= petrol - 1e-6 && lpg >= petrol - 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("EV korting reduces MRB monotonically as the korting itself increases", () => {
    // 2026: 30% korting; 2030: 0% korting. So 2030 EV MRB > 2026 EV MRB.
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 3500, noNaN: true }),
        fc.constantFrom(...provinces),
        (weightKg, province) => {
          const yr2026 = calculateAnnualMrb(
            { weightKg, powertrain: "ev", province, taxYear: 2026 },
            data,
          );
          const yr2030 = calculateAnnualMrb(
            { weightKg, powertrain: "ev", province, taxYear: 2030 },
            data,
          );
          return yr2030 >= yr2026 - 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("non-EV MRB is independent of taxYear (no EV korting affects them)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 3500, noNaN: true }),
        fc.constantFrom(...nonEvPowertrains),
        fc.constantFrom(...provinces),
        (weightKg, powertrain, province) => {
          const a = calculateAnnualMrb(
            { weightKg, powertrain, province, taxYear: 2026 },
            data,
          );
          const b = calculateAnnualMrb(
            { weightKg, powertrain, province, taxYear: 2030 },
            data,
          );
          return Math.abs(a - b) < 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });
});
