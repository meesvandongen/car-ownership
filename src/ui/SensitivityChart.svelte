<script lang="ts">
  import * as Plot from "@observablehq/plot";
  import type { AppInputs } from "../domain/types";
  import {
    type SweepableNumeric,
    getCurrentValue,
    isScenarioSweepable,
    suggestRange,
    sweep,
  } from "../domain/sensitivity";

  let { inputs }: { inputs: AppInputs } = $props();

  const VARIABLES: { key: SweepableNumeric; label: string }[] = [
    { key: "annualKm", label: "Annual mileage (km)" },
    { key: "bruto", label: "Bruto salary (€)" },
    { key: "electricityCostPerKwh", label: "Electricity (€/kWh)" },
    { key: "fuelCostPerLiter", label: "Fuel (€/L)" },
    { key: "opportunityCostRate", label: "Opportunity cost rate" },
    { key: "catalogusprijs", label: "Catalogusprijs (€) — per scenario" },
    { key: "aanschafprijs", label: "Aanschafprijs (€) — per scenario" },
    { key: "co2", label: "CO₂ (g/km) — per scenario" },
    { key: "weightKg", label: "Weight (kg) — per scenario" },
    { key: "residualValue", label: "Residual value (€) — per scenario" },
    { key: "monthlyLeaseTariff", label: "Business lease tariff (€/mo) — per scenario" },
    { key: "monthlyPayment", label: "Private lease payment (€/mo) — per scenario" },
    { key: "eigenBijdrage", label: "Eigen bijdrage (€/mo) — per scenario" },
    { key: "salarySacrificeMonthly", label: "Salary sacrifice (€/mo) — per scenario" },
  ];

  let variable = $state<SweepableNumeric>("annualKm");
  let scenarioId = $state<string>("");
  let chartEl: HTMLDivElement;

  $effect(() => {
    if (!inputs.scenarios.find((s) => s.id === scenarioId)) {
      scenarioId = inputs.scenarios[0]?.id ?? "";
    }
  });

  const isPerScenario = $derived(isScenarioSweepable(variable));

  $effect(() => {
    if (!chartEl) return;
    const sId = isPerScenario ? scenarioId : undefined;
    const range = suggestRange(inputs, variable, 31, sId);
    const points = sweep(inputs, variable, range, sId);
    const flat = points.flatMap((p) =>
      p.result.scenarios.map((s) => ({
        x: p.x,
        scenario: s.label,
        net: s.netMonthly,
      })),
    );
    const current = getCurrentValue(inputs, variable, sId);
    const variableLabel = VARIABLES.find((v) => v.key === variable)?.label ?? variable;
    const labels = inputs.scenarios.map((s) => s.label);

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
      {#if isPerScenario}
        <select bind:value={scenarioId} title="Scenario to sweep">
          {#each inputs.scenarios as s (s.id)}
            <option value={s.id}>{s.label}</option>
          {/each}
        </select>
      {/if}
    </div>
  </div>
  <p class="hint">
    Sweeps the selected variable across ±50% of its current value, holding all others
    fixed.
    {#if isPerScenario}
      Per-scenario variables only change the chosen scenario; other scenarios stay at their current values.
    {:else}
      Shared variables affect every scenario.
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
