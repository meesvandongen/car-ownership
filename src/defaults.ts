import type {
  AppInputs,
  BusinessLeaseInputs,
  OwnershipInputs,
  PrivateLeaseInputs,
  Scenario,
  ScenarioKind,
  VehicleInputs,
} from "./domain/types";

export const DEFAULT_VEHICLE: VehicleInputs = {
  catalogusprijs: 45_000,
  aanschafprijs: 42_000,
  powertrain: "ev",
  co2: 0,
  weightKg: 1850,
  detYear: 2026,
  residualValue: 18_000,
  consumptionKwhPer100km: 18,
  consumptionLper100km: 6.5,
};

export const DEFAULT_OWNERSHIP: OwnershipInputs = {
  downPayment: 10_000,
  interestRate: 0.065,
  loanTermMonths: 60,
  insurancePerMonth: 95,
  maintenancePerYear: 800,
  holdingMonths: 60,
};

export const DEFAULT_PRIVATE_LEASE: PrivateLeaseInputs = {
  monthlyPayment: 599,
  contractMonths: 48,
  contractKmPerYear: 15_000,
  excessKmTariff: 0.12,
  eigenRisico: 250,
  downPayment: 0,
};

export const DEFAULT_BUSINESS_LEASE: BusinessLeaseInputs = {
  monthlyLeaseTariff: 750,
  eigenBijdrage: 0,
  fuelCardPrivate: true,
  role: "employee",
  rittenregistratie: false,
  salarySacrificeMonthly: 0,
};

const SCENARIO_LABELS: Record<ScenarioKind, string> = {
  ownership: "Private ownership",
  privateLease: "Private lease",
  businessLease: "Business lease",
};

let idCounter = 0;
export function newScenarioId(): string {
  idCounter += 1;
  return `s${Date.now().toString(36)}-${idCounter}`;
}

export function makeScenario(
  kind: ScenarioKind,
  label: string = SCENARIO_LABELS[kind],
): Scenario {
  return {
    id: newScenarioId(),
    label,
    kind,
    vehicle: structuredClone(DEFAULT_VEHICLE),
    ownership: structuredClone(DEFAULT_OWNERSHIP),
    privateLease: structuredClone(DEFAULT_PRIVATE_LEASE),
    businessLease: structuredClone(DEFAULT_BUSINESS_LEASE),
  };
}

export function defaultScenarioLabel(kind: ScenarioKind): string {
  return SCENARIO_LABELS[kind];
}

export const DEFAULTS: AppInputs = {
  taxYear: 2026,
  drivingProfile: {
    province: "Overijssel",
    annualKm: 18_000,
    businessKm: 6_000,
    commuteKm: 8_000,
    privateKm: 4_000,
  },
  salary: {
    bruto: 65_000,
    aowAge: false,
    fiscalPartner: false,
    hypotheekrenteAftrek: 0,
  },
  energy: {
    electricityCostPerKwh: 0.28,
    fuelCostPerLiter: 2.05,
  },
  reimbursement: {
    ratePerKm: 0.23,
  },
  opportunityCostRate: 0.04,
  comparisonMonths: 60,
  scenarios: [
    makeScenario("ownership"),
    makeScenario("privateLease"),
    makeScenario("businessLease"),
  ],
};
