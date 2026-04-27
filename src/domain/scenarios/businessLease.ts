import type { AppInputs, Calculation, Car, ScenarioResult } from "../types";
import type { TaxData } from "../taxData";
import { calculateBijtelling } from "../tax/bijtelling";
import { computeIncomeTax, marginalNetCost } from "../tax/incomeTax";
import { annualFuelCost } from "./fuel";

export function evaluateBusinessLease(
  inputs: AppInputs,
  car: Car,
  calc: Calculation,
  data: TaxData,
): ScenarioResult {
  const { drivingProfile, salary, energy } = inputs;
  const { vehicle } = car;
  const { businessLease } = calc;

  // Annual gross bijtelling
  const grossBijtellingAnnual = calculateBijtelling(
    {
      catalogusprijs: vehicle.catalogusprijs,
      powertrain: vehicle.powertrain,
      detYear: vehicle.detYear,
      taxYear: inputs.taxYear,
      privateKmPerYear: drivingProfile.privateKm,
      rittenregistratie: businessLease.rittenregistratie,
    },
    data,
  );

  // Eigen bijdrage reduces bijtelling 1:1, but only up to the bijtelling itself
  // (you can never have negative bijtelling). The employee, however, still pays
  // the full eigen bijdrage from net salary regardless — any excess above the
  // gross bijtelling just doesn't reduce tax further, but is not refunded.
  const eigenBijdrageAnnual = businessLease.eigenBijdrage * 12;
  const eigenBijdrageReducingBijtelling = Math.min(
    eigenBijdrageAnnual,
    grossBijtellingAnnual,
  );
  const taxableBijtelling = Math.max(
    0,
    grossBijtellingAnnual - eigenBijdrageReducingBijtelling,
  );

  // Salary sacrifice / cafetariaregeling: the employer reduces gross salary
  // (cannot exceed the actual bruto) in exchange for the lease car. This both
  //   • lowers the base income against which bijtelling marginal cost is computed
  //   • costs the employee the gross sacrifice minus the tax saved on it
  const salarySacrificeAnnual = Math.max(
    0,
    Math.min(businessLease.salarySacrificeMonthly * 12, salary.bruto),
  );
  const effectiveBruto = salary.bruto - salarySacrificeAnnual;
  const taxBefore = computeIncomeTax(salary.bruto, data);
  const taxAfter = computeIncomeTax(effectiveBruto, data);
  const taxSavedFromSacrifice = taxBefore.netTax - taxAfter.netTax;
  const annualSalarySacrificeNetCost = salarySacrificeAnnual - taxSavedFromSacrifice;

  // Net cost of bijtelling = marginal income-tax cost on the additional taxable income,
  // computed on top of the (possibly reduced) effective bruto.
  const annualBijtellingNetCost = marginalNetCost(effectiveBruto, taxableBijtelling, data);

  // Fuel: if no fuel card or private fuel not covered, employee pays for private km.
  let fuelAnnual = 0;
  if (!businessLease.fuelCardPrivate) {
    const privateFraction =
      drivingProfile.annualKm > 0
        ? drivingProfile.privateKm / drivingProfile.annualKm
        : 0;
    fuelAnnual = annualFuelCost(vehicle, drivingProfile, energy) * privateFraction;
  }

  const monthlyBijtellingNet = annualBijtellingNetCost / 12;
  const monthlyEigenBijdrage = eigenBijdrageAnnual / 12;
  const monthlyFuel = fuelAnnual / 12;
  const monthlySalarySacrificeNet = annualSalarySacrificeNetCost / 12;

  // From the user's perspective, the user pays:
  //   • net bijtelling cost (extra tax on the bijtelling addition)
  //   • eigen bijdrage (paid from net salary)
  //   • private fuel (if applicable)
  //   • net cost of any salary sacrificed (gross given up minus tax saved)
  const grossMonthly =
    monthlyEigenBijdrage +
    monthlyBijtellingNet +
    monthlyFuel +
    monthlySalarySacrificeNet;
  const netMonthly = grossMonthly;

  const warnings: string[] = [];
  if (vehicle.detYear <= inputs.taxYear) {
    warnings.push(
      `Bijtelling rate for ${vehicle.detYear} registration is locked for 60 months.`,
    );
  }
  if (
    inputs.taxYear >= data.pseudoEindheffing.fromYear &&
    vehicle.powertrain !== "ev" &&
    vehicle.powertrain !== "hydrogen"
  ) {
    warnings.push(
      `From ${data.pseudoEindheffing.fromYear} the employer pays a ${(data.pseudoEindheffing.rate * 100).toFixed(
        0,
      )}% pseudo-eindheffing on non-EV company cars (cannot be passed to employee).`,
    );
  }
  if (businessLease.rittenregistratie && drivingProfile.privateKm < 500) {
    warnings.push(
      "Zero bijtelling claimed: requires a watertight rittenregistratie maintained year-round.",
    );
  }

  return {
    id: calc.id,
    label: calc.label,
    carId: car.id,
    carLabel: car.label,
    kind: "businessLease",
    grossMonthly,
    netMonthly,
    totalCost: netMonthly * inputs.comparisonMonths,
    costPerKm:
      drivingProfile.annualKm > 0
        ? (netMonthly * 12) / drivingProfile.annualKm
        : 0,
    breakdown: [
      { label: "Bijtelling (net tax cost)", monthly: monthlyBijtellingNet },
      { label: "Eigen bijdrage", monthly: monthlyEigenBijdrage },
      { label: "Private fuel", monthly: monthlyFuel },
      { label: "Salary sacrifice (net cost)", monthly: monthlySalarySacrificeNet },
    ],
    warnings,
  };
}
