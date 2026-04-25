import { describe, expect, it } from "vitest";
import { calculateBpm } from "./bpm";
import { getTaxData } from "../taxData";

const data = getTaxData(2026);

describe("BPM 2026", () => {
  it("EV pays the fixed bedrag", () => {
    expect(calculateBpm({ powertrain: "ev", co2: 0 }, data)).toBe(data.bpm.evFixed);
  });

  it("higher CO₂ → higher BPM for combustion", () => {
    const low = calculateBpm({ powertrain: "petrol", co2: 100 }, data);
    const high = calculateBpm({ powertrain: "petrol", co2: 180 }, data);
    expect(high).toBeGreaterThan(low);
  });

  it("diesel surcharge raises BPM above petrol equivalent", () => {
    const petrol = calculateBpm({ powertrain: "petrol", co2: 130 }, data);
    const diesel = calculateBpm({ powertrain: "diesel", co2: 130 }, data);
    expect(diesel).toBeGreaterThan(petrol);
  });
});
