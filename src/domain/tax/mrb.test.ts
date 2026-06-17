import { describe, expect, it } from "vitest";
import { calculateAnnualMrb } from "./mrb";
import { getTaxData } from "../taxData";

const data = getTaxData(2026);

describe("MRB 2026", () => {
  it("EV in 2026 receives 30% korting on top of opcenten", () => {
    const ev = calculateAnnualMrb(
      { weightKg: 1850, powertrain: "ev", province: "Overijssel", taxYear: 2026 },
      data,
    );
    const petrol = calculateAnnualMrb(
      { weightKg: 1850, powertrain: "petrol", province: "Overijssel", taxYear: 2026 },
      data,
    );
    // EV pays the same base rate as petrol, reduced only by the art. 23b
    // korting: (1 − 0.30) = 70% of the petrol equivalent in 2026.
    expect(ev / petrol).toBeCloseTo(0.7, 5);
  });

  it("higher opcenten province yields higher MRB", () => {
    const noordHolland = calculateAnnualMrb(
      { weightKg: 1500, powertrain: "petrol", province: "Noord-Holland", taxYear: 2026 },
      data,
    );
    const groningen = calculateAnnualMrb(
      { weightKg: 1500, powertrain: "petrol", province: "Groningen", taxYear: 2026 },
      data,
    );
    expect(groningen).toBeGreaterThan(noordHolland);
  });

  it("diesel surcharge applies", () => {
    const petrol = calculateAnnualMrb(
      { weightKg: 1500, powertrain: "petrol", province: "Overijssel", taxYear: 2026 },
      data,
    );
    const diesel = calculateAnnualMrb(
      { weightKg: 1500, powertrain: "diesel", province: "Overijssel", taxYear: 2026 },
      data,
    );
    expect(diesel).toBeGreaterThan(petrol);
  });
});
