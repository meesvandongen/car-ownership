export type Powertrain = "ev" | "hydrogen" | "phev" | "petrol" | "diesel" | "lpg";

export type Province =
  | "Drenthe"
  | "Flevoland"
  | "Friesland"
  | "Gelderland"
  | "Groningen"
  | "Limburg"
  | "Noord-Brabant"
  | "Noord-Holland"
  | "Overijssel"
  | "Utrecht"
  | "Zeeland"
  | "Zuid-Holland";

export type Role = "employee" | "dga" | "zzp";

export interface VehicleInputs {
  catalogusprijs: number;
  aanschafprijs: number;
  powertrain: Powertrain;
  co2: number;
  weightKg: number;
  detYear: number;
  province: Province;
  holdingMonths: number;
  residualValue: number;
  annualKm: number;
  businessKm: number;
  commuteKm: number;
  privateKm: number;
}

export interface SalaryInputs {
  bruto: number;
  aowAge: boolean;
  fiscalPartner: boolean;
  hypotheekrenteAftrek: number;
}

export interface OwnershipInputs {
  downPayment: number;
  interestRate: number;
  loanTermMonths: number;
  insurancePerMonth: number;
  maintenancePerYear: number;
  electricityCostPerKwh: number;
  fuelCostPerLiter: number;
  consumptionKwhPer100km: number;
  consumptionLper100km: number;
}

export interface PrivateLeaseInputs {
  monthlyPayment: number;
  contractMonths: number;
  contractKmPerYear: number;
  excessKmTariff: number;
  eigenRisico: number;
  downPayment: number;
}

export interface BusinessLeaseInputs {
  monthlyLeaseTariff: number;
  eigenBijdrage: number;
  fuelCardPrivate: boolean;
  role: Role;
  rittenregistratie: boolean;
  // "Cafetariaregeling" / bruto-netto uitruil: employer reduces gross salary
  // by this monthly amount in exchange for the lease car. €0 means the
  // employer fully bears the lease cost (default).
  salarySacrificeMonthly: number;
}

export interface ReimbursementInputs {
  ratePerKm: number;
}

export interface AppInputs {
  taxYear: number;
  vehicle: VehicleInputs;
  salary: SalaryInputs;
  ownership: OwnershipInputs;
  privateLease: PrivateLeaseInputs;
  businessLease: BusinessLeaseInputs;
  reimbursement: ReimbursementInputs;
  // Annual rate (e.g. 0.04 = 4%) used to charge an opportunity cost on capital
  // tied up in a down payment or in the vehicle's residual value. Set to 0
  // to disable.
  opportunityCostRate: number;
  // Comparison horizon used for the "total cost" figure across all scenarios,
  // so that ownership (with a short holding period) is not unfairly compared
  // against a 5-year lease total.
  comparisonMonths: number;
}

export interface CostBreakdown {
  label: string;
  monthly: number;
}

export interface ScenarioResult {
  name: "ownership" | "privateLease" | "businessLease";
  netMonthly: number;
  grossMonthly: number;
  /** Total net cost over `AppInputs.comparisonMonths`. */
  totalCost: number;
  costPerKm: number;
  breakdown: CostBreakdown[];
  warnings: string[];
}

export interface CompareResult {
  ownership: ScenarioResult;
  privateLease: ScenarioResult;
  businessLease: ScenarioResult;
  warnings: string[];
}
