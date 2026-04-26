<script lang="ts">
  import type {
    AppInputs,
    Calculation,
    Car,
    Powertrain,
    Province,
    Role,
    ScenarioKind,
  } from "../domain/types";
  import {
    calculationKindLabel,
    makeCalculation,
    makeCar,
    newId,
  } from "../defaults";

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
  const KINDS: ScenarioKind[] = ["ownership", "privateLease", "businessLease"];

  let activeCarId = $state<string>("");
  let activeCalcId = $state<string>("");

  // Keep activeCarId valid (initial mount + when cars list changes).
  $effect(() => {
    if (!inputs.cars.find((c) => c.id === activeCarId)) {
      activeCarId = inputs.cars[0]?.id ?? "";
    }
  });

  // The calculations attached to the currently active car.
  const carCalcs = $derived(
    inputs.calculations.filter((c) => c.carId === activeCarId),
  );

  // Keep activeCalcId valid: must belong to the active car.
  $effect(() => {
    if (!carCalcs.find((c) => c.id === activeCalcId)) {
      activeCalcId = carCalcs[0]?.id ?? "";
    }
  });

  const activeCar = $derived(
    inputs.cars.find((c) => c.id === activeCarId),
  );
  const activeCalc = $derived(
    inputs.calculations.find((c) => c.id === activeCalcId),
  );

  function addCar() {
    const next = makeCar(`Car ${inputs.cars.length + 1}`);
    inputs.cars = [...inputs.cars, next];
    // Auto-add an ownership calculation so the new car is immediately useful.
    inputs.calculations = [
      ...inputs.calculations,
      makeCalculation(next.id, "ownership"),
    ];
    activeCarId = next.id;
  }

  function duplicateActiveCar() {
    if (!activeCar) return;
    const car = activeCar;
    const copy: Car = {
      id: newId("car"),
      label: `${car.label} (copy)`,
      vehicle: structuredClone($state.snapshot(car.vehicle)),
    };
    // Duplicate calculations too, repointing them at the new car.
    const dupCalcs: Calculation[] = inputs.calculations
      .filter((c) => c.carId === car.id)
      .map((c) => {
        const snap = structuredClone($state.snapshot(c));
        return { ...snap, id: newId("calc"), carId: copy.id };
      });
    inputs.cars = [...inputs.cars, copy];
    inputs.calculations = [...inputs.calculations, ...dupCalcs];
    activeCarId = copy.id;
  }

  function removeActiveCar() {
    if (inputs.cars.length <= 1 || !activeCar) return;
    const removedId = activeCar.id;
    inputs.calculations = inputs.calculations.filter((c) => c.carId !== removedId);
    inputs.cars = inputs.cars.filter((c) => c.id !== removedId);
    activeCarId = inputs.cars[0]?.id ?? "";
  }

  function addCalc(kind: ScenarioKind) {
    if (!activeCar) return;
    // If this kind already exists on the car, suffix it; users can rename later.
    const existing = inputs.calculations.filter(
      (c) => c.carId === activeCar.id && c.kind === kind,
    ).length;
    const label =
      existing === 0
        ? calculationKindLabel(kind)
        : `${calculationKindLabel(kind)} ${existing + 1}`;
    const next = makeCalculation(activeCar.id, kind, label);
    inputs.calculations = [...inputs.calculations, next];
    activeCalcId = next.id;
  }

  function duplicateActiveCalc() {
    if (!activeCalc) return;
    const snap = structuredClone($state.snapshot(activeCalc));
    const copy: Calculation = {
      ...snap,
      id: newId("calc"),
      label: `${activeCalc.label} (copy)`,
    };
    inputs.calculations = [...inputs.calculations, copy];
    activeCalcId = copy.id;
  }

  function removeActiveCalc() {
    if (!activeCalc) return;
    if (carCalcs.length <= 1) return;
    const removedId = activeCalc.id;
    inputs.calculations = inputs.calculations.filter((c) => c.id !== removedId);
    activeCalcId = "";
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

<div class="panel cars-panel">
  <div class="cars-header">
    <h2>Cars &amp; calculations</h2>
    <p class="hint">Each car holds the vehicle spec once. Add as many calculations (ownership / leases) per car as you want — and as many cars as you want.</p>
  </div>

  <div class="tabs car-tabs" role="tablist">
    {#each inputs.cars as car (car.id)}
      <button
        type="button"
        class="tab car-tab"
        class:active={car.id === activeCarId}
        onclick={() => (activeCarId = car.id)}
        role="tab"
        aria-selected={car.id === activeCarId}
      >
        <span class="car-icon">🚗</span>
        <span class="tab-label">{car.label}</span>
      </button>
    {/each}
    <button type="button" class="add-tab" onclick={addCar} title="Add a new car">+ Car</button>
  </div>

  {#if activeCar}
    <div class="entity-toolbar">
      <label class="row name-row">
        <span>Car name</span>
        <input type="text" bind:value={activeCar.label} />
      </label>
      <div class="row actions">
        <button type="button" onclick={duplicateActiveCar}>Duplicate car</button>
        <button
          type="button"
          onclick={removeActiveCar}
          disabled={inputs.cars.length <= 1}
          title={inputs.cars.length <= 1 ? "Keep at least one car" : "Remove this car and its calculations"}
        >Remove car</button>
      </div>
    </div>

    <h3>Vehicle spec</h3>
    <div class="field-grid">
      <label>
        Catalogusprijs (€)
        <input type="number" bind:value={activeCar.vehicle.catalogusprijs} min="0" step="500" />
      </label>
      <label>
        Aanschafprijs (€)
        <input type="number" bind:value={activeCar.vehicle.aanschafprijs} min="0" step="500" />
      </label>
      <label>
        Powertrain
        <select bind:value={activeCar.vehicle.powertrain}>
          {#each POWERTRAINS as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </label>
      <label>
        CO₂ (g/km)
        <input type="number" bind:value={activeCar.vehicle.co2} min="0" step="1" />
      </label>
      <label>
        Weight (kg)
        <input type="number" bind:value={activeCar.vehicle.weightKg} min="0" step="10" />
      </label>
      <label>
        Year of first registration
        <input type="number" bind:value={activeCar.vehicle.detYear} min="2010" max="2030" />
      </label>
      <label>
        Consumption (kWh/100km)
        <input type="number" bind:value={activeCar.vehicle.consumptionKwhPer100km} min="0" step="0.1" />
      </label>
      <label>
        Consumption (L/100km)
        <input type="number" bind:value={activeCar.vehicle.consumptionLper100km} min="0" step="0.1" />
      </label>
    </div>

    <h3>Calculations on this car</h3>

    {#if carCalcs.length === 0}
      <p class="empty">No calculations yet for this car.</p>
    {:else}
      <div class="tabs calc-tabs" role="tablist">
        {#each carCalcs as calc (calc.id)}
          <button
            type="button"
            class="tab calc-tab"
            class:active={calc.id === activeCalcId}
            onclick={() => (activeCalcId = calc.id)}
            role="tab"
            aria-selected={calc.id === activeCalcId}
            title={calculationKindLabel(calc.kind)}
          >
            <span class="dot dot-{calc.kind}"></span>
            <span class="tab-label">{calc.label}</span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="add-calc-row">
      <span class="add-calc-label">Add calculation:</span>
      {#each KINDS as k}
        <button type="button" class="chip" onclick={() => addCalc(k)}>
          <span class="dot dot-{k}"></span>
          {calculationKindLabel(k)}
        </button>
      {/each}
    </div>

    {#if activeCalc}
      <div class="entity-toolbar calc-toolbar">
        <label class="row name-row">
          <span>Calculation name</span>
          <input type="text" bind:value={activeCalc.label} />
        </label>
        <label class="row kind-row">
          <span>Type</span>
          <select bind:value={activeCalc.kind}>
            {#each KINDS as k}
              <option value={k}>{calculationKindLabel(k)}</option>
            {/each}
          </select>
        </label>
        <div class="row actions">
          <button type="button" onclick={duplicateActiveCalc}>Duplicate</button>
          <button
            type="button"
            onclick={removeActiveCalc}
            disabled={carCalcs.length <= 1}
            title={carCalcs.length <= 1 ? "Each car needs at least one calculation" : "Remove this calculation"}
          >Remove</button>
        </div>
      </div>

      {#if activeCalc.kind === "ownership"}
        <div class="field-grid">
          <label>
            Holding period (months)
            <input type="number" bind:value={activeCalc.ownership.holdingMonths} min="1" step="1" />
          </label>
          <label>
            Residual value (€)
            <input type="number" bind:value={activeCalc.ownership.residualValue} min="0" step="500" />
          </label>
          <label>
            Down payment (€)
            <input type="number" bind:value={activeCalc.ownership.downPayment} min="0" step="500" />
          </label>
          <label>
            Interest rate (%)
            <input
              type="number"
              bind:value={
                () => activeCalc.ownership.interestRate * 100,
                (v) => (activeCalc.ownership.interestRate = (v ?? 0) / 100)
              }
              min="0"
              step="0.1"
            />
          </label>
          <label>
            Loan term (months)
            <input type="number" bind:value={activeCalc.ownership.loanTermMonths} min="0" step="1" />
          </label>
          <label>
            Insurance (€/month)
            <input type="number" bind:value={activeCalc.ownership.insurancePerMonth} min="0" step="5" />
          </label>
          <label>
            Maintenance (€/year)
            <input type="number" bind:value={activeCalc.ownership.maintenancePerYear} min="0" step="50" />
          </label>
        </div>
      {:else if activeCalc.kind === "privateLease"}
        <div class="field-grid">
          <label>
            Monthly payment (€)
            <input type="number" bind:value={activeCalc.privateLease.monthlyPayment} min="0" step="10" />
          </label>
          <label>
            Contract (months)
            <input type="number" bind:value={activeCalc.privateLease.contractMonths} min="0" step="1" />
          </label>
          <label>
            Contract km/year
            <input type="number" bind:value={activeCalc.privateLease.contractKmPerYear} min="0" step="500" />
          </label>
          <label>
            Excess km (€/km)
            <input type="number" bind:value={activeCalc.privateLease.excessKmTariff} min="0" step="0.01" />
          </label>
          <label>
            Down payment (€)
            <input type="number" bind:value={activeCalc.privateLease.downPayment} min="0" step="100" />
          </label>
        </div>
      {:else}
        <div class="field-grid">
          <label>
            Monthly lease tariff (€)
            <input type="number" bind:value={activeCalc.businessLease.monthlyLeaseTariff} min="0" step="10" />
          </label>
          <label>
            Eigen bijdrage (€/month)
            <input type="number" bind:value={activeCalc.businessLease.eigenBijdrage} min="0" step="10" />
          </label>
          <label>
            Salary sacrifice (€/month bruto)
            <input
              type="number"
              bind:value={activeCalc.businessLease.salarySacrificeMonthly}
              min="0"
              step="10"
            />
          </label>
          <label>
            Role
            <select bind:value={activeCalc.businessLease.role}>
              {#each ROLES as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
          </label>
          <label class="row" style="align-items: center;">
            <input type="checkbox" bind:checked={activeCalc.businessLease.fuelCardPrivate} style="width:auto;" />
            <span>Fuel card covers private km</span>
          </label>
          <label class="row" style="align-items: center;">
            <input type="checkbox" bind:checked={activeCalc.businessLease.rittenregistratie} style="width:auto;" />
            <span>Rittenregistratie maintained</span>
          </label>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .panel + .panel {
    margin-top: 12px;
  }
  .cars-header h2 {
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
  .calc-tabs {
    margin-bottom: 8px;
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
    max-width: 240px;
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
  .car-tab.active {
    background: var(--panel-2);
  }
  .car-icon {
    font-size: 13px;
    line-height: 1;
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
  .add-tab {
    background: transparent;
    border: 1px dashed var(--border);
    color: var(--muted);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    margin-left: auto;
  }
  .add-tab:hover {
    color: inherit;
    border-color: var(--accent);
  }
  .entity-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
    margin-bottom: 12px;
    align-items: end;
  }
  .calc-toolbar {
    margin-top: 4px;
    background: var(--panel-2);
    padding: 8px 10px;
    border-radius: 6px;
  }
  .entity-toolbar .name-row,
  .entity-toolbar .kind-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .entity-toolbar .name-row > span,
  .entity-toolbar .kind-row > span {
    font-size: 12px;
    color: var(--muted);
  }
  .entity-toolbar .actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 6px;
  }
  .entity-toolbar .actions button {
    font-size: 12px;
    padding: 6px 10px;
  }
  .cars-panel h3 {
    font-size: 12px;
    margin: 14px 0 6px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .empty {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 12px;
    font-style: italic;
  }
  .add-calc-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0 0 10px;
  }
  .add-calc-label {
    font-size: 12px;
    color: var(--muted);
  }
  .chip {
    background: var(--panel-2);
    color: inherit;
    border: 1px solid var(--border);
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .chip:hover {
    border-color: var(--accent);
  }
</style>
