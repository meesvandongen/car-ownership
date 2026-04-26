import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  computeAlgemeneHeffingskorting,
  computeArbeidskorting,
  computeBox1Tax,
  computeIncomeTax,
  marginalNetCost,
} from "./incomeTax";
import { getTaxData } from "../taxData";

const data = getTaxData(2026);

const arbIncome = () => fc.double({ min: 0, max: 500_000, noNaN: true });

describe("income tax — property-based invariants", () => {
  it("netTax is never negative (kortingen cannot create a refund)", () => {
    fc.assert(
      fc.property(arbIncome(), (income) => {
        const r = computeIncomeTax(income, data);
        return r.netTax >= 0 && Number.isFinite(r.netTax);
      }),
      { numRuns: 2000 },
    );
  });

  it("netTax never exceeds gross income (cannot owe more than you earn)", () => {
    fc.assert(
      fc.property(arbIncome(), (income) => {
        const r = computeIncomeTax(income, data);
        return r.netTax <= income + 1e-6;
      }),
      { numRuns: 2000 },
    );
  });

  it("rawTax is non-negative and bounded by income × top rate", () => {
    const topRate =
      data.incomeTax.brackets[data.incomeTax.brackets.length - 1].rate;
    fc.assert(
      fc.property(arbIncome(), (income) => {
        const raw = computeBox1Tax(income, data);
        return raw >= 0 && raw <= income * topRate + 1e-6;
      }),
      { numRuns: 2000 },
    );
  });

  it("rawTax is monotonically non-decreasing in income", () => {
    fc.assert(
      fc.property(
        arbIncome(),
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        (income, delta) => {
          const a = computeBox1Tax(income, data);
          const b = computeBox1Tax(income + delta, data);
          return b >= a - 1e-6;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("netIncome is monotonically non-decreasing in gross income (no marginal rate > 100%)", () => {
    // CRITICAL invariant. If there is any input where netIncome decreases as
    // gross income rises, the calculation has an effective marginal rate above
    // 100%, which would break tax law.
    fc.assert(
      fc.property(
        arbIncome(),
        fc.double({ min: 0.01, max: 50_000, noNaN: true }),
        (income, delta) => {
          const a = computeIncomeTax(income, data).netIncome;
          const b = computeIncomeTax(income + delta, data).netIncome;
          return b >= a - 1e-6;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("algemene heffingskorting is monotonically non-increasing in income", () => {
    fc.assert(
      fc.property(
        arbIncome(),
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        (income, delta) => {
          const a = computeAlgemeneHeffingskorting(income, data);
          const b = computeAlgemeneHeffingskorting(income + delta, data);
          return b <= a + 1e-6;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("algemene heffingskorting is bounded between 0 and the configured max", () => {
    fc.assert(
      fc.property(arbIncome(), (income) => {
        const k = computeAlgemeneHeffingskorting(income, data);
        return k >= 0 && k <= data.incomeTax.algemeneHeffingskorting.max + 1e-6;
      }),
      { numRuns: 1000 },
    );
  });

  it("arbeidskorting is bounded between 0 and the configured max", () => {
    fc.assert(
      fc.property(arbIncome(), (income) => {
        const k = computeArbeidskorting(income, data);
        return k >= 0 && k <= data.incomeTax.arbeidskorting.max + 1e-6;
      }),
      { numRuns: 1000 },
    );
  });

  it("zero income → zero tax, zero arbeidskorting, but max algemeneHeffingskorting", () => {
    expect(computeBox1Tax(0, data)).toBe(0);
    expect(computeArbeidskorting(0, data)).toBe(0);
    expect(computeAlgemeneHeffingskorting(0, data)).toBe(
      data.incomeTax.algemeneHeffingskorting.max,
    );
    expect(computeIncomeTax(0, data).netTax).toBe(0);
  });

  it("marginalNetCost(base, 0) is exactly 0", () => {
    fc.assert(
      fc.property(arbIncome(), (base) => {
        return Math.abs(marginalNetCost(base, 0, data)) < 1e-6;
      }),
      { numRuns: 200 },
    );
  });

  it("marginalNetCost(base, x) is non-negative for non-negative x", () => {
    fc.assert(
      fc.property(
        arbIncome(),
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        (base, extra) => {
          const cost = marginalNetCost(base, extra, data);
          return cost >= -1e-6;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("marginalNetCost(base, x) ≤ x (cannot lose more in tax than the gross addition itself, since rates ≤ 100%)", () => {
    // With top rate 49.5% + at most ~13% combined phase-out rates, marginal
    // cost can exceed bracket rate but never the gross addition.
    fc.assert(
      fc.property(
        arbIncome(),
        fc.double({ min: 0, max: 100_000, noNaN: true }),
        (base, extra) => {
          const cost = marginalNetCost(base, extra, data);
          return cost <= extra + 1e-6;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("box-1 tax is continuous at every bracket boundary", () => {
    for (const bracket of data.incomeTax.brackets) {
      if (bracket.upTo === null) continue;
      const eps = 0.01;
      const just_below = computeBox1Tax(bracket.upTo - eps, data);
      const just_above = computeBox1Tax(bracket.upTo + eps, data);
      // Difference must be ≤ 2*eps* top_rate (no jump discontinuity).
      const topRate = data.incomeTax.brackets.at(-1)!.rate;
      expect(Math.abs(just_above - just_below)).toBeLessThan(2 * eps * topRate + 1e-6);
    }
  });

  it("computeIncomeTax invariants compose: rawTax = netTax + (kortingen actually applied)", () => {
    fc.assert(
      fc.property(arbIncome(), (income) => {
        const r = computeIncomeTax(income, data);
        // Either rawTax ≥ heffingskortingen sum (and netTax = rawTax - kortingen),
        // or rawTax < kortingen and netTax was floored at 0.
        const totalK = r.algemeneHeffingskorting + r.arbeidskorting;
        const expectedNet = Math.max(0, r.rawTax - totalK);
        return Math.abs(r.netTax - expectedNet) < 1e-6;
      }),
      { numRuns: 1000 },
    );
  });
});
