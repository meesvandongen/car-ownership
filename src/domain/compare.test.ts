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
      expect(Number.isFinite(s.fiveYearTotal)).toBe(true);
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
