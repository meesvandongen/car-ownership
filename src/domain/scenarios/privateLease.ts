import type { AppInputs, Calculation, Car, ScenarioResult } from "../types";
import { totalAnnualKm } from "../types";
import type { TaxData } from "../taxData";
import { computeIncomeTax } from "../tax/incomeTax";
import { annualFuelCost } from "./fuel";

export function evaluatePrivateLease(
  inputs: AppInputs,
  car: Car,
  calc: Calculation,
  data: TaxData,
): ScenarioResult {
  const { drivingProfile, reimbursement, salary, energy } = inputs;
  const { vehicle } = car;
  const { privateLease } = calc;

  const monthlyDownPayment = privateLease.downPayment / privateLease.contractMonths;

  // Opportunity cost on the down payment: it's paid up-front and amortized
  // linearly over the contract, so average tied-up capital is downPayment/2.
  const monthlyOpportunityCost =
    ((privateLease.downPayment / 2) * inputs.opportunityCostRate) / 12;

  const fuelAnnual = annualFuelCost(vehicle, drivingProfile, energy);
  const monthlyFuel = fuelAnnual / 12;

  // Excess km charge (if total km > contractKmPerYear)
  const totalKm = totalAnnualKm(drivingProfile);
  const excessKmAnnual = Math.max(0, totalKm - privateLease.contractKmPerYear);
  const monthlyExcessKm = (excessKmAnnual * privateLease.excessKmTariff) / 12;

  // Reimbursement (same untaxed cap as ownership)
  const reimbursementAnnual =
    Math.min(reimbursement.ratePerKm, data.reimbursement.taxFreePerKm) *
    drivingProfile.businessKm;
  const taxableExcessRate = Math.max(
    0,
    reimbursement.ratePerKm - data.reimbursement.taxFreePerKm,
  );
  const taxableExcessAnnual = taxableExcessRate * drivingProfile.businessKm;
  const baseTax = computeIncomeTax(salary.bruto, data);
  const withExcess = computeIncomeTax(salary.bruto + taxableExcessAnnual, data);
  const excessNetGain = withExcess.netIncome - baseTax.netIncome;
  const monthlyReimbursement = reimbursementAnnual / 12 + excessNetGain / 12;

  const grossMonthly =
    privateLease.monthlyPayment +
    monthlyDownPayment +
    monthlyFuel +
    monthlyExcessKm +
    monthlyOpportunityCost;
  const netMonthly = grossMonthly - monthlyReimbursement;

  return {
    id: calc.id,
    label: calc.label,
    carId: car.id,
    carLabel: car.label,
    kind: "privateLease",
    grossMonthly,
    netMonthly,
    totalCost: netMonthly * inputs.comparisonMonths,
    costPerKm: totalKm > 0 ? (netMonthly * 12) / totalKm : 0,
    breakdown: [
      { label: "Lease payment", monthly: privateLease.monthlyPayment },
      { label: "Down payment (amortized)", monthly: monthlyDownPayment },
      { label: "Fuel/electricity", monthly: monthlyFuel },
      { label: "Excess km", monthly: monthlyExcessKm },
      { label: "Opportunity cost (down payment)", monthly: monthlyOpportunityCost },
      { label: "Reimbursement received", monthly: -monthlyReimbursement },
    ],
    warnings: [
      "Private lease registers with BKR — reduces future mortgage borrowing capacity.",
    ],
  };
}
