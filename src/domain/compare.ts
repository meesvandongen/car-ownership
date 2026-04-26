import type { AppInputs, CompareResult, Scenario, ScenarioResult } from "./types";
import { getTaxData } from "./taxData";
import { evaluateOwnership } from "./scenarios/ownership";
import { evaluatePrivateLease } from "./scenarios/privateLease";
import { evaluateBusinessLease } from "./scenarios/businessLease";
import type { TaxData } from "./taxData";

export function evaluateScenario(
  inputs: AppInputs,
  scenario: Scenario,
  data: TaxData,
): ScenarioResult {
  switch (scenario.kind) {
    case "ownership":
      return evaluateOwnership(inputs, scenario, data);
    case "privateLease":
      return evaluatePrivateLease(inputs, scenario, data);
    case "businessLease":
      return evaluateBusinessLease(inputs, scenario, data);
  }
}

export function compareAll(inputs: AppInputs): CompareResult {
  const data = getTaxData(inputs.taxYear);
  const scenarios = inputs.scenarios.map((s) => evaluateScenario(inputs, s, data));

  const warnings: string[] = [];

  const youngtimerYears = data.bijtelling.youngtimerMinAgeYears;
  const youngtimerRate = data.bijtelling.youngtimerRate;
  const currentYear = new Date().getFullYear();
  const youngtimerLabels = inputs.scenarios
    .filter((s) => currentYear - s.vehicle.detYear >= youngtimerYears)
    .map((s) => s.label);
  if (youngtimerLabels.length > 0) {
    warnings.push(
      `Youngtimer (${youngtimerRate * 100}% over dagwaarde, not list price): ${youngtimerLabels.join(", ")}.`,
    );
  }

  const hasEv = inputs.scenarios.some((s) => s.vehicle.powertrain === "ev");
  if (hasEv && inputs.taxYear >= 2030) {
    warnings.push("From 2030 the EV MRB korting is 0% — full MRB applies.");
  }

  return { scenarios, warnings };
}
