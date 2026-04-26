import type { AppInputs } from "../domain/types";

const KEYS: { path: string[]; key: string }[] = [
  { path: ["taxYear"], key: "ty" },
  { path: ["vehicle", "catalogusprijs"], key: "cat" },
  { path: ["vehicle", "aanschafprijs"], key: "ans" },
  { path: ["vehicle", "powertrain"], key: "pt" },
  { path: ["vehicle", "co2"], key: "co2" },
  { path: ["vehicle", "weightKg"], key: "wt" },
  { path: ["vehicle", "detYear"], key: "det" },
  { path: ["vehicle", "province"], key: "prov" },
  { path: ["vehicle", "holdingMonths"], key: "hold" },
  { path: ["vehicle", "residualValue"], key: "rv" },
  { path: ["vehicle", "annualKm"], key: "km" },
  { path: ["vehicle", "businessKm"], key: "bkm" },
  { path: ["vehicle", "commuteKm"], key: "ckm" },
  { path: ["vehicle", "privateKm"], key: "pkm" },
  { path: ["salary", "bruto"], key: "bruto" },
  { path: ["salary", "aowAge"], key: "aow" },
  { path: ["ownership", "downPayment"], key: "dp" },
  { path: ["ownership", "interestRate"], key: "ir" },
  { path: ["ownership", "loanTermMonths"], key: "lt" },
  { path: ["ownership", "insurancePerMonth"], key: "ins" },
  { path: ["ownership", "maintenancePerYear"], key: "maint" },
  { path: ["ownership", "electricityCostPerKwh"], key: "kwh" },
  { path: ["ownership", "fuelCostPerLiter"], key: "ltr" },
  { path: ["ownership", "consumptionKwhPer100km"], key: "kwh100" },
  { path: ["ownership", "consumptionLper100km"], key: "l100" },
  { path: ["privateLease", "monthlyPayment"], key: "plm" },
  { path: ["privateLease", "contractMonths"], key: "plct" },
  { path: ["privateLease", "contractKmPerYear"], key: "plkm" },
  { path: ["privateLease", "excessKmTariff"], key: "plex" },
  { path: ["privateLease", "downPayment"], key: "pldp" },
  { path: ["businessLease", "monthlyLeaseTariff"], key: "blm" },
  { path: ["businessLease", "eigenBijdrage"], key: "eb" },
  { path: ["businessLease", "fuelCardPrivate"], key: "fcp" },
  { path: ["businessLease", "rittenregistratie"], key: "rit" },
  { path: ["businessLease", "role"], key: "role" },
  { path: ["businessLease", "salarySacrificeMonthly"], key: "sac" },
  { path: ["reimbursement", "ratePerKm"], key: "reim" },
  { path: ["opportunityCostRate"], key: "ocr" },
  { path: ["comparisonMonths"], key: "cmp" },
];

function getAt(obj: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

function setAt(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const next = cur[path[i]];
    if (!next || typeof next !== "object") return;
    cur = next as Record<string, unknown>;
  }
  cur[path[path.length - 1]] = value;
}

export function serializeToUrl(inputs: AppInputs): string {
  const params = new URLSearchParams();
  for (const { path, key } of KEYS) {
    const v = getAt(inputs as unknown as Record<string, unknown>, path);
    if (v === undefined || v === null) continue;
    params.set(key, String(v));
  }
  return params.toString();
}

export function applyUrlToInputs(base: AppInputs, search: string): AppInputs {
  const next = structuredClone(base);
  const params = new URLSearchParams(search);
  for (const { path, key } of KEYS) {
    if (!params.has(key)) continue;
    const raw = params.get(key)!;
    const existing = getAt(next as unknown as Record<string, unknown>, path);
    if (typeof existing === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) setAt(next as unknown as Record<string, unknown>, path, n);
    } else if (typeof existing === "boolean") {
      setAt(
        next as unknown as Record<string, unknown>,
        path,
        raw === "true" || raw === "1",
      );
    } else {
      setAt(next as unknown as Record<string, unknown>, path, raw);
    }
  }
  return next;
}
