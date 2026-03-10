"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import {
  calcLMI,
  calcStampDutyNSW,
  calcTaxWithMedicare,
  marginalRate,
  computeBreakeven,
  compute10YearProjection,
  computeRateStressTest,
  computeBreakevenVsRate,
  computeCoCVsDeposit,
  fmt,
  signedFmt,
  pctFmt,
  MORTGAGE_REGISTRATION_FEE,
  TRANSFER_FEE,
  LEGAL_FEES,
  MONTHLY_COUNCIL_WATER,
} from "@/lib/calculations";

// ─── Number Input Component ───

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="text-sm font-medium text-[var(--fg)]">{label}</span>
      <div className="relative mt-1">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          min={min}
          style={{ paddingLeft: prefix ? "1.75rem" : undefined, paddingRight: suffix ? "2rem" : undefined }}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

// ─── Table Component ───

function Table({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <tbody>
        {rows.map(([label, value, bold], i) => (
          <tr key={i} className="border-b border-[var(--border)]">
            <td className={`py-1.5 pr-4 ${bold ? "font-semibold" : ""}`}>{label}</td>
            <td className={`py-1.5 text-right tabular-nums ${bold ? "font-semibold" : ""}`}>
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Metric Card ───

function Metric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  const color =
    positive === undefined
      ? "text-[var(--fg)]"
      : positive
        ? "text-[var(--positive)]"
        : "text-[var(--negative)]";
  return (
    <div className="mb-3">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

// ─── Info Tooltip ───

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex ml-1 group">
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--muted)] text-[var(--muted)] text-[10px] leading-none cursor-help select-none">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--fg)] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-30 normal-case tracking-normal font-normal leading-snug">
        {text}
      </span>
    </span>
  );
}

// ─── Custom tooltip formatter ───

function dollarFormatter(value: number) {
  return fmt(value);
}

// ─── Main Page ───

function Home() {
  const [price, setPrice] = useState(850_000);
  const [depositPct, setDepositPct] = useState(5);
  const [capitaliseLMI, setCapitaliseLMI] = useState(true);
  const [weeklyRental, setWeeklyRental] = useState(600);
  const [weeklyRent, setWeeklyRent] = useState(850);
  const [income, setIncome] = useState(110_000);
  const [rate, setRate] = useState(6.1);
  const [propertyType, setPropertyType] = useState<"House" | "Apartment">("House");
  const [quarterlyStrata, setQuarterlyStrata] = useState(1_500);
  const [includeBuyerAgent, setIncludeBuyerAgent] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appreciationRate, setAppreciationRate] = useState(4);
  const [rentalGrowthRate, setRentalGrowthRate] = useState(3);

  const results = useMemo(() => {
    const isApartment = propertyType === "Apartment";
    const yearlyStrata = isApartment ? quarterlyStrata * 4 : 0;
    const monthlyStrata = yearlyStrata / 12;

    const lmi = calcLMI(price, depositPct);
    const effectiveCapitaliseLMI = depositPct < 20 ? capitaliseLMI : false;
    const mortgage = price * (1 - depositPct / 100) + (effectiveCapitaliseLMI ? lmi : 0);
    const monthlyInterest = (mortgage * (rate / 100)) / 12;
    const monthlyRental = (weeklyRental * 52) / 12;
    const monthlyRentalAgentFee = monthlyRental * 0.07;
    const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
    const monthlyInsurance = yearlyInsurance / 12;
    const monthlyRentSpend = (weeklyRent * 52) / 12;
    const monthlyNet =
      monthlyRental -
      monthlyRentalAgentFee -
      monthlyInsurance -
      MONTHLY_COUNCIL_WATER -
      monthlyStrata -
      monthlyRentSpend -
      monthlyInterest;
    const yearlyPreTax = monthlyNet * 12;

    const yearlyRentalIncome = weeklyRental * 52;
    const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
    const yearlyInterest = monthlyInterest * 12;
    const yearlyCouncilWater = MONTHLY_COUNCIL_WATER * 12;
    const propertyNet =
      yearlyRentalIncome -
      yearlyRentalAgentFee -
      yearlyInsurance -
      yearlyCouncilWater -
      yearlyStrata -
      yearlyInterest;
    const deductibleLoss = Math.max(0, -propertyNet);

    const taxWithout = calcTaxWithMedicare(income);
    const taxWith = calcTaxWithMedicare(income - deductibleLoss);
    const taxSaving = taxWithout - taxWith;
    const yearlyAfterTax = yearlyPreTax + taxSaving;

    // Upfront costs
    const deposit = (price * depositPct) / 100;
    const stampDuty = calcStampDutyNSW(price);
    const lmiUpfront = effectiveCapitaliseLMI ? 0 : lmi;
    const buyerAgentFee = includeBuyerAgent ? price * 0.02 : 0;
    const totalUpfront =
      deposit +
      stampDuty +
      lmiUpfront +
      buyerAgentFee +
      MORTGAGE_REGISTRATION_FEE +
      TRANSFER_FEE +
      LEGAL_FEES;

    const takeHomeYearly = income - taxWith + yearlyPreTax;

    // Break-even chart data
    const baseTaxableIncome = income - deductibleLoss;
    const steps = 61;
    const appDataRaw: { rate: number; net: number }[] = [];
    let breakevenRate: number | null = null;

    for (let i = 0; i < steps; i++) {
      const appRate = (i / (steps - 1)) * 20;
      const yearlyApp = price * (appRate / 100);
      const taxableCG = yearlyApp * 0.5;
      const taxWithCGT = calcTaxWithMedicare(baseTaxableIncome + taxableCG);
      const taxWithoutCGT = calcTaxWithMedicare(baseTaxableIncome);
      const cgtOwed = taxWithCGT - taxWithoutCGT;
      const netPosition = yearlyAfterTax + yearlyApp - cgtOwed;
      appDataRaw.push({ rate: Math.round(appRate * 100) / 100, net: Math.round(netPosition) });

      if (i > 0 && breakevenRate === null) {
        const prev = appDataRaw[i - 1].net;
        if (prev < 0 && netPosition >= 0) {
          const t = -prev / (netPosition - prev);
          breakevenRate =
            appDataRaw[i - 1].rate + t * (appRate - appDataRaw[i - 1].rate);
        }
      }
    }
    if (appDataRaw.length > 0 && appDataRaw[0].net >= 0) breakevenRate = 0;

    // Insert breakeven point into data so the dot renders and colors split cleanly
    if (breakevenRate !== null && breakevenRate > 0) {
      const beRateRounded = Math.round(breakevenRate * 100) / 100;
      const insertIdx = appDataRaw.findIndex((d) => d.rate >= beRateRounded);
      if (insertIdx >= 0 && appDataRaw[insertIdx].rate !== beRateRounded) {
        appDataRaw.splice(insertIdx, 0, { rate: beRateRounded, net: 0 });
      }
    }

    // Split into negNet / posNet series for red/green coloring
    const allPositive = appDataRaw.length > 0 && appDataRaw[0].net >= 0;
    const allNegative = breakevenRate === null && !allPositive;
    const beRateRoundedVal = breakevenRate !== null ? Math.round(breakevenRate * 100) / 100 : -1;
    const appData = appDataRaw.map((d) => ({
      rate: d.rate,
      net: d.net,
      negNet: allPositive ? undefined : (allNegative || d.rate <= beRateRoundedVal) ? d.net : undefined as number | undefined,
      posNet: allNegative ? undefined : (allPositive || d.rate >= beRateRoundedVal) ? d.net : undefined as number | undefined,
    }));

    // Break-even vs rent difference
    const currentRentDiff = weeklyRent - weeklyRental;
    const rdMin = currentRentDiff - 750;
    const rdMax = currentRentDiff + 750;
    const rdData: { rentDiff: number; breakeven: number }[] = [];
    for (let ri = 0; ri <= 80; ri++) {
      const rd = rdMin + ((rdMax - rdMin) * ri) / 80;
      const wr = weeklyRental + rd;
      if (wr < 0) continue;
      const be = computeBreakeven(
        price, weeklyRental, wr, income, rate, depositPct,
        effectiveCapitaliseLMI, yearlyStrata, isApartment
      );
      if (be !== null) rdData.push({ rentDiff: Math.round(rd), breakeven: Math.round(be * 100) / 100 });
    }

    // Break-even vs property price
    const pMin = price * 0.7;
    const pMax = price * 1.3;
    const ppData: { price: number; breakeven: number }[] = [];
    for (let pi = 0; pi <= 80; pi++) {
      const pp = pMin + ((pMax - pMin) * pi) / 80;
      const be = computeBreakeven(
        pp, weeklyRental, weeklyRent, income, rate, depositPct,
        effectiveCapitaliseLMI, yearlyStrata, isApartment
      );
      if (be !== null) ppData.push({ price: Math.round(pp), breakeven: Math.round(be * 100) / 100 });
    }

    // Deposit sensitivity
    const depRange = Array.from({ length: 26 }, (_, i) => i + 5);
    const depData = depRange.map((dp) => {
      const dpLmi = calcLMI(price, dp);
      const dpMortgage = price * (1 - dp / 100) + (effectiveCapitaliseLMI ? dpLmi : 0);
      const dpMonthlyInterest = (dpMortgage * (rate / 100)) / 12;
      const dpYearlyInterest = dpMonthlyInterest * 12;
      const dpYearlyPreTax =
        yearlyRentalIncome -
        yearlyRentalAgentFee -
        yearlyInsurance -
        yearlyCouncilWater -
        yearlyStrata -
        weeklyRent * 52 -
        dpYearlyInterest;
      const dpPropertyNet =
        yearlyRentalIncome -
        yearlyRentalAgentFee -
        yearlyInsurance -
        yearlyCouncilWater -
        yearlyStrata -
        dpYearlyInterest;
      const dpDeductibleLoss = Math.max(0, -dpPropertyNet);
      const dpTaxSaving =
        calcTaxWithMedicare(income) -
        calcTaxWithMedicare(income - dpDeductibleLoss);
      const dpYearlyAfterTax = dpYearlyPreTax + dpTaxSaving;

      const dpDeposit = (price * dp) / 100;
      const dpLmiUpfront = effectiveCapitaliseLMI ? 0 : dpLmi;
      const dpUpfront =
        dpDeposit +
        stampDuty +
        dpLmiUpfront +
        buyerAgentFee +
        MORTGAGE_REGISTRATION_FEE +
        TRANSFER_FEE +
        LEGAL_FEES;

      const be = computeBreakeven(
        price, weeklyRental, weeklyRent, income, rate, dp,
        effectiveCapitaliseLMI, yearlyStrata, isApartment
      );

      return {
        deposit: dp,
        yearlyNet: Math.round(dpYearlyAfterTax),
        upfront: Math.round(dpUpfront),
        breakeven: be !== null ? Math.round(be * 100) / 100 : null,
      };
    });

    // Compute dynamic break-even tick ranges from actual data
    const beTicks = (data: { breakeven: number }[]) => {
      if (data.length === 0) return [];
      const min = Math.floor(Math.min(...data.map((d) => d.breakeven)) * 2) / 2;
      const max = Math.ceil(Math.max(...data.map((d) => d.breakeven)) * 2) / 2;
      const ticks: number[] = [];
      for (let v = min; v <= max + 0.01; v += 0.5) ticks.push(Math.round(v * 10) / 10);
      return ticks;
    };
    const rdBETicks = beTicks(rdData);
    const ppBETicks = beTicks(ppData);

    // ─── New Professional Metrics ───
    const grossYield = price > 0 ? ((weeklyRental * 52) / price) * 100 : 0;
    const noi =
      yearlyRentalIncome -
      yearlyRentalAgentFee -
      yearlyInsurance -
      yearlyCouncilWater -
      yearlyStrata;
    const netYield = price > 0 ? (noi / price) * 100 : 0;
    const cashOnCash = totalUpfront > 0 ? (yearlyAfterTax / totalUpfront) * 100 : 0;
    const dscr = yearlyInterest > 0 ? noi / yearlyInterest : 0;
    const lvr = 100 - depositPct;

    // 10-year projection
    const tenYearData = compute10YearProjection(
      price, weeklyRental, weeklyRent, income, rate, depositPct,
      effectiveCapitaliseLMI, yearlyStrata, isApartment, totalUpfront,
      appreciationRate, rentalGrowthRate,
    );

    // Interest rate stress test
    const rateStressData = computeRateStressTest(
      price, weeklyRental, weeklyRent, income, depositPct,
      effectiveCapitaliseLMI, yearlyStrata, isApartment,
    );

    // Break-even vs interest rate
    const beVsRateData = computeBreakevenVsRate(
      price, weeklyRental, weeklyRent, income, depositPct,
      effectiveCapitaliseLMI, yearlyStrata, isApartment,
    );

    // Cash-on-cash return vs deposit
    const cocVsDepositData = computeCoCVsDeposit(
      price, weeklyRental, weeklyRent, income, rate,
      effectiveCapitaliseLMI, yearlyStrata, isApartment,
      stampDuty, includeBuyerAgent,
    );

    return {
      lmi,
      effectiveCapitaliseLMI,
      mortgage,
      monthlyInterest,
      monthlyRental,
      monthlyRentalAgentFee,
      monthlyInsurance,
      monthlyStrata,
      monthlyRentSpend,
      monthlyNet,
      yearlyPreTax,
      yearlyAfterTax,
      deductibleLoss,
      taxSaving,
      deposit,
      stampDuty,
      lmiUpfront: effectiveCapitaliseLMI ? 0 : lmi,
      buyerAgentFee,
      totalUpfront,
      takeHomeYearly,
      taxWith,
      appData,
      breakevenRate,
      rdData,
      currentRentDiff,
      ppData,
      depData,
      isApartment,
      rdBETicks,
      ppBETicks,
      grossYield,
      netYield,
      cashOnCash,
      dscr,
      lvr,
      noi,
      tenYearData,
      rateStressData,
      beVsRateData,
      cocVsDepositData,
    };
  }, [price, depositPct, capitaliseLMI, weeklyRental, weeklyRent, income, rate, propertyType, quarterlyStrata, includeBuyerAgent, appreciationRate, rentalGrowthRate]);

  const r = results;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden sticky top-0 z-20 flex items-center gap-2 w-full px-4 py-3 text-sm font-medium bg-[var(--card)] border-b border-[var(--border)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        {sidebarOpen ? "Hide Inputs" : "Show Inputs"}
      </button>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "block" : "hidden"} md:block w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] p-5 overflow-y-auto bg-[var(--card)]`}>
        <h2 className="text-lg font-semibold mb-4">Inputs</h2>

        <NumberInput label="Property Price" value={price} onChange={setPrice} step={10_000} prefix="$" />

        <label className="block mb-1">
          <span className="text-sm font-medium">Deposit: {depositPct}%</span>
          <input
            type="range"
            min={5}
            max={30}
            value={depositPct}
            onChange={(e) => setDepositPct(Number(e.target.value))}
            className="mt-1"
          />
        </label>

        {depositPct < 20 && (
          <label className="flex items-center gap-2 mb-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={capitaliseLMI}
              onChange={(e) => setCapitaliseLMI(e.target.checked)}
            />
            Capitalise LMI
          </label>
        )}

        <NumberInput label="Rental Income (weekly)" value={weeklyRental} onChange={setWeeklyRental} step={10} prefix="$" />
        <NumberInput label="Your Rent Spend (weekly)" value={weeklyRent} onChange={setWeeklyRent} step={10} prefix="$" />
        <NumberInput label="Gross Income (annual, pre-tax)" value={income} onChange={setIncome} step={1_000} prefix="$" />
        <NumberInput label="Bank Interest Rate (annual)" value={rate} onChange={setRate} step={0.01} min={0} suffix="%" />

        <label className="block mb-3">
          <span className="text-sm font-medium">Property Type</span>
          <div className="flex mt-1 rounded-md overflow-hidden border border-[var(--border)]">
            {(["House", "Apartment"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setPropertyType(t)}
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                  propertyType === t
                    ? "bg-blue-500 text-white"
                    : "bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--card)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </label>

        {propertyType === "Apartment" && (
          <NumberInput
            label="Strata Fees (quarterly)"
            value={quarterlyStrata}
            onChange={setQuarterlyStrata}
            step={100}
            prefix="$"
          />
        )}

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={includeBuyerAgent}
            onChange={(e) => setIncludeBuyerAgent(e.target.checked)}
          />
          Include Buyer&apos;s Agent Fee (2%)
        </label>

        <hr className="my-4 border-[var(--border)]" />
        <h2 className="text-lg font-semibold mb-4">Projection Assumptions</h2>

        <label className="block mb-1">
          <span className="text-sm font-medium">Capital Growth: {appreciationRate}% p.a.</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={appreciationRate}
            onChange={(e) => setAppreciationRate(Number(e.target.value))}
            className="mt-1"
          />
        </label>

        <label className="block mb-1">
          <span className="text-sm font-medium">Rental Growth: {rentalGrowthRate}% p.a.</span>
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={rentalGrowthRate}
            onChange={(e) => setRentalGrowthRate(Number(e.target.value))}
            className="mt-1"
          />
        </label>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Investment Property Calculator</h1>

        {/* Dashboard cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Upfront Costs */}
          <div className="rounded-lg border border-[var(--border)] p-4 md:p-5 bg-[var(--card)]">
            <h3 className="text-base font-semibold mb-3">Upfront Costs</h3>
            <Metric label="Total Upfront" value={fmt(r.totalUpfront)} />
            <Table
              rows={[
                [`Deposit (${depositPct}%)`, fmt(r.deposit)],
                ["Stamp (transfer) Duty (NSW)", fmt(r.stampDuty)],
                ...(r.lmi > 0
                  ? [
                      [
                        r.effectiveCapitaliseLMI ? "LMI (capitalised)" : "LMI",
                        fmt(r.lmi),
                      ] as [string, string],
                    ]
                  : []),
                ...(includeBuyerAgent
                  ? [["Buyer's Agent Fee (2%)", fmt(r.buyerAgentFee)] as [string, string]]
                  : []),
                ["Legal Fees", fmt(LEGAL_FEES)],
                ["Govt. Fees*", fmt(MORTGAGE_REGISTRATION_FEE + TRANSFER_FEE)],
                ["Total", fmt(r.totalUpfront), true],
              ]}
            />
            <p className="text-xs text-[var(--muted)] mt-2">
              *Govt. Fees = Mortgage Registration + Transfer Fee
            </p>
          </div>

          {/* Yearly Cost */}
          <div className="rounded-lg border border-[var(--border)] p-4 md:p-5 bg-[var(--card)]">
            <h3 className="text-base font-semibold mb-3">After-Tax Yearly Cost</h3>
            <Metric
              label="Yearly Net (after tax)"
              value={`${signedFmt(r.yearlyAfterTax)} / yr`}
              positive={r.yearlyAfterTax >= 0}
            />
            <Table
              rows={[
                [`Mortgage (${100 - depositPct}% LVR)`, fmt(r.mortgage)],
                ["Interest", `-${fmt(r.monthlyInterest)}`],
                ["Rental income", fmt(r.monthlyRental)],
                ["Rental agent fee (7%)", `-${fmt(r.monthlyRentalAgentFee)}`],
                ...(r.isApartment
                  ? [["Strata fees", `-${fmt(r.monthlyStrata)}`] as [string, string]]
                  : [["House insurance", `-${fmt(r.monthlyInsurance)}`] as [string, string]]),
                ["Council + Water", `-${fmt(MONTHLY_COUNCIL_WATER)}`],
                ["Rent spend", `-${fmt(r.monthlyRentSpend)}`],
                ["Net (pre-tax) /mo", signedFmt(r.monthlyNet), true],
                ["Yearly net (pre-tax)", signedFmt(r.yearlyPreTax), true],
              ]}
            />
          </div>

          {/* Tax Impact */}
          <div className="rounded-lg border border-[var(--border)] p-4 md:p-5 bg-[var(--card)]">
            <h3 className="text-base font-semibold mb-3">Tax Impact</h3>
            <p className="text-xs text-[var(--muted)] mb-3">
              Negative Gearing (2024-25 rates + 2% Medicare)
            </p>
            <Table
              rows={[
                ["Marginal tax rate", `${(marginalRate(income) * 100).toFixed(0)}%`],
                [
                  "Property loss (deductible)",
                  r.deductibleLoss > 0 ? fmt(r.deductibleLoss) : "N/A (no loss)",
                ],
                ["Tax saving", r.taxSaving > 0 ? `+${fmt(r.taxSaving)}` : fmt(0)],
                ["Yearly net (after tax)", signedFmt(r.yearlyAfterTax), true],
              ]}
            />
            <hr className="my-3 border-[var(--border)]" />
            <Table
              rows={[
                ["Take home (yearly)", fmt(r.takeHomeYearly)],
                ["Take home (monthly)", fmt(r.takeHomeYearly / 12)],
              ]}
            />
          </div>
        </div>

        {/* Investment Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="rounded-lg border border-[var(--border)] p-3 md:p-4 bg-[var(--card)]">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Gross Yield
              <InfoTip text="Annual rental income as a percentage of the property purchase price, before any expenses. A quick gauge of income return." />
            </div>
            <div className="text-xl font-bold tabular-nums">{pctFmt(r.grossYield)}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3 md:p-4 bg-[var(--card)]">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Net Yield
              <InfoTip text="Net Operating Income (after property expenses but before debt service) as a percentage of purchase price. Also known as cap rate." />
            </div>
            <div className="text-xl font-bold tabular-nums">{pctFmt(r.netYield)}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3 md:p-4 bg-[var(--card)]">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
              NOI (yearly)
              <InfoTip text="Net Operating Income. Annual rental income minus property expenses (agent fees, insurance/strata, council, water) but before interest and tax. The core profitability of the property itself." />
            </div>
            <div className={`text-xl font-bold tabular-nums ${r.noi >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
              {fmt(r.noi)}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3 md:p-4 bg-[var(--card)]">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Cash-on-Cash
              <InfoTip text="After-tax annual cash flow divided by total cash invested (deposit + upfront costs). Measures the return on your actual out-of-pocket investment." />
            </div>
            <div className={`text-xl font-bold tabular-nums ${r.cashOnCash >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
              {pctFmt(r.cashOnCash)}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3 md:p-4 bg-[var(--card)]">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
              DSCR
              <InfoTip text="Debt Service Coverage Ratio. NOI divided by annual interest payments. Above 1.0x means rental income covers debt costs; below 1.0x means it doesn't. Lenders typically require 1.2x+." />
            </div>
            <div className={`text-xl font-bold tabular-nums ${r.dscr >= 1 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
              {r.dscr.toFixed(2)}x
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <hr className="mb-4 md:mb-6 border-[var(--border)]" />
        <h2 className="text-lg font-semibold mb-4">Break-Even Sensitivity Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Net Position vs Appreciation */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Net Yearly Position vs Appreciation
            </h4>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={r.appData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="rate" tick={{ fontSize: 12 }} ticks={[0,2,4,6,8,10,12,14,16,18,20]} label={{ value: "Appreciation %", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Net Position ($)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const net = payload.find((p) => p.value !== undefined);
                    if (!net) return null;
                    return (
                      <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs shadow">
                        <div className="text-[var(--muted)]">{label}%</div>
                        <div className="font-medium">{fmt(net.value as number)}</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="negNet"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  dot={false}
                  name="Net Position"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="posNet"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={false}
                  name="Net Position"
                  connectNulls={false}
                />
                {r.breakevenRate !== null && (
                  <ReferenceDot
                    x={Math.round(r.breakevenRate * 100) / 100}
                    y={0}
                    r={5}
                    fill="#333"
                    stroke="none"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-[var(--muted)] text-center mt-1">
              {r.breakevenRate !== null
                ? `Break-even at ${r.breakevenRate.toFixed(1)}% appreciation (${fmt(price * r.breakevenRate / 100)}/yr)`
                : r.appData.length > 0 && r.appData[0].net >= 0
                  ? "Net positive at all appreciation rates."
                  : "Net negative across the entire 0-20% range."}
            </p>
          </div>

          {/* Break-Even vs Rent Difference */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Break-Even vs Rent Difference (weekly)
            </h4>
            {r.rdData.length >= 2 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={r.rdData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="breakeven" tick={{ fontSize: 12 }} type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => v.toFixed(1)} ticks={r.rdBETicks} label={{ value: "Break-Even %", position: "insideBottom", offset: -2, fontSize: 12 }} />
                    <YAxis dataKey="rentDiff" tick={{ fontSize: 12 }} label={{ value: "Rent Diff ($/wk)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rentDiff" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Rent Diff" />
                    {r.breakevenRate !== null && (
                      <ReferenceDot
                        x={Math.round(r.breakevenRate * 100) / 100}
                        y={r.currentRentDiff}
                        r={5}
                        fill="#333"
                        stroke="none"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-[var(--muted)] text-center mt-1">
                  {r.breakevenRate !== null
                    ? `Current: ${r.currentRentDiff >= 0 ? "" : "-"}$${Math.abs(r.currentRentDiff)}/wk → ${r.breakevenRate.toFixed(1)}% to break even`
                    : "Current rent difference has no break-even in 0-20%."}
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)] text-center py-20">Insufficient data</p>
            )}
          </div>

          {/* Break-Even vs Property Price */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Break-Even vs Property Price (&plusmn;30%)
            </h4>
            {r.ppData.length >= 2 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={r.ppData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="breakeven" tick={{ fontSize: 12 }} type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => v.toFixed(1)} ticks={r.ppBETicks} label={{ value: "Break-Even %", position: "insideBottom", offset: -2, fontSize: 12 }} />
                    <YAxis dataKey="price" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Property Price ($)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                    <Tooltip formatter={dollarFormatter} />
                    <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Property Price" />
                    {r.breakevenRate !== null && (
                      <ReferenceDot
                        x={Math.round(r.breakevenRate * 100) / 100}
                        y={price}
                        r={5}
                        fill="#333"
                        stroke="none"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-[var(--muted)] text-center mt-1">
                  {r.breakevenRate !== null
                    ? `Current: ${fmt(price)} → ${r.breakevenRate.toFixed(1)}% to break even`
                    : "Current price has no break-even in 0-20%."}
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)] text-center py-20">Insufficient data</p>
            )}
          </div>
        </div>

        {/* Charts Row 2 - Deposit Sensitivity */}
        <hr className="mb-4 md:mb-6 border-[var(--border)]" />
        <h2 className="text-lg font-semibold mb-4">Deposit Sensitivity</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Yearly Net vs Deposit */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Yearly Net vs Deposit %
            </h4>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={r.depData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="deposit" tick={{ fontSize: 12 }} domain={[5, 30]} ticks={[6,8,10,12,14,16,18,20,22,24,26,28,30]} label={{ value: "Deposit %", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Yearly Net ($)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                <Tooltip formatter={dollarFormatter} />
                <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="yearlyNet" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Yearly Net" />
                <ReferenceDot x={depositPct} y={r.yearlyAfterTax} r={5} fill="#333" stroke="none" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Upfront Costs vs Deposit */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Upfront Costs vs Deposit %
            </h4>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={r.depData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="deposit" tick={{ fontSize: 12 }} domain={[5, 30]} ticks={[6,8,10,12,14,16,18,20,22,24,26,28,30]} label={{ value: "Deposit %", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Upfront Cost ($)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                <Tooltip formatter={dollarFormatter} />
                <Line type="monotone" dataKey="upfront" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Upfront Cost" />
                <ReferenceDot x={depositPct} y={r.totalUpfront} r={5} fill="#333" stroke="none" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Break-Even vs Deposit */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Break-Even % vs Deposit %
            </h4>
            {r.depData.filter((d) => d.breakeven !== null).length >= 2 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={r.depData.filter((d) => d.breakeven !== null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="deposit" tick={{ fontSize: 12 }} domain={[5, 30]} ticks={[6,8,10,12,14,16,18,20,22,24,26,28,30]} label={{ value: "Deposit %", position: "insideBottom", offset: -2, fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: "Break-Even (%)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="breakeven" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Break-Even %" />
                  {r.breakevenRate !== null && (
                    <ReferenceDot
                      x={depositPct}
                      y={Math.round(r.breakevenRate * 100) / 100}
                      r={5}
                      fill="#333"
                      stroke="none"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-[var(--muted)] text-center py-20">Insufficient data</p>
            )}
          </div>
        </div>

        {/* Charts Row 3 - 10-Year Projections */}
        <hr className="my-4 md:my-6 border-[var(--border)]" />
        <h2 className="text-lg font-semibold mb-4">10-Year Projections ({appreciationRate}% growth, {rentalGrowthRate}% rental growth)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Yearly Cash Flow (Bar Chart) */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Annual Cash Flow (incl. Year 0 Upfront)
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={r.tenYearData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} label={{ value: "Year", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Cash Flow ($)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow">
                        <div className="font-medium mb-1">Year {label}</div>
                        {payload.map((p, i) => (
                          <div key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value as number)}</div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
                <Bar dataKey="netCashFlow" name="Net Cash Flow" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="cumulativeCashFlow" name="Cumulative" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-[var(--muted)] text-center mt-1">
              {(() => {
                const breakEvenYear = r.tenYearData.find((d, i) => i > 0 && d.cumulativeCashFlow >= 0);
                return breakEvenYear
                  ? `Cash break-even in Year ${breakEvenYear.year}`
                  : "Cash position remains negative over 10 years";
              })()}
            </p>
          </div>

          {/* Equity Growth */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Equity Position Over 10 Years
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={r.tenYearData.filter(d => d.year > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} label={{ value: "Year", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Value ($)", angle: -90, position: "center", dx: -30, fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow">
                        <div className="font-medium mb-1">Year {label}</div>
                        {payload.map((p, i) => (
                          <div key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value as number)}</div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area type="monotone" dataKey="propertyValue" name="Property Value" stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="loanBalance" name="Loan Balance" stroke="#dc2626" fill="#dc2626" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="equity" name="Equity" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-[var(--muted)] text-center mt-1">
              Year 10 equity: {fmt(r.tenYearData[10]?.equity ?? 0)} (interest-only loan)
            </p>
          </div>

          {/* Total Return (Cash Flow + Capital Gains) */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Total Return (Cash + Capital Gains)
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={r.tenYearData.filter(d => d.year > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} label={{ value: "Year", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Return ($)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow">
                        <div className="font-medium mb-1">Year {label}</div>
                        {payload.map((p, i) => (
                          <div key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value as number)}</div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
                <Bar dataKey="cumulativeCashFlow" name="Cumulative Cash" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="totalReturn" name="Total Return" stroke="#16a34a" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-[var(--muted)] text-center mt-1">
              Year 10 total return: {signedFmt(r.tenYearData[10]?.totalReturn ?? 0)}
            </p>
          </div>
        </div>

        {/* Charts Row 4 - Rate Sensitivity & Advanced */}
        <hr className="mb-4 md:mb-6 border-[var(--border)]" />
        <h2 className="text-lg font-semibold mb-4">Interest Rate & Return Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Interest Rate Stress Test */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Interest Rate Stress Test
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={r.rateStressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="rate" tick={{ fontSize: 12 }} label={{ value: "Interest Rate (%)", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Yearly Net ($)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: "DSCR", angle: 90, position: "center", dx: 20, fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow">
                        <div className="font-medium mb-1">{label}% rate</div>
                        {payload.map((p, i) => (
                          <div key={i} style={{ color: p.color }}>
                            {p.name}: {p.name === "DSCR" ? `${(p.value as number).toFixed(2)}x` : fmt(p.value as number)}
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <ReferenceLine yAxisId="left" y={0} stroke="var(--muted)" strokeDasharray="4 4" />
                <ReferenceLine yAxisId="right" y={1} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} />
                <Bar yAxisId="left" dataKey="yearlyNet" name="Yearly Net" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="dscr" name="DSCR" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <ReferenceDot yAxisId="left" x={rate} y={r.rateStressData.find(d => d.rate === rate)?.yearlyNet ?? 0} r={5} fill="#333" stroke="none" />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-[var(--muted)] text-center mt-1">
              Current rate: {rate}% | DSCR &lt; 1.0 = rental income doesn&apos;t cover debt
            </p>
          </div>

          {/* Break-Even vs Interest Rate */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Break-Even Appreciation vs Interest Rate
            </h4>
            {r.beVsRateData.length >= 2 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={r.beVsRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="rate" tick={{ fontSize: 12 }} label={{ value: "Interest Rate (%)", position: "insideBottom", offset: -2, fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: "Break-Even Appr. (%)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow">
                            <div className="font-medium mb-1">{label}% interest</div>
                            <div>Break-even: {(payload[0].value as number).toFixed(2)}%</div>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="breakeven" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Break-Even %" />
                    {r.breakevenRate !== null && (
                      <ReferenceDot
                        x={rate}
                        y={Math.round(r.breakevenRate * 100) / 100}
                        r={5}
                        fill="#333"
                        stroke="none"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-[var(--muted)] text-center mt-1">
                  Higher rates require more appreciation to break even
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)] text-center py-20">Insufficient data</p>
            )}
          </div>

          {/* Cash-on-Cash Return vs Deposit */}
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">
              Cash-on-Cash Return vs Deposit %
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={r.cocVsDepositData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="deposit" tick={{ fontSize: 12 }} domain={[5, 30]} ticks={[6,8,10,12,14,16,18,20,22,24,26,28,30]} label={{ value: "Deposit %", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} label={{ value: "Cash-on-Cash (%)", angle: -90, position: "center", dx: -25, fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow">
                        <div className="font-medium mb-1">{label}% deposit</div>
                        <div>CoC: {(payload[0].value as number).toFixed(2)}%</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="coc" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Cash-on-Cash %" />
                <ReferenceDot
                  x={depositPct}
                  y={r.cocVsDepositData.find(d => d.deposit === depositPct)?.coc ?? 0}
                  r={5}
                  fill="#333"
                  stroke="none"
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-[var(--muted)] text-center mt-1">
              Current: {pctFmt(r.cashOnCash)} (negative = paying out of pocket)
            </p>
          </div>
        </div>

        {/* 10-Year Cash Flow Table */}
        <hr className="mb-4 md:mb-6 border-[var(--border)]" />
        <h2 className="text-lg font-semibold mb-4">10-Year Cash Flow Summary</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)] mb-6">
          <table className="w-full text-xs md:text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="py-2 px-3 text-left font-semibold">Year</th>
                <th className="py-2 px-3 text-right font-semibold">Rental Income</th>
                <th className="py-2 px-3 text-right font-semibold">Expenses</th>
                <th className="py-2 px-3 text-right font-semibold">Interest</th>
                <th className="py-2 px-3 text-right font-semibold">Tax Benefit</th>
                <th className="py-2 px-3 text-right font-semibold">Net Cash Flow</th>
                <th className="py-2 px-3 text-right font-semibold">Cumulative</th>
                <th className="py-2 px-3 text-right font-semibold">Property Value</th>
                <th className="py-2 px-3 text-right font-semibold">Equity</th>
                <th className="py-2 px-3 text-right font-semibold">Total Return</th>
              </tr>
            </thead>
            <tbody>
              {r.tenYearData.map((row) => (
                <tr key={row.year} className={`border-b border-[var(--border)] ${row.year === 0 ? "bg-[var(--bg)] font-semibold" : ""}`}>
                  <td className="py-1.5 px-3">{row.year === 0 ? "Purchase" : `Year ${row.year}`}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{row.year === 0 ? "—" : fmt(row.rentalIncome)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{row.year === 0 ? "—" : fmt(row.expenses)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{row.year === 0 ? "—" : fmt(row.interest)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{row.year === 0 ? "—" : fmt(row.taxBenefit)}</td>
                  <td className={`py-1.5 px-3 text-right tabular-nums ${row.netCashFlow >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                    {signedFmt(row.netCashFlow)}
                  </td>
                  <td className={`py-1.5 px-3 text-right tabular-nums ${row.cumulativeCashFlow >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                    {signedFmt(row.cumulativeCashFlow)}
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{fmt(row.propertyValue)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{fmt(row.equity)}</td>
                  <td className={`py-1.5 px-3 text-right tabular-nums font-medium ${row.totalReturn >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                    {signedFmt(row.totalReturn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
