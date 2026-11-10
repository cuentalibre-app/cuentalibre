import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Calculator, ChevronRight } from "lucide-react";
import type { Period } from "@cuentalibre/core";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { BackLink, Page, PageHeader } from "@/components/page";
import { usePeriod } from "@/lib/use-period";
import { FACTS, FormFactsList } from "./form-info";
import {
  INCOME_TAX_PATH,
  INTRA_EU_PATH,
  modelPath,
  quarterOf,
  RENTALS_PATH,
  TAXES_PATH,
  THIRD_PARTIES_PATH,
  VAT_PATH,
  WITHHOLDINGS_PATH,
  type FormCode,
} from "./taxes-model";

/*
 * Each tax module opens on what its forms are, who files them and when;
 * "Calcular datos" opens the calculation on the selected period (?periodo=…).
 */

interface TaxModule {
  title: string;
  path: string;
  forms: { code: FormCode; annual: boolean }[];
}

export const TAX_MODULES = {
  vat: {
    title: "IVA",
    path: VAT_PATH,
    forms: [
      { code: "303", annual: false },
      { code: "390", annual: true },
    ],
  },
  incomeTax: {
    title: "IRPF",
    path: INCOME_TAX_PATH,
    forms: [
      { code: "130", annual: false },
      { code: "100", annual: true },
    ],
  },
  withholdings: {
    title: "Retenciones",
    path: WITHHOLDINGS_PATH,
    forms: [
      { code: "111", annual: false },
      { code: "190", annual: true },
    ],
  },
  rentals: {
    title: "Retenciones de alquileres",
    path: RENTALS_PATH,
    forms: [
      { code: "115", annual: false },
      { code: "180", annual: true },
    ],
  },
  thirdParties: {
    title: "Operaciones con terceras personas",
    path: THIRD_PARTIES_PATH,
    forms: [{ code: "347", annual: true }],
  },
  intraEu: {
    title: "Operaciones intracomunitarias",
    path: INTRA_EU_PATH,
    forms: [{ code: "349", annual: false }],
  },
} satisfies Record<string, TaxModule>;

export type TaxModuleKey = keyof typeof TAX_MODULES;

/** The period a form opens on: the selected one, as a quarter or a year as the form needs. */
function formPeriod(period: Period, annual: boolean, today: Date): Period {
  if (annual) return { year: period.year, quarter: null };
  return period.quarter === null ? quarterOf(period.year, today) : period;
}

function TaxIntro({ module }: { module: TaxModuleKey }) {
  const today = useMemo(() => new Date(), []);
  const [period] = usePeriod(today);
  const { title, path, forms } = TAX_MODULES[module];

  return (
    <Page>
      <PageHeader
        title={title}
        eyebrow={<Breadcrumb items={[{ label: "Impuestos", to: TAXES_PATH }]} />}
        back={<TaxesBackLink />}
        actions={forms.map((f) => (
          <Link
            key={f.code}
            to={modelPath(path, formPeriod(period, f.annual, today))}
            className={buttonVariants({ variant: "primary" })}
          >
            <Calculator strokeWidth={1.8} aria-hidden="true" />
            Calcular datos modelo {f.code}
          </Link>
        ))}
      />
      {forms.map((f, i) => (
        <section
          key={f.code}
          aria-labelledby={`modelo-${f.code}`}
          className="flex animate-rise-in flex-col gap-4 surface p-5"
          style={{ "--i": i } as CSSProperties}
        >
          <h2 id={`modelo-${f.code}`} className="m-0 text-lg font-semibold tracking-tight lg:text-title">
            {FACTS[f.code].title}
          </h2>
          <FormFactsList form={f.code} />
        </section>
      ))}
    </Page>
  );
}

function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Migas de pan" className="max-lg:hidden">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />}
            {item.to ? (
              <Link to={item.to} className="text-muted-foreground no-underline hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** On phones, where the breadcrumb is hidden: one arrow back to the taxes overview. */
export function TaxesBackLink() {
  return <BackLink to={TAXES_PATH} label="Volver a impuestos" className="shrink-0 lg:hidden" />;
}

/** Above a calculation's title on desktop: back to the module's intro. */
export function ModuleBreadcrumb({ module, form }: { module: TaxModuleKey; form: FormCode }) {
  const { title, path } = TAX_MODULES[module];
  return (
    <Breadcrumb
      items={[{ label: "Impuestos", to: TAXES_PATH }, { label: title, to: path }, { label: `Cálculo modelo ${form}` }]}
    />
  );
}

/** The module's intro until a period is picked: a link with ?periodo opens the calculation directly. */
export function TaxModulePage({ module, children }: { module: TaxModuleKey; children: ReactNode }) {
  const [params] = useSearchParams();
  return params.has("periodo") ? children : <TaxIntro module={module} />;
}
