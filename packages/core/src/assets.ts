import { addDays } from "./invoices";
import { cents, roundHundredths, type Cents } from "./money";

/*
 * Investment goods (bienes de inversión): purchases that last more than a year
 * and are not an expense when bought. Their VAT is deducted at once, in its own
 * boxes of forms 303 and 390, but for income tax only the yearly amortization
 * counts, following the simplified table of the direct estimation method.
 */

/** Kind of good, as the simplified amortization table of direct estimation lists them. */
export type AssetCategory =
  | "buildings"
  | "installations"
  | "machinery"
  | "transport"
  | "itEquipment"
  | "software"
  | "tools"
  | "cattle"
  | "horses"
  | "citrus"
  | "olives"
  | "research"
  | "development"
  | "concessions"
  | "industrialProperty"
  | "goodwill"
  | "leaseRights";

/** Amortization account of the PGC: 680 intangible, 681 tangible, 682 real estate investments. */
export type AmortizationAccount = "680" | "681" | "682";

export interface AssetCategoryInfo {
  /** Highest yearly rate, in percent. */
  maxRate: number;
  /** Longest period, in years; the lowest rate is 100 / maxYears. */
  maxYears: number;
  account: AmortizationAccount;
}

/** Simplified amortization table of direct estimation (Orden de 27 de marzo de 1998). */
export const ASSET_CATEGORIES: Record<AssetCategory, AssetCategoryInfo> = {
  buildings: { maxRate: 3, maxYears: 68, account: "681" },
  installations: { maxRate: 10, maxYears: 20, account: "681" },
  machinery: { maxRate: 12, maxYears: 18, account: "681" },
  transport: { maxRate: 16, maxYears: 14, account: "681" },
  itEquipment: { maxRate: 26, maxYears: 10, account: "681" },
  software: { maxRate: 33, maxYears: 6, account: "680" },
  tools: { maxRate: 30, maxYears: 8, account: "681" },
  cattle: { maxRate: 16, maxYears: 14, account: "681" },
  horses: { maxRate: 8, maxYears: 25, account: "681" },
  citrus: { maxRate: 4, maxYears: 50, account: "681" },
  olives: { maxRate: 2, maxYears: 100, account: "681" },
  research: { maxRate: 100, maxYears: 100, account: "680" },
  development: { maxRate: 100, maxYears: 100, account: "680" },
  concessions: { maxRate: 100, maxYears: 100, account: "680" },
  industrialProperty: { maxRate: 100, maxYears: 100, account: "680" },
  goodwill: { maxRate: 100, maxYears: 100, account: "680" },
  leaseRights: { maxRate: 100, maxYears: 100, account: "680" },
};

/**
 * State of the good. Used goods and accelerated amortization (small companies)
 * may apply twice the table's highest rate; goods of little value (up to 300 €
 * each) and those under free amortization are written off in the year they are
 * bought.
 */
export type AssetCondition = "new" | "used" | "accelerated" | "lowValue" | "free";

/** Rate: yearly percentage; years: the good is spread evenly over that many years. */
export type AmortizationMethod = "rate" | "years";

export interface AmortizationPlan {
  category: AssetCategory;
  condition: AssetCondition;
  method: AmortizationMethod;
  /** Yearly percentage (method "rate") or number of years (method "years"). */
  value: number;
}

/** Goods written off in full the year they are bought. */
export function isImmediate(condition: AssetCondition): boolean {
  return condition === "lowValue" || condition === "free";
}

/** Range of yearly rates (percent) the plan's category and condition allow. */
export function rateRange(category: AssetCategory, condition: AssetCondition): { min: number; max: number } {
  const info = ASSET_CATEGORIES[category];
  if (isImmediate(condition)) return { min: 100, max: 100 };
  const factor = condition === "used" || condition === "accelerated" ? 2 : 1;
  return { min: roundHundredths(100 / info.maxYears), max: Math.min(100, info.maxRate * factor) };
}

/** Range of years the plan's category and condition allow. */
export function yearsRange(category: AssetCategory, condition: AssetCondition): { min: number; max: number } {
  const { max } = rateRange(category, condition);
  const min = roundHundredths(100 / max);
  return { min, max: isImmediate(condition) ? min : ASSET_CATEGORIES[category].maxYears };
}

/** Yearly rate (percent) of a plan, whatever its method. */
export function yearlyRate(plan: AmortizationPlan): number {
  if (isImmediate(plan.condition)) return 100;
  return plan.method === "rate" ? plan.value : 100 / plan.value;
}

/** Whether the plan's value is within what its category and condition allow. */
export function isValidPlan(plan: AmortizationPlan): boolean {
  if (isImmediate(plan.condition)) return true;
  if (!Number.isFinite(plan.value) || plan.value <= 0) return false;
  const { min, max } =
    plan.method === "rate" ? rateRange(plan.category, plan.condition) : yearsRange(plan.category, plan.condition);
  // The table rounds its minimum rates to two decimals
  return plan.value >= min - 0.005 && plan.value <= max + 0.005;
}

/**
 * Amortizable value: the purchase price without the deductible VAT, times the
 * share used in the activity. VAT that can't be deducted is part of the cost.
 */
export function amortizableValue(base: Cents, vat: Cents, imputation: number, vatImputation: number | null): Cents {
  const nonDeductibleVat = vat * (1 - (vatImputation ?? imputation) / 100);
  return cents(((base + nonDeductibleVat) * imputation) / 100);
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const daysInYear = (year: number) => (isLeap(year) ? 366 : 365);

function dayOfYear(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return (Date.UTC(y!, m! - 1, d!) - Date.UTC(y!, 0, 1)) / 86_400_000 + 1;
}

/** Years of use from the start date to the end of `isoDate`, counting each year's days apart. */
function yearsOfUse(startsOn: string, isoDate: string): number {
  if (isoDate < startsOn) return 0;
  const startYear = Number(startsOn.slice(0, 4));
  const endYear = Number(isoDate.slice(0, 4));
  let years = 0;
  for (let y = startYear; y <= endYear; y++) {
    const from = y === startYear ? dayOfYear(startsOn) : 1;
    const to = y === endYear ? dayOfYear(isoDate) : daysInYear(y);
    years += (to - from + 1) / daysInYear(y);
  }
  return years;
}

export interface AmortizedAsset {
  /** Amortizable value, see `amortizableValue`. */
  value: Cents;
  /** Date the good starts being used (ISO). */
  startsOn: string;
  plan: AmortizationPlan;
}

/** Amortization accumulated from the start up to the end of `isoDate`, never above the value. */
export function accumulatedAmortization(asset: AmortizedAsset, isoDate: string): Cents {
  if (isoDate < asset.startsOn) return cents(0);
  if (isImmediate(asset.plan.condition)) return asset.value;
  const accrued = (asset.value * yearlyRate(asset.plan) * yearsOfUse(asset.startsOn, isoDate)) / 100;
  return cents(Math.min(asset.value, accrued));
}

/** Amortization of the days between two ISO dates, both included. */
export function amortizationBetween(asset: AmortizedAsset, from: string, to: string): Cents {
  const before = accumulatedAmortization(asset, addDays(from, -1));
  return cents(accumulatedAmortization(asset, to) - before);
}

/** Year the good is fully amortized. */
export function lastAmortizationYear(asset: AmortizedAsset): number {
  const start = Number(asset.startsOn.slice(0, 4));
  if (isImmediate(asset.plan.condition) || asset.value === 0) return start;
  // A year past the nominal end covers a start date mid-year
  const span = Math.ceil(100 / yearlyRate(asset.plan)) + 1;
  for (let y = start; y <= start + span; y++) {
    if (accumulatedAmortization(asset, `${y}-12-31`) >= asset.value) return y;
  }
  return start + span;
}

export interface AmortizationQuota {
  /** Last day of the quarter (ISO), which decides the return it goes to. */
  date: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  amount: Cents;
}

const QUARTER_ENDS = ["03-31", "06-30", "09-30", "12-31"] as const;

/** Quarterly amortization quotas from the start date until the good is fully amortized. */
export function amortizationQuotas(asset: AmortizedAsset): AmortizationQuota[] {
  const quotas: AmortizationQuota[] = [];
  const start = Number(asset.startsOn.slice(0, 4));
  const end = lastAmortizationYear(asset);
  let previous = cents(0);
  for (let year = start; year <= end; year++) {
    QUARTER_ENDS.forEach((suffix, i) => {
      const date = `${year}-${suffix}`;
      if (date < asset.startsOn) return;
      const accumulated = accumulatedAmortization(asset, date);
      const amount = cents(accumulated - previous);
      previous = accumulated;
      if (amount !== 0) quotas.push({ date, year, quarter: (i + 1) as AmortizationQuota["quarter"], amount });
    });
  }
  return quotas;
}

export interface AmortizationYear {
  year: number;
  amount: Cents;
  accumulated: Cents;
  pending: Cents;
}

/** Year-by-year amortization table, as the register of investment goods shows it. */
export function amortizationTable(asset: AmortizedAsset): AmortizationYear[] {
  const rows: AmortizationYear[] = [];
  const start = Number(asset.startsOn.slice(0, 4));
  let previous = cents(0);
  for (let year = start; year <= lastAmortizationYear(asset); year++) {
    const accumulated = accumulatedAmortization(asset, `${year}-12-31`);
    rows.push({
      year,
      amount: cents(accumulated - previous),
      accumulated,
      pending: cents(asset.value - accumulated),
    });
    previous = accumulated;
  }
  return rows;
}
