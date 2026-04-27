<script lang="ts">
  import InputPanel from "./ui/InputPanel.svelte";
  import ResultCards from "./ui/ResultCards.svelte";
  import SensitivityChart from "./ui/SensitivityChart.svelte";
  import { DEFAULTS } from "./defaults";
  import { compareAll } from "./domain/compare";
  import { applyUrlToInputs, serializeToUrl } from "./lib/urlState";
  import { getTaxData } from "./domain/taxData";

  const initial = applyUrlToInputs(DEFAULTS, window.location.search);
  let inputs = $state(initial);
  const result = $derived(compareAll(inputs));
  const taxData = $derived(getTaxData(inputs.taxYear));

  let urlTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const qs = serializeToUrl(inputs);
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const url = `${window.location.pathname}?${qs}`;
      window.history.replaceState(null, "", url);
    }, 250);
  });

  function resetToDefaults() {
    inputs = structuredClone(DEFAULTS);
  }

  function copyShareLink() {
    navigator.clipboard?.writeText(window.location.href);
  }
</script>

<header>
  <div>
    <h1>Dutch Car Cost Calculator</h1>
    <p class="sub">
      Compare private ownership, private lease, and business lease for the Netherlands.
      <span class="tag">Tax year {taxData.year}</span>
      <span class="tag">Rates verified {taxData.lastVerified}</span>
    </p>
  </div>
  <div class="toolbar">
    <button onclick={copyShareLink}>Copy share link</button>
    <button onclick={resetToDefaults}>Reset</button>
  </div>
</header>

<main>
  <aside class="inputs">
    <InputPanel bind:inputs />
  </aside>
  <section class="results">
    <ResultCards {result} />
    <SensitivityChart {inputs} />
  </section>
</main>

<footer>
  <p>
    Calculations are estimates based on published 2026 rules. Values for MRB, BPM, and
    heffingskortingen are simplified — verify against
    <a href="https://www.belastingdienst.nl" target="_blank" rel="noreferrer noopener">belastingdienst.nl</a>
    before making decisions. Your inputs never leave this browser.
  </p>
</footer>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px 28px 16px;
    border-bottom: 1px solid var(--border);
    gap: 16px;
    flex-wrap: wrap;
  }
  .sub {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .toolbar {
    display: flex;
    gap: 8px;
  }
  main {
    display: grid;
    grid-template-columns: minmax(320px, 380px) 1fr;
    gap: 16px;
    padding: 16px 28px 28px;
    align-items: start;
  }
  .inputs {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .results {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
    position: sticky;
    top: 12px;
    max-height: calc(100vh - 24px);
    overflow-y: auto;
    /* Pad the inner edge so the scrollbar doesn't crowd the cards. */
    padding-right: 4px;
  }
  footer {
    padding: 12px 28px 28px;
    color: var(--muted);
    font-size: 12px;
    border-top: 1px solid var(--border);
  }
  @media (max-width: 980px) {
    main {
      grid-template-columns: 1fr;
    }
    /* Single-column layout: stickiness would trap the inputs above the results. */
    .results {
      position: static;
      max-height: none;
      overflow-y: visible;
      padding-right: 0;
    }
  }
</style>
