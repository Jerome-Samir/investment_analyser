"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  fmt,
  signedFmt,
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
    };
  }, [price, depositPct, capitaliseLMI, weeklyRental, weeklyRent, income, rate, propertyType, quarterlyStrata, includeBuyerAgent]);

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

        {/* Charts Row 1 */}
        <hr className="mb-4 md:mb-6 border-[var(--border)]" />
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
      </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
