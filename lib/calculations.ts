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

// P&I monthly repayment (standard amortisation over termYears)
export function calcMonthlyPI(
  loanAmount: number,
  annualRate: number,
  termYears: number = 30,
): number {
  if (loanAmount <= 0) return 0;
  if (annualRate <= 0) return loanAmount / (termYears * 12);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// NSW First Home Buyer Assistance Scheme stamp duty
export function calcStampDutyNSW_FHBAS(price: number): number {
  if (price <= 800_000) return 0;
  if (price <= 1_000_000) {
    const normalDuty = calcStampDutyNSW(price);
    const discountFactor = (1_000_000 - price) / 200_000;
    return normalDuty * (1 - discountFactor);
  }
  return calcStampDutyNSW(price);
}

export interface AmortisationYear {
  year: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
}

export function computeAmortisationSchedule(
  loanAmount: number,
  annualRate: number,
  termYears: number = 30,
  offsetBalance: number = 0,
): AmortisationYear[] {
  const monthlyPayment = calcMonthlyPI(loanAmount, annualRate, termYears);
  const results: AmortisationYear[] = [];
  let balance = loanAmount;

  for (let y = 1; y <= termYears; y++) {
    let yearlyPrincipal = 0;
    let yearlyInterest = 0;
    for (let m = 0; m < 12; m++) {
      const interestBearing = Math.max(0, balance - offsetBalance);
      const monthInterest = interestBearing * (annualRate / 100 / 12);
      const monthPrincipal = monthlyPayment - monthInterest;
      yearlyPrincipal += monthPrincipal;
      yearlyInterest += monthInterest;
      balance -= monthPrincipal;
    }
    results.push({
      year: y,
      principalPaid: Math.round(yearlyPrincipal),
      interestPaid: Math.round(yearlyInterest),
      remainingBalance: Math.max(0, Math.round(balance)),
    });
  }
  return results;
}

export interface PPORRateStressPoint {
  rate: number;
  monthlyRepayment: number;
  yearlyRepayment: number;
}

export function computePPORRateStress(
  loanAmount: number,
): PPORRateStressPoint[] {
  const results: PPORRateStressPoint[] = [];
  for (let r = 200; r <= 1000; r += 25) {
    const rateDecimal = r / 100;
    const monthly = calcMonthlyPI(loanAmount, rateDecimal);
    results.push({
      rate: rateDecimal,
      monthlyRepayment: Math.round(monthly),
      yearlyRepayment: Math.round(monthly * 12),
    });
  }
  return results;
}

export interface PPORDepositPoint {
  deposit: number;
  totalUpfront: number;
  monthlyRepayment: number;
  lmi: number;
}

export function computePPORDepositSensitivity(
  price: number,
  rate: number,
  isFirstHomeBuyer: boolean,
  capitaliseLMI: boolean,
): PPORDepositPoint[] {
  const results: PPORDepositPoint[] = [];
  for (let dp = 5; dp <= 30; dp++) {
    const dpLmi = calcLMI(price, dp);
    const effectiveCap = dp < 20 ? capitaliseLMI : false;
    const loan = price * (1 - dp / 100) + (effectiveCap ? dpLmi : 0);
    const monthly = calcMonthlyPI(loan, rate);
    const dpDeposit = (price * dp) / 100;
    const stampDuty = isFirstHomeBuyer
      ? calcStampDutyNSW_FHBAS(price)
      : calcStampDutyNSW(price);
    const lmiUpfront = effectiveCap ? 0 : dpLmi;
    const totalUpfront =
      dpDeposit + stampDuty + lmiUpfront +
      MORTGAGE_REGISTRATION_FEE + TRANSFER_FEE + LEGAL_FEES;

    results.push({
      deposit: dp,
      totalUpfront: Math.round(totalUpfront),
      monthlyRepayment: Math.round(monthly),
      lmi: Math.round(dpLmi),
    });
  }
  return results;
}

// NSW Land Tax (2024-25 rates) — applies to land value, not property price
export function calcLandTaxNSW(landValue: number): number {
  const generalThreshold = 1_075_000;
  const premiumThreshold = 6_571_000;
  if (landValue <= generalThreshold) return 0;
  if (landValue <= premiumThreshold)
    return 100 + (landValue - generalThreshold) * 0.016;
  return 87_936 + (landValue - premiumThreshold) * 0.02;
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
  isApartment: boolean,
  yearlyLandTax: number = 0,
  taxBenefitsEnabled: boolean = true,
  offsetBalance: number = 0,
): number | null {
  const lmi = calcLMI(price, depositPct);
  const mortgage = price * (1 - depositPct / 100) + (capitaliseLMI ? lmi : 0);
  const monthlyInterest = (Math.max(0, mortgage - offsetBalance) * (rate / 100)) / 12;
  const yearlyRentalIncome = weeklyRental * 52;
  const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
  const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
  const yearlyCouncilWater = price > 0 ? MONTHLY_COUNCIL_WATER * 12 : 0;
  const yearlyInterest = monthlyInterest * 12;
  const yearlyRent = weeklyRent * 52;
  const yearlyPreTax =
    yearlyRentalIncome -
    yearlyRentalAgentFee -
    yearlyInsurance -
    yearlyCouncilWater -
    yearlyStrata -
    yearlyLandTax -
    yearlyRent -
    yearlyInterest;

  const propertyNet =
    yearlyRentalIncome -
    yearlyRentalAgentFee -
    yearlyInsurance -
    yearlyCouncilWater -
    yearlyStrata -
    yearlyLandTax -
    yearlyInterest;
  const deductibleLoss = taxBenefitsEnabled ? Math.max(0, -propertyNet) : 0;

  const taxWithout = calcTaxWithMedicare(income);
  const taxWith = calcTaxWithMedicare(income - deductibleLoss);
  const taxSaving = taxWithout - taxWith;
  const yearlyAfterTax = yearlyPreTax + taxSaving;

  const baseTaxableIncome = income - deductibleLoss;
  const cgtInclusion = taxBenefitsEnabled ? 0.5 : 1.0;

  const steps = 301;
  let prevNet: number | null = null;
  let prevRate: number | null = null;

  for (let i = 0; i < steps; i++) {
    const appRate = (i / (steps - 1)) * 20;
    const yearlyApp = price * (appRate / 100);
    const taxableCG = yearlyApp * cgtInclusion;
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
  principal: number;
  taxBenefit: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  grossReturn: number; // cumulative cash flow + capital gain (before CGT / equity from deposit & principal)
  totalReturn: number; // profit if sold today: equity + cumulative cash flow − CGT
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
  yearlyLandTax: number = 0,
  loanType: "IO" | "PI" = "IO",
  taxBenefitsEnabled: boolean = true,
  offsetBalance: number = 0,
): YearlyCashFlow[] {
  const lmi = calcLMI(price, depositPct);
  const mortgage = price * (1 - depositPct / 100) + (capitaliseLMI ? lmi : 0);
  const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
  const yearlyCouncilWater = price > 0 ? MONTHLY_COUNCIL_WATER * 12 : 0;

  // Compute amortisation schedule for P&I mode
  const amortisation = loanType === "PI" ? computeAmortisationSchedule(mortgage, rate, 30, offsetBalance) : null;

  const results: YearlyCashFlow[] = [];
  let cumulativeCash = -totalUpfront;

  // Year 0 entry (purchase)
  results.push({
    year: 0,
    rentalIncome: 0,
    expenses: 0,
    interest: 0,
    principal: 0,
    taxBenefit: 0,
    netCashFlow: -totalUpfront,
    cumulativeCashFlow: cumulativeCash,
    propertyValue: price,
    loanBalance: mortgage,
    equity: price - mortgage,
    // Total return: cumulative cash + capital gain (none yet at purchase)
    grossReturn: cumulativeCash,
    // Profit if sold today: sale proceeds (equity) + cash to date, no capital gain yet so no CGT
    totalReturn: (price - mortgage) + cumulativeCash,
  });

  for (let y = 1; y <= 10; y++) {
    const currentRental = weeklyRental * Math.pow(1 + rentalGrowthRate / 100, y - 1);
    const currentRent = weeklyRent * Math.pow(1 + rentalGrowthRate / 100, y - 1);
    const yearlyRentalIncome = currentRental * 52;
    const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
    const yearlyRent = currentRent * 52;

    // Interest and principal depend on loan type
    const yearlyInterest = amortisation
      ? amortisation[y - 1].interestPaid
      : Math.max(0, mortgage - offsetBalance) * (rate / 100);
    const yearlyPrincipal = amortisation
      ? amortisation[y - 1].principalPaid
      : 0;
    const loanBalance = amortisation
      ? amortisation[y - 1].remainingBalance
      : mortgage;

    const totalExpenses =
      yearlyRentalAgentFee +
      yearlyInsurance +
      yearlyCouncilWater +
      yearlyStrata +
      yearlyLandTax +
      yearlyRent;

    const propertyNet =
      yearlyRentalIncome -
      yearlyRentalAgentFee -
      yearlyInsurance -
      yearlyCouncilWater -
      yearlyStrata -
      yearlyLandTax -
      yearlyInterest;
    const deductibleLoss = taxBenefitsEnabled ? Math.max(0, -propertyNet) : 0;
    const taxSaving =
      calcTaxWithMedicare(income) -
      calcTaxWithMedicare(income - deductibleLoss);

    // Cash outflow includes principal repayments (not deductible but still cash out the door)
    const yearlyPreTax =
      yearlyRentalIncome -
      totalExpenses -
      yearlyInterest -
      yearlyPrincipal;
    const netCashFlow = yearlyPreTax + taxSaving;
    cumulativeCash += netCashFlow;

    const propertyValue = price * Math.pow(1 + appreciationRate / 100, y);
    const equity = propertyValue - loanBalance;

    // Profit if sold today = sale proceeds (equity) + cumulative cash flow − CGT on the gain.
    // Capital gain is taxed at the investor's marginal rate; 50% CGT discount applied when tax benefits are on.
    const capitalGain = Math.max(0, propertyValue - price);
    const taxableGain = capitalGain * (taxBenefitsEnabled ? 0.5 : 1.0);
    const cgt =
      calcTaxWithMedicare(income + taxableGain) - calcTaxWithMedicare(income);
    const profitIfSold = equity + cumulativeCash - cgt;

    results.push({
      year: y,
      rentalIncome: Math.round(yearlyRentalIncome),
      expenses: Math.round(totalExpenses),
      interest: Math.round(yearlyInterest),
      principal: Math.round(yearlyPrincipal),
      taxBenefit: Math.round(taxSaving),
      netCashFlow: Math.round(netCashFlow),
      cumulativeCashFlow: Math.round(cumulativeCash),
      propertyValue: Math.round(propertyValue),
      loanBalance: Math.round(loanBalance),
      equity: Math.round(equity),
      grossReturn: Math.round(cumulativeCash + (propertyValue - price)),
      totalReturn: Math.round(profitIfSold),
    });
  }

  return results;
}

// ETF vs Property comparison — models deploying the same capital into an index fund
export interface ETFvsPropertyYear {
  year: number;
  propertyWealth: number;
  etfWealth: number;
  propertyContrib: number;
  etfContrib: number;
}

export function computeETFComparison(
  tenYearData: YearlyCashFlow[],
  totalUpfront: number,
  etfReturnRate: number,
): ETFvsPropertyYear[] {
  const results: ETFvsPropertyYear[] = [];
  let etfBalance = totalUpfront;
  let totalEtfContrib = totalUpfront;

  // Year 0
  const year0 = tenYearData[0];
  results.push({
    year: 0,
    propertyWealth: 0,
    etfWealth: Math.round(etfBalance),
    propertyContrib: Math.round(totalUpfront),
    etfContrib: Math.round(totalEtfContrib),
  });

  for (let y = 1; y <= 10; y++) {
    const row = tenYearData[y];
    if (!row) break;

    // Property net wealth = equity + cumulative cash flow (includes year 0 outlay)
    const propertyWealth = row.equity + row.cumulativeCashFlow;

    // If property has a net cash outflow this year, the investor would have
    // invested that same amount into the ETF instead. If net positive, we
    // assume they withdraw (don't add to ETF).
    const yearlyOutOfPocket = Math.max(0, -row.netCashFlow);

    // Grow existing ETF balance, then add this year's contribution
    etfBalance = etfBalance * (1 + etfReturnRate / 100) + yearlyOutOfPocket;
    totalEtfContrib += yearlyOutOfPocket;

    results.push({
      year: y,
      propertyWealth: Math.round(propertyWealth),
      etfWealth: Math.round(etfBalance),
      propertyContrib: Math.round(totalUpfront + row.cumulativeCashFlow + totalUpfront),
      etfContrib: Math.round(totalEtfContrib),
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
  yearlyLandTax: number = 0,
  taxBenefitsEnabled: boolean = true,
  offsetBalance: number = 0,
): RateStressPoint[] {
  const lmi = calcLMI(price, depositPct);
  const mortgage = price * (1 - depositPct / 100) + (capitaliseLMI ? lmi : 0);
  const interestBearing = Math.max(0, mortgage - offsetBalance);
  const yearlyRentalIncome = weeklyRental * 52;
  const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
  const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
  const yearlyCouncilWater = price > 0 ? MONTHLY_COUNCIL_WATER * 12 : 0;
  const yearlyRent = weeklyRent * 52;

  const results: RateStressPoint[] = [];
  for (let r = 200; r <= 1000; r += 25) {
    const rateDecimal = r / 100;
    const yearlyInterest = interestBearing * (rateDecimal / 100);
    const yearlyPreTax =
      yearlyRentalIncome -
      yearlyRentalAgentFee -
      yearlyInsurance -
      yearlyCouncilWater -
      yearlyStrata -
      yearlyLandTax -
      yearlyRent -
      yearlyInterest;

    const propertyNet =
      yearlyRentalIncome -
      yearlyRentalAgentFee -
      yearlyInsurance -
      yearlyCouncilWater -
      yearlyStrata -
      yearlyLandTax -
      yearlyInterest;
    const deductibleLoss = taxBenefitsEnabled ? Math.max(0, -propertyNet) : 0;
    const taxSaving =
      calcTaxWithMedicare(income) -
      calcTaxWithMedicare(income - deductibleLoss);
    const yearlyAfterTax = yearlyPreTax + taxSaving;

    const noi = yearlyRentalIncome - yearlyRentalAgentFee - yearlyInsurance - yearlyCouncilWater - yearlyStrata - yearlyLandTax;
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
  yearlyLandTax: number = 0,
  taxBenefitsEnabled: boolean = true,
  offsetBalance: number = 0,
): { rate: number; breakeven: number }[] {
  const results: { rate: number; breakeven: number }[] = [];
  for (let r = 200; r <= 1000; r += 25) {
    const rateDecimal = r / 100;
    const be = computeBreakeven(
      price, weeklyRental, weeklyRent, income, rateDecimal,
      depositPct, capitaliseLMI, yearlyStrata, isApartment, yearlyLandTax,
      taxBenefitsEnabled, offsetBalance,
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
  buyerAgentFee: number,
  yearlyLandTax: number = 0,
  taxBenefitsEnabled: boolean = true,
  offsetBalance: number = 0,
): { deposit: number; coc: number; upfront: number }[] {
  const results: { deposit: number; coc: number; upfront: number }[] = [];
  for (let dp = 5; dp <= 30; dp++) {
    const dpLmi = calcLMI(price, dp);
    const effectiveCap = dp < 20 ? capitaliseLMI : false;
    const dpMortgage = price * (1 - dp / 100) + (effectiveCap ? dpLmi : 0);
    const yearlyInterest = Math.max(0, dpMortgage - offsetBalance) * (rate / 100);
    const yearlyRentalIncome = weeklyRental * 52;
    const yearlyRentalAgentFee = yearlyRentalIncome * 0.07;
    const yearlyInsurance = isApartment ? 0 : price > 0 ? 2_000 : 0;
    const yearlyCouncilWater = price > 0 ? MONTHLY_COUNCIL_WATER * 12 : 0;
    const yearlyRent = weeklyRent * 52;
    const yearlyPreTax =
      yearlyRentalIncome - yearlyRentalAgentFee - yearlyInsurance -
      yearlyCouncilWater - yearlyStrata - yearlyLandTax - yearlyRent - yearlyInterest;

    const propertyNet =
      yearlyRentalIncome - yearlyRentalAgentFee - yearlyInsurance -
      yearlyCouncilWater - yearlyStrata - yearlyLandTax - yearlyInterest;
    const deductibleLoss = taxBenefitsEnabled ? Math.max(0, -propertyNet) : 0;
    const taxSaving = calcTaxWithMedicare(income) - calcTaxWithMedicare(income - deductibleLoss);
    const yearlyAfterTax = yearlyPreTax + taxSaving;

    const dpDeposit = (price * dp) / 100;
    const dpLmiUpfront = effectiveCap ? 0 : dpLmi;
    const totalUpfront = dpDeposit + stampDuty + dpLmiUpfront + buyerAgentFee +
      MORTGAGE_REGISTRATION_FEE + TRANSFER_FEE + LEGAL_FEES;

    const coc = totalUpfront > 0 ? (yearlyAfterTax / totalUpfront) * 100 : 0;
    results.push({ deposit: dp, coc: Math.round(coc * 100) / 100, upfront: Math.round(totalUpfront) });
  }
  return results;
}
