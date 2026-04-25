import type { AppInputs, ScenarioResult } from "../types";
import type { TaxData } from "../taxData";
import { computeIncomeTax } from "../tax/incomeTax";
import { annualFuelCost } from "./fuel";

export function evaluatePrivateLease(
  inputs: AppInputs,
  data: TaxData,
): ScenarioResult {
  const { vehicle, privateLease, ownership, reimbursement, salary } = inputs;

  const monthlyDownPayment = privateLease.downPayment / privateLease.contractMonths;

  const fuelAnnual = annualFuelCost(vehicle, ownership);
  const monthlyFuel = fuelAnnual / 12;

  // Excess km charge (if annualKm > contractKmPerYear)
  const excessKmAnnual = Math.max(0, vehicle.annualKm - privateLease.contractKmPerYear);
  const monthlyExcessKm = (excessKmAnnual * privateLease.excessKmTariff) / 12;

  // Reimbursement (same untaxed cap as ownership)
  const reimbursementAnnual =
    Math.min(reimbursement.ratePerKm, data.reimbursement.taxFreePerKm) *
    vehicle.businessKm;
  const taxableExcessRate = Math.max(
    0,
    reimbursement.ratePerKm - data.reimbursement.taxFreePerKm,
  );
  const taxableExcessAnnual = taxableExcessRate * vehicle.businessKm;
  const baseTax = computeIncomeTax(salary.bruto, data);
  const withExcess = computeIncomeTax(salary.bruto + taxableExcessAnnual, data);
  const excessNetGain = withExcess.netIncome - baseTax.netIncome;
  const monthlyReimbursement = reimbursementAnnual / 12 + excessNetGain / 12;

  const grossMonthly =
    privateLease.monthlyPayment + monthlyDownPayment + monthlyFuel + monthlyExcessKm;
  const netMonthly = grossMonthly - monthlyReimbursement;

  return {
    name: "privateLease",
    grossMonthly,
    netMonthly,
    fiveYearTotal: netMonthly * 60,
    costPerKm: vehicle.annualKm > 0 ? (netMonthly * 12) / vehicle.annualKm : 0,
    breakdown: [
      { label: "Lease payment", monthly: privateLease.monthlyPayment },
      { label: "Down payment (amortized)", monthly: monthlyDownPayment },
      { label: "Fuel/electricity", monthly: monthlyFuel },
      { label: "Excess km", monthly: monthlyExcessKm },
      { label: "Reimbursement received", monthly: -monthlyReimbursement },
    ],
    warnings: [
      "Private lease registers with BKR — reduces future mortgage borrowing capacity.",
    ],
  };
}
