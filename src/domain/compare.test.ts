import { describe, expect, it } from "vitest";
import { compareAll } from "./compare";
import { sweep, suggestRange } from "./sensitivity";
import { DEFAULTS } from "../defaults";
import type { AppInputs, ScenarioKind, ScenarioResult } from "./types";

function byKind(r: { scenarios: ScenarioResult[] }, kind: ScenarioKind): ScenarioResult {
  const found = r.scenarios.find((s) => s.kind === kind);
  if (!found) throw new Error(`no scenario of kind ${kind} in result`);
  return found;
}

function patchScenario(
  inputs: AppInputs,
  kind: ScenarioKind,
  patch: (s: AppInputs["scenarios"][number]) => AppInputs["scenarios"][number],
): AppInputs {
  return {
    ...inputs,
    scenarios: inputs.scenarios.map((s) => (s.kind === kind ? patch(s) : s)),
  };
}

describe("compareAll", () => {
  it("produces a result for each scenario with finite numbers", () => {
    const r = compareAll(DEFAULTS);
    expect(r.scenarios.length).toBe(DEFAULTS.scenarios.length);
    for (const s of r.scenarios) {
      expect(Number.isFinite(s.netMonthly)).toBe(true);
      expect(Number.isFinite(s.grossMonthly)).toBe(true);
      expect(Number.isFinite(s.totalCost)).toBe(true);
    }
  });

  it("business lease net cost rises when bijtelling is taken (vs zero-bijtelling)", () => {
    const withBijtelling = compareAll(DEFAULTS);
    const noBij: AppInputs = patchScenario(
      {
        ...DEFAULTS,
        drivingProfile: { ...DEFAULTS.drivingProfile, privateKm: 100 },
      },
      "businessLease",
      (s) => ({
        ...s,
        businessLease: { ...s.businessLease, rittenregistratie: true },
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
    const inputs = patchScenario(DEFAULTS, "privateLease", (s) => ({
      ...s,
      privateLease: { ...s.privateLease, downPayment: 5_000 },
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
      patchScenario(DEFAULTS, "businessLease", (s) => ({
        ...s,
        businessLease: { ...s.businessLease, salarySacrificeMonthly: 500 },
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
      patchScenario(DEFAULTS, "businessLease", (s) => ({
        ...s,
        businessLease: {
          ...s.businessLease,
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

  it("totalCost honours the comparisonMonths horizon for all scenarios", () => {
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
      ...patchScenario(DEFAULTS, "ownership", (s) => ({
        ...s,
        ownership: { ...s.ownership, holdingMonths: 36 },
      })),
      comparisonMonths: 60,
    });
    const o = byKind(r, "ownership");
    expect(o.totalCost).toBeCloseTo(o.netMonthly * 60, 5);
  });

  it("supports multiple scenarios of the same kind with different cars", () => {
    const cheaper = DEFAULTS.scenarios.find((s) => s.kind === "ownership")!;
    const dearer = {
      ...structuredClone(cheaper),
      id: "own-2",
      label: "Ownership (premium)",
      vehicle: { ...cheaper.vehicle, aanschafprijs: cheaper.vehicle.aanschafprijs * 1.5 },
    };
    const r = compareAll({
      ...DEFAULTS,
      scenarios: [cheaper, dearer, ...DEFAULTS.scenarios.slice(1)],
    });
    expect(r.scenarios.length).toBe(4);
    const cheap = r.scenarios[0];
    const expensive = r.scenarios[1];
    expect(cheap.kind).toBe("ownership");
    expect(expensive.kind).toBe("ownership");
    expect(expensive.netMonthly).toBeGreaterThan(cheap.netMonthly);
  });

  it("preserves scenario order and labels in the result", () => {
    const r = compareAll(DEFAULTS);
    expect(r.scenarios.map((s) => s.label)).toEqual(
      DEFAULTS.scenarios.map((s) => s.label),
    );
    expect(r.scenarios.map((s) => s.id)).toEqual(
      DEFAULTS.scenarios.map((s) => s.id),
    );
  });
});

describe("sensitivity sweep", () => {
  it("returns one comparison per range value (shared variable)", () => {
    const range = suggestRange(DEFAULTS, "annualKm", 11);
    const points = sweep(DEFAULTS, "annualKm", range);
    expect(points).toHaveLength(11);
    for (const p of points) {
      for (const s of p.result.scenarios) {
        expect(Number.isFinite(s.netMonthly)).toBe(true);
      }
    }
  });

  it("scenario-scoped sweep only changes the targeted scenario", () => {
    const ownership = DEFAULTS.scenarios.find((s) => s.kind === "ownership")!;
    const range = suggestRange(DEFAULTS, "catalogusprijs", 5, ownership.id);
    const points = sweep(DEFAULTS, "catalogusprijs", range, ownership.id);
    const baselinePrivateLease = compareAll(DEFAULTS).scenarios.find(
      (s) => s.kind === "privateLease",
    )!.netMonthly;
    for (const p of points) {
      const pl = p.result.scenarios.find((s) => s.kind === "privateLease")!;
      expect(pl.netMonthly).toBe(baselinePrivateLease);
    }
  });
});
