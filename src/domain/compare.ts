import type {
  AppInputs,
  Calculation,
  Car,
  CompareResult,
  ScenarioResult,
} from "./types";
import { getTaxData, type TaxData } from "./taxData";
import { evaluateOwnership } from "./scenarios/ownership";
import { evaluatePrivateLease } from "./scenarios/privateLease";
import { evaluateBusinessLease } from "./scenarios/businessLease";

export function evaluateCalculation(
  inputs: AppInputs,
  car: Car,
  calc: Calculation,
  data: TaxData,
): ScenarioResult {
  switch (calc.kind) {
    case "ownership":
      return evaluateOwnership(inputs, car, calc, data);
    case "privateLease":
      return evaluatePrivateLease(inputs, car, calc, data);
    case "businessLease":
      return evaluateBusinessLease(inputs, car, calc, data);
  }
}

export function compareAll(inputs: AppInputs): CompareResult {
  const data = getTaxData(inputs.taxYear);
  const carsById = new Map(inputs.cars.map((c) => [c.id, c]));

  const results: ScenarioResult[] = [];
  const orphanCalcLabels: string[] = [];
  for (const calc of inputs.calculations) {
    const car = carsById.get(calc.carId);
    if (!car) {
      orphanCalcLabels.push(calc.label);
      continue;
    }
    results.push(evaluateCalculation(inputs, car, calc, data));
  }

  const warnings: string[] = [];
  if (orphanCalcLabels.length > 0) {
    warnings.push(
      `Calculation${orphanCalcLabels.length > 1 ? "s" : ""} with no matching car: ${orphanCalcLabels.join(", ")}.`,
    );
  }

  const youngtimerYears = data.bijtelling.youngtimerMinAgeYears;
  const youngtimerRate = data.bijtelling.youngtimerRate;
  const currentYear = new Date().getFullYear();
  const youngtimerCars = inputs.cars
    .filter((c) => currentYear - c.vehicle.detYear >= youngtimerYears)
    .map((c) => c.label);
  if (youngtimerCars.length > 0) {
    warnings.push(
      `Youngtimer (${youngtimerRate * 100}% over dagwaarde, not list price): ${youngtimerCars.join(", ")}.`,
    );
  }

  const hasEv = inputs.cars.some((c) => c.vehicle.powertrain === "ev");
  if (hasEv && inputs.taxYear >= 2030) {
    warnings.push("From 2030 the EV MRB korting is 0% — full MRB applies.");
  }

  return { results, warnings };
}
