/*
 * Money is stored and computed in whole euro cents, never in fractional euros:
 * integer sums are exact, so totals can't drift by a cent. `Cents` is a branded
 * number so the type checker tells cents and euros apart; arithmetic on it
 * yields a plain number that goes back through `cents()` (or `applyRate`) to be
 * rounded to whole cents again.
 *
 * Unit prices and quantities are not amounts: they stay decimal numbers in euros
 * (per-word or per-unit prices often have more than two decimals) and only the
 * line base they produce becomes cents.
 */

declare const brand: unique symbol;

/** An amount of money in whole euro cents: 1234 is 12,34 €. */
export type Cents = number & { readonly [brand]: "Cents" };

/** Rounds a value measured in cents to whole cents, half away from zero. */
export function cents(value: number): Cents {
  return (Math.sign(value) * Math.round(Math.abs(value)) || 0) as Cents;
}

/**
 * Converts a decimal amount in euros (typed by the user, imported, or a unit
 * price times a quantity) to cents, rounding half away from zero. Decimal input
 * is the one place binary floats show noise: 1.005 * 100 is 100.49999999999999.
 */
export function eurosToCents(euros: number): Cents {
  return cents(Number((euros * 100).toPrecision(15)));
}

/** Cents as decimal euros, for formats that expect them (Facturae XML, spreadsheets, input fields). */
export function centsToEuros(amount: Cents): number {
  return amount / 100;
}

/** A rate (VAT, withholding, imputation share…) applied to an amount, rounded to whole cents. */
export function applyRate(amount: Cents, rate: number): Cents {
  return cents(amount * rate);
}

export function sumCents(amounts: Iterable<Cents>): Cents {
  let total = 0;
  for (const amount of amounts) total += amount;
  return total as Cents;
}

/** Sums the amount each item yields. */
export function sumBy<T>(items: Iterable<T>, amountOf: (item: T) => Cents): Cents {
  let total = 0;
  for (const item of items) total += amountOf(item);
  return total as Cents;
}

/** Rounds a figure that is not money (a percentage, a number of years) to two decimals, half away from zero. */
export function roundHundredths(value: number): number {
  return (Math.sign(value) * Math.round(Number((Math.abs(value) * 100).toPrecision(15)))) / 100 || 0;
}
