import { describe, it } from "vitest";
import fc from "fast-check";
import { evaluateBusinessLease } from "./businessLease";
import { getTaxData } from "../taxData";
import { DEFAULTS, makeScenario } from "../../defaults";
import type { AppInputs, Powertrain, Province, Scenario } from "../types";

const data = getTaxData(2026);
const provinces = Object.keys(data.provinces) as Province[];
const powertrains: Powertrain[] = ["ev", "hydrogen", "phev", "petrol", "diesel", "lpg"];

interface Bundle {
  inputs: AppInputs;
  scenario: Scenario;
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
      fuelCardPrivate: fc.boolean(),
      rittenregistratie: fc.boolean(),
      salarySacrificeMonthly: fc.double({ min: 0, max: 3_000, noNaN: true }),
      taxYear: fc.integer({ min: 2026, max: 2030 }),
    })
    .map((p) => {
      const scenario = makeScenario("businessLease");
      scenario.vehicle = {
        ...scenario.vehicle,
        catalogusprijs: p.catalogusprijs,
        aanschafprijs: p.catalogusprijs * 0.93,
        powertrain: p.powertrain,
        detYear: p.detYear,
        weightKg: p.weightKg,
      };
      scenario.businessLease = {
        ...scenario.businessLease,
        eigenBijdrage: p.eigenBijdrageMonthly,
        fuelCardPrivate: p.fuelCardPrivate,
        rittenregistratie: p.rittenregistratie,
        salarySacrificeMonthly: p.salarySacrificeMonthly,
      };
      const inputs: AppInputs = {
        ...DEFAULTS,
        taxYear: p.taxYear,
        drivingProfile: {
          ...DEFAULTS.drivingProfile,
          province: p.province,
          annualKm: p.annualKm,
          privateKm: p.annualKm * p.privateFraction,
          businessKm: p.annualKm * (1 - p.privateFraction) * 0.5,
          commuteKm: p.annualKm * (1 - p.privateFraction) * 0.5,
        },
        salary: { ...DEFAULTS.salary, bruto: p.bruto },
        scenarios: [scenario],
      };
      return { inputs, scenario };
    });

describe("businessLease — property-based invariants", () => {
  it("grossMonthly is never negative for any input combination", () => {
    fc.assert(
      fc.property(arbBundle(), ({ inputs, scenario }) => {
        const r = evaluateBusinessLease(inputs, scenario, data);
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
        ({ inputs, scenario }, hugeEigenBijdrage) => {
          const adjusted: Scenario = {
            ...scenario,
            businessLease: {
              ...scenario.businessLease,
              eigenBijdrage: hugeEigenBijdrage,
            },
          };
          const adjustedInputs: AppInputs = {
            ...inputs,
            scenarios: [adjusted],
          };
          const r = evaluateBusinessLease(adjustedInputs, adjusted, data);
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

  it("eigen bijdrage line item never exceeds the gross bijtelling (1:1 cap)", () => {
    fc.assert(
      fc.property(arbBundle(), ({ inputs, scenario }) => {
        const r = evaluateBusinessLease(inputs, scenario, data);
        const eigenLine = r.breakdown.find((b) => b.label === "Eigen bijdrage")!;
        return eigenLine.monthly <= scenario.businessLease.eigenBijdrage + 1e-6;
      }),
      { numRuns: 1000 },
    );
  });

  it("increasing eigen bijdrage never decreases the user's total monthly burden by less than the increase", () => {
    fc.assert(
      fc.property(
        arbBundle(),
        fc.double({ min: 1, max: 1_000, noNaN: true }),
        ({ inputs, scenario }, deltaMonthly) => {
          const before = evaluateBusinessLease(inputs, scenario, data);
          const next: Scenario = {
            ...scenario,
            businessLease: {
              ...scenario.businessLease,
              eigenBijdrage: scenario.businessLease.eigenBijdrage + deltaMonthly,
            },
          };
          const nextInputs: AppInputs = { ...inputs, scenarios: [next] };
          const after = evaluateBusinessLease(nextInputs, next, data);
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
        ({ inputs, scenario }, lowPrivateKm) => {
          const adjustedScenario: Scenario = {
            ...scenario,
            businessLease: { ...scenario.businessLease, rittenregistratie: true },
          };
          const adjustedInputs: AppInputs = {
            ...inputs,
            drivingProfile: { ...inputs.drivingProfile, privateKm: lowPrivateKm },
            scenarios: [adjustedScenario],
          };
          const r = evaluateBusinessLease(adjustedInputs, adjustedScenario, data);
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
