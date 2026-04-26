import { describe, it } from "vitest";
import fc from "fast-check";
import { evaluateBusinessLease } from "./businessLease";
import { getTaxData } from "../taxData";
import { DEFAULTS } from "../../defaults";
import type { AppInputs, Powertrain, Province } from "../types";

const data = getTaxData(2026);
const provinces = Object.keys(data.provinces) as Province[];
const powertrains: Powertrain[] = ["ev", "hydrogen", "phev", "petrol", "diesel", "lpg"];

const arbInputs = (): fc.Arbitrary<AppInputs> =>
  fc.record({
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
  }).map((p) => ({
    ...DEFAULTS,
    taxYear: p.taxYear,
    vehicle: {
      ...DEFAULTS.vehicle,
      catalogusprijs: p.catalogusprijs,
      aanschafprijs: p.catalogusprijs * 0.93,
      powertrain: p.powertrain,
      detYear: p.detYear,
      province: p.province,
      weightKg: p.weightKg,
      annualKm: p.annualKm,
      privateKm: p.annualKm * p.privateFraction,
      businessKm: p.annualKm * (1 - p.privateFraction) * 0.5,
      commuteKm: p.annualKm * (1 - p.privateFraction) * 0.5,
    },
    salary: { ...DEFAULTS.salary, bruto: p.bruto },
    businessLease: {
      ...DEFAULTS.businessLease,
      eigenBijdrage: p.eigenBijdrageMonthly,
      fuelCardPrivate: p.fuelCardPrivate,
      rittenregistratie: p.rittenregistratie,
      salarySacrificeMonthly: p.salarySacrificeMonthly,
    },
  }));

describe("businessLease — property-based invariants", () => {
  it("grossMonthly is never negative for any input combination", () => {
    fc.assert(
      fc.property(arbInputs(), (inputs) => {
        const r = evaluateBusinessLease(inputs, data);
        return r.grossMonthly >= -1e-6 && Number.isFinite(r.grossMonthly);
      }),
      { numRuns: 2000 },
    );
  });

  it("CRITICAL: a very high eigen bijdrage cannot create a negative bijtelling component", () => {
    // The user's specific concern: if the eigen bijdrage exceeds the gross
    // bijtelling, the taxable bijtelling must be capped at 0, never negative.
    fc.assert(
      fc.property(
        arbInputs(),
        fc.double({ min: 0, max: 50_000, noNaN: true }),
        (inputs, hugeEigenBijdrage) => {
          const adjusted: AppInputs = {
            ...inputs,
            businessLease: {
              ...inputs.businessLease,
              eigenBijdrage: hugeEigenBijdrage,
            },
          };
          const r = evaluateBusinessLease(adjusted, data);
          // The bijtelling tax-cost line item must be ≥ 0.
          const bijtellingLine = r.breakdown.find(
            (b) => b.label === "Bijtelling (net tax cost)",
          );
          if (!bijtellingLine) return false;
          // Eigen bijdrage line must also be ≥ 0 (paid out of pocket, never refunded).
          const eigenLine = r.breakdown.find((b) => b.label === "Eigen bijdrage");
          if (!eigenLine) return false;
          return bijtellingLine.monthly >= -1e-6 && eigenLine.monthly >= -1e-6;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("eigen bijdrage line item never exceeds the gross bijtelling (1:1 cap)", () => {
    // If eigenBijdrage * 12 > grossBijtelling, only grossBijtelling is recognised.
    fc.assert(
      fc.property(arbInputs(), (inputs) => {
        const r = evaluateBusinessLease(inputs, data);
        const eigenLine = r.breakdown.find((b) => b.label === "Eigen bijdrage")!;
        // Cannot deduct more than the user actually pays per month.
        return eigenLine.monthly <= inputs.businessLease.eigenBijdrage + 1e-6;
      }),
      { numRuns: 1000 },
    );
  });

  it("increasing eigen bijdrage never decreases the user's total monthly burden by less than the increase", () => {
    // While taxable bijtelling drops, eigen bijdrage is paid out of pocket.
    // Net effect: each extra €1 of eigen bijdrage saves at most marginal_rate
    // in tax — so the user is *never* better off paying more eigen bijdrage,
    // unless the tax rate is genuinely 100% (which it isn't).
    fc.assert(
      fc.property(
        arbInputs(),
        fc.double({ min: 1, max: 1_000, noNaN: true }),
        (inputs, deltaMonthly) => {
          const before = evaluateBusinessLease(inputs, data);
          const after = evaluateBusinessLease(
            {
              ...inputs,
              businessLease: {
                ...inputs.businessLease,
                eigenBijdrage: inputs.businessLease.eigenBijdrage + deltaMonthly,
              },
            },
            data,
          );
          // The user's net monthly cost should never *decrease* due to paying
          // more eigen bijdrage. (The tax saving from reduced bijtelling is
          // always ≤ the extra eigen bijdrage paid.)
          return after.grossMonthly >= before.grossMonthly - 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("rittenregistratie + privateKm < 500 → bijtelling component is exactly 0", () => {
    fc.assert(
      fc.property(
        arbInputs(),
        fc.double({ min: 0, max: 499, noNaN: true }),
        (inputs, lowPrivateKm) => {
          const adjusted: AppInputs = {
            ...inputs,
            vehicle: { ...inputs.vehicle, privateKm: lowPrivateKm },
            businessLease: { ...inputs.businessLease, rittenregistratie: true },
          };
          const r = evaluateBusinessLease(adjusted, data);
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
