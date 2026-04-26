<script lang="ts">
  import type {
    AppInputs,
    Powertrain,
    Province,
    Role,
    Scenario,
    ScenarioKind,
  } from "../domain/types";
  import { defaultScenarioLabel, makeScenario, newScenarioId } from "../defaults";

  let { inputs = $bindable() }: { inputs: AppInputs } = $props();

  const POWERTRAINS: Powertrain[] = ["ev", "hydrogen", "phev", "petrol", "diesel", "lpg"];
  const PROVINCES: Province[] = [
    "Drenthe",
    "Flevoland",
    "Friesland",
    "Gelderland",
    "Groningen",
    "Limburg",
    "Noord-Brabant",
    "Noord-Holland",
    "Overijssel",
    "Utrecht",
    "Zeeland",
    "Zuid-Holland",
  ];
  const ROLES: Role[] = ["employee", "dga", "zzp"];
  const KIND_LABELS: Record<ScenarioKind, string> = {
    ownership: "Private ownership",
    privateLease: "Private lease",
    businessLease: "Business lease",
  };

  let activeId = $state<string>("");

  // Keep activeId valid (initial mount + when scenarios change via add/remove).
  $effect(() => {
    if (!inputs.scenarios.find((s) => s.id === activeId)) {
      activeId = inputs.scenarios[0]?.id ?? "";
    }
  });

  const activeScenario = $derived(
    inputs.scenarios.find((s) => s.id === activeId) ?? inputs.scenarios[0],
  );
  const activeIndex = $derived(
    inputs.scenarios.findIndex((s) => s.id === activeId),
  );

  function addScenario(kind: ScenarioKind) {
    const next = makeScenario(kind);
    // Suffix label if a default-labeled scenario of this kind already exists.
    const existing = inputs.scenarios.filter(
      (s) => s.kind === kind && s.label.startsWith(defaultScenarioLabel(kind)),
    ).length;
    if (existing > 0) {
      next.label = `${defaultScenarioLabel(kind)} ${existing + 1}`;
    }
    inputs.scenarios = [...inputs.scenarios, next];
    activeId = next.id;
  }

  function duplicateActive() {
    if (!activeScenario) return;
    const copy: Scenario = structuredClone($state.snapshot(activeScenario));
    copy.id = newScenarioId();
    copy.label = `${activeScenario.label} (copy)`;
    inputs.scenarios = [...inputs.scenarios, copy];
    activeId = copy.id;
  }

  function removeActive() {
    if (inputs.scenarios.length <= 1) return;
    if (!activeScenario) return;
    const idx = activeIndex;
    inputs.scenarios = inputs.scenarios.filter((s) => s.id !== activeId);
    activeId = inputs.scenarios[Math.max(0, idx - 1)]?.id ?? "";
  }
</script>

<div class="panel">
  <h2>Driving profile</h2>
  <div class="field-grid">
    <label>
      Province
      <select bind:value={inputs.drivingProfile.province}>
        {#each PROVINCES as p}
          <option value={p}>{p}</option>
        {/each}
      </select>
    </label>
    <label>
      Annual km — total
      <input type="number" bind:value={inputs.drivingProfile.annualKm} min="0" step="500" />
    </label>
    <label>
      Annual km — business
      <input type="number" bind:value={inputs.drivingProfile.businessKm} min="0" step="500" />
    </label>
    <label>
      Annual km — commute
      <input type="number" bind:value={inputs.drivingProfile.commuteKm} min="0" step="500" />
    </label>
    <label>
      Annual km — private
      <input type="number" bind:value={inputs.drivingProfile.privateKm} min="0" step="500" />
    </label>
  </div>
</div>

<div class="panel">
  <h2>Salary &amp; tax</h2>
  <div class="field-grid">
    <label>
      Bruto annual (€)
      <input type="number" bind:value={inputs.salary.bruto} min="0" step="1000" />
    </label>
    <label class="row" style="grid-column: 2 / 3; align-items: center;">
      <input type="checkbox" bind:checked={inputs.salary.aowAge} style="width:auto;" />
      <span>AOW age</span>
    </label>
    <label class="row" style="grid-column: 1 / 2; align-items: center;">
      <input type="checkbox" bind:checked={inputs.salary.fiscalPartner} style="width:auto;" />
      <span>Fiscal partner</span>
    </label>
    <label>
      Hypotheekrenteaftrek (€/yr)
      <input type="number" bind:value={inputs.salary.hypotheekrenteAftrek} min="0" step="500" />
    </label>
  </div>
</div>

<div class="panel">
  <h2>Energy prices</h2>
  <div class="field-grid">
    <label>
      Electricity (€/kWh)
      <input type="number" bind:value={inputs.energy.electricityCostPerKwh} min="0" step="0.01" />
    </label>
    <label>
      Fuel (€/L)
      <input type="number" bind:value={inputs.energy.fuelCostPerLiter} min="0" step="0.01" />
    </label>
  </div>
</div>

<div class="panel">
  <h2>Comparison assumptions</h2>
  <div class="field-grid">
    <label>
      Opportunity cost rate (%/yr)
      <input
        type="number"
        bind:value={
          () => inputs.opportunityCostRate * 100,
          (v) => (inputs.opportunityCostRate = (v ?? 0) / 100)
        }
        min="0"
        step="0.1"
      />
    </label>
    <label>
      Comparison horizon (months)
      <input type="number" bind:value={inputs.comparisonMonths} min="1" step="1" />
    </label>
    <label>
      Reimbursement received (€/km)
      <input type="number" bind:value={inputs.reimbursement.ratePerKm} min="0" step="0.01" />
    </label>
  </div>
</div>

<div class="panel scenarios-panel">
  <div class="scenario-header">
    <h2>Scenarios</h2>
    <p class="hint">Compare any mix of ownership, private lease, and business lease — for the same car or different cars.</p>
  </div>

  <div class="tabs" role="tablist">
    {#each inputs.scenarios as s (s.id)}
      <button
        type="button"
        class="tab"
        class:active={s.id === activeId}
        onclick={() => (activeId = s.id)}
        role="tab"
        aria-selected={s.id === activeId}
        title={KIND_LABELS[s.kind]}
      >
        <span class="dot dot-{s.kind}"></span>
        <span class="tab-label">{s.label}</span>
      </button>
    {/each}
    <div class="add-menu">
      <details>
        <summary aria-label="Add scenario">+ Add</summary>
        <div class="menu">
          <button type="button" onclick={() => addScenario("ownership")}>Ownership</button>
          <button type="button" onclick={() => addScenario("privateLease")}>Private lease</button>
          <button type="button" onclick={() => addScenario("businessLease")}>Business lease</button>
        </div>
      </details>
    </div>
  </div>

  {#if activeScenario}
    <div class="scenario-toolbar">
      <label class="row name-row">
        <span>Name</span>
        <input type="text" bind:value={activeScenario.label} />
      </label>
      <label class="row kind-row">
        <span>Type</span>
        <select bind:value={activeScenario.kind}>
          {#each Object.keys(KIND_LABELS) as k}
            <option value={k}>{KIND_LABELS[k as ScenarioKind]}</option>
          {/each}
        </select>
      </label>
      <div class="row actions">
        <button type="button" onclick={duplicateActive}>Duplicate</button>
        <button
          type="button"
          onclick={removeActive}
          disabled={inputs.scenarios.length <= 1}
          title={inputs.scenarios.length <= 1 ? "At least one scenario is required" : "Remove this scenario"}
        >Remove</button>
      </div>
    </div>

    <h3>Vehicle</h3>
    <div class="field-grid">
      <label>
        Catalogusprijs (€)
        <input type="number" bind:value={activeScenario.vehicle.catalogusprijs} min="0" step="500" />
      </label>
      <label>
        Aanschafprijs (€)
        <input type="number" bind:value={activeScenario.vehicle.aanschafprijs} min="0" step="500" />
      </label>
      <label>
        Powertrain
        <select bind:value={activeScenario.vehicle.powertrain}>
          {#each POWERTRAINS as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </label>
      <label>
        CO₂ (g/km)
        <input type="number" bind:value={activeScenario.vehicle.co2} min="0" step="1" />
      </label>
      <label>
        Weight (kg)
        <input type="number" bind:value={activeScenario.vehicle.weightKg} min="0" step="10" />
      </label>
      <label>
        Year of first registration
        <input type="number" bind:value={activeScenario.vehicle.detYear} min="2010" max="2030" />
      </label>
      <label>
        Residual value (€)
        <input type="number" bind:value={activeScenario.vehicle.residualValue} min="0" step="500" />
      </label>
      <label>
        Consumption (kWh/100km)
        <input type="number" bind:value={activeScenario.vehicle.consumptionKwhPer100km} min="0" step="0.1" />
      </label>
      <label>
        Consumption (L/100km)
        <input type="number" bind:value={activeScenario.vehicle.consumptionLper100km} min="0" step="0.1" />
      </label>
    </div>

    {#if activeScenario.kind === "ownership"}
      <h3>Ownership</h3>
      <div class="field-grid">
        <label>
          Holding period (months)
          <input type="number" bind:value={activeScenario.ownership.holdingMonths} min="1" step="1" />
        </label>
        <label>
          Down payment (€)
          <input type="number" bind:value={activeScenario.ownership.downPayment} min="0" step="500" />
        </label>
        <label>
          Interest rate (%)
          <input
            type="number"
            bind:value={
              () => activeScenario.ownership.interestRate * 100,
              (v) => (activeScenario.ownership.interestRate = (v ?? 0) / 100)
            }
            min="0"
            step="0.1"
          />
        </label>
        <label>
          Loan term (months)
          <input type="number" bind:value={activeScenario.ownership.loanTermMonths} min="0" step="1" />
        </label>
        <label>
          Insurance (€/month)
          <input type="number" bind:value={activeScenario.ownership.insurancePerMonth} min="0" step="5" />
        </label>
        <label>
          Maintenance (€/year)
          <input type="number" bind:value={activeScenario.ownership.maintenancePerYear} min="0" step="50" />
        </label>
      </div>
    {:else if activeScenario.kind === "privateLease"}
      <h3>Private lease</h3>
      <div class="field-grid">
        <label>
          Monthly payment (€)
          <input type="number" bind:value={activeScenario.privateLease.monthlyPayment} min="0" step="10" />
        </label>
        <label>
          Contract (months)
          <input type="number" bind:value={activeScenario.privateLease.contractMonths} min="0" step="1" />
        </label>
        <label>
          Contract km/year
          <input type="number" bind:value={activeScenario.privateLease.contractKmPerYear} min="0" step="500" />
        </label>
        <label>
          Excess km (€/km)
          <input type="number" bind:value={activeScenario.privateLease.excessKmTariff} min="0" step="0.01" />
        </label>
        <label>
          Down payment (€)
          <input type="number" bind:value={activeScenario.privateLease.downPayment} min="0" step="100" />
        </label>
      </div>
    {:else}
      <h3>Business lease</h3>
      <div class="field-grid">
        <label>
          Monthly lease tariff (€)
          <input type="number" bind:value={activeScenario.businessLease.monthlyLeaseTariff} min="0" step="10" />
        </label>
        <label>
          Eigen bijdrage (€/month)
          <input type="number" bind:value={activeScenario.businessLease.eigenBijdrage} min="0" step="10" />
        </label>
        <label>
          Salary sacrifice (€/month bruto)
          <input
            type="number"
            bind:value={activeScenario.businessLease.salarySacrificeMonthly}
            min="0"
            step="10"
          />
        </label>
        <label>
          Role
          <select bind:value={activeScenario.businessLease.role}>
            {#each ROLES as r}
              <option value={r}>{r}</option>
            {/each}
          </select>
        </label>
        <label class="row" style="align-items: center;">
          <input type="checkbox" bind:checked={activeScenario.businessLease.fuelCardPrivate} style="width:auto;" />
          <span>Fuel card covers private km</span>
        </label>
        <label class="row" style="align-items: center;">
          <input type="checkbox" bind:checked={activeScenario.businessLease.rittenregistratie} style="width:auto;" />
          <span>Rittenregistratie maintained</span>
        </label>
      </div>
    {/if}
  {/if}
</div>

<style>
  .panel + .panel {
    margin-top: 12px;
  }
  .scenario-header h2 {
    margin: 0;
  }
  .hint {
    margin: 4px 0 12px;
    color: var(--muted);
    font-size: 12px;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
  }
  .tab {
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    color: var(--muted);
    padding: 6px 10px;
    border-radius: 6px 6px 0 0;
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
  }
  .tab .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tab:hover {
    color: inherit;
  }
  .tab.active {
    background: var(--panel);
    border-color: var(--border);
    color: inherit;
    margin-bottom: -1px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-ownership {
    background: #58a6ff;
  }
  .dot-privateLease {
    background: #3fb950;
  }
  .dot-businessLease {
    background: #d29922;
  }
  .add-menu {
    margin-left: auto;
    position: relative;
  }
  .add-menu summary {
    list-style: none;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--muted);
    border: 1px dashed var(--border);
  }
  .add-menu summary::-webkit-details-marker {
    display: none;
  }
  .add-menu summary:hover {
    color: inherit;
  }
  .add-menu .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    min-width: 160px;
    z-index: 10;
  }
  .add-menu .menu button {
    background: transparent;
    border: none;
    text-align: left;
    padding: 6px 10px;
    color: inherit;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
  }
  .add-menu .menu button:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  .scenario-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
    margin-bottom: 12px;
    align-items: end;
  }
  .scenario-toolbar .name-row,
  .scenario-toolbar .kind-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .scenario-toolbar .name-row > span,
  .scenario-toolbar .kind-row > span {
    font-size: 12px;
    color: var(--muted);
  }
  .scenario-toolbar .actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 6px;
  }
  .scenario-toolbar .actions button {
    font-size: 12px;
    padding: 6px 10px;
  }
  .scenarios-panel h3 {
    font-size: 13px;
    margin: 12px 0 6px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
