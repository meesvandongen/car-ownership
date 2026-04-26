import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateBpm, type BpmInputs } from "./bpm";
import { getTaxData } from "../taxData";
import type { Powertrain } from "../types";

const data = getTaxData(2026);

const combustion: Powertrain[] = ["petrol", "diesel", "lpg", "phev"];
const allPowertrains: Powertrain[] = [...combustion, "ev", "hydrogen"];

describe("BPM — property-based invariants", () => {
  it("is never negative for any powertrain × CO₂ combination", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPowertrains),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (powertrain, co2) => {
          const got = calculateBpm({ powertrain, co2 }, data);
          return got >= 0 && Number.isFinite(got);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("EV always returns the fixed bedrag, regardless of CO₂ input", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 600, noNaN: true }), (co2) => {
        return calculateBpm({ powertrain: "ev", co2 }, data) === data.bpm.evFixed;
      }),
      { numRuns: 200 },
    );
  });

  it("hydrogen always returns the fixed bedrag, regardless of CO₂ input", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 600, noNaN: true }), (co2) => {
        return (
          calculateBpm({ powertrain: "hydrogen", co2 }, data) === data.bpm.hydrogenFixed
        );
      }),
      { numRuns: 200 },
    );
  });

  it("is monotonically non-decreasing in CO₂ for combustion-style powertrains", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...combustion),
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (powertrain, co2, delta) => {
          const a = calculateBpm({ powertrain, co2 }, data);
          const b = calculateBpm({ powertrain, co2: co2 + delta }, data);
          return b >= a - 1e-6;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("diesel BPM ≥ petrol BPM for the same CO₂ (diesel surcharge cannot subtract)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (co2) => {
        const petrol = calculateBpm({ powertrain: "petrol", co2 }, data);
        const diesel = calculateBpm({ powertrain: "diesel", co2 }, data);
        return diesel >= petrol - 1e-6;
      }),
      { numRuns: 1000 },
    );
  });

  it("PHEV BPM ≥ petrol BPM for the same CO₂ (PHEV surcharge per gram)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (co2) => {
        const petrol = calculateBpm({ powertrain: "petrol", co2 }, data);
        const phev = calculateBpm({ powertrain: "phev", co2 }, data);
        return phev >= petrol - 1e-6;
      }),
      { numRuns: 1000 },
    );
  });

  it("LPG BPM equals petrol BPM at the same CO₂ (no LPG-specific surcharge)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (co2) => {
        const petrol = calculateBpm({ powertrain: "petrol", co2 }, data);
        const lpg = calculateBpm({ powertrain: "lpg", co2 }, data);
        return Math.abs(petrol - lpg) < 1e-6;
      }),
      { numRuns: 500 },
    );
  });

  it("BPM brackets accumulate correctly: stepwise total at each ceiling matches manual sum", () => {
    // Walk through each bracket ceiling and assert the running sum equals the function output.
    let runningManual = 0;
    let lower = 0;
    for (const bracket of data.bpm.co2Brackets) {
      const ceiling = bracket.upToCo2;
      if (ceiling === null) break;
      runningManual += (ceiling - lower) * bracket.ratePerGram + bracket.fixed;
      const got = calculateBpm({ powertrain: "petrol", co2: ceiling }, data);
      expect(got).toBeCloseTo(runningManual, 5);
      lower = ceiling;
    }
  });
});
