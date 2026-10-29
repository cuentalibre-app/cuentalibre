import { cents, type Cents } from "./money";

/*
 * Treasury: the collections and payments recorded against documents. Amounts
 * are signed: positive money in (collections), negative money out (payments).
 */

export interface Flow {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  amount: Cents;
}

export interface MonthFlows {
  year: number;
  /** Zero-based month. */
  month: number;
  /** Money in, positive. */
  collected: Cents;
  /** Money out, as a positive figure. */
  paid: Cents;
}

/** Money in and out per month for the `count` months ending with the one of `today`, oldest first. */
export function monthlyFlows(flows: Flow[], today: Date, count = 12): MonthFlows[] {
  const last = today.getFullYear() * 12 + today.getMonth();
  const months: MonthFlows[] = Array.from({ length: count }, (_, i) => {
    const index = last - count + 1 + i;
    return { year: Math.floor(index / 12), month: index % 12, collected: cents(0), paid: cents(0) };
  });
  for (const flow of flows) {
    const [year, month] = flow.date.split("-").map(Number);
    const slot = months[year! * 12 + month! - 1 - (last - count + 1)];
    if (!slot) continue;
    if (flow.amount >= 0) slot.collected = cents(slot.collected + flow.amount);
    else slot.paid = cents(slot.paid - flow.amount);
  }
  return months;
}
