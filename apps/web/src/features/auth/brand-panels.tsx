import type { ReactNode } from "react";
import { type Quarter, daysUntil, filingDeadline, filingStatus, quarterToFile } from "@cuentalibre/core";
import { cn } from "@cuentalibre/ui/lib/cn";
import { QUARTER_ORDINAL, daysLeftLabel } from "@/lib/format";
import vatScreen from "./assets/iva-303.webp";

/** The panel beside the auth forms, on wide screens. */
function BrandPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="relative m-3 hidden overflow-hidden rounded-[24px] border border-border bg-brand-glow lg:flex lg:flex-col">
      {children}
    </aside>
  );
}

function Headline({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex max-w-[560px] flex-col gap-4">
      <p className="m-0 font-display text-[clamp(32px,3.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance">
        {title}
      </p>
      <p className="m-0 text-lg text-pretty text-muted-foreground">{text}</p>
    </div>
  );
}

const longDate = (date: Date) => date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
const shortDate = (date: Date) => date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");

/** For people coming back: the next quarterly filing and where it sits in the year. */
export function DeadlinePanel() {
  const today = new Date();
  const focus = quarterToFile(today);
  const quarter = `${QUARTER_ORDINAL[focus.quarter]} trimestre`;
  const title =
    focus.status === "open"
      ? `Tienes hasta el ${longDate(focus.dueOn)} para presentar el ${quarter}.`
      : `El ${quarter} se presenta hasta el ${longDate(focus.dueOn)}.`;
  return (
    <BrandPanel>
      <div className="flex flex-1 flex-col justify-center gap-16 p-12 xl:p-16">
        <Headline title={title} text={`IVA (modelo 303) e IRPF (modelo 130). ${daysLeftLabel(daysUntil(today, focus.dueOn))}.`} />
        <YearTimeline year={focus.year} focus={focus.quarter} today={today} />
      </div>
    </BrandPanel>
  );
}

/**
 * The four quarters of a year as blocks on one line, with the day each one is filed below it and today
 * marked above. It runs into February, where the last quarter is filed.
 */
function YearTimeline({ year, focus, today }: { year: number; focus: Quarter; today: Date }) {
  const start = new Date(year, 0, 1).getTime();
  const span = new Date(year + 1, 1, 15).getTime() - start;
  const at = (date: Date) => `${(((date.getTime() - start) / span) * 100).toFixed(2)}%`;
  const quarters = ([1, 2, 3, 4] as const).map((q) => ({
    q,
    from: new Date(year, (q - 1) * 3, 1),
    to: new Date(year, q * 3, 1),
    due: filingDeadline(year, q),
    status: filingStatus(year, q, today),
  }));

  return (
    <figure className="m-0 flex flex-col gap-4">
      <figcaption className="text-md font-semibold">Plazos de {year}</figcaption>
      <div className="relative h-[116px]">
        <span
          className="absolute top-0 -translate-x-1/2 rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background"
          style={{ left: at(today) }}
        >
          Hoy
        </span>
        {quarters.map(({ q, from, to, due, status }) => {
          const isFocus = q === focus;
          return (
            <div key={q}>
              <span
                className={cn(
                  "absolute top-8 flex h-9 items-center rounded-lg px-3 text-sm font-semibold",
                  isFocus
                    ? "bg-gradient-brand text-primary-foreground"
                    : status === "closed"
                      ? "bg-foreground/10 text-muted-foreground"
                      : "border border-border bg-background text-muted-foreground",
                )}
                style={{ left: at(from), width: `calc(${at(to)} - ${at(from)} - 4px)` }}
              >
                T{q}
              </span>
              <span
                aria-hidden
                className={cn("absolute top-[84px] h-2 w-px", isFocus ? "bg-primary" : "bg-foreground/25")}
                style={{ left: at(due) }}
              />
              <span
                className={cn(
                  "absolute top-[96px] -translate-x-1/2 text-sm whitespace-nowrap",
                  isFocus ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
                style={{ left: at(due) }}
              >
                {shortDate(due)}
              </span>
            </div>
          );
        })}
        <span aria-hidden className="absolute top-5 h-[52px] w-0.5 -translate-x-1/2 bg-foreground" style={{ left: at(today) }} />
      </div>
    </figure>
  );
}

/** For people signing up: one thing the app does for them, shown in the app. */
export function ProductPanel() {
  return (
    <BrandPanel>
      <div className="relative z-10 p-12 xl:p-16">
        <Headline
          title="Tu 303, rellenado con tus facturas."
          text="Revisas las casillas, descargas el fichero y lo presentas en la AEAT."
        />
      </div>
      {/* Decorative: the VAT return screen, peeking in from the bottom-right corner */}
      <img
        src={vatScreen}
        alt=""
        loading="lazy"
        decoding="async"
        width={1400}
        height={961}
        className="pointer-events-none absolute top-[min(34%,300px)] left-12 w-[1000px] max-w-none rounded-tl-[14px] border border-border bg-background shadow-[-10px_-10px_36px_-14px_rgb(17_18_20/0.28)] select-none xl:left-16"
      />
    </BrandPanel>
  );
}
