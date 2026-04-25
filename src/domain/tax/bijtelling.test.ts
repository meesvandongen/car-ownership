import { describe, expect, it } from "vitest";
import { calculateBijtelling } from "./bijtelling";
import { getTaxData } from "../taxData";

const data = getTaxData(2026);

describe("bijtelling 2026", () => {
  it("EV registered 2026, €45k catalogus → 18% on €30k + 22% on €15k", () => {
    const got = calculateBijtelling(
      {
        catalogusprijs: 45_000,
        powertrain: "ev",
        detYear: 2026,
        taxYear: 2026,
        privateKmPerYear: 4000,
        rittenregistratie: false,
      },
      data,
    );
    expect(got).toBe(0.18 * 30_000 + 0.22 * 15_000);
  });

  it("EV registered 2025 keeps 17% rate in 2027 (60-month lock active)", () => {
    const got = calculateBijtelling(
      {
        catalogusprijs: 45_000,
        powertrain: "ev",
        detYear: 2025,
        taxYear: 2027,
        privateKmPerYear: 4000,
        rittenregistratie: false,
      },
      data,
    );
    expect(got).toBe(0.17 * 30_000 + 0.22 * 15_000);
  });

  it("petrol applies 22% over full catalogus", () => {
    const got = calculateBijtelling(
      {
        catalogusprijs: 45_000,
        powertrain: "petrol",
        detYear: 2026,
        taxYear: 2026,
        privateKmPerYear: 4000,
        rittenregistratie: false,
      },
      data,
    );
    expect(got).toBe(0.22 * 45_000);
  });

  it("returns zero with rittenregistratie and < 500 km private", () => {
    const got = calculateBijtelling(
      {
        catalogusprijs: 45_000,
        powertrain: "petrol",
        detYear: 2026,
        taxYear: 2026,
        privateKmPerYear: 200,
        rittenregistratie: true,
      },
      data,
    );
    expect(got).toBe(0);
  });

  it("youngtimer applies 35% over market value", () => {
    const got = calculateBijtelling(
      {
        catalogusprijs: 50_000,
        powertrain: "petrol",
        detYear: 2008,
        taxYear: 2026,
        privateKmPerYear: 4000,
        rittenregistratie: false,
        isYoungtimer: true,
        marketValueIfYoungtimer: 8_000,
      },
      data,
    );
    expect(got).toBe(0.35 * 8_000);
  });

  it("hydrogen applies 18% on full catalogus", () => {
    const got = calculateBijtelling(
      {
        catalogusprijs: 60_000,
        powertrain: "hydrogen",
        detYear: 2026,
        taxYear: 2026,
        privateKmPerYear: 4000,
        rittenregistratie: false,
      },
      data,
    );
    expect(got).toBe(0.18 * 60_000);
  });
});
