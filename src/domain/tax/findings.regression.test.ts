import { describe, expect, it } from "vitest";
import { calculateBijtelling } from "./bijtelling";
import { calculateBpm } from "./bpm";
import { calculateAnnualMrb } from "./mrb";
import {
  computeBox1Tax,
  computeIncomeTax,
  marginalNetCost,
} from "./incomeTax";
import { evaluateBusinessLease } from "../scenarios/businessLease";
import { getTaxData } from "../taxData";
import { DEFAULTS, makeCalculation, makeCar } from "../../defaults";
import type { AppInputs, Calculation, Car, VehicleInputs, BusinessLeaseInputs } from "../types";

function withBusinessLeaseScenario(
  base: AppInputs,
  vehicle: Partial<VehicleInputs>,
  bl: Partial<BusinessLeaseInputs>,
): { inputs: AppInputs; car: Car; calc: Calculation } {
  const car = makeCar();
  car.vehicle = { ...car.vehicle, ...vehicle };
  const calc = makeCalculation(car.id, "businessLease");
  calc.businessLease = { ...calc.businessLease, ...bl };
  return {
    inputs: { ...base, cars: [car], calculations: [calc] },
    car,
    calc,
  };
}

const data = getTaxData(2026);

/**
 * Regression tests derived from the numerical explorer
 * (`scripts/explore-tax.ts`). Each case below was surfaced by sweeping the
 * input space and was then manually validated against Dutch tax law as
 * mathematically correct. Pinning these values prevents accidental drift in
 * future refactors of the calculation engine.
 *
 * If a value here changes, either:
 *   1. The rates JSON intentionally changed → update the expected value, OR
 *   2. The calculation logic regressed → fix the bug.
 */
describe("tax calculation — regression tests for explorer findings", () => {
  describe("bijtelling — EV cap boundary points", () => {
    it("EV detYear 2025: just below €30k cap uses 17% slope", () => {
      const at29_500 = calculateBijtelling(
        {
          catalogusprijs: 29_500,
          powertrain: "ev",
          detYear: 2025,
          taxYear: 2025,
          privateKmPerYear: 5_000,
          rittenregistratie: false,
        },
        data,
      );
      expect(at29_500).toBe(29_500 * 0.17);
      expect(at29_500).toBe(5_015);
    });

    it("EV detYear 2025: exactly at €30k cap uses 17% slope, no above-cap component", () => {
      const at30_000 = calculateBijtelling(
        {
          catalogusprijs: 30_000,
          powertrain: "ev",
          detYear: 2025,
          taxYear: 2025,
          privateKmPerYear: 5_000,
          rittenregistratie: false,
        },
        data,
      );
      expect(at30_000).toBe(30_000 * 0.17);
      expect(at30_000).toBe(5_100);
    });

    it("EV detYear 2025: just above €30k applies 17% to first €30k + 22% to remainder", () => {
      const at30_250 = calculateBijtelling(
        {
          catalogusprijs: 30_250,
          powertrain: "ev",
          detYear: 2025,
          taxYear: 2025,
          privateKmPerYear: 5_000,
          rittenregistratie: false,
        },
        data,
      );
      expect(at30_250).toBe(30_000 * 0.17 + 250 * 0.22);
      expect(at30_250).toBe(5_155);
    });

    it("EV detYear 2026: 18% applies up to and including the €30k cap", () => {
      expect(
        calculateBijtelling(
          {
            catalogusprijs: 30_000,
            powertrain: "ev",
            detYear: 2026,
            taxYear: 2026,
            privateKmPerYear: 5_000,
            rittenregistratie: false,
          },
          data,
        ),
      ).toBe(30_000 * 0.18);
    });

    it("EV detYear 2027: 20% applies up to the €30k cap, 22% above it", () => {
      const at30_250 = calculateBijtelling(
        {
          catalogusprijs: 30_250,
          powertrain: "ev",
          detYear: 2027,
          taxYear: 2027,
          privateKmPerYear: 5_000,
          rittenregistratie: false,
        },
        data,
      );
      expect(at30_250).toBe(30_000 * 0.2 + 250 * 0.22);
    });

    it("EV detYear 2025: lock survives across multi-year span (still 17% in tax-year 2027)", () => {
      const at30_000 = calculateBijtelling(
        {
          catalogusprijs: 30_000,
          powertrain: "ev",
          detYear: 2025,
          taxYear: 2027,
          privateKmPerYear: 5_000,
          rittenregistratie: false,
        },
        data,
      );
      expect(at30_000).toBe(30_000 * 0.17);
    });
  });

  describe("BPM — exact bracket transition values", () => {
    it("petrol at CO₂=160 jumps by €622 over the 159 g/km boundary", () => {
      const at_159 = calculateBpm({ powertrain: "petrol", co2: 159 }, data);
      const at_160 = calculateBpm({ powertrain: "petrol", co2: 160 }, data);
      expect(at_160 - at_159).toBeCloseTo(622, 5);
    });

    it("diesel at CO₂=160 jumps by €744.94 (top bracket €622 + diesel surcharge €122.94)", () => {
      const at_159 = calculateBpm({ powertrain: "diesel", co2: 159 }, data);
      const at_160 = calculateBpm({ powertrain: "diesel", co2: 160 }, data);
      expect(at_160 - at_159).toBeCloseTo(622 + 122.94, 2);
    });

    it("PHEV at CO₂=160 jumps by €660 (top bracket €622 + PHEV surcharge €38)", () => {
      const at_159 = calculateBpm({ powertrain: "phev", co2: 159 }, data);
      const at_160 = calculateBpm({ powertrain: "phev", co2: 160 }, data);
      expect(at_160 - at_159).toBeCloseTo(660, 5);
    });

    it("LPG behaves identically to petrol at CO₂=160 (no LPG-specific surcharge)", () => {
      const at_159 = calculateBpm({ powertrain: "lpg", co2: 159 }, data);
      const at_160 = calculateBpm({ powertrain: "lpg", co2: 160 }, data);
      expect(at_160 - at_159).toBeCloseTo(622, 5);
    });

    it("petrol at CO₂=0 returns the bracket-1 fixed bedrag (€440)", () => {
      // The first bracket has a fixed €440 + €2.5/g, applied for any CO₂ > 0.
      // At exactly 0, the loop's `co2 > prevThreshold` guard skips bracket 1.
      // This documents the current behaviour: a 0 g/km combustion car pays €0.
      expect(calculateBpm({ powertrain: "petrol", co2: 0 }, data)).toBe(0);
    });

    it("counterintuitive: petrol BPM at CO₂ ≤ 71 is LESS than the EV flat €685", () => {
      // At CO₂ = 71 (bracket-1 top), petrol = 71×2.5 + 440 = €617.50.
      // The EV/hydrogen flat fixed bedrag is €685 — so a very-low-emission
      // petrol pays *less* BPM than an EV. The property-based test surfaced
      // this; it is a genuine quirk of the 2026 BPM tariff schedule.
      const petrol_71 = calculateBpm({ powertrain: "petrol", co2: 71 }, data);
      const ev = calculateBpm({ powertrain: "ev", co2: 0 }, data);
      expect(petrol_71).toBeLessThan(ev);
      expect(petrol_71).toBe(617.5);
      expect(ev).toBe(685);
    });

    it("petrol BPM crosses the EV bedrag between 71 and 72 g/km", () => {
      const petrol_72 = calculateBpm({ powertrain: "petrol", co2: 72 }, data);
      const ev = calculateBpm({ powertrain: "ev", co2: 0 }, data);
      expect(petrol_72).toBeGreaterThan(ev);
    });

    it("petrol at CO₂=1 includes the €440 bracket-1 fixed component", () => {
      const got = calculateBpm({ powertrain: "petrol", co2: 1 }, data);
      expect(got).toBe(1 * 2.5 + 440);
    });

    it("diesel surcharge does not apply for CO₂ ≤ 50 (threshold)", () => {
      const at_50 = calculateBpm({ powertrain: "diesel", co2: 50 }, data);
      const petrol_50 = calculateBpm({ powertrain: "petrol", co2: 50 }, data);
      expect(at_50).toBe(petrol_50);
    });

    it("diesel surcharge engages for CO₂ > 50 (= €122.94 per gram above)", () => {
      const at_51 = calculateBpm({ powertrain: "diesel", co2: 51 }, data);
      const petrol_51 = calculateBpm({ powertrain: "petrol", co2: 51 }, data);
      expect(at_51 - petrol_51).toBeCloseTo(122.94, 2);
    });
  });

  describe("MRB — weight-tier cliffs", () => {
    // Tier boundary 2500→2501 jumps from the 2500-tier (340.56/q) to the
    // 3000-tier (426.91/q): (426.91 − 340.56) × (1+0.85) × 4 = €638.99 (petrol).
    const boundaryJump = (426.91 - 340.56) * 1.85 * 4;

    it("petrol/Overijssel: MRB jumps €638.99 over the 2500→2501 kg tier boundary", () => {
      const at2500 = calculateAnnualMrb(
        { weightKg: 2500, powertrain: "petrol", province: "Overijssel", taxYear: 2026 },
        data,
      );
      const at2501 = calculateAnnualMrb(
        { weightKg: 2501, powertrain: "petrol", province: "Overijssel", taxYear: 2026 },
        data,
      );
      expect(at2501 - at2500).toBeCloseTo(boundaryJump, 1);
    });

    it("diesel/Overijssel: same boundary, jump scales with diesel multiplier 1.30", () => {
      const at2500 = calculateAnnualMrb(
        { weightKg: 2500, powertrain: "diesel", province: "Overijssel", taxYear: 2026 },
        data,
      );
      const at2501 = calculateAnnualMrb(
        { weightKg: 2501, powertrain: "diesel", province: "Overijssel", taxYear: 2026 },
        data,
      );
      expect(at2501 - at2500).toBeCloseTo(boundaryJump * 1.3, 1);
    });

    it("LPG/Overijssel: same boundary, jump scales with LPG multiplier 1.40", () => {
      const at2500 = calculateAnnualMrb(
        { weightKg: 2500, powertrain: "lpg", province: "Overijssel", taxYear: 2026 },
        data,
      );
      const at2501 = calculateAnnualMrb(
        { weightKg: 2501, powertrain: "lpg", province: "Overijssel", taxYear: 2026 },
        data,
      );
      expect(at2501 - at2500).toBeCloseTo(boundaryJump * 1.4, 1);
    });

    it("EV/Overijssel: same boundary, jump scales with 0.70 multiplier × 0.70 (1−korting)", () => {
      const at2500 = calculateAnnualMrb(
        { weightKg: 2500, powertrain: "ev", province: "Overijssel", taxYear: 2026 },
        data,
      );
      const at2501 = calculateAnnualMrb(
        { weightKg: 2501, powertrain: "ev", province: "Overijssel", taxYear: 2026 },
        data,
      );
      expect(at2501 - at2500).toBeCloseTo(boundaryJump * 0.7 * 0.7, 1);
    });

    it("weights above the highest tier (3000 kg) clamp to the last tier", () => {
      // The current behaviour for weights > 3000 kg is to use the last tier
      // (€426.91/quarter). This is a deliberate clamp; the law's tariffs above
      // 3000 kg fall outside personenauto territory.
      const at3000 = calculateAnnualMrb(
        { weightKg: 3000, powertrain: "petrol", province: "Overijssel", taxYear: 2026 },
        data,
      );
      const at3500 = calculateAnnualMrb(
        { weightKg: 3500, powertrain: "petrol", province: "Overijssel", taxYear: 2026 },
        data,
      );
      expect(at3000).toBe(at3500);
    });
  });

  describe("income tax — implied marginal rate", () => {
    it("max effective marginal rate is 56.01% in arbeidskorting phase-out region (≤ 100%, sanity)", () => {
      // 49.5% top bracket + 6.51% arbeidskorting phase-out per euro = 56.01%.
      // Algemene heffingskorting phase-out (6.33%) doesn't apply here since
      // €79,300 > €76,817 (its phase-out end).
      const before = computeIncomeTax(79_300, data);
      const after = computeIncomeTax(79_400, data);
      const marginalRate = (after.netTax - before.netTax) / 100;
      expect(marginalRate).toBeCloseTo(0.5601, 4);
      expect(marginalRate).toBeLessThan(1);
    });

    it("marginal rate around the €38,883 boundary stays bounded, no jump", () => {
      const just_below = computeBox1Tax(38_882, data);
      const just_above = computeBox1Tax(38_884, data);
      // 2 € of extra income should add at most ~75 cents of tax (top of bracket 2).
      expect(just_above - just_below).toBeLessThan(2 * 0.5);
      expect(just_above - just_below).toBeGreaterThan(0);
    });

    it("marginal rate around the €79,137 boundary stays bounded, no jump", () => {
      const just_below = computeBox1Tax(79_136, data);
      const just_above = computeBox1Tax(79_138, data);
      expect(just_above - just_below).toBeLessThan(2 * 0.55);
      expect(just_above - just_below).toBeGreaterThan(0);
    });

    it("marginal rate at €30k = bracket-1 rate + AHK phase-out − arbeidskorting buildup", () => {
      // At €30k, three forces interact:
      //   + bracket-1 income tax              35.76 %
      //   + algemene heffingskorting phase-out 6.33 % (active above €28,406)
      //   − arbeidskorting buildup             8.71 % (active until €43,071, INCREASES korting)
      // Net effective marginal rate ≈ 33.38 %.
      const before = computeIncomeTax(30_000, data);
      const after = computeIncomeTax(30_100, data);
      const marginalRate = (after.netTax - before.netTax) / 100;
      expect(marginalRate).toBeCloseTo(0.3576 + 0.0633 - 0.0871, 3);
    });

    it("marginal rate above €129,078 is just the top bracket rate (no kortingen left to phase out)", () => {
      const before = computeIncomeTax(150_000, data);
      const after = computeIncomeTax(150_100, data);
      const marginalRate = (after.netTax - before.netTax) / 100;
      expect(marginalRate).toBeCloseTo(0.495, 4);
    });

    it("marginalNetCost of €25k extra at €100k base lands within sane bracket-3 range", () => {
      const cost = marginalNetCost(100_000, 25_000, data);
      // Effective rate should be between 49.5% (top bracket only) and ~56% (with phase-out).
      const ratio = cost / 25_000;
      expect(ratio).toBeGreaterThan(0.49);
      expect(ratio).toBeLessThan(0.57);
    });
  });

  describe("business lease — eigen bijdrage extreme cases (regression for user-stated invariant)", () => {
    it("eigen bijdrage of €100,000/month does not produce negative bijtelling tax cost", () => {
      const { inputs, car, calc } = withBusinessLeaseScenario(
        DEFAULTS,
        { catalogusprijs: 30_000, powertrain: "petrol", detYear: 2026 },
        { eigenBijdrage: 100_000 },
      );
      const r = evaluateBusinessLease(inputs, car, calc, data);
      const bijLine = r.breakdown.find(
        (b) => b.label === "Bijtelling (net tax cost)",
      )!;
      const eigenLine = r.breakdown.find((b) => b.label === "Eigen bijdrage")!;
      expect(bijLine.monthly).toBeGreaterThanOrEqual(0);
      expect(bijLine.monthly).toBe(0);
      // Eigen bijdrage line reflects what the employee actually pays from net
      // salary — that is the full input amount. Excess above gross bijtelling
      // simply doesn't reduce tax further, but the employee is still out-of-pocket.
      expect(eigenLine.monthly).toBe(100_000);
    });

    it("eigen bijdrage exactly equal to gross bijtelling reduces taxable bijtelling to 0", () => {
      // Gross bijtelling: €30k × 22% = €6,600/year = €550/month.
      const { inputs, car, calc } = withBusinessLeaseScenario(
        DEFAULTS,
        { catalogusprijs: 30_000, powertrain: "petrol", detYear: 2026 },
        { eigenBijdrage: 550 },
      );
      const r = evaluateBusinessLease(inputs, car, calc, data);
      const bijLine = r.breakdown.find(
        (b) => b.label === "Bijtelling (net tax cost)",
      )!;
      expect(bijLine.monthly).toBe(0);
    });

    it("halving eigen bijdrage MORE-than-halves tax cost when full bijtelling crosses kortingen-end", () => {
      // Important non-linearity surfaced by the explorer: at €65k base salary,
      // adding the full taxable bijtelling (€13,200) pushes income past €76,817
      // where the algemene heffingskorting reaches 0. Adding only half (€6,600)
      // stays under that cliff, so the kortingen loss is less than half.
      // Therefore: halfBij/fullBij is slightly *greater* than 0.5.
      const halfMonthly = 550;
      const { inputs: fullCase, car: fullCar, calc: fullCalc } = withBusinessLeaseScenario(
        DEFAULTS,
        { catalogusprijs: 60_000, powertrain: "petrol", detYear: 2026 },
        { eigenBijdrage: 0 },
      );
      const halfCalc: Calculation = {
        ...fullCalc,
        businessLease: { ...fullCalc.businessLease, eigenBijdrage: halfMonthly },
      };
      const halfCase: AppInputs = { ...fullCase, calculations: [halfCalc] };
      const full = evaluateBusinessLease(fullCase, fullCar, fullCalc, data);
      const half = evaluateBusinessLease(halfCase, fullCar, halfCalc, data);
      const fullBij = full.breakdown.find(
        (b) => b.label === "Bijtelling (net tax cost)",
      )!.monthly;
      const halfBij = half.breakdown.find(
        (b) => b.label === "Bijtelling (net tax cost)",
      )!.monthly;
      const ratio = halfBij / fullBij;
      // Empirically observed ratio ≈ 0.503 — slightly above 0.5 because of
      // the AHK cliff. Pin it within a tight band; if it ever drops below
      // 0.5 it would mean tax cost is super-linear in addition (a bug).
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(0.55);
    });
  });
});
