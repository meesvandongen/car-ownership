<script lang="ts">
  import type { CompareResult, ScenarioResult } from "../domain/types";
  import { formatEuro, formatEuroPrecise } from "../lib/format";

  let { result }: { result: CompareResult } = $props();

  const SCENARIOS: { key: keyof CompareResult; title: string }[] = [
    { key: "ownership", title: "Private ownership" },
    { key: "privateLease", title: "Private lease" },
    { key: "businessLease", title: "Business lease" },
  ];

  function cheapestKey(r: CompareResult): keyof CompareResult {
    const arr: [keyof CompareResult, number][] = [
      ["ownership", r.ownership.netMonthly],
      ["privateLease", r.privateLease.netMonthly],
      ["businessLease", r.businessLease.netMonthly],
    ];
    arr.sort((a, b) => a[1] - b[1]);
    return arr[0][0];
  }
</script>

<div class="cards">
  {#each SCENARIOS as { key, title }}
    {@const scenario = result[key] as ScenarioResult}
    <div class="card" class:best={cheapestKey(result) === key}>
      <h3>{title}</h3>
      <div class="net">{formatEuro(scenario.netMonthly)}<span>/month net</span></div>
      <div class="muted">
        Gross {formatEuro(scenario.grossMonthly)} · {formatEuroPrecise(scenario.costPerKm)}/km
      </div>
      <table>
        <tbody>
          {#each scenario.breakdown as item}
            <tr>
              <td>{item.label}</td>
              <td class="num">{formatEuro(item.monthly)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if scenario.warnings.length > 0}
        <ul class="warnings">
          {#each scenario.warnings as w}
            <li>{w}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
</div>

{#if result.warnings.length > 0}
  <div class="panel global-warnings">
    <h3>Heads up</h3>
    <ul>
      {#each result.warnings as w}
        <li>{w}</li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card.best {
    border-color: var(--good);
  }
  .net {
    font-size: 28px;
    font-weight: 600;
  }
  .net span {
    font-size: 12px;
    color: var(--muted);
    margin-left: 6px;
    font-weight: 400;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  td {
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  tr:last-child td {
    border-bottom: 0;
  }
  .warnings {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: var(--warn);
  }
  .global-warnings {
    margin-top: 12px;
    border-color: var(--warn);
  }
  .global-warnings ul {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 13px;
  }
</style>
