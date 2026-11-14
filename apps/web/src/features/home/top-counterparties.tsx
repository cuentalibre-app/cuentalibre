import { useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ECONOMIC_DEPENDENCY_THRESHOLD, type CounterpartyRanking } from "@cuentalibre/core";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { Notice, SeeAllLink, Section } from "@/components/page";
import { formatPercent } from "@/lib/format";

interface Warning {
  /** What the user closes: a new id (say, another client) shows it again. */
  id: string;
  text: string;
}

const DISMISSED_KEY = "cuentalibre:dismissed-warnings";

function readDismissed(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

interface Props {
  id: string;
  title: string;
  /** Plural noun for the count ("clientes"); without it the card shows no count and total line. */
  noun?: string;
  ranking: CounterpartyRanking;
  /** Bar color, as a background class. */
  barClass: string;
  /** "Ver todos" link; omitted when there is no list to open. */
  href?: string;
  empty: string;
  /** Shown above the list when the ranking signals a risk; closing it hides it for good while `id` stays the same. */
  warning?: Warning;
  icon?: LucideIcon;
  className?: string;
}

/** Ranked bars: who makes up most of the period's income or expenses (tax base). */
export function TopCounterparties({ id, title, noun, ranking, barClass, href, empty, warning, icon, className }: Props) {
  const titleId = `${id}-title`;
  const [dismissed, setDismissed] = useState(readDismissed);
  const dismiss = (warningId: string) => {
    const next = [...dismissed, warningId];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: it stays hidden until the page reloads.
    }
  };

  return (
    <Section
      id={titleId}
      title={title}
      icon={icon}
      subtitle={
        noun && (
          <span className="text-sm text-muted-foreground">
            {ranking.count} {noun} · <span className="amount">{formatEUR(ranking.total)}</span> sin IVA
          </span>
        )
      }
      action={
        href && (
          <SeeAllLink to={href}>Ver todos</SeeAllLink>
        )
      }
      className={className}
    >
      {warning && !dismissed.includes(warning.id) && (
        <Notice tone="warning" onDismiss={() => dismiss(warning.id)}>
          {warning.text}
        </Notice>
      )}

      {ranking.items.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
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
              <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full origin-left animate-reveal-x rounded-full transition-[width] duration-500 ease-out [animation-delay:calc(var(--i)*60ms)]",
                    item.isOther ? "bg-muted-strong" : barClass,
                  )}
                  style={{ width: `${item.share * 100}%`, "--i": i } as CSSProperties}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/** Warning for the clients card when one client reaches the TRADE threshold. */
export function dependencyWarning(ranking: CounterpartyRanking): Warning {
  const top = ranking.items[0]!;
  const text = `El ${formatPercent(top.share * 100)} de tus ingresos viene de ${top.name}. Desde el ${formatPercent(
    ECONOMIC_DEPENDENCY_THRESHOLD * 100,
  )} podrías ser autónomo económicamente dependiente (TRADE).`;
  return { id: `trade:${top.name}`, text };
}
