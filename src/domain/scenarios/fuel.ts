import type { OwnershipInputs, VehicleInputs } from "../types";

export function annualFuelCost(vehicle: VehicleInputs, ownership: OwnershipInputs): number {
  if (vehicle.powertrain === "ev" || vehicle.powertrain === "hydrogen") {
    return (
      (vehicle.annualKm / 100) *
      ownership.consumptionKwhPer100km *
      ownership.electricityCostPerKwh
    );
  }
  return (
    (vehicle.annualKm / 100) *
    ownership.consumptionLper100km *
    ownership.fuelCostPerLiter
  );
}
