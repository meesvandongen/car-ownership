import type { AppInputs, CompareResult } from "./types";
import { compareAll } from "./compare";

export type SweepableNumeric =
  | "annualKm"
  | "catalogusprijs"
  | "aanschafprijs"
  | "co2"
  | "weightKg"
  | "residualValue"
  | "bruto"
  | "electricityCostPerKwh"
  | "fuelCostPerLiter"
  | "monthlyLeaseTariff"
  | "monthlyPayment"
  | "eigenBijdrage"
  | "salarySacrificeMonthly"
  | "opportunityCostRate";

export interface SweepPoint {
  x: number;
  result: CompareResult;
}

const VARIABLE_PATHS: Record<SweepableNumeric, (i: AppInputs, v: number) => AppInputs> = {
  annualKm: (i, v) => ({ ...i, vehicle: { ...i.vehicle, annualKm: v } }),
  catalogusprijs: (i, v) => ({ ...i, vehicle: { ...i.vehicle, catalogusprijs: v } }),
  aanschafprijs: (i, v) => ({ ...i, vehicle: { ...i.vehicle, aanschafprijs: v } }),
  co2: (i, v) => ({ ...i, vehicle: { ...i.vehicle, co2: v } }),
  weightKg: (i, v) => ({ ...i, vehicle: { ...i.vehicle, weightKg: v } }),
  residualValue: (i, v) => ({ ...i, vehicle: { ...i.vehicle, residualValue: v } }),
  bruto: (i, v) => ({ ...i, salary: { ...i.salary, bruto: v } }),
  electricityCostPerKwh: (i, v) => ({
    ...i,
    ownership: { ...i.ownership, electricityCostPerKwh: v },
  }),
  fuelCostPerLiter: (i, v) => ({
    ...i,
    ownership: { ...i.ownership, fuelCostPerLiter: v },
  }),
  monthlyLeaseTariff: (i, v) => ({
    ...i,
    businessLease: { ...i.businessLease, monthlyLeaseTariff: v },
  }),
  monthlyPayment: (i, v) => ({
    ...i,
    privateLease: { ...i.privateLease, monthlyPayment: v },
  }),
  eigenBijdrage: (i, v) => ({
    ...i,
    businessLease: { ...i.businessLease, eigenBijdrage: v },
  }),
  salarySacrificeMonthly: (i, v) => ({
    ...i,
    businessLease: { ...i.businessLease, salarySacrificeMonthly: v },
  }),
  opportunityCostRate: (i, v) => ({ ...i, opportunityCostRate: v }),
};

export function getCurrentValue(inputs: AppInputs, variable: SweepableNumeric): number {
  switch (variable) {
    case "annualKm":
      return inputs.vehicle.annualKm;
    case "catalogusprijs":
      return inputs.vehicle.catalogusprijs;
    case "aanschafprijs":
      return inputs.vehicle.aanschafprijs;
    case "co2":
      return inputs.vehicle.co2;
    case "weightKg":
      return inputs.vehicle.weightKg;
    case "residualValue":
      return inputs.vehicle.residualValue;
    case "bruto":
      return inputs.salary.bruto;
    case "electricityCostPerKwh":
      return inputs.ownership.electricityCostPerKwh;
    case "fuelCostPerLiter":
      return inputs.ownership.fuelCostPerLiter;
    case "monthlyLeaseTariff":
      return inputs.businessLease.monthlyLeaseTariff;
    case "monthlyPayment":
      return inputs.privateLease.monthlyPayment;
    case "eigenBijdrage":
      return inputs.businessLease.eigenBijdrage;
    case "salarySacrificeMonthly":
      return inputs.businessLease.salarySacrificeMonthly;
    case "opportunityCostRate":
      return inputs.opportunityCostRate;
  }
}

export function suggestRange(
  inputs: AppInputs,
  variable: SweepableNumeric,
  steps = 21,
): number[] {
  const current = getCurrentValue(inputs, variable);
  const min = Math.max(0, current * 0.5);
  const max = current * 1.5 || 100;
  const step = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + i * step);
}

export function sweep(
  inputs: AppInputs,
  variable: SweepableNumeric,
  range: number[],
): SweepPoint[] {
  const apply = VARIABLE_PATHS[variable];
  return range.map((value) => ({ x: value, result: compareAll(apply(inputs, value)) }));
}
