import { Link } from "react-router";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { closingPath, quarterToClose, useQuarterChecks, useQuarterIsEmpty } from "@/features/closing/closing-model";
import { useClosedQuarters } from "@/features/closing/closing-store";
import { CALENDAR_PATH } from "@/features/taxes/taxes-model";
import { daysLeftLabel, deadlineTitle, MONTHS_SHORT } from "@/lib/format";
import type { DeadlineItem, HomeData } from "./home-data";

function DateBlock({ date, className }: { date: Date; className?: string }) {
  return (
    <div className={cn("flex w-11 shrink-0 flex-col items-center", className)}>
      <span className="text-xl font-semibold">{date.getDate()}</span>
      <span className="text-2xs text-muted-foreground uppercase">{MONTHS_SHORT[date.getMonth()]}</span>
    </div>
  );
}

function Amount({ item }: { item: DeadlineItem }) {
  if (item.amount === null) return <span className="text-xs text-muted-foreground">Informativo</span>;
  return <span className="amount">{formatEUR(item.amount)}</span>;
}

export function TaxCalendar({ data, today, className }: { data: HomeData; today: Date; className?: string }) {
  const daysLeft = data.nextFilingDays;
  const toClose = quarterToClose(today, useClosedQuarters());
  const checks = useQuarterChecks(toClose);
  // An untouched quarter has nothing to review yet: it shouldn't read as done
  const empty = useQuarterIsEmpty(toClose);
  const reviewed = empty ? 0 : checks.filter((c) => c.tone === "ok").length;
  const progress = (reviewed / checks.length) * 100;

  return (
    <section
      aria-labelledby="tax-calendar-title"
      className={cn(
        "flex flex-col gap-2 lg:gap-4 lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id="tax-calendar-title"
            className="m-0 text-lg font-semibold tracking-tight whitespace-nowrap lg:text-title"
          >
            <span className="lg:hidden">Próximos vencimientos</span>
            <span className="hidden lg:inline">Calendario fiscal</span>
          </h2>
          {daysLeft !== null && <span className="text-sm font-semibold text-warning">{daysLeftLabel(daysLeft)}</span>}
        </div>
        <Link to={CALENDAR_PATH} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "no-underline")}>
          Ver calendario
        </Link>
      </div>

      {/* Desktop: full list */}
      <ul className="m-0 hidden list-none flex-col gap-1 p-0 lg:flex">
        {data.deadlines.map((item) => (
          <li
            key={`${item.deadline.kind}-${item.deadline.date.toISOString()}`}
            className="flex items-center gap-3.5 border-b border-divider py-2.5 last:border-b-0"
          >
            <DateBlock date={item.deadline.date} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{deadlineTitle(item.deadline)}</span>
              <span className="text-xs text-muted-foreground">{item.detail}</span>
            </div>
            <Amount item={item} />
          </li>
        ))}
      </ul>

      <div className="hidden flex-col gap-2 pt-1 lg:flex">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Cierre del T{toClose.quarter}</span>
          <span className="text-muted-foreground">
            {empty ? "Sin movimientos" : `${reviewed} de ${checks.length} revisados`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Cierre del T${toClose.quarter}`}
          aria-valuemin={0}
          aria-valuemax={checks.length}
          aria-valuenow={reviewed}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-1.5 animate-reveal-x rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <Link
        to={closingPath(toClose)}
        className={cn(buttonVariants({ variant: "secondary" }), "hidden font-semibold no-underline lg:inline-flex")}
      >
        Continuar cierre de trimestre
      </Link>

      {/* Mobile: next two, as cards */}
      <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
        {data.deadlines.slice(0, 2).map((item) => (
          <li key={`${item.deadline.kind}-${item.deadline.date.toISOString()}`}>
            <Link
              to="/impuestos"
              className="flex items-center gap-3.5 rounded-xl border border-border p-3.5 text-foreground no-underline transition-[background-color,scale] duration-150 ease-out active:scale-[0.98] active:bg-muted"
            >
              <DateBlock date={item.deadline.date} className="w-10" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium">{deadlineTitle(item.deadline)}</span>
                <span className="text-sm text-muted-foreground">{item.detail}</span>
              </div>
              <Amount item={item} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
