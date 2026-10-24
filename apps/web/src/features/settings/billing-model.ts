import type { BillingPeriod, Plan, Subscription } from "@cuentalibre/contracts";
import { applyRate, cents, type Cents } from "@cuentalibre/core";

/** VAT added on top of the Cloud prices, which are quoted without it. */
export const CLOUD_VAT_RATE = 0.21;

/** Length of the free trial, as the landing promises it. */
export const TRIAL_DAYS = 30;

export interface PeriodOption {
  value: BillingPeriod;
  label: string;
  /** What each charge costs, VAT not included. */
  price: Cents;
  months: number;
  /** "al mes", "cada trimestre"… */
  every: string;
}

/** The Cloud prices, the same as Stripe's and the landing's. */
export const PERIODS: PeriodOption[] = [
  { value: "monthly", label: "Mensual", price: cents(499), months: 1, every: "al mes" },
  { value: "quarterly", label: "Trimestral", price: cents(1399), months: 3, every: "cada trimestre" },
  { value: "yearly", label: "Anual", price: cents(4900), months: 12, every: "al año" },
];

export const periodOf = (value: BillingPeriod) => PERIODS.find((period) => period.value === value)!;

/** What a period comes to per month, the figure the landing leads with. */
export const perMonth = (period: PeriodOption): Cents => cents(period.price / period.months);

/** Whole percentage saved against paying monthly; 0 for monthly itself. */
export function savingOf(period: PeriodOption): number {
  const monthly = PERIODS[0]!.price * period.months;
  return Math.round((1 - period.price / monthly) * 100);
}

/** The amount charged, VAT included. */
export const withVat = (price: Cents): Cents => applyRate(price, 1 + CLOUD_VAT_RATE);

/** Days of trial left, counting today's as a whole one; 0 once it ended. */
export function trialDaysLeft(plan: Plan, now = new Date()): number {
  const left = new Date(plan.trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(left / (24 * 60 * 60 * 1000)));
}

/** "2026-11-23" from an ISO timestamp, in the user's time zone. */
export function localDate(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A subscription that still charges, or will again: one is enough per company. */
export const isLive = (subscription: Subscription | null) =>
  subscription !== null && !["canceled", "incomplete_expired"].includes(subscription.status);
