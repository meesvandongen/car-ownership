/**
 * Standard fixed-rate annuity payment.
 */
export function annuityPayment(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  if (termMonths <= 0) return 0;
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/**
 * Total interest paid over the life of an annuity loan.
 */
export function totalInterest(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  return annuityPayment(principal, annualRate, termMonths) * termMonths - principal;
}
