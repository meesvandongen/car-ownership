# Dutch Car Cost Calculator

A client-side web app that compares the total cost of three car-acquisition options
in the Netherlands — **private ownership**, **private lease**, and **business lease** —
taking Dutch tax rules and bruto/netto salary into account.

Reference year: **2026**.

## Stack

- Svelte 5 + TypeScript
- Vite for dev/build
- Observable Plot for the sensitivity charts
- Vitest for the domain tests

The calculation engine in `src/domain/` is framework-agnostic, fully typed, and unit
tested. Tax rules live in `src/data/tax_year_2026.json`; new years can be added by
dropping in another JSON.

## Scripts

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
npm test         # vitest
```

## Layout

```
src/
├── domain/                     pure TS, no framework
│   ├── tax/                    incomeTax, bijtelling, MRB, BPM
│   ├── scenarios/              ownership, privateLease, businessLease, fuel, financing
│   ├── compare.ts              runs all scenarios
│   ├── sensitivity.ts          parametric sweep
│   ├── taxData.ts              loader + types
│   └── types.ts
├── data/
│   └── tax_year_2026.json      rates, brackets, thresholds
├── ui/                         Svelte components
├── lib/                        URL serialization, formatting
├── defaults.ts
├── App.svelte
└── main.ts
```

## What's modelled

- Box 1 income tax with algemene heffingskorting + arbeidskorting phase-outs
- Bijtelling with EV cap and 60-month registration lock
- Hydrogen / solar-EV special rate, youngtimer regime, <500 km rittenregistratie zero
- MRB by weight × powertrain × provincial opcenten, with EV korting schedule
- BPM by powertrain + CO₂ with diesel/PHEV surcharges
- Ownership: depreciation + financing (annuity) + MRB + insurance + maintenance + fuel
- Private lease: lease tariff + down payment + fuel + excess km
- Business lease: marginal-rate net cost of bijtelling + eigen bijdrage + private fuel
- 2026 untaxed reimbursement cap (€0,23/km) with marginal tax on the excess
- 2027 12% pseudo-eindheffing surfaced as a warning

## Sensitivity

Pick one variable from the dropdown — annual mileage, catalogusprijs, salary, etc. —
and the chart sweeps it across ±50% with all three scenarios overlaid. The dashed
line marks the current input.

## Sharing

Every input is serialised to the URL query string (debounced), so the address bar
itself is the share link. Use the **Copy share link** button.

## Caveats

The MRB weight table, BPM brackets, and heffingskorting parameters are simplified
approximations of the published 2026 rules and are intended for indicative
comparison only — verify against
[belastingdienst.nl](https://www.belastingdienst.nl) before making decisions.
Inputs never leave the browser.
