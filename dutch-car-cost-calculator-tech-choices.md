# Technical Choices — Dutch Car Cost Calculator

A working document for the technical stack. Captures recommendations, trade-offs, and the reasoning behind each choice.

---

## TL;DR — Recommended Stack

| Layer | Recommendation | Reason in one line |
|---|---|---|
| UI framework | **Svelte 5** (or **Solid**), with Ripple as an experiment-only fallback | Fine-grained reactivity like Ripple, but production-ready and with an ecosystem |
| Build tool | Vite | De-facto standard, works with all the above |
| Language | TypeScript (strict) | Tax math + many domain rules → types catch bugs early |
| Charting | **Observable Plot** as primary, **uPlot** as secondary | Plot is great for "fix variable X, sweep variable Y"; uPlot for fast interactive sliders |
| State / domain logic | Plain TypeScript modules, framework-agnostic | Keep the calculation engine independent of the UI |
| Data (tax rules) | Versioned JSON (`tax_year_2026.json`) | Easy yearly updates without code changes |
| Testing | Vitest | First-class Vite integration |
| Hosting | Static (Vercel / Cloudflare Pages / GitHub Pages) | App is fully client-side |

---

## 1. UI Framework — Should We Use Ripple?

### What Ripple actually is (April 2026 status)

Ripple TS is a TypeScript-first UI framework by Dominic Gannaway (ex-React core, ex-Svelte 5). It uses a `.tsrx` file extension, fine-grained reactivity via `track()` and the `&[]` lazy-destructuring syntax, no virtual DOM, scoped CSS, and a Vite-based dev setup. It draws heavily on Svelte 5 patterns and Solid's reactivity model.

The honest situation:

- **The author himself** described it (in the original announcement) as "more of an early alpha version of something that might be, rather than something you should try and adopt."
- **Independent reviews** (LogRocket, OpenReplay, March 2026) consistently land on: "interesting, watch closely, do not use in production yet."
- **Ecosystem**: SPA-only, no SSR, no mature meta-framework, no broad third-party library coverage, and crucially **no purpose-built charting wrappers**. Any chart library would have to be integrated via direct DOM mounting (which actually still works fine, see below).
- **Stability**: bugs and missing features acknowledged by maintainers; API still in flux (the syntax has already shifted from `$` prefixes to `track()` + `&[]` since the original release).

### Verdict

**Don't pick Ripple as the primary framework for this project** — but the instinct to try something different than React is sound, and there are good options.

Reasons to skip Ripple specifically:
- You'll want to ship and iterate; alpha-stage frameworks burn time on framework bugs rather than on the actual problem.
- The tax math + sensitivity analysis is the interesting part. The framework should get out of the way.
- LLM tooling assistance (Claude, Copilot, etc.) is meaningfully weaker on Ripple than on Svelte/Solid/React because of training data scarcity.

If you specifically want the "fine-grained reactivity, no-VDOM, compiler-driven" experience that drew you to Ripple, **Svelte 5** and **Solid** give you 90% of the same feel with a real ecosystem. Both share lineage with Ripple — Svelte 5 because Gannaway worked on it, Solid because it pioneered the signal-based reactivity that Ripple emulates.

### Recommended primary: **Svelte 5**

- Compiler-driven, no virtual DOM — same architectural philosophy as Ripple.
- `$state`, `$derived`, `$effect` runes give you the same fine-grained reactivity feel.
- First-class TypeScript support.
- SvelteKit if you ever want SSR or routing later (you don't need it now — this is a single-page calc tool).
- Mature charting story: Observable Plot, ECharts, and uPlot all work cleanly.

### Recommended alternative: **Solid**

- The most direct philosophical match to Ripple (signals, fine-grained reactivity, no VDOM).
- JSX-based, so the syntax will feel familiar if you know React.
- Smaller ecosystem than Svelte but bigger than Ripple, and very TS-friendly.

### Optional escape hatch: **Ripple as a learning experiment**

If you genuinely want to play with Ripple, build a small toy version of one panel (e.g., the salary → bijtelling calculator) in Ripple **after** the main app is working in Svelte. That way you scratch the itch without tying the project to an alpha framework.

---

## 2. Charting Library

The core requirement is: **plot one variable across a range while holding others fixed**, so the user sees the influence of that variable. This is a sensitivity-analysis / parametric-sweep visualization, not a dashboard with 20 widget types.

### Recommendation: **Observable Plot** (primary) + **uPlot** (for interactive sliders if needed)

#### Observable Plot — for the main "sensitivity" charts

- Built by Mike Bostock (creator of D3), explicitly designed for the "show me how Y depends on X" use case.
- Tiny, declarative API — you describe the marks and the data, you don't manually wire scales and axes.
- Outputs an SVG element you append to a DOM node — works the same in Svelte, Solid, and even Ripple.
- Re-rendering on input change is a single function call — perfect for "user moved a slider, redraw the chart."
- MIT licensed, no commercial restrictions.

Typical usage (framework-agnostic):

```ts
import * as Plot from "@observablehq/plot";

const points = mileages.map(km => ({
  km,
  netCost: calculateNetMonthlyCost({ ...fixedInputs, annualKm: km }),
}));

const chart = Plot.plot({
  marks: [
    Plot.lineY(points, { x: "km", y: "netCost" }),
    Plot.ruleX([fixedInputs.annualKm]), // current value indicator
  ],
});
container.replaceChildren(chart);
```

#### uPlot — only if performance becomes an issue

Observable Plot uses SVG, which is fine for a few hundred points. If you build a "drag this slider and watch the curve update at 60fps" interaction with a few thousand points, swap that specific chart for uPlot (~20KB, canvas-based, very fast). The rest of the charts can stay on Plot.

#### What I'd skip

- **ECharts**: powerful but oversized for this use case. You don't need 3D globes or candlestick charts.
- **Chart.js**: fine, but Plot is better suited to parametric sweeps.
- **D3 directly**: too much manual work for what you need.
- **Recharts / Victory / Visx**: all React-locked, defeats the purpose of moving away from React.
- **Plotly.js**: heavy and overkill for this app.

---

## 3. Architecture: Keep the Calculation Engine Framework-Agnostic

This is the single most important architectural decision and it's independent of which framework you pick.

```
src/
├── domain/                    ← pure TypeScript, no framework imports
│   ├── tax/
│   │   ├── incomeTax.ts       ← bruto → netto, marginal rate
│   │   ├── bijtelling.ts      ← annual gross bijtelling per scenario
│   │   ├── mrb.ts             ← weight + powertrain + province → annual MRB
│   │   └── bpm.ts             ← powertrain + CO₂ → one-time BPM
│   ├── scenarios/
│   │   ├── ownership.ts
│   │   ├── privateLease.ts
│   │   └── businessLease.ts
│   ├── compare.ts             ← runs all scenarios, returns comparison
│   └── sensitivity.ts         ← sweeps one variable across a range
├── data/
│   ├── tax_year_2026.json     ← all rates, brackets, thresholds
│   └── provinces_2026.json    ← opcenten per province
├── ui/                        ← Svelte/Solid components
│   ├── InputPanel.svelte
│   ├── ResultCards.svelte
│   ├── SensitivityChart.svelte   ← wraps Observable Plot
│   └── ...
└── defaults.ts                ← realistic starting values
```

**Why this matters:**
1. The hard part of this project is the tax math, not the UI. Keeping it pure TS means you can unit-test it thoroughly with Vitest.
2. If you ever change frameworks (or want to swap Svelte for Ripple later as a learning exercise), the domain code moves untouched.
3. The sensitivity analysis is just `domain/sensitivity.ts` calling `compare.ts` in a loop — no framework involved.

---

## 4. Default Values — "Playable from the Get-Go"

Defaults should let someone open the app and immediately see meaningful output. Suggested baseline:

```ts
// src/defaults.ts
export const DEFAULTS = {
  vehicle: {
    catalogusprijs: 45_000,         // representative mid-market EV / petrol
    aanschafprijs: 42_000,
    powertrain: "EV",
    co2: 0,
    weight: 1850,                    // kg, typical EV weight
    detYear: 2026,
    province: "Overijssel",          // adjust default if you want
    holdingMonths: 60,
    residualValue: 18_000,
    annualKm: 18_000,
    businessKm: 6_000,
    commuteKm: 8_000,
    privateKm: 4_000,
  },
  salary: {
    bruto: 65_000,
    aowAge: false,
    fiscalPartner: false,
    hypotheekrenteAftrek: 0,
  },
  ownership: {
    downPayment: 10_000,
    interestRate: 0.065,
    loanTermMonths: 60,
    insurancePerMonth: 95,
    maintenancePerYear: 800,
    electricityCostPerKwh: 0.28,    // mixed home/public
    consumptionKwhPer100km: 18,
  },
  privateLease: {
    monthlyPayment: 599,
    contractMonths: 48,
    contractKmPerYear: 15_000,
    excessKmTariff: 0.12,
    eigenRisico: 250,
  },
  businessLease: {
    monthlyLeaseTariff: 750,        // employer-paid
    eigenBijdrage: 0,
    fuelCardPrivate: true,
    role: "employee",
  },
  reimbursement: {
    ratePerKm: 0.23,                // 2026 confirmed; €0.25 still pending
  },
};
```

Every input field should be pre-filled from this and editable. The result panels should render on first load with these values.

---

## 5. Sensitivity Analysis — How "Plot one variable, fix the rest" Should Work

UX pattern:

1. User picks a variable from a dropdown ("Annual mileage", "Catalogusprijs", "Bruto salary", "Electricity price", "Holding period", etc.).
2. App auto-suggests a reasonable range (e.g., for annual mileage: current ± 50% in 20 steps).
3. User can override the range and step count.
4. App evaluates `compare(inputs)` for each step, with all other variables held at their current input values.
5. Result: a line chart with one line per scenario (ownership / private lease / business lease) and the X-axis being the swept variable.
6. A vertical reference line marks the user's current value, so you see "where am I now, and where would I be if X changed?"

```ts
// domain/sensitivity.ts
export function sweep<K extends keyof Inputs>(
  inputs: Inputs,
  variable: K,
  range: number[],
): SensitivityResult {
  return range.map(value => ({
    x: value,
    scenarios: compareAll({ ...inputs, [variable]: value }),
  }));
}
```

This stays entirely in the domain layer; the UI just hands it inputs and renders the result.

---

## 6. State Management

For an app this size: **just framework-native primitives are enough**.

- Svelte 5: a single `$state` object holding all inputs, with `$derived` for computed scenarios.
- Solid: signals + `createMemo`.
- No need for Redux, Zustand, Pinia, or similar. The app is essentially `inputs → pure function → outputs`, which is the easiest possible state shape.

URL serialization is worth adding so you can share a scenario:

```
?bruto=65000&powertrain=EV&catalogus=45000&km=18000&...
```

Implement once at the boundary (read URL → fill defaults; on input change → debounced URL update) and you've got shareable links + browser back/forward "for free."

---

## 7. Testing Strategy

The domain layer is the part that absolutely needs tests. Tax math has many edge cases (60-month bijtelling lock, €30k cap on EV bijtelling, AOW threshold, heffingskorting phase-out zones).

```ts
// domain/tax/bijtelling.test.ts
import { describe, it, expect } from "vitest";
import { calculateBijtelling } from "./bijtelling";

describe("bijtelling 2026", () => {
  it("EV registered 2026, €45k catalogus → 18% on €30k + 22% on €15k", () => {
    expect(calculateBijtelling({
      catalogusprijs: 45_000,
      powertrain: "EV",
      detYear: 2026,
    })).toBe(0.18 * 30_000 + 0.22 * 15_000);  // 5_400 + 3_300 = 8_700
  });

  it("EV registered 2025 keeps 17% rate through 2030 (60-month lock)", () => {
    expect(calculateBijtelling({
      catalogusprijs: 45_000,
      powertrain: "EV",
      detYear: 2025,
      taxYear: 2027,
    })).toBe(0.17 * 30_000 + 0.22 * 15_000);
  });

  it("petrol always 22% over full catalogus", () => {
    expect(calculateBijtelling({
      catalogusprijs: 45_000,
      powertrain: "petrol",
      detYear: 2026,
    })).toBe(0.22 * 45_000);
  });
});
```

UI tests can be lighter — mostly snapshot/interaction tests on the input panel and ensuring the chart re-renders when inputs change.

---

## 8. Build, Tooling, Hosting

- **Build**: Vite. Fast HMR, works with Svelte/Solid/Ripple, minimal config.
- **Linting**: Biome (or ESLint + Prettier if you prefer the classic setup). Biome is faster and a single tool.
- **Deployment**: anywhere static. Vercel, Cloudflare Pages, Netlify, GitHub Pages all work — the app is pure client-side, no server needed.
- **No backend**: the app does no network calls except (optionally) loading the tax-year JSON. Privacy bonus: your salary numbers never leave the browser.

---

## 9. Open Decisions

Things to lock down before starting implementation:

1. **Svelte 5 vs Solid?** Both fit. Pick by which syntax you'd enjoy more — Svelte's `.svelte` files (HTML-first with logic blocks) or Solid's JSX (React-like).
2. **i18n now or later?** The audience is Dutch, but tax terminology is half-Dutch / half-English in practice. Consider whether to label inputs as "Catalogusprijs" or "List price (incl. BTW + BPM)." A quick toggle is cheap to add.
3. **Tax-year switcher?** If you build it parametrically from day one, supporting 2025 and 2027 later is trivial. Decide whether to expose this in the UI or hide it.
4. **PWA / offline?** Probably overkill, but free with Vite + a small plugin if useful.
5. **Mobile layout priority?** Sensitivity charts on a phone are hard — decide if mobile is a first-class target or "should work but desktop-first."

---

## 10. Suggested Next Step

Build a minimal end-to-end vertical slice first:
1. One scenario (e.g., business lease only).
2. Three inputs (catalogusprijs, bruto salary, annual km).
3. One result number (net monthly cost).
4. One sensitivity chart (sweep annual km).

Get this working in ~a day. Once the architecture is proven, fanning out to all three scenarios and the full input panel is mechanical work.
