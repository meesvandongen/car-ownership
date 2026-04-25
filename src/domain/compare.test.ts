import { describe, expect, it } from "vitest";
import { compareAll } from "./compare";
import { sweep, suggestRange } from "./sensitivity";
import { DEFAULTS } from "../defaults";

describe("compareAll", () => {
  it("produces a result for each scenario with finite numbers", () => {
    const r = compareAll(DEFAULTS);
    for (const s of [r.ownership, r.privateLease, r.businessLease]) {
      expect(Number.isFinite(s.netMonthly)).toBe(true);
      expect(Number.isFinite(s.grossMonthly)).toBe(true);
      expect(Number.isFinite(s.totalCost)).toBe(true);
    }
  });

  it("business lease net cost rises when bijtelling is taken (vs zero-bijtelling)", () => {
    const withBijtelling = compareAll(DEFAULTS);
    const withoutBijtelling = compareAll({
      ...DEFAULTS,
      vehicle: { ...DEFAULTS.vehicle, privateKm: 100 },
      businessLease: { ...DEFAULTS.businessLease, rittenregistratie: true },
    });
    expect(withBijtelling.businessLease.netMonthly).toBeGreaterThan(
      withoutBijtelling.businessLease.netMonthly,
    );
  });

  it("doubling annual km significantly increases ownership net cost", () => {
    const base = compareAll(DEFAULTS);
    const more = compareAll({
      ...DEFAULTS,
      vehicle: { ...DEFAULTS.vehicle, annualKm: DEFAULTS.vehicle.annualKm * 2 },
    });
    expect(more.ownership.netMonthly).toBeGreaterThan(base.ownership.netMonthly);
  });

  it("opportunity cost increases ownership net cost (capital tied up)", () => {
    const noOpp = compareAll({ ...DEFAULTS, opportunityCostRate: 0 });
    const withOpp = compareAll({ ...DEFAULTS, opportunityCostRate: 0.05 });
    expect(withOpp.ownership.netMonthly).toBeGreaterThan(noOpp.ownership.netMonthly);
  });

  it("opportunity cost increases private lease cost when there's a down payment", () => {
    const inputs = {
      ...DEFAULTS,
      privateLease: { ...DEFAULTS.privateLease, downPayment: 5_000 },
    };
    const noOpp = compareAll({ ...inputs, opportunityCostRate: 0 });
    const withOpp = compareAll({ ...inputs, opportunityCostRate: 0.05 });
    expect(withOpp.privateLease.netMonthly).toBeGreaterThan(noOpp.privateLease.netMonthly);
  });

  it("opportunity cost does not affect business lease (no capital tied up)", () => {
    const noOpp = compareAll({ ...DEFAULTS, opportunityCostRate: 0 });
    const withOpp = compareAll({ ...DEFAULTS, opportunityCostRate: 0.1 });
    expect(withOpp.businessLease.netMonthly).toBe(noOpp.businessLease.netMonthly);
  });

  it("salary sacrifice increases business lease net cost", () => {
    const noSacrifice = compareAll(DEFAULTS);
    const withSacrifice = compareAll({
      ...DEFAULTS,
      businessLease: { ...DEFAULTS.businessLease, salarySacrificeMonthly: 500 },
    });
    expect(withSacrifice.businessLease.netMonthly).toBeGreaterThan(
      noSacrifice.businessLease.netMonthly,
    );
  });

  it("salary sacrifice net cost is less than the gross sacrifice (tax saved)", () => {
    const noSacrifice = compareAll(DEFAULTS);
    const sacrificeAmount = 500;
    const withSacrifice = compareAll({
      ...DEFAULTS,
      businessLease: {
        ...DEFAULTS.businessLease,
        salarySacrificeMonthly: sacrificeAmount,
      },
    });
    const delta =
      withSacrifice.businessLease.netMonthly - noSacrifice.businessLease.netMonthly;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(sacrificeAmount);
  });

  it("totalCost honours the comparisonMonths horizon for all scenarios", () => {
    const r36 = compareAll({ ...DEFAULTS, comparisonMonths: 36 });
    const r60 = compareAll({ ...DEFAULTS, comparisonMonths: 60 });
    for (const key of ["ownership", "privateLease", "businessLease"] as const) {
      expect(r36[key].totalCost).toBeCloseTo(r36[key].netMonthly * 36, 5);
      expect(r60[key].totalCost).toBeCloseTo(r60[key].netMonthly * 60, 5);
    }
  });

  it("ownership totalCost no longer truncates when holding < comparison horizon", () => {
    // Previously: ownership.fiveYearTotal = netMonthly * min(60, holdingMonths),
    // which made a 36-month holding look 24 months cheaper than a 60-month lease.
    const r = compareAll({
      ...DEFAULTS,
      vehicle: { ...DEFAULTS.vehicle, holdingMonths: 36 },
      comparisonMonths: 60,
    });
    expect(r.ownership.totalCost).toBeCloseTo(r.ownership.netMonthly * 60, 5);
  });
});

describe("sensitivity sweep", () => {
  it("returns one comparison per range value", () => {
    const range = suggestRange(DEFAULTS, "annualKm", 11);
    const points = sweep(DEFAULTS, "annualKm", range);
    expect(points).toHaveLength(11);
    for (const p of points) {
      expect(Number.isFinite(p.result.ownership.netMonthly)).toBe(true);
    }
  });
});
