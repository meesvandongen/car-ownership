import { describe, expect, it } from "vitest";
import { computeBox1Tax, computeIncomeTax, marginalNetCost } from "./incomeTax";
import { getTaxData } from "../taxData";

const data = getTaxData(2026);

describe("income tax 2026", () => {
  it("zero income → zero tax and zero kortingen applied", () => {
    const r = computeIncomeTax(0, data);
    expect(r.netTax).toBe(0);
    expect(r.netIncome).toBe(0);
  });

  it("€65k bruto produces a sensible netto", () => {
    const r = computeIncomeTax(65_000, data);
    expect(r.netIncome).toBeGreaterThan(40_000);
    expect(r.netIncome).toBeLessThan(55_000);
  });

  it("higher income → higher net tax", () => {
    const a = computeIncomeTax(40_000, data);
    const b = computeIncomeTax(120_000, data);
    expect(b.netTax).toBeGreaterThan(a.netTax);
  });

  it("marginal cost of €5k bijtelling is positive but less than the gross", () => {
    const cost = marginalNetCost(65_000, 5_000, data);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(5_000);
  });

  it("box-1 tax sums slices, not full brackets, for income inside bracket 2", () => {
    // 2026: bracket 1 ends at 38,883 @ 35.76%; bracket 2 ends at 79,137 @ 37.56%.
    const b = data.incomeTax.brackets;
    const cap1 = b[0].upTo!;
    const expected = cap1 * b[0].rate + (65_000 - cap1) * b[1].rate;
    expect(computeBox1Tax(65_000, data)).toBeCloseTo(expected, 2);
  });

  it("box-1 tax for top bracket only taxes the slice above the cap", () => {
    // €80k: only €863 should land in the 49.5% bracket.
    const b = data.incomeTax.brackets;
    const cap1 = b[0].upTo!;
    const cap2 = b[1].upTo!;
    const expected =
      cap1 * b[0].rate + (cap2 - cap1) * b[1].rate + (80_000 - cap2) * b[2].rate;
    expect(computeBox1Tax(80_000, data)).toBeCloseTo(expected, 2);
  });

  it("net tax never exceeds gross income (sanity check across brackets)", () => {
    for (const income of [10_000, 38_883, 65_000, 80_000, 120_000, 250_000]) {
      const r = computeIncomeTax(income, data);
      expect(r.netTax).toBeLessThan(income);
      expect(r.netIncome).toBeGreaterThan(0);
    }
  });
});
