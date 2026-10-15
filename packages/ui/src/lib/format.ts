const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // es-ES doesn't group 4-digit numbers by default (4876,00 €);
  // force the thousands separator: 4.876,00 €
  useGrouping: "always",
});

/** 4876 → "4.876,00 €". Uses the typographic minus sign (−) for negatives. */
export function formatEUR(value: number): string {
  return eur.format(value).replace("-", "−");
}
