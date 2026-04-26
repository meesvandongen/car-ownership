import type { AppInputs, Scenario } from "../domain/types";
import { newScenarioId } from "../defaults";

const SHARED_KEYS: { path: string[]; key: string }[] = [
  { path: ["taxYear"], key: "ty" },
  { path: ["drivingProfile", "province"], key: "prov" },
  { path: ["drivingProfile", "annualKm"], key: "km" },
  { path: ["drivingProfile", "businessKm"], key: "bkm" },
  { path: ["drivingProfile", "commuteKm"], key: "ckm" },
  { path: ["drivingProfile", "privateKm"], key: "pkm" },
  { path: ["salary", "bruto"], key: "bruto" },
  { path: ["salary", "aowAge"], key: "aow" },
  { path: ["salary", "fiscalPartner"], key: "fp" },
  { path: ["salary", "hypotheekrenteAftrek"], key: "hra" },
  { path: ["energy", "electricityCostPerKwh"], key: "kwh" },
  { path: ["energy", "fuelCostPerLiter"], key: "ltr" },
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
  for (const { path, key } of SHARED_KEYS) {
    const v = getAt(inputs as unknown as Record<string, unknown>, path);
    if (v === undefined || v === null) continue;
    params.set(key, String(v));
  }
  // Scenarios: strip the runtime-only `id` field; on load we generate fresh ids.
  const slim = inputs.scenarios.map(({ id: _id, ...rest }) => rest);
  params.set("s", JSON.stringify(slim));
  return params.toString();
}

function isScenarioLike(v: unknown): v is Omit<Scenario, "id"> {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.label === "string" &&
    typeof o.kind === "string" &&
    typeof o.vehicle === "object" &&
    typeof o.ownership === "object" &&
    typeof o.privateLease === "object" &&
    typeof o.businessLease === "object"
  );
}

export function applyUrlToInputs(base: AppInputs, search: string): AppInputs {
  const next = structuredClone(base);
  const params = new URLSearchParams(search);
  for (const { path, key } of SHARED_KEYS) {
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
  const sRaw = params.get("s");
  if (sRaw) {
    try {
      const parsed = JSON.parse(sRaw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isScenarioLike)) {
        next.scenarios = parsed.map((s) => ({
          id: newScenarioId(),
          ...(s as Omit<Scenario, "id">),
        }));
      }
    } catch {
      // ignore malformed scenarios payload, keep defaults
    }
  }
  return next;
}
