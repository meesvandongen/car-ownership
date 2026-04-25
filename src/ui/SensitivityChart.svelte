<script lang="ts">
  import * as Plot from "@observablehq/plot";
  import type { AppInputs } from "../domain/types";
  import {
    type SweepableNumeric,
    getCurrentValue,
    suggestRange,
    sweep,
  } from "../domain/sensitivity";

  let { inputs }: { inputs: AppInputs } = $props();

  const VARIABLES: { key: SweepableNumeric; label: string }[] = [
    { key: "annualKm", label: "Annual mileage (km)" },
    { key: "catalogusprijs", label: "Catalogusprijs (€)" },
    { key: "aanschafprijs", label: "Aanschafprijs (€)" },
    { key: "co2", label: "CO₂ (g/km)" },
    { key: "weightKg", label: "Weight (kg)" },
    { key: "residualValue", label: "Residual value (€)" },
    { key: "bruto", label: "Bruto salary (€)" },
    { key: "electricityCostPerKwh", label: "Electricity (€/kWh)" },
    { key: "fuelCostPerLiter", label: "Fuel (€/L)" },
    { key: "monthlyLeaseTariff", label: "Business lease tariff (€/mo)" },
    { key: "monthlyPayment", label: "Private lease payment (€/mo)" },
    { key: "eigenBijdrage", label: "Eigen bijdrage (€/mo)" },
  ];

  let variable = $state<SweepableNumeric>("annualKm");
  let chartEl: HTMLDivElement;

  $effect(() => {
    if (!chartEl) return;
    const range = suggestRange(inputs, variable, 31);
    const points = sweep(inputs, variable, range);
    const flat = points.flatMap((p) => [
      { x: p.x, scenario: "Ownership", net: p.result.ownership.netMonthly },
      { x: p.x, scenario: "Private lease", net: p.result.privateLease.netMonthly },
      { x: p.x, scenario: "Business lease", net: p.result.businessLease.netMonthly },
    ]);
    const current = getCurrentValue(inputs, variable);
    const variableLabel = VARIABLES.find((v) => v.key === variable)?.label ?? variable;

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
        domain: ["Ownership", "Private lease", "Business lease"],
        range: ["#58a6ff", "#3fb950", "#d29922"],
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
    <select bind:value={variable}>
      {#each VARIABLES as v}
        <option value={v.key}>{v.label}</option>
      {/each}
    </select>
  </div>
  <p class="hint">
    Sweeps the selected variable across ±50% of its current value, holding all others
    fixed. The dashed line marks your current input.
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
  }
  .header h2 {
    margin: 0;
  }
  .header select {
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
