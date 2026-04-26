<script lang="ts">
  import * as Plot from "@observablehq/plot";
  import type { AppInputs } from "../domain/types";
  import {
    type SweepableNumeric,
    type SweepScope,
    getCurrentValue,
    suggestRange,
    sweep,
    variableScope,
  } from "../domain/sensitivity";

  let { inputs }: { inputs: AppInputs } = $props();

  const VARIABLES: { key: SweepableNumeric; label: string }[] = [
    { key: "annualKm", label: "Annual mileage (km)" },
    { key: "bruto", label: "Bruto salary (€)" },
    { key: "electricityCostPerKwh", label: "Electricity (€/kWh)" },
    { key: "fuelCostPerLiter", label: "Fuel (€/L)" },
    { key: "opportunityCostRate", label: "Opportunity cost rate" },
    { key: "catalogusprijs", label: "Catalogusprijs (€) — per car" },
    { key: "aanschafprijs", label: "Aanschafprijs (€) — per car" },
    { key: "co2", label: "CO₂ (g/km) — per car" },
    { key: "weightKg", label: "Weight (kg) — per car" },
    { key: "residualValue", label: "Residual value (€) — per calc" },
    { key: "monthlyLeaseTariff", label: "Business lease tariff (€/mo) — per calc" },
    { key: "monthlyPayment", label: "Private lease payment (€/mo) — per calc" },
    { key: "eigenBijdrage", label: "Eigen bijdrage (€/mo) — per calc" },
    { key: "salarySacrificeMonthly", label: "Salary sacrifice (€/mo) — per calc" },
  ];

  let variable = $state<SweepableNumeric>("annualKm");
  let carId = $state<string>("");
  let calcId = $state<string>("");
  let chartEl: HTMLDivElement;

  const scopeKind = $derived(variableScope(variable));

  $effect(() => {
    if (!inputs.cars.find((c) => c.id === carId)) {
      carId = inputs.cars[0]?.id ?? "";
    }
    if (!inputs.calculations.find((c) => c.id === calcId)) {
      calcId = inputs.calculations[0]?.id ?? "";
    }
  });

  const scope = $derived<SweepScope>(
    scopeKind === "shared"
      ? { kind: "shared" }
      : scopeKind === "car"
        ? { kind: "car", carId }
        : { kind: "calculation", calculationId: calcId },
  );

  $effect(() => {
    if (!chartEl) return;
    const range = suggestRange(inputs, variable, 31, scope);
    const points = sweep(inputs, variable, range, scope);
    const flat = points.flatMap((p) =>
      p.result.results.map((s) => ({
        x: p.x,
        // Distinguish multiple cars: include car label when more than one car.
        scenario:
          inputs.cars.length > 1 ? `${s.carLabel} — ${s.label}` : s.label,
        net: s.netMonthly,
      })),
    );
    if (flat.length === 0) {
      chartEl.replaceChildren();
      return;
    }
    const current = getCurrentValue(inputs, variable, scope);
    const variableLabel = VARIABLES.find((v) => v.key === variable)?.label ?? variable;
    const labels = Array.from(new Set(flat.map((f) => f.scenario)));

    const chart = Plot.plot({
      width: chartEl.clientWidth || 720,
      height: 380,
      marginLeft: 70,
      marginBottom: 50,
      style: {
        background: "transparent",
        color: "#e6edf3",
        fontSize: "12px",
      },
      x: { label: variableLabel, grid: true },
      y: { label: "Net €/month", grid: true, tickFormat: (d) => `€${d}` },
      color: {
        legend: true,
        domain: labels,
      },
      marks: [
        Plot.lineY(flat, {
          x: "x",
          y: "net",
          stroke: "scenario",
          strokeWidth: 2,
          curve: "monotone-x",
        }),
        Plot.ruleX([current], { stroke: "#8b949e", strokeDasharray: "4 4" }),
        Plot.text(
          [{ x: current, label: "current" }],
          {
            x: "x",
            y: () => Math.max(...flat.map((p) => p.net)),
            text: "label",
            textAnchor: "start",
            dx: 6,
            fill: "#8b949e",
          },
        ),
      ],
    });
    chartEl.replaceChildren(chart);
  });
</script>

<div class="panel">
  <div class="header">
    <h2>Sensitivity</h2>
    <div class="controls">
      <select bind:value={variable}>
        {#each VARIABLES as v}
          <option value={v.key}>{v.label}</option>
        {/each}
      </select>
      {#if scopeKind === "car"}
        <select bind:value={carId} title="Which car to sweep">
          {#each inputs.cars as c (c.id)}
            <option value={c.id}>{c.label}</option>
          {/each}
        </select>
      {:else if scopeKind === "calculation"}
        <select bind:value={calcId} title="Which calculation to sweep">
          {#each inputs.calculations as c (c.id)}
            <option value={c.id}>
              {inputs.cars.find((car) => car.id === c.carId)?.label ?? "?"} — {c.label}
            </option>
          {/each}
        </select>
      {/if}
    </div>
  </div>
  <p class="hint">
    Sweeps the selected variable across ±50% of its current value, holding all others
    fixed.
    {#if scopeKind === "shared"}
      Shared variables affect every calculation.
    {:else if scopeKind === "car"}
      Per-car variables only change calculations attached to the chosen car.
    {:else}
      Per-calc variables only change one calculation.
    {/if}
  </p>
  <div class="chart" bind:this={chartEl}></div>
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .header h2 {
    margin: 0;
  }
  .controls {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .controls select {
    width: auto;
    max-width: 320px;
  }
  .hint {
    margin: 0 0 10px;
    color: var(--muted);
    font-size: 12px;
  }
  .chart :global(svg) {
    overflow: visible;
  }
</style>
