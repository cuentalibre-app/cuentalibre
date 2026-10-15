import { Link } from "react-router";
import { buttonVariants } from "@fiscalia/ui/components/button";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { quarterClose } from "@/mocks/data";
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

export function TaxCalendar({ data, className }: { data: HomeData; className?: string }) {
  const daysLeft = data.nextFilingDays;
  const progress = (quarterClose.stepsDone / quarterClose.stepsTotal) * 100;

  return (
    <section
      aria-labelledby="tax-calendar-title"
      className={cn(
        "flex flex-col gap-2 lg:gap-4 lg:rounded-xl lg:border lg:border-border lg:p-5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between lg:items-center">
        <h2 id="tax-calendar-title" className="m-0 text-md font-semibold lg:text-lg">
          <span className="lg:hidden">Próximos vencimientos</span>
          <span className="hidden lg:inline">Calendario fiscal</span>
        </h2>
        {daysLeft !== null && <span className="text-xs font-semibold text-warning">{daysLeftLabel(daysLeft)}</span>}
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
          <span className="font-medium">Cierre del T{quarterClose.quarter}</span>
          <span className="text-muted-foreground">
            {quarterClose.stepsDone} de {quarterClose.stepsTotal} pasos
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Cierre del T${quarterClose.quarter}`}
          aria-valuemin={0}
          aria-valuemax={quarterClose.stepsTotal}
          aria-valuenow={quarterClose.stepsDone}
          className="h-1.5 rounded-full bg-muted"
        >
          <div className="h-1.5 animate-reveal-x rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <Link
        to="/cierre-trimestre"
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
