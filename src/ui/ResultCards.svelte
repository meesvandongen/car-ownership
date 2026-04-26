<script lang="ts">
  import type { CompareResult, ScenarioKind } from "../domain/types";
  import { formatEuro, formatEuroPrecise } from "../lib/format";

  let { result }: { result: CompareResult } = $props();

  const KIND_LABELS: Record<ScenarioKind, string> = {
    ownership: "Private ownership",
    privateLease: "Private lease",
    businessLease: "Business lease",
  };

  const cheapestId = $derived.by(() => {
    if (result.scenarios.length === 0) return undefined;
    return result.scenarios.reduce((best, s) =>
      s.netMonthly < best.netMonthly ? s : best,
    ).id;
  });
</script>

<div class="cards">
  {#each result.scenarios as scenario (scenario.id)}
    <div class="card" class:best={cheapestId === scenario.id}>
      <div class="card-head">
        <h3>{scenario.label}</h3>
        <span class="kind-tag tag-{scenario.kind}">{KIND_LABELS[scenario.kind]}</span>
      </div>
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
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .card-head h3 {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kind-tag {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid var(--border);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tag-ownership {
    border-color: #58a6ff;
    color: #58a6ff;
  }
  .tag-privateLease {
    border-color: #3fb950;
    color: #3fb950;
  }
  .tag-businessLease {
    border-color: #d29922;
    color: #d29922;
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
