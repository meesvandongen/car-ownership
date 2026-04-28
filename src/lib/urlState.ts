import type { AppInputs, Calculation, Car } from "../domain/types";
import { newId } from "../defaults";

const SHARED_KEYS: { path: string[]; key: string }[] = [
  { path: ["taxYear"], key: "ty" },
  { path: ["drivingProfile", "province"], key: "prov" },
  { path: ["drivingProfile", "businessKm"], key: "bkm" },
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

interface SerializedCar {
  id: string;
  label: string;
  vehicle: Car["vehicle"];
}

interface SerializedCalc {
  id: string;
  carId: string;
  label: string;
  kind: Calculation["kind"];
  ownership: Calculation["ownership"];
  privateLease: Calculation["privateLease"];
  businessLease: Calculation["businessLease"];
}

export function serializeToUrl(inputs: AppInputs): string {
  const params = new URLSearchParams();
  for (const { path, key } of SHARED_KEYS) {
    const v = getAt(inputs as unknown as Record<string, unknown>, path);
    if (v === undefined || v === null) continue;
    params.set(key, String(v));
  }
  // Stable ids in the URL preserve the car↔calculation links across reloads.
  const cars: SerializedCar[] = inputs.cars.map((c) => ({
    id: c.id,
    label: c.label,
    vehicle: c.vehicle,
  }));
  const calcs: SerializedCalc[] = inputs.calculations.map((c) => ({
    id: c.id,
    carId: c.carId,
    label: c.label,
    kind: c.kind,
    ownership: c.ownership,
    privateLease: c.privateLease,
    businessLease: c.businessLease,
  }));
  params.set("cars", JSON.stringify(cars));
  params.set("calcs", JSON.stringify(calcs));
  return params.toString();
}

function isCarLike(v: unknown): v is SerializedCar {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.vehicle === "object" &&
    o.vehicle !== null
  );
}

function isCalcLike(v: unknown): v is SerializedCalc {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.carId === "string" &&
    typeof o.label === "string" &&
    typeof o.kind === "string" &&
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

  const carsRaw = params.get("cars");
  const calcsRaw = params.get("calcs");
  if (carsRaw && calcsRaw) {
    try {
      const parsedCars = JSON.parse(carsRaw);
      const parsedCalcs = JSON.parse(calcsRaw);
      if (
        Array.isArray(parsedCars) &&
        Array.isArray(parsedCalcs) &&
        parsedCars.length > 0 &&
        parsedCalcs.length > 0 &&
        parsedCars.every(isCarLike) &&
        parsedCalcs.every(isCalcLike)
      ) {
        // Re-id everything to avoid collisions, but preserve the carId links.
        const idMap = new Map<string, string>();
        const cars: Car[] = parsedCars.map((c) => {
          const fresh = newId("car");
          idMap.set(c.id, fresh);
          return { id: fresh, label: c.label, vehicle: c.vehicle };
        });
        const calcs: Calculation[] = parsedCalcs
          .filter((c) => idMap.has(c.carId))
          .map((c) => ({
            id: newId("calc"),
            carId: idMap.get(c.carId)!,
            label: c.label,
            kind: c.kind,
            ownership: c.ownership,
            privateLease: c.privateLease,
            businessLease: c.businessLease,
          }));
        if (cars.length > 0 && calcs.length > 0) {
          next.cars = cars;
          next.calculations = calcs;
        }
      }
    } catch {
      // ignore malformed payload, keep defaults
    }
  }
  return next;
}
