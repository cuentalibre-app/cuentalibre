import { useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";
import { Building2, ExternalLink } from "lucide-react";
import type { Contact, ContactRole } from "@cuentalibre/contracts";
import { Badge } from "@cuentalibre/ui/components/badge";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { SearchField } from "@cuentalibre/ui/components/input";
import { SegmentedControl } from "@cuentalibre/ui/components/segmented-control";
import { cn } from "@cuentalibre/ui/lib/cn";
import { table } from "@cuentalibre/ui/lib/table";
import { BackLink, Notice, Page, PageHeader } from "@/components/page";
import { contactPath } from "@/features/contacts/contacts-model";
import { useContacts } from "@/features/contacts/contacts-store";
import { formatDate } from "@/lib/format";
import { registryChanges } from "@/mocks/company-reports";
import { REPORTS_PATH } from "./reports-model";

const EINFORMA_URL = "https://www.einforma.com";

/** Paid reports, as eInforma sells them; the sample links are eInforma's own. */
const PAID_REPORTS = [
  {
    title: "Informe de últimos cambios",
    description: "El detalle de cada cambio publicado: nombramientos, cuentas, capital, incidencias…",
    sample: `${EINFORMA_URL}/servlet/app/portal/CONTA/prod/INFORME_COMERCIAL_RAI/nif/A00000000/PRINT/1/MODE/E`,
  },
  {
    title: "Resumen ejecutivo",
    description: "Datos registrales, actividad, administradores y principales cifras de sus cuentas.",
    sample: null,
  },
  {
    title: "Informe de solvencia",
    description: "Riesgo de impago y crédito recomendado, antes de dar un aplazamiento a un cliente.",
    sample: null,
  },
];

/** Changes that should make you think twice before selling on credit. */
const WARNING = /impagados|concurs/i;

type SearchBy = "name" | "taxId";

interface Company {
  name: string;
  taxId: string;
  city?: string;
  /** Where it is in your contacts, if it is. */
  contact?: { role: ContactRole; id: string };
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Natural people (NIF with a final letter and no leading one) aren't in the Registro Mercantil. */
const isCompanyTaxId = (taxId: string) => /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/i.test(taxId);

function useCompanies(): Company[] {
  const clients = useContacts("client");
  const suppliers = useContacts("supplier");
  return useMemo(() => {
    const byTaxId = new Map<string, Company>();
    const add = (role: ContactRole) => (c: Contact) => {
      if (isCompanyTaxId(c.taxId) && !byTaxId.has(c.taxId))
        byTaxId.set(c.taxId, { name: c.name, taxId: c.taxId, city: c.city, contact: { role, id: c.id } });
    };
    clients.forEach(add("client"));
    suppliers.forEach(add("supplier"));
    return [...byTaxId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [clients, suppliers]);
}

export function CompanyReportsPage() {
  const companies = useCompanies();
  const [params, setParams] = useSearchParams();
  const [by, setBy] = useState<SearchBy>("name");
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedId = params.get("nif");
  const selected =
    selectedId === null
      ? null
      : (companies.find((c) => c.taxId === selectedId) ?? { name: selectedId, taxId: selectedId });

  const q = normalize(text);
  const suggestions =
    q.length < 2
      ? []
      : companies
          .filter((c) => (by === "name" ? normalize(c.name).includes(q) : c.taxId.toLowerCase().startsWith(q)))
          .slice(0, 6);

  const pick = (company: Company) => {
    setText(by === "name" ? company.name : company.taxId);
    setError(null);
    setFocused(false);
    setParams({ nif: company.taxId }, { replace: true });
  };

  const consult = () => {
    if (by === "taxId") {
      const taxId = text.trim().toUpperCase();
      if (!isCompanyTaxId(taxId)) {
        setError(
          "Introduce el NIF de una sociedad, por ejemplo B12345674. Los autónomos no figuran en el Registro Mercantil.",
        );
        return;
      }
      pick(companies.find((c) => c.taxId === taxId) ?? { name: taxId, taxId });
    } else if (suggestions.length > 0) pick(suggestions[0]!);
    else setError("Elige una empresa de la lista, o busca por NIF si no está entre tus contactos.");
  };

  return (
    <Page>
      <PageHeader
        back={<BackLink to={REPORTS_PATH} label="Volver a informes" />}
        title="Informes de empresas"
        description="Lo último que ha publicado el Registro Mercantil de un cliente o proveedor, gracias a eInforma."
        actions={
          <a href={EINFORMA_URL} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary" })}>
            Ir a eInforma
            <ExternalLink strokeWidth={1.8} aria-hidden="true" />
          </a>
        }
      />

      <Notice tone="info">
        Consultar los últimos cambios registrales de una empresa es gratis. Antes de aceptar un pago aplazado de un
        cliente nuevo, conviene revisar su solvencia: eInforma vende informes con más detalle.
      </Notice>

      <form
        noValidate
        role="search"
        className="flex flex-wrap items-start gap-2.5 surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          consult();
        }}
      >
        <SegmentedControl
          label="Buscar por"
          value={by}
          onChange={(v) => {
            setBy(v);
            setText("");
            setError(null);
          }}
          options={[
            { value: "name", label: "Nombre o razón social" },
            { value: "taxId", label: "NIF" },
          ]}
          className="h-10 items-center"
        />
        <div className="relative flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <SearchField
            role="combobox"
            aria-expanded={focused && suggestions.length > 0}
            aria-controls="company-suggestions"
            aria-label={by === "name" ? "Nombre o razón social" : "NIF"}
            aria-invalid={error ? true : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            placeholder={by === "name" ? "Empieza a escribir, por ejemplo Lumen" : "B12345674"}
            autoComplete="off"
          />
          {focused && suggestions.length > 0 && (
            <ul
              id="company-suggestions"
              role="listbox"
              className="absolute top-11 right-0 left-0 z-20 m-0 popover-motion list-none rounded-xl border border-border bg-popover p-1.5 shadow-popover"
            >
              {suggestions.map((c) => (
                <li key={c.taxId} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-0 bg-transparent px-3 py-2 text-left text-foreground hover:bg-muted"
                  >
                    <span className="truncate">
                      {c.name}
                      {c.city && <span className="text-muted-foreground"> ({c.city})</span>}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{c.taxId}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="m-0 text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit">Consultar</Button>
      </form>

      {selected ? (
        <CompanyResult company={selected} />
      ) : (
        <p className="m-0 py-10 text-center text-muted-foreground">
          Busca por nombre o por NIF y pulsa Consultar para ver los últimos cambios registrales.
        </p>
      )}
    </Page>
  );
}

function CompanyResult({ company }: { company: Company }) {
  const changes = registryChanges[company.taxId] ?? [];
  const warning = changes.find((c) => WARNING.test(c.description));
  const known = company.name !== company.taxId;

  return (
    <div className="grid animate-rise-in gap-5 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="registry-title" className="flex min-w-0 flex-col gap-4 surface p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Building2 className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="registry-title" className="m-0 text-lg font-semibold tracking-tight lg:text-title">
              Últimos cambios registrales{known && ` de ${company.name}`}
            </h2>
            <span className="text-sm text-muted-foreground">
              NIF <span className="tabular-nums">{company.taxId}</span>
              {company.city && ` · ${company.city}`}
              {company.contact && (
                <>
                  {" · "}
                  <Link
                    to={contactPath(company.contact.role, company.contact.id)}
                    className={buttonVariants({ variant: "link" })}
                  >
                    Ver su ficha de {company.contact.role === "client" ? "cliente" : "proveedor"}
                  </Link>
                </>
              )}
            </span>
          </div>
        </div>

        {warning && (
          <Notice tone="danger">
            {warning.description.split(" (")[0]} el {formatDate(warning.date)}. Piénsalo antes de venderle a crédito.
          </Notice>
        )}

        {changes.length === 0 ? (
          <p className="m-0 py-8 text-center text-muted-foreground">
            No hay cambios registrales recientes de {known ? company.name : `la empresa con NIF ${company.taxId}`}.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className={table.headRow}>
                  <th scope="col" className={cn(table.th, "w-32")}>
                    Fecha
                  </th>
                  <th scope="col" className={table.th}>
                    Descripción
                  </th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c, i) => (
                  <tr key={i} className={cn(table.row, "animate-row-in")} style={{ "--i": i } as CSSProperties}>
                    <td className={cn(table.td, "whitespace-nowrap text-muted-foreground")}>{formatDate(c.date)}</td>
                    <td className={table.td}>
                      {c.description}
                      {WARNING.test(c.description) && (
                        <Badge tone="danger" className="ml-2">
                          Atención
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside aria-labelledby="paid-title" className="flex flex-col gap-3 surface p-4 sm:p-5">
        <h2 id="paid-title" className="m-0 text-lg font-semibold tracking-tight lg:text-title">
          Más información en eInforma
        </h2>
        <p className="m-0 text-sm text-muted-foreground">Informes de pago que se compran en la web de eInforma.</p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {PAID_REPORTS.map((r) => (
            <li key={r.title} className="flex flex-col gap-1.5 border-t border-divider pt-3">
              <span className="font-medium">{r.title}</span>
              <span className="text-sm text-muted-foreground">{r.description}</span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <a
                  href={EINFORMA_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  Comprar
                  <ExternalLink strokeWidth={1.8} aria-hidden="true" />
                </a>
                {r.sample && (
                  <a
                    href={r.sample}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline-offset-2 hover:text-foreground"
                  >
                    Ver un ejemplo
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
