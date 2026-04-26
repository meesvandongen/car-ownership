import { describe, expect, it } from "vitest";
import { compareAll } from "./compare";
import { sweep, suggestRange } from "./sensitivity";
import { DEFAULTS, makeCalculation, makeCar } from "../defaults";
import type {
  AppInputs,
  Calculation,
  ScenarioKind,
  ScenarioResult,
} from "./types";

function byKind(r: { results: ScenarioResult[] }, kind: ScenarioKind): ScenarioResult {
  const found = r.results.find((s) => s.kind === kind);
  if (!found) throw new Error(`no calculation of kind ${kind} in result`);
  return found;
}

function patchCalc(
  inputs: AppInputs,
  kind: ScenarioKind,
  patch: (c: Calculation) => Calculation,
): AppInputs {
  return {
    ...inputs,
    calculations: inputs.calculations.map((c) => (c.kind === kind ? patch(c) : c)),
  };
}

describe("compareAll", () => {
  it("produces a result for each calculation with finite numbers", () => {
    const r = compareAll(DEFAULTS);
    expect(r.results.length).toBe(DEFAULTS.calculations.length);
    for (const s of r.results) {
      expect(Number.isFinite(s.netMonthly)).toBe(true);
      expect(Number.isFinite(s.grossMonthly)).toBe(true);
      expect(Number.isFinite(s.totalCost)).toBe(true);
    }
  });

  it("results carry the car label so multi-car comparisons stay legible", () => {
    const r = compareAll(DEFAULTS);
    for (const s of r.results) {
      expect(s.carLabel.length).toBeGreaterThan(0);
      expect(s.carId).toBe(DEFAULTS.cars[0].id);
    }
  });

  it("business lease net cost rises when bijtelling is taken (vs zero-bijtelling)", () => {
    const withBijtelling = compareAll(DEFAULTS);
    const noBij: AppInputs = patchCalc(
      {
        ...DEFAULTS,
        drivingProfile: { ...DEFAULTS.drivingProfile, privateKm: 100 },
      },
      "businessLease",
      (c) => ({
        ...c,
        businessLease: { ...c.businessLease, rittenregistratie: true },
      }),
    );
    const withoutBijtelling = compareAll(noBij);
    expect(byKind(withBijtelling, "businessLease").netMonthly).toBeGreaterThan(
      byKind(withoutBijtelling, "businessLease").netMonthly,
    );
  });

  it("doubling annual km significantly increases ownership net cost", () => {
    const base = compareAll(DEFAULTS);
    const more = compareAll({
      ...DEFAULTS,
      drivingProfile: {
        ...DEFAULTS.drivingProfile,
        annualKm: DEFAULTS.drivingProfile.annualKm * 2,
      },
    });
    expect(byKind(more, "ownership").netMonthly).toBeGreaterThan(
      byKind(base, "ownership").netMonthly,
    );
  });

  it("opportunity cost increases ownership net cost (capital tied up)", () => {
    const noOpp = compareAll({ ...DEFAULTS, opportunityCostRate: 0 });
    const withOpp = compareAll({ ...DEFAULTS, opportunityCostRate: 0.05 });
    expect(byKind(withOpp, "ownership").netMonthly).toBeGreaterThan(
      byKind(noOpp, "ownership").netMonthly,
    );
  });

  it("opportunity cost increases private lease cost when there's a down payment", () => {
    const inputs = patchCalc(DEFAULTS, "privateLease", (c) => ({
      ...c,
      privateLease: { ...c.privateLease, downPayment: 5_000 },
    }));
    const noOpp = compareAll({ ...inputs, opportunityCostRate: 0 });
    const withOpp = compareAll({ ...inputs, opportunityCostRate: 0.05 });
    expect(byKind(withOpp, "privateLease").netMonthly).toBeGreaterThan(
      byKind(noOpp, "privateLease").netMonthly,
    );
  });

  it("opportunity cost does not affect business lease (no capital tied up)", () => {
    const noOpp = compareAll({ ...DEFAULTS, opportunityCostRate: 0 });
    const withOpp = compareAll({ ...DEFAULTS, opportunityCostRate: 0.1 });
    expect(byKind(withOpp, "businessLease").netMonthly).toBe(
      byKind(noOpp, "businessLease").netMonthly,
    );
  });

  it("salary sacrifice increases business lease net cost", () => {
    const noSacrifice = compareAll(DEFAULTS);
    const withSacrifice = compareAll(
      patchCalc(DEFAULTS, "businessLease", (c) => ({
        ...c,
        businessLease: { ...c.businessLease, salarySacrificeMonthly: 500 },
      })),
    );
    expect(byKind(withSacrifice, "businessLease").netMonthly).toBeGreaterThan(
      byKind(noSacrifice, "businessLease").netMonthly,
    );
  });

  it("salary sacrifice net cost is less than the gross sacrifice (tax saved)", () => {
    const noSacrifice = compareAll(DEFAULTS);
    const sacrificeAmount = 500;
    const withSacrifice = compareAll(
      patchCalc(DEFAULTS, "businessLease", (c) => ({
        ...c,
        businessLease: {
          ...c.businessLease,
          salarySacrificeMonthly: sacrificeAmount,
        },
      })),
    );
    const delta =
      byKind(withSacrifice, "businessLease").netMonthly -
      byKind(noSacrifice, "businessLease").netMonthly;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(sacrificeAmount);
  });

  it("totalCost honours the comparisonMonths horizon for all calculations", () => {
    const r36 = compareAll({ ...DEFAULTS, comparisonMonths: 36 });
    const r60 = compareAll({ ...DEFAULTS, comparisonMonths: 60 });
    for (const kind of ["ownership", "privateLease", "businessLease"] as const) {
      expect(byKind(r36, kind).totalCost).toBeCloseTo(
        byKind(r36, kind).netMonthly * 36,
        5,
      );
      expect(byKind(r60, kind).totalCost).toBeCloseTo(
        byKind(r60, kind).netMonthly * 60,
        5,
      );
    }
  });

  it("ownership totalCost no longer truncates when holding < comparison horizon", () => {
    const r = compareAll({
      ...patchCalc(DEFAULTS, "ownership", (c) => ({
        ...c,
        ownership: { ...c.ownership, holdingMonths: 36 },
      })),
      comparisonMonths: 60,
    });
    const o = byKind(r, "ownership");
    expect(o.totalCost).toBeCloseTo(o.netMonthly * 60, 5);
  });

  it("two calculations on the SAME car share vehicle inputs (no duplication)", () => {
    // Two ownership calcs on one car: changing the car's catalogusprijs changes
    // *both* calculations' cost components, proving they share storage.
    const car = makeCar("Tesla Model 3");
    const calcA = makeCalculation(car.id, "ownership", "5-year");
    const calcB = makeCalculation(car.id, "ownership", "3-year");
    calcB.ownership.holdingMonths = 36;
    calcB.ownership.residualValue = 24_000;
    const baseInputs: AppInputs = {
      ...DEFAULTS,
      cars: [car],
      calculations: [calcA, calcB],
    };
    const baseline = compareAll(baseInputs).results;
    const moved = compareAll({
      ...baseInputs,
      cars: [{ ...car, vehicle: { ...car.vehicle, aanschafprijs: car.vehicle.aanschafprijs * 1.5 } }],
    }).results;
    expect(moved[0].netMonthly).toBeGreaterThan(baseline[0].netMonthly);
    expect(moved[1].netMonthly).toBeGreaterThan(baseline[1].netMonthly);
  });

  it("supports calculations across multiple cars", () => {
    const carA = makeCar("Cheap car");
    const carB = makeCar("Premium car");
    carB.vehicle = {
      ...carB.vehicle,
      catalogusprijs: carA.vehicle.catalogusprijs * 1.5,
      aanschafprijs: carA.vehicle.aanschafprijs * 1.5,
    };
    const calcA = makeCalculation(carA.id, "ownership", "Cheap (own)");
    const calcB = makeCalculation(carB.id, "ownership", "Premium (own)");
    const r = compareAll({
      ...DEFAULTS,
      cars: [carA, carB],
      calculations: [calcA, calcB],
    });
    expect(r.results.length).toBe(2);
    expect(r.results[1].netMonthly).toBeGreaterThan(r.results[0].netMonthly);
    expect(r.results[0].carLabel).toBe("Cheap car");
    expect(r.results[1].carLabel).toBe("Premium car");
  });

  it("emits a warning when a calculation references a missing car", () => {
    const car = DEFAULTS.cars[0];
    const orphan = makeCalculation("car-does-not-exist", "ownership", "Orphan");
    const inputs: AppInputs = {
      ...DEFAULTS,
      cars: [car],
      calculations: [...DEFAULTS.calculations, orphan],
    };
    const r = compareAll(inputs);
    expect(r.results.find((x) => x.id === orphan.id)).toBeUndefined();
    expect(r.warnings.some((w) => w.includes("Orphan"))).toBe(true);
  });
});

describe("sensitivity sweep", () => {
  it("returns one comparison per range value (shared variable affects all)", () => {
    const range = suggestRange(DEFAULTS, "annualKm", 11);
    const points = sweep(DEFAULTS, "annualKm", range);
    expect(points).toHaveLength(11);
    for (const p of points) {
      for (const s of p.result.results) {
        expect(Number.isFinite(s.netMonthly)).toBe(true);
      }
    }
  });

  it("car-scoped sweep only affects calculations of that car", () => {
    const carA = makeCar("A");
    const carB = makeCar("B");
    const calcA = makeCalculation(carA.id, "ownership", "A-own");
    const calcB = makeCalculation(carB.id, "ownership", "B-own");
    const inputs: AppInputs = {
      ...DEFAULTS,
      cars: [carA, carB],
      calculations: [calcA, calcB],
    };
    const range = suggestRange(inputs, "catalogusprijs", 5, {
      kind: "car",
      carId: carA.id,
    });
    const points = sweep(inputs, "catalogusprijs", range, {
      kind: "car",
      carId: carA.id,
    });
    const baselineB = compareAll(inputs).results.find((r) => r.id === calcB.id)!.netMonthly;
    for (const p of points) {
      const bRes = p.result.results.find((r) => r.id === calcB.id)!;
      expect(bRes.netMonthly).toBe(baselineB);
    }
  });

  it("calculation-scoped sweep only affects the chosen calculation", () => {
    const ownershipCalc = DEFAULTS.calculations.find((c) => c.kind === "ownership")!;
    const range = suggestRange(DEFAULTS, "residualValue", 5, {
      kind: "calculation",
      calculationId: ownershipCalc.id,
    });
    const points = sweep(DEFAULTS, "residualValue", range, {
      kind: "calculation",
      calculationId: ownershipCalc.id,
    });
    const baselineLease = compareAll(DEFAULTS).results.find(
      (r) => r.kind === "privateLease",
    )!.netMonthly;
    for (const p of points) {
      const lease = p.result.results.find((r) => r.kind === "privateLease")!;
      expect(lease.netMonthly).toBe(baselineLease);
    }
  });
});
