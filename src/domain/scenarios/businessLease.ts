import type { AppInputs, ScenarioResult } from "../types";
import type { TaxData } from "../taxData";
import { calculateBijtelling } from "../tax/bijtelling";
import { marginalNetCost } from "../tax/incomeTax";
import { annualFuelCost } from "./fuel";

export function evaluateBusinessLease(
  inputs: AppInputs,
  data: TaxData,
): ScenarioResult {
  const { vehicle, businessLease, salary, ownership } = inputs;

  // Annual gross bijtelling
  const grossBijtellingAnnual = calculateBijtelling(
    {
      catalogusprijs: vehicle.catalogusprijs,
      powertrain: vehicle.powertrain,
      detYear: vehicle.detYear,
      taxYear: inputs.taxYear,
      privateKmPerYear: vehicle.privateKm,
      rittenregistratie: businessLease.rittenregistratie,
    },
    data,
  );

  // Eigen bijdrage reduces bijtelling 1:1 (capped at gross bijtelling).
  const eigenBijdrageAnnual = Math.min(
    businessLease.eigenBijdrage * 12,
    grossBijtellingAnnual,
  );
  const taxableBijtelling = Math.max(0, grossBijtellingAnnual - eigenBijdrageAnnual);

  // Net cost of bijtelling = marginal income-tax cost on the additional taxable income.
  const annualBijtellingNetCost = marginalNetCost(salary.bruto, taxableBijtelling, data);

  // Fuel: if no fuel card or private fuel not covered, employee pays for private km.
  let fuelAnnual = 0;
  if (!businessLease.fuelCardPrivate) {
    const privateFraction =
      vehicle.annualKm > 0 ? vehicle.privateKm / vehicle.annualKm : 0;
    fuelAnnual = annualFuelCost(vehicle, ownership) * privateFraction;
  }

  const monthlyBijtellingNet = annualBijtellingNetCost / 12;
  const monthlyEigenBijdrage = eigenBijdrageAnnual / 12;
  const monthlyFuel = fuelAnnual / 12;

  // From the user's perspective, the employer pays the lease tariff. The user pays:
  //   • net bijtelling cost (extra tax)
  //   • eigen bijdrage (paid from net salary)
  //   • private fuel (if applicable)
  const grossMonthly = monthlyEigenBijdrage + monthlyBijtellingNet + monthlyFuel;
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
  if (businessLease.rittenregistratie && vehicle.privateKm < 500) {
    warnings.push(
      "Zero bijtelling claimed: requires a watertight rittenregistratie maintained year-round.",
    );
  }

  return {
    name: "businessLease",
    grossMonthly,
    netMonthly,
    fiveYearTotal: netMonthly * 60,
    costPerKm: vehicle.annualKm > 0 ? (netMonthly * 12) / vehicle.annualKm : 0,
    breakdown: [
      { label: "Bijtelling (net tax cost)", monthly: monthlyBijtellingNet },
      { label: "Eigen bijdrage", monthly: monthlyEigenBijdrage },
      { label: "Private fuel", monthly: monthlyFuel },
    ],
    warnings,
  };
}
