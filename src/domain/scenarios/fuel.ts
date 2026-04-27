import type { DrivingProfile, EnergyPrices, VehicleInputs } from "../types";
import { totalAnnualKm } from "../types";

export function annualFuelCost(
  vehicle: VehicleInputs,
  driving: DrivingProfile,
  energy: EnergyPrices,
): number {
  const km = totalAnnualKm(driving);
  if (vehicle.powertrain === "ev" || vehicle.powertrain === "hydrogen") {
    return (km / 100) * vehicle.consumptionKwhPer100km * energy.electricityCostPerKwh;
  }
  return (km / 100) * vehicle.consumptionLper100km * energy.fuelCostPerLiter;
}
