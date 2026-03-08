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
