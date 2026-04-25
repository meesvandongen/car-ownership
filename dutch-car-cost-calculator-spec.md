# Dutch Car Ownership Cost Calculator — Project Specification

A tool to compare the total cost of three car-acquisition options in the Netherlands — **private ownership**, **private lease**, and **business lease** — taking Dutch tax rules and the user's bruto/netto salary into account.

**Reference year:** 2026 (rules and rates change annually; the tool should be parameterized so values can be updated each year).

---

## 1. Scope & Goals

### What the tool does
- Accepts vehicle, usage, and personal financial inputs.
- Computes monthly and total cost for each of the three ownership models.
- Translates gross tax effects (e.g., bijtelling) into actual net monthly cost using the user's marginal income tax rate.
- Compares scenarios side-by-side, with sensitivity analysis on key variables.

### Who it's for
- Employees considering a `auto van de zaak` vs buying privately.
- ZZP'ers / IB-ondernemers choosing between private lease, business lease, or buying through the business.
- DGA's weighing leasing through their BV vs personal ownership.

### Out of scope (for v1)
- Bicycles, scooters, motorcycles.
- Truck-based `vrachtwagenheffing` (kilometer charge introduced 1 July 2026).
- BTW reclaim mechanics for mixed-use cars beyond a high-level toggle.
- MIA/Vamil/KIA investment deductions (flagged but not modeled in detail).

---

## 2. Variable Catalogue

### A. Vehicle variables (apply to all three options)

| Variable | Type | Notes |
|---|---|---|
| Catalogusprijs (incl. BTW + BPM) | € | Official Dutch list price; basis for bijtelling, NOT the actual purchase price |
| Aanschafprijs / netto purchase price | € | What you actually pay (used for ownership, financial lease, depreciation) |
| Powertrain | enum | `EV`, `hydrogen`, `PHEV`, `petrol`, `diesel`, `LPG` |
| CO₂ emissions | g/km | Drives BPM (combustion) and PHEV MRB surcharge |
| Vehicle weight | kg | Drives MRB |
| Date of first registration (DET) | date | Locks bijtelling rate for 60 months |
| Province of registration | enum | Drives `provinciale opcenten` portion of MRB |
| Expected holding period | months | For ownership TCO and post-60-month bijtelling modeling |
| Expected residual / resale value | € | For ownership scenario |
| Annual mileage — total | km/year | |
| Annual mileage — business | km/year | |
| Annual mileage — commute | km/year | |
| Annual mileage — private | km/year | The 500 km/year threshold determines whether bijtelling applies on a business car |

### B. Bijtelling variables (only for `auto van de zaak`)

The 2026 rules in summary:

| Year of registration (DET) | EV rate (over first €30.000) | Above €30.000 | Combustion |
|---|---|---|---|
| 2025 | 17% | 22% | 22% |
| 2026 | 18% | 22% | 22% |
| 2027 | 20% | 22% | 22% |
| 2028+ | 22% (cap removed) | 22% | 22% |

Special cases:
- **Hydrogen + integrated solar-cell EVs (2026):** 18% over the **full** catalogusprijs.
- **Youngtimer (16+ years old in 2026, 25+ years old from 2027):** 35% over **dagwaarde** (market value), not list price.
- **<500 km/year private use:** zero bijtelling, but requires watertight `rittenregistratie`.
- **60-month lock:** the rate applicable at first registration is locked for 5 years.

Required inputs:
- Year of first registration (drives rate selection).
- Eigen bijdrage from net salary (€/month, reduces bijtelling 1:1, capped at bijtelling amount).
- Rittenregistratie maintained? (yes/no toggle).

### C. MRB (motorrijtuigenbelasting) — 2026

| Variable | Notes |
|---|---|
| Vehicle weight | kg, lookup table → base MRB |
| Powertrain | EV: 70% of base (30% korting through 2028, 25% in 2029, 0% from 2030); PHEV 1–50 g/km: 100% (driekwarttarief gone in 2026); combustion: 100% |
| Province | Provinciale opcenten as % of base; differs significantly between provinces |

### D. BPM (purchase tax) — 2026

Only relevant for new purchases.

| Variable | Notes |
|---|---|
| Powertrain | EV/hydrogen: fixed bedrag (~€667 in 2025, slightly higher in 2026 with inflation) |
| CO₂ emissions | Combustion: stepped CO₂-based tariff; brackets tightened and rates raised in 2026 |
| Diesel surcharge | Applies to diesel cars; raised in 2026 |
| PHEV surcharge | Raised in 2026 |

### E. Income / tax variables (bruto → netto conversion)

| Variable | Notes |
|---|---|
| Annual gross salary | € |
| Tax box 1 (2026, < AOW age) | Bracket 1: up to €38.883 — ~35,70–35,75%; Bracket 2: €38.883–€79.137 — 37,56%; Bracket 3: above €79.137 — 49,50% |
| AOW status | yes/no — affects bracket 1 rate (no AOW premie) |
| Algemene heffingskorting | Phases out as income rises |
| Arbeidskorting | Phases out as income rises; meaningfully changes effective marginal rate around €28k–€79k |
| Has fiscal partner? | Affects some kortingen and box 3 calculations |
| Hypotheekrenteaftrek? | Affects taxable income; relevant for accurate marginal rate |

> **Implementation note:** for bijtelling cost, prefer computing income WITH and WITHOUT bijtelling and taking the net difference, rather than applying a flat marginal rate. The afbouw of arbeidskorting/algemene heffingskorting can push the effective marginal rate well above the nominal bracket.

### F. Option-specific variables

#### F1. Private ownership (own purchase, cash or financed)
- Purchase price incl. BTW + BPM.
- Financing: down payment, loan amount, interest rate (%), term (months).
- Depreciation curve or simple linear/exponential model + residual value.
- Insurance: WA / WA+ / All-risk premium per month.
- Maintenance + tyres + APK budget per year.
- Fuel/electricity: €/kWh home, €/kWh public, €/L petrol/diesel; consumption (kWh/100km or L/100km).
- MRB (full tariff, with EV korting if applicable).
- Optional: opportunity cost of capital (% on the down payment + tied capital).
- Business km reimbursement received: €0,23/km untaxed in 2026 (potentially €0,25 — proposed, pending Tweede Kamer approval).

#### F2. Private lease
- Monthly lease payment (all-in: depreciation, MRB, insurance, maintenance, tyres; fuel/electricity NOT included).
- Contract duration (12–60 months) and contract km/year.
- Excess km tariff (€/km) and under-km refund (€/km).
- Eigen risico per claim.
- Down payment / aanbetaling.
- Fuel/electricity cost (same model as ownership).
- BKR registration impact (informational — reduces future mortgage capacity; rule of thumb: €400/month lease → tens of thousands less mortgage).
- Tax effects:
  - **No bijtelling**, **no business deduction** (private contract).
  - For ZZP'ers: business km still deductible at €0,23/km from profit.

#### F3. Business lease (operationeel) — employee, DGA, or ZZP
- Monthly lease tariff paid by the employer / business.
- User role: `employee`, `DGA`, `IB-ondernemer / ZZP`.
- Eigen bijdrage from net salary (reduces bijtelling 1:1, capped at bijtelling amount).
- Fuel card: yes/no; who pays for private km.
- For employer / DGA / ZZP:
  - Deductibility of lease costs from business profit.
  - BTW recovery (with private-use correction).
  - From 2027: 12% **pseudo-eindheffing** on non-zero-emission company cars (paid by employer, may NOT be passed to employee).
- Bijtelling computation per section B.

#### F4. Financial lease / business ownership (ZZP / BV)
- Loan structure: down payment, term, interest, balloon payment.
- Depreciation schedule on the books (typically 5 years, residual ~10–20%).
- KOR / BTW status (small business scheme affects BTW reclaim on purchase + running costs).
- Pro-rata BTW correction if private use applies.
- Income tax: deduct depreciation + interest + running costs from profit; bijtelling added back if used privately >500 km.
- Optional flags: MIA / Vamil / KIA eligibility (rules tighten yearly).

### G. Travel reimbursement (relevant when user has a private car and gets reimbursed for business km)

| Variable | Notes |
|---|---|
| Reimbursement rate received | €/km, default €0,23 in 2026 (cap for tax-free) |
| Business km/year reimbursed | km |
| Excess above €0,23 treated as | `loon` / `WKR vrije ruimte` |

---

## 3. Output Variables

Per option, the tool should produce:

- **Per year** and **5-year total**:
  - Gross monthly cash cost (cashflow out of pocket).
  - Net monthly cost after tax effects (bijtelling cost, deductions, reimbursements netted).
  - Net cost per km.
- **Side-by-side comparison** of all three options.
- **Sensitivity analysis** on:
  - Annual mileage ±5.000 km.
  - Electricity price ±20%.
  - Residual value ±€2.000.
  - Marginal tax rate (e.g., what if income changes brackets).

---

## 4. Warnings & Flags

The tool should explicitly surface these to the user:

- **60-month bijtelling lock** — registering in 2025 vs 2026 vs 2027 has long-tail consequences (e.g., 17% locked through 2030 for a 2025 EV).
- **BKR registration** on private lease reduces mortgage borrowing capacity.
- **500 km/year private-use threshold** + rittenregistratie administrative burden if claiming zero bijtelling.
- **2027 pseudo-eindheffing** (12%) on non-EV company cars — major shift for employers.
- **€0,23 → €0,25 reimbursement increase** is proposed but not yet final as of April 2026.
- **Youngtimer age threshold** moves from 15 to 16 years in 2026, then to 25 years in 2027.
- **EV MRB korting** schedule: 30% (2026–2028), 25% (2029), 0% (2030+).
- **PHEV MRB driekwarttarief** is gone from 2026 — PHEVs now pay full MRB.

---

## 5. Data Sources (for keeping rules current)

| Topic | Authoritative source |
|---|---|
| Bijtelling rates | belastingdienst.nl |
| Income tax brackets & heffingskortingen | belastingdienst.nl, Belastingplan documents |
| MRB rates | belastingdienst.nl + provincie websites for opcenten |
| BPM tariff | belastingdienst.nl |
| Reimbursement cap | rijksoverheid.nl |
| Annual changes summary | "Belangrijkste wijzigingen belastingen" (Ministerie van Financiën) |

---

## 6. Suggested Architecture

### Calculation modules
1. **TaxModule** — computes net income from gross, given brackets + heffingskortingen + AOW status. Used both standalone (for salary display) and incrementally (for bijtelling marginal cost).
2. **BijtellingModule** — given vehicle + DET + private km, returns annual gross bijtelling.
3. **MRBModule** — given weight + powertrain + CO₂ + province + year, returns annual MRB.
4. **BPMModule** — given purchase year + powertrain + CO₂, returns one-time BPM.
5. **OwnershipModule** — combines purchase, depreciation, financing, MRB, insurance, maintenance, fuel, reimbursements.
6. **PrivateLeaseModule** — combines lease tariff + fuel + reimbursements.
7. **BusinessLeaseModule** — combines lease tariff (employer-paid) + bijtelling cost + eigen bijdrage + fuel.
8. **ComparisonEngine** — runs all enabled scenarios, produces tables + sensitivity.

### Data layer
- A versioned `tax_year_2026.json` (or similar) containing all rates, brackets, and thresholds. Allows easy updates each year without code changes.

### UI considerations
- Sensible defaults for each input (Dutch averages: insurance, maintenance, electricity price, etc.) so the user can get a useful first answer with minimal entry.
- Progressive disclosure: hide ZZP/DGA-specific options unless the user selects that role.
- Show **both** the headline number (€/month net) and the breakdown (bijtelling, MRB, fuel, etc.).

---

## 7. Open Questions / Decisions to Make

1. **EV charging cost**: model as a single average €/kWh, or split home/public charging with their respective shares?
2. **Insurance premium**: fetch from a lookup table by car category, or always user-input?
3. **Multi-year modeling**: assume rules from 2026 stay constant, or apply known future changes (2027 EV bijtelling 20%, 2028 EV bijtelling 22%, 2030 MRB EV korting gone)?
4. **WKR-vrije ruimte**: model the ability to receive reimbursement above €0,23 untaxed via WKR, or treat anything above as taxable?
5. **Hypotheekrenteaftrek interaction**: include in marginal-rate computation, or assume user enters their effective marginal rate directly?

---

## 8. Versioning & Maintenance

The Dutch tax rules change every year, often with last-minute amendments (the 2026 EV bijtelling change in November 2025 is a prime example). The tool should:

- Show the tax year being used in the UI ("Calculations based on 2026 rules").
- Make it trivial to add a `tax_year_2027.json` and switch.
- Log when key rates were last verified against authoritative sources.
