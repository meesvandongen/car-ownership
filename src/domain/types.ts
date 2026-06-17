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

export type ScenarioKind = "ownership" | "privateLease" | "businessLease";

/**
 * The intrinsic spec of a vehicle. Properties of the car itself, independent
 * of how it's acquired. A single Car can back multiple Calculations.
 */
export interface VehicleInputs {
  catalogusprijs: number;
  aanschafprijs: number;
  powertrain: Powertrain;
  co2: number;
  weightKg: number;
  detYear: number;
  consumptionKwhPer100km: number;
  consumptionLper100km: number;
  /**
   * LPG only: the car has a certified G3/R115 gas installation, which pays the
   * reduced MRB gas toeslag. Defaults to true. Ignored for other powertrains.
   */
  lpgG3?: boolean;
  /**
   * Diesel only: older diesel with PM emission above the limit (no particulate
   * filter), which owes the 19% MRB fijnstoftoeslag. Defaults to false.
   */
  dieselFijnstof?: boolean;
}

export interface Car {
  id: string;
  label: string;
  vehicle: VehicleInputs;
}

export interface SalaryInputs {
  bruto: number;
  aowAge: boolean;
  fiscalPartner: boolean;
  hypotheekrenteAftrek: number;
}

/**
 * Inputs specific to an ownership calculation. `holdingMonths` and
 * `residualValue` live here (not on the Car) because they belong to the
 * decision of buying-and-holding for a particular period — the same car can
 * be evaluated against multiple holding periods with different residuals.
 */
export interface OwnershipInputs {
  downPayment: number;
  interestRate: number;
  loanTermMonths: number;
  insurancePerMonth: number;
  maintenancePerYear: number;
  holdingMonths: number;
  residualValue: number;
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
  // When true, the employer bills the employee back for the calculated annual
  // fuel cost. Mechanically this is an eigen bijdrage (vergoeding aan de
  // werkgever) on top of `eigenBijdrage`: it reduces the taxable bijtelling
  // base 1:1 and is paid out of net salary. Splitting fuel by km purpose isn't
  // realistic for a tankpas — the only legitimate way to make the employee
  // bear (part of) the fuel cost is via an employer reimbursement.
  fuelPaidByEmployee: boolean;
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

export interface DrivingProfile {
  province: Province;
  // Zakelijke kilometers — includes woon-werkverkeer. Both qualify for the
  // €0,23/km gerichte vrijstelling, and woon-werkverkeer is treated as
  // zakelijk for the bijtelling 500-km test, so a single field covers both
  // and avoids the redundant total-vs-sum bookkeeping.
  businessKm: number;
  privateKm: number;
}

export function totalAnnualKm(driving: DrivingProfile): number {
  return driving.businessKm + driving.privateKm;
}

export interface EnergyPrices {
  electricityCostPerKwh: number;
  fuelCostPerLiter: number;
}

/**
 * A single contract / acquisition scenario for a specific Car. Multiple
 * Calculations can share one Car (e.g. ownership-vs-business-lease for the
 * same vehicle), avoiding duplicated vehicle inputs.
 */
export interface Calculation {
  id: string;
  carId: string;
  label: string;
  kind: ScenarioKind;
  ownership: OwnershipInputs;
  privateLease: PrivateLeaseInputs;
  businessLease: BusinessLeaseInputs;
}

export interface AppInputs {
  taxYear: number;
  drivingProfile: DrivingProfile;
  salary: SalaryInputs;
  energy: EnergyPrices;
  reimbursement: ReimbursementInputs;
  // Annual rate (e.g. 0.04 = 4%) used to charge an opportunity cost on capital
  // tied up in a down payment or in the vehicle's residual value. Set to 0
  // to disable.
  opportunityCostRate: number;
  // Comparison horizon used for the "total cost" figure across all scenarios,
  // so that ownership (with a short holding period) is not unfairly compared
  // against a 5-year lease total.
  comparisonMonths: number;
  cars: Car[];
  calculations: Calculation[];
}

export interface CostBreakdown {
  label: string;
  monthly: number;
}

export interface ScenarioResult {
  id: string;
  label: string;
  carId: string;
  carLabel: string;
  kind: ScenarioKind;
  netMonthly: number;
  grossMonthly: number;
  /** Total net cost over `AppInputs.comparisonMonths`. */
  totalCost: number;
  costPerKm: number;
  breakdown: CostBreakdown[];
  warnings: string[];
}

export interface CompareResult {
  results: ScenarioResult[];
  warnings: string[];
}
