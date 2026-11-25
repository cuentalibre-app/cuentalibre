import { useTranslation } from "react-i18next";
import type { Period } from "@cuentalibre/core";
import type es from "./locales/es.json";

type MonthKey = keyof typeof es.date.months;

/** Month keys in calendar order, so a month index (0 = January) picks its translation. */
export const MONTH_KEYS: readonly MonthKey[] = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * Month and period names in the app's language, for translated screens. Screens not translated yet keep
 * the Spanish helpers in `@/lib/format`; invoices and exports never use these, as they follow the
 * document's language.
 */
export function useDateLabels() {
  const { t } = useTranslation();
  const quarterLabel = (year: number, quarter: NonNullable<Period["quarter"]>) =>
    t("period.quarterLabel", { quarter, year });

  return {
    /** "Enero" */
    month: (index: number) => t(`date.months.${MONTH_KEYS[index]!}`),
    /** "Ene" */
    monthShort: (index: number) => t(`date.monthsShort.${MONTH_KEYS[index]!}`),
    /** "enero", as it reads inside a sentence. */
    monthInSentence: (index: number) => t(`date.monthsInSentence.${MONTH_KEYS[index]!}`),
    /** "3T" */
    quarter: (quarter: NonNullable<Period["quarter"]>) => t("period.quarter", { quarter }),
    /** "3T 2026" or "Año 2026". */
    periodLabel: ({ year, quarter }: Period) =>
      quarter === null ? t("period.yearLabel", { year }) : quarterLabel(year, quarter),
    /** periodLabel inside a sentence: "3T 2026" or "año 2026". */
    periodInSentence: ({ year, quarter }: Period) =>
      quarter === null ? t("period.yearInSentence", { year }) : quarterLabel(year, quarter),
    /** "3T", or "4T 2025" when it's not the reference year; "2025" for a whole year. */
    periodShortLabel: ({ year, quarter }: Period, referenceYear: number) => {
      if (quarter === null) return String(year);
      return year === referenceYear ? t("period.quarter", { quarter }) : quarterLabel(year, quarter);
    },
    /** "2026-3T" for a quarter, "2026" for a year. */
    periodCode: ({ year, quarter }: Period) =>
      quarter === null ? String(year) : t("period.quarterCode", { quarter, year }),
  };
}
