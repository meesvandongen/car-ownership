import type { AppInputs, CompareResult } from "./types";
import { getTaxData } from "./taxData";
import { evaluateOwnership } from "./scenarios/ownership";
import { evaluatePrivateLease } from "./scenarios/privateLease";
import { evaluateBusinessLease } from "./scenarios/businessLease";

export function compareAll(inputs: AppInputs): CompareResult {
  const data = getTaxData(inputs.taxYear);
  const ownership = evaluateOwnership(inputs, data);
  const privateLease = evaluatePrivateLease(inputs, data);
  const businessLease = evaluateBusinessLease(inputs, data);

  const warnings: string[] = [];

  const ageInYears = new Date().getFullYear() - inputs.vehicle.detYear;
  if (ageInYears >= data.bijtelling.youngtimerMinAgeYears) {
    warnings.push(
      `Vehicle qualifies as Youngtimer (${data.bijtelling.youngtimerRate * 100}% over dagwaarde, not list price).`,
    );
  }
  if (inputs.vehicle.powertrain === "ev" && inputs.taxYear >= 2030) {
    warnings.push("From 2030 the EV MRB korting is 0% — full MRB applies.");
  }

  return { ownership, privateLease, businessLease, warnings };
}
