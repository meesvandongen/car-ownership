<script lang="ts">
  import type { CompareResult, ScenarioKind, ScenarioResult } from "../domain/types";
  import { formatEuro, formatEuroPrecise } from "../lib/format";

  let { result }: { result: CompareResult } = $props();

  const KIND_LABELS: Record<ScenarioKind, string> = {
    ownership: "Ownership",
    privateLease: "Private lease",
    businessLease: "Business lease",
  };

  // Group results by car, preserving the order each car first appears.
  const groups = $derived.by(() => {
    const order: string[] = [];
    const map = new Map<string, { carId: string; carLabel: string; items: ScenarioResult[] }>();
    for (const r of result.results) {
      if (!map.has(r.carId)) {
        order.push(r.carId);
        map.set(r.carId, { carId: r.carId, carLabel: r.carLabel, items: [] });
      }
      map.get(r.carId)!.items.push(r);
    }
    return order.map((id) => map.get(id)!);
  });

  const cheapestId = $derived.by(() => {
    if (result.results.length === 0) return undefined;
    return result.results.reduce((best, s) =>
      s.netMonthly < best.netMonthly ? s : best,
    ).id;
  });

  const showCarHeading = $derived(groups.length > 1);
</script>

<div class="results">
  {#each groups as group (group.carId)}
    {#if showCarHeading}
      <h2 class="car-heading">{group.carLabel}</h2>
    {/if}
    <div class="cards">
      {#each group.items as scenario (scenario.id)}
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
  .results {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .car-heading {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
  }
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
