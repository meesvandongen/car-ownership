import type { AppInputs, CompareResult } from "./types";
import { compareAll } from "./compare";

export type SharedSweepable =
  | "annualKm"
  | "bruto"
  | "electricityCostPerKwh"
  | "fuelCostPerLiter"
  | "opportunityCostRate";

export type ScenarioSweepable =
  | "catalogusprijs"
  | "aanschafprijs"
  | "co2"
  | "weightKg"
  | "residualValue"
  | "monthlyLeaseTariff"
  | "monthlyPayment"
  | "eigenBijdrage"
  | "salarySacrificeMonthly";

export type SweepableNumeric = SharedSweepable | ScenarioSweepable;

export const SHARED_SWEEPABLES: SharedSweepable[] = [
  "annualKm",
  "bruto",
  "electricityCostPerKwh",
  "fuelCostPerLiter",
  "opportunityCostRate",
];

export const SCENARIO_SWEEPABLES: ScenarioSweepable[] = [
  "catalogusprijs",
  "aanschafprijs",
  "co2",
  "weightKg",
  "residualValue",
  "monthlyLeaseTariff",
  "monthlyPayment",
  "eigenBijdrage",
  "salarySacrificeMonthly",
];

export function isScenarioSweepable(v: SweepableNumeric): v is ScenarioSweepable {
  return (SCENARIO_SWEEPABLES as readonly string[]).includes(v);
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
    case "annualKm":
      return {
        ...inputs,
        drivingProfile: { ...inputs.drivingProfile, annualKm: value },
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

function withScenarioVariable(
  inputs: AppInputs,
  scenarioId: string,
  variable: ScenarioSweepable,
  value: number,
): AppInputs {
  return {
    ...inputs,
    scenarios: inputs.scenarios.map((s) => {
      if (s.id !== scenarioId) return s;
      switch (variable) {
        case "catalogusprijs":
          return { ...s, vehicle: { ...s.vehicle, catalogusprijs: value } };
        case "aanschafprijs":
          return { ...s, vehicle: { ...s.vehicle, aanschafprijs: value } };
        case "co2":
          return { ...s, vehicle: { ...s.vehicle, co2: value } };
        case "weightKg":
          return { ...s, vehicle: { ...s.vehicle, weightKg: value } };
        case "residualValue":
          return { ...s, vehicle: { ...s.vehicle, residualValue: value } };
        case "monthlyLeaseTariff":
          return {
            ...s,
            businessLease: { ...s.businessLease, monthlyLeaseTariff: value },
          };
        case "monthlyPayment":
          return {
            ...s,
            privateLease: { ...s.privateLease, monthlyPayment: value },
          };
        case "eigenBijdrage":
          return {
            ...s,
            businessLease: { ...s.businessLease, eigenBijdrage: value },
          };
        case "salarySacrificeMonthly":
          return {
            ...s,
            businessLease: {
              ...s.businessLease,
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
  scenarioId?: string,
): number {
  switch (variable) {
    case "annualKm":
      return inputs.drivingProfile.annualKm;
    case "bruto":
      return inputs.salary.bruto;
    case "electricityCostPerKwh":
      return inputs.energy.electricityCostPerKwh;
    case "fuelCostPerLiter":
      return inputs.energy.fuelCostPerLiter;
    case "opportunityCostRate":
      return inputs.opportunityCostRate;
  }
  const scenario =
    inputs.scenarios.find((s) => s.id === scenarioId) ?? inputs.scenarios[0];
  if (!scenario) return 0;
  switch (variable) {
    case "catalogusprijs":
      return scenario.vehicle.catalogusprijs;
    case "aanschafprijs":
      return scenario.vehicle.aanschafprijs;
    case "co2":
      return scenario.vehicle.co2;
    case "weightKg":
      return scenario.vehicle.weightKg;
    case "residualValue":
      return scenario.vehicle.residualValue;
    case "monthlyLeaseTariff":
      return scenario.businessLease.monthlyLeaseTariff;
    case "monthlyPayment":
      return scenario.privateLease.monthlyPayment;
    case "eigenBijdrage":
      return scenario.businessLease.eigenBijdrage;
    case "salarySacrificeMonthly":
      return scenario.businessLease.salarySacrificeMonthly;
  }
}

export function suggestRange(
  inputs: AppInputs,
  variable: SweepableNumeric,
  steps = 21,
  scenarioId?: string,
): number[] {
  const current = getCurrentValue(inputs, variable, scenarioId);
  const min = Math.max(0, current * 0.5);
  const max = current * 1.5 || 100;
  const step = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + i * step);
}

export function sweep(
  inputs: AppInputs,
  variable: SweepableNumeric,
  range: number[],
  scenarioId?: string,
): SweepPoint[] {
  if (isScenarioSweepable(variable)) {
    const id = scenarioId ?? inputs.scenarios[0]?.id;
    if (!id) return [];
    return range.map((value) => ({
      x: value,
      result: compareAll(withScenarioVariable(inputs, id, variable, value)),
    }));
  }
  return range.map((value) => ({
    x: value,
    result: compareAll(withSharedVariable(inputs, variable, value)),
  }));
}
