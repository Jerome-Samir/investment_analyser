# PPOR Mode — Design Spec

## Overview

Add a "Primary Residence (PPOR)" mode to the existing investment property analyser via a toggle in the sidebar. When active, the tool switches from investment-focused calculations (negative gearing, CGT, rental yield) to owner-occupier calculations (P&I repayments, total cost of ownership, equity build-up). The existing Investment mode remains the default and is unchanged.

## Approach

**Approach B: Mode toggle with extracted calculation modules.** New PPOR-specific calculations (P&I amortisation, FHBAS stamp duty, total cost of ownership) are added to `lib/calculations.ts`. The page conditionally renders different inputs, KPI cards, summary tables, and charts based on the selected mode.

---

## 1. Mode Toggle & Inputs

### Toggle

A two-option toggle at the top of the sidebar: **Investment** | **PPOR**. Default: Investment.

### Shared Inputs (both modes)

- Purchase price
- Deposit %
- Capitalise LMI toggle
- Interest rate
- Property type (House / Apartment)
- Quarterly strata (visible when Apartment)
- Appreciation rate

### Investment-Only Inputs (hidden in PPOR mode)

- Weekly rental income
- Weekly rent you currently pay
- Your income (for tax calculations)
- Rental growth rate
- Buyer's agent toggle

### PPOR-Only Inputs (hidden in Investment mode)

- First Home Buyer toggle (default: off)

---

## 2. PPOR Calculations (new in `lib/calculations.ts`)

### P&I Monthly Repayment

Standard amortisation formula over 30 years (360 months):

```
M = P * [r(1+r)^n] / [(1+r)^n - 1]
```

Where P = loan amount (including capitalised LMI if applicable), r = monthly interest rate, n = 360.

### First Home Buyer Stamp Duty (NSW FHBAS)

- Purchase price <= $800,000: full exemption ($0)
- $800,001 - $1,000,000: concessional — discount factor = `(1,000,000 - price) / 200,000`, applied to normal stamp duty (i.e. `normalDuty * (1 - discountFactor)`)
- Above $1,000,000: normal stamp duty via existing `calcStampDutyNSW`

New function: `calcStampDutyNSW_FHBAS(price: number): number`

### Amortisation Schedule

Year-by-year breakdown for a given loan amount, rate, and 30-year term:
- Principal paid in each year
- Interest paid in each year
- Remaining loan balance at end of each year

New function: `computeAmortisationSchedule(loanAmount, annualRate, termYears = 30): AmortisationYear[]`

### Total Cost of Ownership

Sum of:
- Total upfront costs
- Total interest paid over 30 years
- Total running expenses over 30 years (council/water, strata, insurance — no rental agent fees, no land tax for PPOR)

### What is excluded in PPOR mode

- No negative gearing / tax deductions (PPOR mortgage interest is not deductible)
- No CGT calculations (primary residence is CGT-exempt)
- No land tax (PPOR is exempt from NSW land tax)
- No rental income, rental agent fees, or rental growth

---

## 3. PPOR KPI Cards & Summary Table

### 6 KPI Metric Cards

1. **Monthly P&I Repayment** — standard amortisation payment amount
2. **Total Interest (30yr)** — total interest paid over the life of the loan
3. **Total Cost of Ownership** — upfront + total interest + running expenses over 30 years
4. **LVR** — loan-to-value ratio (same calculation as investment mode)
5. **Equity at Year 10** — property value (with appreciation) minus remaining loan balance at year 10
6. **Loan Payoff Date** — displayed as a calendar year (e.g. "2056")

Each card includes an InfoTip tooltip explaining the metric, consistent with the existing investment KPI cards.

### Summary Table

Replaces the investment cash flow breakdown:

**Monthly costs:**
- Monthly P&I repayment
- Monthly council & water
- Monthly strata (if apartment)
- Monthly insurance (if house)
- **Total monthly housing cost** (bold)

**Upfront costs:**
- Deposit
- Stamp duty (showing "FHBAS exempt" or discounted amount if First Home Buyer)
- LMI (if deposit < 20% and not capitalised)
- Legal fees
- Mortgage registration fee
- Transfer fee
- **Total upfront** (bold)

---

## 4. PPOR Charts

### 4a. Equity Build-Up (10-year)

Area chart showing:
- Property value line (with appreciation)
- Remaining loan balance line
- Shaded equity gap between them

Uses the amortisation schedule + appreciation rate over 10 years.

### 4b. Interest Rate Stress Test

Line chart showing monthly P&I repayment at different interest rates (2%–10%, 0.25% steps). Reference line at the user's current rate. Answers: "can I still afford this if rates rise?"

### 4c. Amortisation Breakdown (10-year)

Stacked bar chart showing principal vs interest portion of each year's total repayments. Visualises how the principal/interest split shifts over time.

### 4d. Deposit Sensitivity

Line chart (or dual-axis) showing:
- Total upfront cost at different deposit percentages (5%–30%)
- Monthly P&I repayment at different deposit percentages

The LMI cliff at 20% should be clearly visible.

### Investment-only charts (hidden in PPOR mode)

- Break-even appreciation rate
- Break-even vs rent difference
- Break-even vs property price
- Cash-on-Cash vs deposit
- DSCR stress test
- Break-even vs interest rate

---

## 5. File Changes Summary

| File | Change |
|------|--------|
| `lib/calculations.ts` | Add `calcMonthlyPI`, `calcStampDutyNSW_FHBAS`, `computeAmortisationSchedule`, `computePPOR10YearProjection`, `computePPORRateStress`, `computePPORDepositSensitivity` |
| `app/page.tsx` | Add mode toggle state, conditional input rendering, PPOR `useMemo` branch, PPOR KPI cards, PPOR summary table, PPOR charts |

No new files needed. No changes to existing Investment mode behaviour.
