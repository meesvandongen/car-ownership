import type { TaxData } from "../taxData";

export interface IncomeTaxResult {
  grossIncome: number;
  rawTax: number;
  algemeneHeffingskorting: number;
  arbeidskorting: number;
  netTax: number;
  netIncome: number;
}

export function computeBox1Tax(income: number, data: TaxData): number {
  let remaining = Math.max(0, income);
  let tax = 0;
  let lower = 0;
  for (const bracket of data.incomeTax.brackets) {
    const upper = bracket.upTo ?? Infinity;
    const slice = Math.max(0, Math.min(remaining + lower, upper) - lower);
    tax += slice * bracket.rate;
    lower = upper;
    if (income <= upper) break;
  }
  return tax;
}

export function computeAlgemeneHeffingskorting(income: number, data: TaxData): number {
  const k = data.incomeTax.algemeneHeffingskorting;
  if (income <= k.phaseOutStart) return k.max;
  if (income >= k.phaseOutEnd) return 0;
  return Math.max(0, k.max - (income - k.phaseOutStart) * k.phaseOutRate);
}

export function computeArbeidskorting(income: number, data: TaxData): number {
  const k = data.incomeTax.arbeidskorting;
  if (income <= 0) return 0;
  // Simplified: linear buildup to max, then linear phase-out.
  const buildup = Math.min(k.max, income * k.buildupRate);
  if (income <= k.phaseOutStart) return buildup;
  if (income >= k.phaseOutEnd) return 0;
  return Math.max(0, buildup - (income - k.phaseOutStart) * k.phaseOutRate);
}

export function computeIncomeTax(grossIncome: number, data: TaxData): IncomeTaxResult {
  const rawTax = computeBox1Tax(grossIncome, data);
  const algemeneHeffingskorting = computeAlgemeneHeffingskorting(grossIncome, data);
  const arbeidskorting = computeArbeidskorting(grossIncome, data);
  const netTax = Math.max(0, rawTax - algemeneHeffingskorting - arbeidskorting);
  const netIncome = grossIncome - netTax;
  return {
    grossIncome,
    rawTax,
    algemeneHeffingskorting,
    arbeidskorting,
    netTax,
    netIncome,
  };
}

/**
 * Effective marginal cost of adding `extraGross` to taxable income.
 * Returns the net amount of tax (and lost kortingen) caused by the addition.
 */
export function marginalNetCost(
  baseIncome: number,
  extraGross: number,
  data: TaxData,
): number {
  const base = computeIncomeTax(baseIncome, data);
  const withExtra = computeIncomeTax(baseIncome + extraGross, data);
  return withExtra.netTax - base.netTax;
}
