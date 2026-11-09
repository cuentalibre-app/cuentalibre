import type { CSSProperties } from "react";
import { Link } from "react-router";
import { BookOpenText, ChevronRight, ListChecks, type LucideIcon } from "lucide-react";
import { PageShell } from "./transfer-parts";
import { EXPORT_ADVANCED_PATH, EXPORT_BOOKS_PATH } from "./transfer-model";

const OPTIONS: { to: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    to: EXPORT_BOOKS_PATH,
    title: "Exportación de libros de registro",
    description:
      "Los libros registro oficiales de IVA e IRPF de un ejercicio, listos para entregar si Hacienda te los pide.",
    icon: BookOpenText,
  },
  {
    to: EXPORT_ADVANCED_PATH,
    title: "Exportación avanzada",
    description:
      "Elige qué listados quieres: facturas con su detalle y pagos, amortizaciones, gastos, presupuestos, albaranes y contactos.",
    icon: ListChecks,
  },
];

export function ExportPage() {
  return (
    <PageShell title="Exportaciones">
      <div className="grid gap-4 md:grid-cols-2">
        {OPTIONS.map((o, i) => (
          <Link
            key={o.to}
            to={o.to}
            className="group flex animate-rise-in items-start gap-4 surface p-5 text-card-foreground no-underline transition-[background-color,border-color,scale] duration-150 hover:border-muted-strong hover:bg-accent active:scale-[0.99]"
            style={{ "--i": i } as CSSProperties}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <o.icon strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-md font-semibold">{o.title}</span>
              <span className="text-sm text-muted-foreground">{o.description}</span>
            </span>
            <ChevronRight
              className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
