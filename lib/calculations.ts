// Australian 2024-25 Stage 3 tax rates

export function calcIncomeTax(taxable: number): number {
  if (taxable <= 18_200) return 0;
  if (taxable <= 45_000) return (taxable - 18_200) * 0.16;
  if (taxable <= 135_000) return 4_288 + (taxable - 45_000) * 0.3;
  if (taxable <= 190_000) return 31_288 + (taxable - 135_000) * 0.37;
  return 51_638 + (taxable - 190_000) * 0.45;
}

export function calcTaxWithMedicare(taxable: number): number {
  return calcIncomeTax(taxable) + Math.max(0, taxable) * 0.02;
}

export function marginalRate(taxable: number): number {
  const medicare = 0.02;
  if (taxable <= 18_200) return 0 + medicare;
  if (taxable <= 45_000) return 0.16 + medicare;
  if (taxable <= 135_000) return 0.3 + medicare;
  if (taxable <= 190_000) return 0.37 + medicare;
  return 0.45 + medicare;
}

// NSW Transfer (Stamp) Duty
export function calcStampDutyNSW(price: number): number {
  if (price <= 17_000) return price * 0.0125;
  if (price <= 36_000) return 212.5 + (price - 17_000) * 0.015;
  if (price <= 97_000) return 497.5 + (price - 36_000) * 0.0175;
  if (price <= 364_000) return 1_565 + (price - 97_000) * 0.035;
  if (price <= 1_212_000) return 10_910 + (price - 364_000) * 0.045;
  return 49_070 + (price - 1_212_000) * 0.055;
}

// Approximate LMI premium by LVR band
export function calcLMI(price: number, depositPct: number): number {
  if (depositPct >= 20) return 0;
  const lvr = 100 - depositPct;
  const loan = (price * lvr) / 100;
  if (lvr <= 85) return loan * 0.01;
  if (lvr <= 90) return loan * 0.022;
  return loan * 0.035;
}

// NSW government fees
export const MORTGAGE_REGISTRATION_FEE = 187.2;
export const TRANSFER_FEE = 165.4;
export const LEGAL_FEES = 2_000;
export const MONTHLY_COUNCIL_WATER = 150;

export interface BreakevenResult {
  breakevenRate: number | null;
}

export function computeBreakeven(
  price: number,
  weeklyRental: number,
  weeklyRent: number,
  income: number,
  rate: number,
  depositPct: number,
  capitaliseLMI: boolean,
  yearlyStrata: number,
  isApartment: boolean
): number | null {
  const lmi = calcLMI(price, depositPct);
  const mortgage = price * (1 - depositPct / 100) + (capitaliseLMI ? lmi : 0);
  const monthlyInterest = (mortgage * (rate / 100)) / 12;
  const yearlyRentalIncome = weeklyRental * 52;
  const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
  const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
  const yearlyCouncilWater = MONTHLY_COUNCIL_WATER * 12;
  const yearlyInterest = monthlyInterest * 12;
  const yearlyRent = weeklyRent * 52;
  const yearlyPreTax =
    yearlyRentalIncome -
    yearlyRentalAgentFee -
    yearlyInsurance -
    yearlyCouncilWater -
    yearlyStrata -
    yearlyRent -
    yearlyInterest;

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

  const baseTaxableIncome = income - deductibleLoss;

  const steps = 301;
  let prevNet: number | null = null;
  let prevRate: number | null = null;

  for (let i = 0; i < steps; i++) {
    const appRate = (i / (steps - 1)) * 20;
    const yearlyApp = price * (appRate / 100);
    const taxableCG = yearlyApp * 0.5;
    const taxWithCGT = calcTaxWithMedicare(baseTaxableIncome + taxableCG);
    const taxWithoutCGT = calcTaxWithMedicare(baseTaxableIncome);
    const cgtOwed = taxWithCGT - taxWithoutCGT;
    const netPosition = yearlyAfterTax + yearlyApp - cgtOwed;

    if (i === 0 && netPosition >= 0) return 0.0;

    if (prevNet !== null && prevRate !== null && prevNet < 0 && netPosition >= 0) {
      const t = -prevNet / (netPosition - prevNet);
      return prevRate + t * (appRate - prevRate);
    }

    prevNet = netPosition;
    prevRate = appRate;
  }

  return null;
}

export function fmt(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function signedFmt(n: number): string {
  const prefix = n >= 0 ? "+" : "-";
  return `${prefix}${fmt(n)}`;
}

export function pctFmt(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`;
}

// 10-Year cash flow projection
export interface YearlyCashFlow {
  year: number;
  rentalIncome: number;
  expenses: number;
  interest: number;
  taxBenefit: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  totalReturn: number;
}

export function compute10YearProjection(
  price: number,
  weeklyRental: number,
  weeklyRent: number,
  income: number,
  rate: number,
  depositPct: number,
  capitaliseLMI: boolean,
  yearlyStrata: number,
  isApartment: boolean,
  totalUpfront: number,
  appreciationRate: number,
  rentalGrowthRate: number,
): YearlyCashFlow[] {
  const lmi = calcLMI(price, depositPct);
  const mortgage = price * (1 - depositPct / 100) + (capitaliseLMI ? lmi : 0);
  const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
  const yearlyCouncilWater = MONTHLY_COUNCIL_WATER * 12;

  const results: YearlyCashFlow[] = [];
  let cumulativeCash = -totalUpfront;

  // Year 0 entry (purchase)
  results.push({
    year: 0,
    rentalIncome: 0,
    expenses: 0,
    interest: 0,
    taxBenefit: 0,
    netCashFlow: -totalUpfront,
    cumulativeCashFlow: cumulativeCash,
    propertyValue: price,
    loanBalance: mortgage,
    equity: price - mortgage,
    totalReturn: -totalUpfront,
  });

  for (let y = 1; y <= 10; y++) {
    const currentRental = weeklyRental * Math.pow(1 + rentalGrowthRate / 100, y - 1);
    const currentRent = weeklyRent * Math.pow(1 + rentalGrowthRate / 100, y - 1);
    const yearlyRentalIncome = currentRental * 52;
    const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
    const yearlyInterest = mortgage * (rate / 100);
    const yearlyRent = currentRent * 52;

    const totalExpenses =
      yearlyRentalAgentFee +
      yearlyInsurance +
      yearlyCouncilWater +
      yearlyStrata +
      yearlyRent;

    const propertyNet =
      yearlyRentalIncome -
      yearlyRentalAgentFee -
      yearlyInsurance -
      yearlyCouncilWater -
      yearlyStrata -
      yearlyInterest;
    const deductibleLoss = Math.max(0, -propertyNet);
    const taxSaving =
      calcTaxWithMedicare(income) -
      calcTaxWithMedicare(income - deductibleLoss);

    const yearlyPreTax =
      yearlyRentalIncome -
      totalExpenses -
      yearlyInterest;
    const netCashFlow = yearlyPreTax + taxSaving;
    cumulativeCash += netCashFlow;

    const propertyValue = price * Math.pow(1 + appreciationRate / 100, y);
    const equity = propertyValue - mortgage;

    results.push({
      year: y,
      rentalIncome: Math.round(yearlyRentalIncome),
      expenses: Math.round(totalExpenses),
      interest: Math.round(yearlyInterest),
      taxBenefit: Math.round(taxSaving),
      netCashFlow: Math.round(netCashFlow),
      cumulativeCashFlow: Math.round(cumulativeCash),
      propertyValue: Math.round(propertyValue),
      loanBalance: Math.round(mortgage),
      equity: Math.round(equity),
      totalReturn: Math.round(cumulativeCash + (propertyValue - price)),
    });
  }

  return results;
}

// Interest rate stress test data
export interface RateStressPoint {
  rate: number;
  yearlyNet: number;
  monthlyCashFlow: number;
  dscr: number;
}

export function computeRateStressTest(
  price: number,
  weeklyRental: number,
  weeklyRent: number,
  income: number,
  depositPct: number,
  capitaliseLMI: boolean,
  yearlyStrata: number,
  isApartment: boolean,
): RateStressPoint[] {
  const lmi = calcLMI(price, depositPct);
  const mortgage = price * (1 - depositPct / 100) + (capitaliseLMI ? lmi : 0);
  const yearlyRentalIncome = weeklyRental * 52;
  const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
  const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
  const yearlyCouncilWater = MONTHLY_COUNCIL_WATER * 12;
  const yearlyRent = weeklyRent * 52;

  const results: RateStressPoint[] = [];
  for (let r = 200; r <= 1000; r += 25) {
    const rateDecimal = r / 100;
    const yearlyInterest = mortgage * (rateDecimal / 100);
    const yearlyPreTax =
      yearlyRentalIncome -
      yearlyRentalAgentFee -
      yearlyInsurance -
      yearlyCouncilWater -
      yearlyStrata -
      yearlyRent -
      yearlyInterest;

    const propertyNet =
      yearlyRentalIncome -
      yearlyRentalAgentFee -
      yearlyInsurance -
      yearlyCouncilWater -
      yearlyStrata -
      yearlyInterest;
    const deductibleLoss = Math.max(0, -propertyNet);
    const taxSaving =
      calcTaxWithMedicare(income) -
      calcTaxWithMedicare(income - deductibleLoss);
    const yearlyAfterTax = yearlyPreTax + taxSaving;

    const noi = yearlyRentalIncome - yearlyRentalAgentFee - yearlyInsurance - yearlyCouncilWater - yearlyStrata;
    const dscr = yearlyInterest > 0 ? noi / yearlyInterest : 999;

    results.push({
      rate: rateDecimal,
      yearlyNet: Math.round(yearlyAfterTax),
      monthlyCashFlow: Math.round(yearlyAfterTax / 12),
      dscr: Math.round(dscr * 100) / 100,
    });
  }
  return results;
}

// Compute break-even at different interest rates
export function computeBreakevenVsRate(
  price: number,
  weeklyRental: number,
  weeklyRent: number,
  income: number,
  depositPct: number,
  capitaliseLMI: boolean,
  yearlyStrata: number,
  isApartment: boolean,
): { rate: number; breakeven: number }[] {
  const results: { rate: number; breakeven: number }[] = [];
  for (let r = 200; r <= 1000; r += 25) {
    const rateDecimal = r / 100;
    const be = computeBreakeven(
      price, weeklyRental, weeklyRent, income, rateDecimal,
      depositPct, capitaliseLMI, yearlyStrata, isApartment,
    );
    if (be !== null) {
      results.push({ rate: rateDecimal, breakeven: Math.round(be * 100) / 100 });
    }
  }
  return results;
}

// Cash-on-cash return vs deposit %
export function computeCoCVsDeposit(
  price: number,
  weeklyRental: number,
  weeklyRent: number,
  income: number,
  rate: number,
  capitaliseLMI: boolean,
  yearlyStrata: number,
  isApartment: boolean,
  stampDuty: number,
  includeBuyerAgent: boolean,
): { deposit: number; coc: number; upfront: number }[] {
  const results: { deposit: number; coc: number; upfront: number }[] = [];
  for (let dp = 5; dp <= 30; dp++) {
    const dpLmi = calcLMI(price, dp);
    const effectiveCap = dp < 20 ? capitaliseLMI : false;
    const dpMortgage = price * (1 - dp / 100) + (effectiveCap ? dpLmi : 0);
    const yearlyInterest = dpMortgage * (rate / 100);
    const yearlyRentalIncome = weeklyRental * 52;
    const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
    const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
    const yearlyCouncilWater = MONTHLY_COUNCIL_WATER * 12;
    const yearlyRent = weeklyRent * 52;
    const yearlyPreTax =
      yearlyRentalIncome - yearlyRentalAgentFee - yearlyInsurance -
      yearlyCouncilWater - yearlyStrata - yearlyRent - yearlyInterest;

    const propertyNet =
      yearlyRentalIncome - yearlyRentalAgentFee - yearlyInsurance -
      yearlyCouncilWater - yearlyStrata - yearlyInterest;
    const deductibleLoss = Math.max(0, -propertyNet);
    const taxSaving = calcTaxWithMedicare(income) - calcTaxWithMedicare(income - deductibleLoss);
    const yearlyAfterTax = yearlyPreTax + taxSaving;

    const dpDeposit = (price * dp) / 100;
    const dpLmiUpfront = effectiveCap ? 0 : dpLmi;
    const buyerAgentFee = includeBuyerAgent ? price * 0.02 : 0;
    const totalUpfront = dpDeposit + stampDuty + dpLmiUpfront + buyerAgentFee +
      MORTGAGE_REGISTRATION_FEE + TRANSFER_FEE + LEGAL_FEES;

    const coc = totalUpfront > 0 ? (yearlyAfterTax / totalUpfront) * 100 : 0;
    results.push({ deposit: dp, coc: Math.round(coc * 100) / 100, upfront: Math.round(totalUpfront) });
  }
  return results;
}
