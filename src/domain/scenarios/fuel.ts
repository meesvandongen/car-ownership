import type { DrivingProfile, EnergyPrices, VehicleInputs } from "../types";

export function annualFuelCost(
  vehicle: VehicleInputs,
  driving: DrivingProfile,
  energy: EnergyPrices,
): number {
  if (vehicle.powertrain === "ev" || vehicle.powertrain === "hydrogen") {
    return (
      (driving.annualKm / 100) *
      vehicle.consumptionKwhPer100km *
      energy.electricityCostPerKwh
    );
  }
  return (
    (driving.annualKm / 100) *
    vehicle.consumptionLper100km *
    energy.fuelCostPerLiter
  );
}
