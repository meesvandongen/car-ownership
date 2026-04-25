<script lang="ts">
  import type { AppInputs, Powertrain, Province, Role } from "../domain/types";

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
</script>

<div class="panel">
  <h2>Vehicle</h2>
  <div class="field-grid">
    <label>
      Catalogusprijs (€)
      <input type="number" bind:value={inputs.vehicle.catalogusprijs} min="0" step="500" />
    </label>
    <label>
      Aanschafprijs (€)
      <input type="number" bind:value={inputs.vehicle.aanschafprijs} min="0" step="500" />
    </label>
    <label>
      Powertrain
      <select bind:value={inputs.vehicle.powertrain}>
        {#each POWERTRAINS as p}
          <option value={p}>{p}</option>
        {/each}
      </select>
    </label>
    <label>
      CO₂ (g/km)
      <input type="number" bind:value={inputs.vehicle.co2} min="0" step="1" />
    </label>
    <label>
      Weight (kg)
      <input type="number" bind:value={inputs.vehicle.weightKg} min="0" step="10" />
    </label>
    <label>
      Year of first registration
      <input type="number" bind:value={inputs.vehicle.detYear} min="2010" max="2030" />
    </label>
    <label>
      Province
      <select bind:value={inputs.vehicle.province}>
        {#each PROVINCES as p}
          <option value={p}>{p}</option>
        {/each}
      </select>
    </label>
    <label>
      Holding period (months)
      <input type="number" bind:value={inputs.vehicle.holdingMonths} min="1" step="1" />
    </label>
    <label>
      Residual value (€)
      <input type="number" bind:value={inputs.vehicle.residualValue} min="0" step="500" />
    </label>
    <label>
      Annual km — total
      <input type="number" bind:value={inputs.vehicle.annualKm} min="0" step="500" />
    </label>
    <label>
      Annual km — business
      <input type="number" bind:value={inputs.vehicle.businessKm} min="0" step="500" />
    </label>
    <label>
      Annual km — commute
      <input type="number" bind:value={inputs.vehicle.commuteKm} min="0" step="500" />
    </label>
    <label>
      Annual km — private
      <input type="number" bind:value={inputs.vehicle.privateKm} min="0" step="500" />
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
  <h2>Ownership</h2>
  <div class="field-grid">
    <label>
      Down payment (€)
      <input type="number" bind:value={inputs.ownership.downPayment} min="0" step="500" />
    </label>
    <label>
      Interest rate (%)
      <input
        type="number"
        bind:value={
          () => inputs.ownership.interestRate * 100,
          (v) => (inputs.ownership.interestRate = (v ?? 0) / 100)
        }
        min="0"
        step="0.1"
      />
    </label>
    <label>
      Loan term (months)
      <input type="number" bind:value={inputs.ownership.loanTermMonths} min="0" step="1" />
    </label>
    <label>
      Insurance (€/month)
      <input type="number" bind:value={inputs.ownership.insurancePerMonth} min="0" step="5" />
    </label>
    <label>
      Maintenance (€/year)
      <input type="number" bind:value={inputs.ownership.maintenancePerYear} min="0" step="50" />
    </label>
    <label>
      Electricity (€/kWh)
      <input type="number" bind:value={inputs.ownership.electricityCostPerKwh} min="0" step="0.01" />
    </label>
    <label>
      Fuel (€/L)
      <input type="number" bind:value={inputs.ownership.fuelCostPerLiter} min="0" step="0.01" />
    </label>
    <label>
      Consumption (kWh/100km)
      <input type="number" bind:value={inputs.ownership.consumptionKwhPer100km} min="0" step="0.1" />
    </label>
    <label>
      Consumption (L/100km)
      <input type="number" bind:value={inputs.ownership.consumptionLper100km} min="0" step="0.1" />
    </label>
  </div>
</div>

<div class="panel">
  <h2>Private lease</h2>
  <div class="field-grid">
    <label>
      Monthly payment (€)
      <input type="number" bind:value={inputs.privateLease.monthlyPayment} min="0" step="10" />
    </label>
    <label>
      Contract (months)
      <input type="number" bind:value={inputs.privateLease.contractMonths} min="0" step="1" />
    </label>
    <label>
      Contract km/year
      <input type="number" bind:value={inputs.privateLease.contractKmPerYear} min="0" step="500" />
    </label>
    <label>
      Excess km (€/km)
      <input type="number" bind:value={inputs.privateLease.excessKmTariff} min="0" step="0.01" />
    </label>
    <label>
      Down payment (€)
      <input type="number" bind:value={inputs.privateLease.downPayment} min="0" step="100" />
    </label>
  </div>
</div>

<div class="panel">
  <h2>Business lease</h2>
  <div class="field-grid">
    <label>
      Monthly lease tariff (€)
      <input type="number" bind:value={inputs.businessLease.monthlyLeaseTariff} min="0" step="10" />
    </label>
    <label>
      Eigen bijdrage (€/month)
      <input type="number" bind:value={inputs.businessLease.eigenBijdrage} min="0" step="10" />
    </label>
    <label>
      Role
      <select bind:value={inputs.businessLease.role}>
        {#each ROLES as r}
          <option value={r}>{r}</option>
        {/each}
      </select>
    </label>
    <label class="row" style="align-items: center;">
      <input type="checkbox" bind:checked={inputs.businessLease.fuelCardPrivate} style="width:auto;" />
      <span>Fuel card covers private km</span>
    </label>
    <label class="row" style="align-items: center;">
      <input type="checkbox" bind:checked={inputs.businessLease.rittenregistratie} style="width:auto;" />
      <span>Rittenregistratie maintained</span>
    </label>
  </div>
</div>

<div class="panel">
  <h2>Reimbursement</h2>
  <div class="field-grid">
    <label>
      Rate received (€/km)
      <input type="number" bind:value={inputs.reimbursement.ratePerKm} min="0" step="0.01" />
    </label>
  </div>
</div>

<style>
  .panel + .panel {
    margin-top: 12px;
  }
</style>
