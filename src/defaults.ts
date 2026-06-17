import type {
  AppInputs,
  BusinessLeaseInputs,
  Calculation,
  Car,
  OwnershipInputs,
  PrivateLeaseInputs,
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
  consumptionKwhPer100km: 18,
  consumptionLper100km: 6.5,
  lpgG3: true,
  dieselFijnstof: false,
};

export const DEFAULT_OWNERSHIP: OwnershipInputs = {
  downPayment: 10_000,
  interestRate: 0.065,
  loanTermMonths: 60,
  insurancePerMonth: 95,
  maintenancePerYear: 800,
  holdingMonths: 60,
  residualValue: 18_000,
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
  fuelPaidByEmployee: false,
  role: "employee",
  rittenregistratie: false,
  salarySacrificeMonthly: 0,
};

const KIND_LABELS: Record<ScenarioKind, string> = {
  ownership: "Ownership",
  privateLease: "Private lease",
  businessLease: "Business lease",
};

export function calculationKindLabel(kind: ScenarioKind): string {
  return KIND_LABELS[kind];
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function makeCar(label = "My car"): Car {
  return {
    id: newId("car"),
    label,
    vehicle: structuredClone(DEFAULT_VEHICLE),
  };
}

export function makeCalculation(
  carId: string,
  kind: ScenarioKind,
  label: string = KIND_LABELS[kind],
): Calculation {
  return {
    id: newId("calc"),
    carId,
    label,
    kind,
    ownership: structuredClone(DEFAULT_OWNERSHIP),
    privateLease: structuredClone(DEFAULT_PRIVATE_LEASE),
    businessLease: structuredClone(DEFAULT_BUSINESS_LEASE),
  };
}

const defaultCar = makeCar("My car");

export const DEFAULTS: AppInputs = {
  taxYear: 2026,
  drivingProfile: {
    province: "Overijssel",
    // 6_000 zakelijk + 8_000 woon-werk under the previous split.
    businessKm: 14_000,
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
  cars: [defaultCar],
  calculations: [
    makeCalculation(defaultCar.id, "ownership"),
    makeCalculation(defaultCar.id, "privateLease"),
    makeCalculation(defaultCar.id, "businessLease"),
  ],
};
