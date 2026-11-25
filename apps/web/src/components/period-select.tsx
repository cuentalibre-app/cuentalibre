import { useTranslation } from "react-i18next";
import { Calendar, ChevronDown } from "lucide-react";
import { parsePeriod, periodKey, quarterOfMonth, type Period } from "@cuentalibre/core";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cuentalibre/ui/components/select";
import { cn } from "@cuentalibre/ui/lib/cn";
import { useDateLabels } from "@/i18n/dates";

interface PeriodSelectProps {
  value: Period;
  onChange: (period: Period) => void;
  years: number[];
  today: Date;
  className?: string;
  /** Phones: just the code (2026-4T) and the chevron, to share a line with the search. */
  compact?: boolean;
}

/** Newest first: each year followed by its quarters (Q4 → Q1). Future quarters are left out. */
function periodOptions(years: number[], today: Date): Period[] {
  return years.flatMap((year) => {
    const lastQuarter = year === today.getFullYear() ? quarterOfMonth(today.getMonth()) : 4;
    const quarters = ([4, 3, 2, 1] as const).filter((q) => q <= lastQuarter).map((quarter) => ({ year, quarter }));
    return [{ year, quarter: null }, ...quarters];
  });
}

export function PeriodSelect({ value, onChange, years, today, className, compact = false }: PeriodSelectProps) {
  const { t } = useTranslation();
  const { periodCode, periodLabel: label } = useDateLabels();
  return (
    <Select
      value={periodKey(value)}
      onValueChange={(key) => {
        const next = parsePeriod(key);
        if (next) onChange(next);
      }}
    >
      <SelectTrigger
        aria-label={t("period.choose", { period: label(value) })}
        className={cn("min-w-40", compact && "@max-5xl:min-w-0", className)}
      >
        <Calendar
          className={cn("size-4 text-muted-foreground", compact && "@max-5xl:hidden")}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="flex-1 text-center">
          <SelectValue />
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent>
        {periodOptions(years, today).map((p) => (
          <SelectItem key={periodKey(p)} value={periodKey(p)} aria-label={label(p)}>
            {periodCode(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
