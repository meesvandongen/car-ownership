import type { AppInputs, Calculation, Car, ScenarioResult } from "../types";
import { totalAnnualKm } from "../types";
import type { TaxData } from "../taxData";
import { calculateAnnualMrb } from "../tax/mrb";
import { calculateBpm } from "../tax/bpm";
import { computeIncomeTax } from "../tax/incomeTax";
import { annualFuelCost } from "./fuel";
import { annuityPayment } from "./financing";

export function evaluateOwnership(
  inputs: AppInputs,
  car: Car,
  calc: Calculation,
  data: TaxData,
): ScenarioResult {
  const { drivingProfile, salary, reimbursement, energy } = inputs;
  const { vehicle } = car;
  const { ownership } = calc;

  // Depreciation (straight line) over holding period.
  const depreciation =
    (vehicle.aanschafprijs - ownership.residualValue) / ownership.holdingMonths;

  // Financing
  const loanPrincipal = Math.max(0, vehicle.aanschafprijs - ownership.downPayment);
  const monthlyLoan = annuityPayment(
    loanPrincipal,
    ownership.interestRate,
    ownership.loanTermMonths,
  );
  // Spread loan payments across holding period (if loan term ≠ holding, average over holding)
  const monthlyFinance =
    (monthlyLoan * Math.min(ownership.loanTermMonths, ownership.holdingMonths)) /
    ownership.holdingMonths;

  // Annual MRB
  const annualMrb = calculateAnnualMrb(
    {
      weightKg: vehicle.weightKg,
      powertrain: vehicle.powertrain,
      province: drivingProfile.province,
      taxYear: inputs.taxYear,
      lpgG3: vehicle.lpgG3,
      dieselFijnstof: vehicle.dieselFijnstof,
    },
    data,
  );

  // One-time BPM amortized over holding (only relevant if not already in aanschafprijs).
  // We assume the user enters aanschafprijs INCLUDING BPM (Dutch market convention),
  // so BPM is informational and not double-counted here.
  const bpm = calculateBpm(
    { powertrain: vehicle.powertrain, co2: vehicle.co2 },
    data,
  );

  // Opportunity cost on capital tied up in the vehicle. Linear depreciation
  // means own-equity in the car runs from `downPayment` (at t=0, with the
  // financed portion borrowed) to `residualValue` (at end-of-holding, loan
  // assumed paid off). Average tied-up own capital ≈ (downPayment + residualValue)/2.
  // This captures the foregone return on cash that's locked into a depreciating asset.
  const cappedDownPayment = Math.min(ownership.downPayment, vehicle.aanschafprijs);
  const averageOwnCapital = (cappedDownPayment + ownership.residualValue) / 2;
  const monthlyOpportunityCost =
    (averageOwnCapital * inputs.opportunityCostRate) / 12;

  // Fuel / electricity
  const fuelAnnual = annualFuelCost(vehicle, drivingProfile, energy);

  // Reimbursement (untaxed, up to cap × business km)
  const reimbursementAnnual =
    Math.min(reimbursement.ratePerKm, data.reimbursement.taxFreePerKm) *
    drivingProfile.businessKm;

  // Above the tax-free cap is loon-taxed; we approximate with marginal rate.
  const taxableExcessRate = Math.max(
    0,
    reimbursement.ratePerKm - data.reimbursement.taxFreePerKm,
  );
  const taxableExcessAnnual = taxableExcessRate * drivingProfile.businessKm;
  const baseTax = computeIncomeTax(salary.bruto, data);
  const withExcess = computeIncomeTax(salary.bruto + taxableExcessAnnual, data);
  const excessNetGain = withExcess.netIncome - baseTax.netIncome;

  const monthlyMrb = annualMrb / 12;
  const monthlyInsurance = ownership.insurancePerMonth;
  const monthlyMaintenance = ownership.maintenancePerYear / 12;
  const monthlyFuel = fuelAnnual / 12;
  const monthlyDepreciation = depreciation;
  const monthlyReimbursement = reimbursementAnnual / 12 + excessNetGain / 12;

  const grossMonthly =
    monthlyDepreciation +
    monthlyFinance +
    monthlyMrb +
    monthlyInsurance +
    monthlyMaintenance +
    monthlyFuel +
    monthlyOpportunityCost;

  const netMonthly = grossMonthly - monthlyReimbursement;

  return {
    id: calc.id,
    label: calc.label,
    carId: car.id,
    carLabel: car.label,
    kind: "ownership",
    grossMonthly,
    netMonthly,
    totalCost: netMonthly * inputs.comparisonMonths,
    costPerKm:
      totalAnnualKm(drivingProfile) > 0
        ? (netMonthly * 12) / totalAnnualKm(drivingProfile)
        : 0,
    breakdown: [
      { label: "Depreciation", monthly: monthlyDepreciation },
      { label: "Financing", monthly: monthlyFinance },
      { label: "MRB", monthly: monthlyMrb },
      { label: "Insurance", monthly: monthlyInsurance },
      { label: "Maintenance", monthly: monthlyMaintenance },
      { label: "Fuel/electricity", monthly: monthlyFuel },
      { label: "Opportunity cost (capital tied up)", monthly: monthlyOpportunityCost },
      { label: "Reimbursement received", monthly: -monthlyReimbursement },
    ],
    warnings:
      bpm > 1000
        ? [
            `BPM on this combustion car is ~€${bpm.toFixed(0)} (already included in catalogusprijs).`,
          ]
        : [],
  };
}
