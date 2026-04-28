import type { AppInputs, CompareResult } from "./types";
import { compareAll } from "./compare";

export type SharedSweepable =
  | "businessKm"
  | "privateKm"
  | "bruto"
  | "electricityCostPerKwh"
  | "fuelCostPerLiter"
  | "opportunityCostRate";

export type CarSweepable =
  | "catalogusprijs"
  | "aanschafprijs"
  | "co2"
  | "weightKg";

export type CalculationSweepable =
  | "residualValue"
  | "monthlyLeaseTariff"
  | "monthlyPayment"
  | "eigenBijdrage"
  | "salarySacrificeMonthly";

export type SweepableNumeric =
  | SharedSweepable
  | CarSweepable
  | CalculationSweepable;

export const SHARED_SWEEPABLES: SharedSweepable[] = [
  "businessKm",
  "privateKm",
  "bruto",
  "electricityCostPerKwh",
  "fuelCostPerLiter",
  "opportunityCostRate",
];

export const CAR_SWEEPABLES: CarSweepable[] = [
  "catalogusprijs",
  "aanschafprijs",
  "co2",
  "weightKg",
];

export const CALCULATION_SWEEPABLES: CalculationSweepable[] = [
  "residualValue",
  "monthlyLeaseTariff",
  "monthlyPayment",
  "eigenBijdrage",
  "salarySacrificeMonthly",
];

export type SweepScope =
  | { kind: "shared" }
  | { kind: "car"; carId: string }
  | { kind: "calculation"; calculationId: string };

export function variableScope(
  v: SweepableNumeric,
): "shared" | "car" | "calculation" {
  if ((SHARED_SWEEPABLES as readonly string[]).includes(v)) return "shared";
  if ((CAR_SWEEPABLES as readonly string[]).includes(v)) return "car";
  return "calculation";
}

export interface SweepPoint {
  x: number;
  result: CompareResult;
}

function withSharedVariable(
  inputs: AppInputs,
  variable: SharedSweepable,
  value: number,
): AppInputs {
  switch (variable) {
    case "businessKm":
      return {
        ...inputs,
        drivingProfile: { ...inputs.drivingProfile, businessKm: value },
      };
    case "privateKm":
      return {
        ...inputs,
        drivingProfile: { ...inputs.drivingProfile, privateKm: value },
      };
    case "bruto":
      return { ...inputs, salary: { ...inputs.salary, bruto: value } };
    case "electricityCostPerKwh":
      return {
        ...inputs,
        energy: { ...inputs.energy, electricityCostPerKwh: value },
      };
    case "fuelCostPerLiter":
      return { ...inputs, energy: { ...inputs.energy, fuelCostPerLiter: value } };
    case "opportunityCostRate":
      return { ...inputs, opportunityCostRate: value };
  }
}

function withCarVariable(
  inputs: AppInputs,
  carId: string,
  variable: CarSweepable,
  value: number,
): AppInputs {
  return {
    ...inputs,
    cars: inputs.cars.map((c) =>
      c.id === carId ? { ...c, vehicle: { ...c.vehicle, [variable]: value } } : c,
    ),
  };
}

function withCalcVariable(
  inputs: AppInputs,
  calcId: string,
  variable: CalculationSweepable,
  value: number,
): AppInputs {
  return {
    ...inputs,
    calculations: inputs.calculations.map((c) => {
      if (c.id !== calcId) return c;
      switch (variable) {
        case "residualValue":
          return { ...c, ownership: { ...c.ownership, residualValue: value } };
        case "monthlyLeaseTariff":
          return {
            ...c,
            businessLease: { ...c.businessLease, monthlyLeaseTariff: value },
          };
        case "monthlyPayment":
          return {
            ...c,
            privateLease: { ...c.privateLease, monthlyPayment: value },
          };
        case "eigenBijdrage":
          return {
            ...c,
            businessLease: { ...c.businessLease, eigenBijdrage: value },
          };
        case "salarySacrificeMonthly":
          return {
            ...c,
            businessLease: {
              ...c.businessLease,
              salarySacrificeMonthly: value,
            },
          };
      }
    }),
  };
}

export function getCurrentValue(
  inputs: AppInputs,
  variable: SweepableNumeric,
  scope?: SweepScope,
): number {
  const s = variableScope(variable);
  if (s === "shared") {
    switch (variable as SharedSweepable) {
      case "businessKm":
        return inputs.drivingProfile.businessKm;
      case "privateKm":
        return inputs.drivingProfile.privateKm;
      case "bruto":
        return inputs.salary.bruto;
      case "electricityCostPerKwh":
        return inputs.energy.electricityCostPerKwh;
      case "fuelCostPerLiter":
        return inputs.energy.fuelCostPerLiter;
      case "opportunityCostRate":
        return inputs.opportunityCostRate;
    }
  }
  if (s === "car") {
    const carId = scope?.kind === "car" ? scope.carId : inputs.cars[0]?.id;
    const car = inputs.cars.find((c) => c.id === carId) ?? inputs.cars[0];
    if (!car) return 0;
    return car.vehicle[variable as CarSweepable];
  }
  // calculation-scoped
  const calcId =
    scope?.kind === "calculation" ? scope.calculationId : inputs.calculations[0]?.id;
  const calc = inputs.calculations.find((c) => c.id === calcId) ?? inputs.calculations[0];
  if (!calc) return 0;
  switch (variable as CalculationSweepable) {
    case "residualValue":
      return calc.ownership.residualValue;
    case "monthlyLeaseTariff":
      return calc.businessLease.monthlyLeaseTariff;
    case "monthlyPayment":
      return calc.privateLease.monthlyPayment;
    case "eigenBijdrage":
      return calc.businessLease.eigenBijdrage;
    case "salarySacrificeMonthly":
      return calc.businessLease.salarySacrificeMonthly;
  }
}

export function suggestRange(
  inputs: AppInputs,
  variable: SweepableNumeric,
  steps = 21,
  scope?: SweepScope,
): number[] {
  const current = getCurrentValue(inputs, variable, scope);
  const min = Math.max(0, current * 0.5);
  const max = current * 1.5 || 100;
  const step = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + i * step);
}

export function sweep(
  inputs: AppInputs,
  variable: SweepableNumeric,
  range: number[],
  scope?: SweepScope,
): SweepPoint[] {
  const s = variableScope(variable);
  if (s === "shared") {
    return range.map((value) => ({
      x: value,
      result: compareAll(withSharedVariable(inputs, variable as SharedSweepable, value)),
    }));
  }
  if (s === "car") {
    const carId = scope?.kind === "car" ? scope.carId : inputs.cars[0]?.id;
    if (!carId) return [];
    return range.map((value) => ({
      x: value,
      result: compareAll(
        withCarVariable(inputs, carId, variable as CarSweepable, value),
      ),
    }));
  }
  const calcId =
    scope?.kind === "calculation" ? scope.calculationId : inputs.calculations[0]?.id;
  if (!calcId) return [];
  return range.map((value) => ({
    x: value,
    result: compareAll(
      withCalcVariable(inputs, calcId, variable as CalculationSweepable, value),
    ),
  }));
}
