/**
 * Numerical explorer for the Dutch tax-calculation engine.
 *
 * This script systematically sweeps the input space of every tax function and
 * detects "interesting" cases — boundary jumps, invariant violations, large
 * derivatives, regions where outputs disagree with naive expectations.
 *
 * It is *not* a unit-test. Its output is a JSON catalogue of suspicious points
 * for a human (or LLM) to review against Dutch tax law. After validation, any
 * confirmed-correct cases are promoted into permanent regression tests in
 * `findings.regression.test.ts`; any confirmed bugs are fixed in the source.
 *
 * Run:  npx tsx scripts/explore-tax.ts
 * Out:  scripts/explorer-output/findings.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateBijtelling } from "../src/domain/tax/bijtelling";
import { calculateBpm } from "../src/domain/tax/bpm";
import { calculateAnnualMrb } from "../src/domain/tax/mrb";
import {
  computeIncomeTax,
  marginalNetCost,
  computeBox1Tax,
} from "../src/domain/tax/incomeTax";
import { evaluateBusinessLease } from "../src/domain/scenarios/businessLease";
import { getTaxData } from "../src/domain/taxData";
import { DEFAULTS, makeScenario } from "../src/defaults";
import type { Powertrain, Province, AppInputs, Scenario } from "../src/domain/types";

const data = getTaxData(2026);
const provinces = Object.keys(data.provinces) as Province[];
const allPowertrains: Powertrain[] = ["ev", "hydrogen", "phev", "petrol", "diesel", "lpg"];

interface Finding {
  category: string;
  severity: "info" | "warn" | "error";
  description: string;
  inputs: Record<string, unknown>;
  observed: Record<string, unknown>;
  expected?: Record<string, unknown>;
}

const findings: Finding[] = [];

function record(f: Finding): void {
  findings.push(f);
}

// ---------------------------------------------------------------------------
// 1. Bijtelling — sweep catalogusprijs and look for kinks/jumps and invariants
// ---------------------------------------------------------------------------
function exploreBijtelling(): void {
  for (const powertrain of allPowertrains) {
    for (const detYear of [2020, 2024, 2025, 2026, 2027, 2028, 2029, 2030]) {
      for (const taxYear of [detYear, detYear + 2, detYear + 5, detYear + 7]) {
        let prevCat = 0;
        let prevBij = 0;
        for (let cat = 0; cat <= 200_000; cat += 250) {
          const bij = calculateBijtelling(
            {
              catalogusprijs: cat,
              powertrain,
              detYear,
              taxYear,
              privateKmPerYear: 5_000,
              rittenregistratie: false,
            },
            data,
          );
          if (bij < 0) {
            record({
              category: "bijtelling",
              severity: "error",
              description: "Bijtelling returned negative value.",
              inputs: { powertrain, detYear, taxYear, catalogusprijs: cat },
              observed: { bijtelling: bij },
              expected: { bijtelling: ">= 0" },
            });
          }
          if (!Number.isFinite(bij)) {
            record({
              category: "bijtelling",
              severity: "error",
              description: "Bijtelling is non-finite.",
              inputs: { powertrain, detYear, taxYear, catalogusprijs: cat },
              observed: { bijtelling: bij },
            });
          }
          // Detect kinks (slope changes) — the signature of a bracket boundary.
          if (cat >= 500) {
            const slope = (bij - prevBij) / (cat - prevCat);
            // For powertrains with known caps, the kink should happen at the cap.
            // Record for inspection.
            if (
              powertrain === "ev" &&
              detYear >= 2025 &&
              detYear <= 2027 &&
              taxYear < detYear + 5 &&
              cat >= 29_500 &&
              cat <= 30_500
            ) {
              record({
                category: "bijtelling",
                severity: "info",
                description: `EV cap region (boundary point) for detYear ${detYear}. Slope = ${slope.toFixed(4)}`,
                inputs: { powertrain, detYear, taxYear, catalogusprijs: cat },
                observed: { bijtelling: bij, slope },
              });
            }
          }
          prevCat = cat;
          prevBij = bij;
        }
      }
    }
  }

  // Specific check: the user's stated invariant. Try huge eigen bijdrage values
  // against a wide grid and verify that the *taxable* bijtelling never goes
  // negative. This is computed inside businessLease, but we replicate the math
  // here as well.
  for (const cat of [5_000, 25_000, 60_000, 120_000]) {
    for (const eigen of [0, 100, 500, 2_000, 10_000, 100_000]) {
      const bij = calculateBijtelling(
        {
          catalogusprijs: cat,
          powertrain: "petrol",
          detYear: 2026,
          taxYear: 2026,
          privateKmPerYear: 5_000,
          rittenregistratie: false,
        },
        data,
      );
      const eigenAnnual = Math.min(eigen * 12, bij);
      const taxable = bij - eigenAnnual;
      if (taxable < 0) {
        record({
          category: "bijtelling.eigenBijdrageCap",
          severity: "error",
          description:
            "Eigen bijdrage produces negative taxable bijtelling — should be capped at 0.",
          inputs: { catalogusprijs: cat, eigenBijdrageMonthly: eigen },
          observed: { grossBijtelling: bij, taxableBijtelling: taxable },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. BPM — sweep CO₂ values across all powertrains
// ---------------------------------------------------------------------------
function exploreBpm(): void {
  for (const powertrain of allPowertrains) {
    let prevBpm = -Infinity;
    let maxJump = 0;
    let maxJumpAt = 0;
    for (let co2 = 0; co2 <= 400; co2 += 1) {
      const bpm = calculateBpm({ powertrain, co2 }, data);
      if (bpm < 0) {
        record({
          category: "bpm",
          severity: "error",
          description: "BPM returned negative value.",
          inputs: { powertrain, co2 },
          observed: { bpm },
        });
      }
      if (!Number.isFinite(bpm)) {
        record({
          category: "bpm",
          severity: "error",
          description: "BPM is non-finite.",
          inputs: { powertrain, co2 },
          observed: { bpm },
        });
      }
      // Monotonicity check.
      if (powertrain !== "ev" && powertrain !== "hydrogen" && bpm < prevBpm - 1e-6) {
        record({
          category: "bpm",
          severity: "error",
          description: "BPM decreased as CO₂ increased (monotonicity violation).",
          inputs: { powertrain, co2 },
          observed: { bpm, prevBpm },
        });
      }
      // Detect large per-gram jumps — likely bracket transitions worth inspecting.
      const jump = bpm - prevBpm;
      if (co2 > 0 && jump > maxJump) {
        maxJump = jump;
        maxJumpAt = co2;
      }
      prevBpm = bpm;
    }
    if (powertrain !== "ev" && powertrain !== "hydrogen") {
      record({
        category: "bpm",
        severity: "info",
        description: `Largest single-gram BPM jump for ${powertrain}.`,
        inputs: { powertrain, co2: maxJumpAt },
        observed: { jumpEuro: maxJump },
      });
    }
  }

  // PHEV vs petrol vs diesel relation across the spectrum.
  for (let co2 = 0; co2 <= 250; co2 += 5) {
    const petrol = calculateBpm({ powertrain: "petrol", co2 }, data);
    const diesel = calculateBpm({ powertrain: "diesel", co2 }, data);
    const phev = calculateBpm({ powertrain: "phev", co2 }, data);
    if (diesel < petrol - 1e-6) {
      record({
        category: "bpm",
        severity: "error",
        description: "Diesel BPM is lower than petrol at the same CO₂.",
        inputs: { co2 },
        observed: { petrol, diesel },
      });
    }
    if (phev < petrol - 1e-6) {
      record({
        category: "bpm",
        severity: "error",
        description: "PHEV BPM is lower than petrol at the same CO₂.",
        inputs: { co2 },
        observed: { petrol, phev },
      });
    }
  }

  // Crossover: at low CO₂, petrol BPM is below the EV flat fixed bedrag.
  // Find the precise crossover point.
  const evBpm = calculateBpm({ powertrain: "ev", co2: 0 }, data);
  let crossoverCo2: number | null = null;
  for (let co2 = 0; co2 <= 200; co2 += 1) {
    const petrol = calculateBpm({ powertrain: "petrol", co2 }, data);
    if (petrol > evBpm) {
      crossoverCo2 = co2;
      break;
    }
  }
  if (crossoverCo2 !== null) {
    record({
      category: "bpm.crossover",
      severity: "info",
      description:
        "CO₂ threshold above which petrol BPM exceeds the EV flat fixed bedrag.",
      inputs: { evBpm },
      observed: {
        crossoverCo2,
        petrolAtCrossover: calculateBpm({ powertrain: "petrol", co2: crossoverCo2 }, data),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 3. MRB — sweep weight × powertrain × province × year
// ---------------------------------------------------------------------------
function exploreMrb(): void {
  for (const powertrain of allPowertrains) {
    for (const province of provinces) {
      for (const taxYear of [2026, 2027, 2028, 2029, 2030]) {
        let prevMrb = -Infinity;
        let prevW = 0;
        for (let w = 100; w <= 3500; w += 25) {
          const mrb = calculateAnnualMrb(
            { weightKg: w, powertrain, province, taxYear },
            data,
          );
          if (mrb < 0) {
            record({
              category: "mrb",
              severity: "error",
              description: "MRB returned negative value.",
              inputs: { weightKg: w, powertrain, province, taxYear },
              observed: { mrb },
            });
          }
          if (!Number.isFinite(mrb)) {
            record({
              category: "mrb",
              severity: "error",
              description: "MRB is non-finite.",
              inputs: { weightKg: w, powertrain, province, taxYear },
              observed: { mrb },
            });
          }
          if (mrb < prevMrb - 1e-6) {
            record({
              category: "mrb",
              severity: "error",
              description: "MRB decreased as weight increased (monotonicity violation).",
              inputs: { weightKg: w, powertrain, province, taxYear },
              observed: { mrb, prevMrb, prevWeight: prevW },
            });
          }
          prevMrb = mrb;
          prevW = w;
        }
      }
    }
  }

  // Spot the maximum jump at any weight tier boundary, for each powertrain.
  for (const powertrain of allPowertrains) {
    let maxJump = 0;
    let maxJumpW = 0;
    for (let w = 100; w <= 3500; w += 1) {
      const a = calculateAnnualMrb(
        { weightKg: w, powertrain, province: "Overijssel", taxYear: 2026 },
        data,
      );
      const b = calculateAnnualMrb(
        { weightKg: w + 1, powertrain, province: "Overijssel", taxYear: 2026 },
        data,
      );
      const jump = b - a;
      if (jump > maxJump) {
        maxJump = jump;
        maxJumpW = w;
      }
    }
    record({
      category: "mrb",
      severity: "info",
      description: `Largest 1-kg MRB jump (weight tier transition) for ${powertrain}.`,
      inputs: { powertrain, weightKg: maxJumpW, province: "Overijssel", taxYear: 2026 },
      observed: { jumpEuro: maxJump },
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Income tax — marginal-rate analysis: highest implied marginal rate?
// ---------------------------------------------------------------------------
function exploreIncomeTax(): void {
  let maxMarginal = 0;
  let maxMarginalIncome = 0;
  for (let income = 0; income <= 250_000; income += 100) {
    const r = computeIncomeTax(income, data);
    if (r.netTax < 0) {
      record({
        category: "incomeTax",
        severity: "error",
        description: "Net tax went negative.",
        inputs: { income },
        observed: r,
      });
    }
    if (r.netTax > income + 1e-6) {
      record({
        category: "incomeTax",
        severity: "error",
        description: "Net tax exceeded gross income.",
        inputs: { income },
        observed: r,
      });
    }
    if (income > 0) {
      const prev = computeIncomeTax(income - 100, data);
      if (r.netIncome < prev.netIncome - 1e-6) {
        record({
          category: "incomeTax",
          severity: "error",
          description: "Net income DECREASED as gross income rose (marginal rate > 100%).",
          inputs: { income },
          observed: { netIncome: r.netIncome, prevNetIncome: prev.netIncome },
        });
      }
      const marginal = (r.netTax - prev.netTax) / 100;
      if (marginal > maxMarginal) {
        maxMarginal = marginal;
        maxMarginalIncome = income;
      }
    }
  }
  record({
    category: "incomeTax",
    severity: "info",
    description: "Maximum implied marginal tax rate across the income range (over a €100 step).",
    inputs: { incomeAroundEuro: maxMarginalIncome },
    observed: { marginalRate: maxMarginal },
  });

  // Marginal cost of bijtelling additions, sweeping base × extra.
  for (const base of [25_000, 38_000, 65_000, 79_000, 100_000, 150_000]) {
    for (const extra of [500, 2_000, 10_000, 25_000]) {
      const cost = marginalNetCost(base, extra, data);
      if (cost < 0) {
        record({
          category: "incomeTax",
          severity: "error",
          description: "Marginal cost of additional gross income is negative.",
          inputs: { base, extra },
          observed: { cost },
        });
      }
      if (cost > extra + 1e-6) {
        record({
          category: "incomeTax",
          severity: "error",
          description: "Marginal cost exceeds the gross addition (effective rate > 100%).",
          inputs: { base, extra },
          observed: { cost, ratio: cost / extra },
        });
      }
    }
  }

  // Bracket boundaries continuity test.
  for (const bracket of data.incomeTax.brackets) {
    if (bracket.upTo === null) continue;
    const eps = 0.01;
    const below = computeBox1Tax(bracket.upTo - eps, data);
    const above = computeBox1Tax(bracket.upTo + eps, data);
    record({
      category: "incomeTax",
      severity: "info",
      description: `Continuity at bracket boundary ${bracket.upTo}.`,
      inputs: { boundary: bracket.upTo },
      observed: { below, above, jump: above - below },
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Business lease scenario — eigen bijdrage × bijtelling interactions
// ---------------------------------------------------------------------------
function exploreBusinessLease(): void {
  for (const powertrain of allPowertrains) {
    for (const cat of [5_000, 30_000, 60_000, 120_000]) {
      for (const eigenMonthly of [0, 50, 200, 500, 2_000, 50_000]) {
        for (const bruto of [25_000, 50_000, 100_000, 200_000]) {
          const scenario: Scenario = makeScenario("businessLease");
          scenario.vehicle = {
            ...scenario.vehicle,
            catalogusprijs: cat,
            aanschafprijs: cat * 0.93,
            powertrain,
            detYear: 2026,
          };
          scenario.businessLease = {
            ...scenario.businessLease,
            eigenBijdrage: eigenMonthly,
          };
          const inputs: AppInputs = {
            ...DEFAULTS,
            salary: { ...DEFAULTS.salary, bruto },
            scenarios: [scenario],
          };
          const r = evaluateBusinessLease(inputs, scenario, data);
          const bijLine = r.breakdown.find(
            (b) => b.label === "Bijtelling (net tax cost)",
          )!;
          const eigenLine = r.breakdown.find((b) => b.label === "Eigen bijdrage")!;
          if (bijLine.monthly < -1e-6) {
            record({
              category: "businessLease.bijtelling",
              severity: "error",
              description:
                "Bijtelling tax-cost component went negative (eigen bijdrage subtracted past zero).",
              inputs: { powertrain, cat, eigenMonthly, bruto },
              observed: { bijtellingMonthly: bijLine.monthly, breakdown: r.breakdown },
            });
          }
          if (eigenLine.monthly > eigenMonthly + 1e-6) {
            record({
              category: "businessLease.eigenBijdrage",
              severity: "error",
              description:
                "Eigen bijdrage line exceeds what the user actually pays per month.",
              inputs: { powertrain, cat, eigenMonthly, bruto },
              observed: { eigenLineMonthly: eigenLine.monthly },
            });
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Run all explorations.
// ---------------------------------------------------------------------------
console.log("Exploring bijtelling…");
exploreBijtelling();
console.log("Exploring BPM…");
exploreBpm();
console.log("Exploring MRB…");
exploreMrb();
console.log("Exploring income tax…");
exploreIncomeTax();
console.log("Exploring business lease scenario…");
exploreBusinessLease();

const summary = {
  totalFindings: findings.length,
  errors: findings.filter((f) => f.severity === "error").length,
  warnings: findings.filter((f) => f.severity === "warn").length,
  infos: findings.filter((f) => f.severity === "info").length,
  byCategory: findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1;
    return acc;
  }, {}),
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "explorer-output");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "findings.json");
writeFileSync(outPath, JSON.stringify({ summary, findings }, null, 2));

console.log(`\nSummary: ${JSON.stringify(summary, null, 2)}`);
console.log(`\nWrote ${findings.length} findings to ${outPath}`);
