# Tax-calculation scripts

## `explore-tax.ts` — numerical explorer / fuzzer

Sweeps the input space of every tax function in `src/domain/tax/` and writes
suspicious or "interesting" cases to `scripts/explorer-output/findings.json`
for human review.

Run:

```bash
npm run explore-tax
```

What it does:

- **Bijtelling**: walks `catalogusprijs` from €0 to €200 000 (€250 step) for
  every `(powertrain, detYear, taxYear)` combination. Records boundary points
  near the EV €30 000 cap, checks for negative or non-finite outputs, and
  validates the eigen-bijdrage cap against gross bijtelling.
- **BPM**: walks CO₂ from 0 to 400 g/km for every powertrain. Flags
  monotonicity violations, finds the largest single-gram jump per powertrain
  (the bracket boundary), and the petrol/EV crossover point.
- **MRB**: walks weight from 100 to 3500 kg for every
  `(powertrain, province, year)` combination. Flags monotonicity violations
  and records the largest 1-kg jump per powertrain (the weight-tier boundary).
- **Income tax**: walks income from €0 to €250 000 (€100 step). Records
  marginal-rate maxima, bracket-boundary continuity, and asserts that net
  income never decreases as gross income rises.
- **Business lease**: combines extreme inputs (huge eigen bijdrage, low
  catalogusprijs, etc.) and asserts that taxable bijtelling never goes
  negative.

### Workflow

1. Run the explorer.
2. Inspect `findings.json`. Each finding has a `severity` of
   `error` / `warn` / `info`.
3. **Errors** are invariant violations: investigate the implementation.
4. **Infos** are boundary points / extremes: validate manually against Dutch
   tax law.
5. Promote validated cases into `src/domain/tax/findings.regression.test.ts`
   (or fix the calculation if a bug is confirmed).

The explorer is intentionally **deterministic** (no randomness, no seeds): the
same inputs produce the same findings every run, so it can be re-run after
changes without diff noise.
