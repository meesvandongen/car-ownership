import { describe, it } from "vitest";
import fc from "fast-check";
import { evaluateBusinessLease } from "./businessLease";
import { getTaxData } from "../taxData";
import { DEFAULTS, makeCalculation, makeCar } from "../../defaults";
import type { AppInputs, Calculation, Car, Powertrain, Province } from "../types";

const data = getTaxData(2026);
const provinces = Object.keys(data.provinces) as Province[];
const powertrains: Powertrain[] = ["ev", "hydrogen", "phev", "petrol", "diesel", "lpg"];

interface Bundle {
  inputs: AppInputs;
  car: Car;
  calc: Calculation;
}

const arbBundle = (): fc.Arbitrary<Bundle> =>
  fc
    .record({
      catalogusprijs: fc.double({ min: 1_000, max: 200_000, noNaN: true }),
      powertrain: fc.constantFrom(...powertrains),
      detYear: fc.integer({ min: 2020, max: 2030 }),
      province: fc.constantFrom(...provinces),
      weightKg: fc.double({ min: 700, max: 2900, noNaN: true }),
      annualKm: fc.double({ min: 1_000, max: 60_000, noNaN: true }),
      privateFraction: fc.double({ min: 0, max: 1, noNaN: true }),
      bruto: fc.double({ min: 15_000, max: 250_000, noNaN: true }),
      eigenBijdrageMonthly: fc.double({ min: 0, max: 5_000, noNaN: true }),
      fuelPaidByEmployee: fc.boolean(),
      rittenregistratie: fc.boolean(),
      salarySacrificeMonthly: fc.double({ min: 0, max: 3_000, noNaN: true }),
      taxYear: fc.integer({ min: 2026, max: 2030 }),
    })
    .map((p) => {
      const car = makeCar();
      car.vehicle = {
        ...car.vehicle,
        catalogusprijs: p.catalogusprijs,
        aanschafprijs: p.catalogusprijs * 0.93,
        powertrain: p.powertrain,
        detYear: p.detYear,
        weightKg: p.weightKg,
      };
      const calc = makeCalculation(car.id, "businessLease");
      calc.businessLease = {
        ...calc.businessLease,
        eigenBijdrage: p.eigenBijdrageMonthly,
        fuelPaidByEmployee: p.fuelPaidByEmployee,
        rittenregistratie: p.rittenregistratie,
        salarySacrificeMonthly: p.salarySacrificeMonthly,
      };
      const inputs: AppInputs = {
        ...DEFAULTS,
        taxYear: p.taxYear,
        drivingProfile: {
          ...DEFAULTS.drivingProfile,
          province: p.province,
          privateKm: p.annualKm * p.privateFraction,
          businessKm: p.annualKm * (1 - p.privateFraction),
        },
        salary: { ...DEFAULTS.salary, bruto: p.bruto },
        cars: [car],
        calculations: [calc],
      };
      return { inputs, car, calc };
    });

describe("businessLease — property-based invariants", () => {
  it("grossMonthly is never negative for any input combination", () => {
    fc.assert(
      fc.property(arbBundle(), ({ inputs, car, calc }) => {
        const r = evaluateBusinessLease(inputs, car, calc, data);
        return r.grossMonthly >= -1e-6 && Number.isFinite(r.grossMonthly);
      }),
      { numRuns: 2000 },
    );
  });

  it("CRITICAL: a very high eigen bijdrage cannot create a negative bijtelling component", () => {
    fc.assert(
      fc.property(
        arbBundle(),
        fc.double({ min: 0, max: 50_000, noNaN: true }),
        ({ inputs, car, calc }, hugeEigenBijdrage) => {
          const adjusted: Calculation = {
            ...calc,
            businessLease: {
              ...calc.businessLease,
              eigenBijdrage: hugeEigenBijdrage,
            },
          };
          const adjustedInputs: AppInputs = {
            ...inputs,
            calculations: [adjusted],
          };
          const r = evaluateBusinessLease(adjustedInputs, car, adjusted, data);
          const bijtellingLine = r.breakdown.find(
            (b) => b.label === "Bijtelling (net tax cost)",
          );
          if (!bijtellingLine) return false;
          const eigenLine = r.breakdown.find((b) => b.label === "Eigen bijdrage");
          if (!eigenLine) return false;
          return bijtellingLine.monthly >= -1e-6 && eigenLine.monthly >= -1e-6;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("eigen bijdrage line item equals the user's monthly contribution from net salary", () => {
    fc.assert(
      fc.property(arbBundle(), ({ inputs, car, calc }) => {
        const r = evaluateBusinessLease(inputs, car, calc, data);
        const eigenLine = r.breakdown.find((b) => b.label === "Eigen bijdrage")!;
        // The line item reflects what the employee actually pays from net salary.
        // The 1:1 cap with gross bijtelling only governs how much tax is saved,
        // not the user's out-of-pocket cost.
        return Math.abs(eigenLine.monthly - calc.businessLease.eigenBijdrage) < 1e-6;
      }),
      { numRuns: 1000 },
    );
  });

  it("increasing eigen bijdrage never decreases the user's total monthly burden by less than the increase", () => {
    fc.assert(
      fc.property(
        arbBundle(),
        fc.double({ min: 1, max: 1_000, noNaN: true }),
        ({ inputs, car, calc }, deltaMonthly) => {
          const before = evaluateBusinessLease(inputs, car, calc, data);
          const next: Calculation = {
            ...calc,
            businessLease: {
              ...calc.businessLease,
              eigenBijdrage: calc.businessLease.eigenBijdrage + deltaMonthly,
            },
          };
          const nextInputs: AppInputs = { ...inputs, calculations: [next] };
          const after = evaluateBusinessLease(nextInputs, car, next, data);
          return after.grossMonthly >= before.grossMonthly - 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("rittenregistratie + privateKm < 500 → bijtelling component is exactly 0", () => {
    fc.assert(
      fc.property(
        arbBundle(),
        fc.double({ min: 0, max: 499, noNaN: true }),
        ({ inputs, car, calc }, lowPrivateKm) => {
          const adjustedCalc: Calculation = {
            ...calc,
            businessLease: { ...calc.businessLease, rittenregistratie: true },
          };
          const adjustedInputs: AppInputs = {
            ...inputs,
            drivingProfile: { ...inputs.drivingProfile, privateKm: lowPrivateKm },
            calculations: [adjustedCalc],
          };
          const r = evaluateBusinessLease(adjustedInputs, car, adjustedCalc, data);
          const line = r.breakdown.find(
            (b) => b.label === "Bijtelling (net tax cost)",
          )!;
          return Math.abs(line.monthly) < 1e-6;
        },
      ),
      { numRuns: 500 },
    );
  });
});
