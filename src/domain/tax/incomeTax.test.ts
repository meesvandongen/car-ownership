import { describe, expect, it } from "vitest";
import { computeIncomeTax, marginalNetCost } from "./incomeTax";
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
});
