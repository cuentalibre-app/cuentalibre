import type { CSSProperties } from "react";
import { Link } from "react-router";
import { TriangleAlert } from "lucide-react";
import { ECONOMIC_DEPENDENCY_THRESHOLD, type CounterpartyRanking } from "@fiscalia/core";
import { Card, CardTitle } from "@fiscalia/ui/components/card";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { formatPercent } from "@/lib/format";

interface Props {
  id: string;
  title: string;
  /** Plural noun for the count: "clientes". */
  noun: string;
  ranking: CounterpartyRanking;
  /** Bar color, as a background class. */
  barClass: string;
  /** "Ver todos" link; omitted when there is no list to open. */
  href?: string;
  empty: string;
  /** Shown above the list when the ranking signals a risk. */
  warning?: string;
  className?: string;
}

/** Ranked bars: who makes up most of the period's income or expenses (tax base). */
export function TopCounterparties({ id, title, noun, ranking, barClass, href, empty, warning, className }: Props) {
  const titleId = `${id}-title`;

  return (
    <Card aria-labelledby={titleId} className={cn("gap-3 p-4 lg:gap-3 lg:p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle id={titleId} className="text-md lg:text-lg">
            {title}
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {ranking.count} {noun} · <span className="amount">{formatEUR(ranking.total)}</span> sin IVA
          </span>
        </div>
        {href && (
          <Link to={href} className="shrink-0 font-medium text-primary no-underline hover:text-primary-hover">
            Ver todos
          </Link>
        )}
      </div>

      {warning && (
        <p className="m-0 flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} aria-hidden="true" />
          {warning}
        </p>
      )}

      {ranking.items.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {ranking.items.map((item, i) => (
            <li key={item.name} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-3">
                <span className={cn("min-w-0 flex-1 truncate", item.isOther ? "text-muted-foreground" : "font-medium")}>
                  {item.name}
                </span>
                <span className="amount">{formatEUR(item.amount)}</span>
                <span className="w-11 text-right amount text-sm text-muted-foreground">
                  {formatPercent(item.share * 100)}
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-xs bg-muted">
                <div
                  className={cn(
                    "h-full origin-left animate-reveal-x rounded-xs transition-[width] duration-500 ease-out [animation-delay:calc(var(--i)*60ms)]",
                    item.isOther ? "bg-muted-strong" : barClass,
                  )}
                  style={{ width: `${item.share * 100}%`, "--i": i } as CSSProperties}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Warning for the clients card when one client reaches the TRADE threshold. */
export function dependencyWarning(ranking: CounterpartyRanking): string {
  const top = ranking.items[0]!;
  return `El ${formatPercent(top.share * 100)} de tus ingresos viene de ${top.name}. Desde el ${formatPercent(
    ECONOMIC_DEPENDENCY_THRESHOLD * 100,
  )} podrías ser autónomo económicamente dependiente (TRADE).`;
}
