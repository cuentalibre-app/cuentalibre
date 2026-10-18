import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ExternalLink, MapPin, MoreHorizontal, Pencil } from "lucide-react";
import {
  cents,
  checkTaxId,
  defaultPeriod,
  formatIban,
  isOtherEuCountry,
  periodMonths,
  type Period,
} from "@fiscalia/core";
import type { Contact, ContactRole } from "@fiscalia/contracts";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { DropdownMenuTrigger } from "@fiscalia/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { PeriodSelect } from "@/components/period-select";
import { useExpenses } from "@/features/purchases/expenses-store";
import { ReceiptDrop } from "@/features/purchases/form-parts";
import { usePurchaseInvoices } from "@/features/purchases/purchases-store";
import { LANGUAGES, NUMBER_FORMATS } from "@/features/sales/invoice-locale";
import { ActionsMenu, EmptyState } from "@/features/sales/list-parts";
import { WITHHOLDING_GROUPS } from "@/features/sales/sales-model";
import { useSalesDocuments } from "@/features/sales/sales-store";
import { MONTHS_SHORT, formatDate, periodCode } from "@/lib/format";
import { availableYears } from "@/mocks/data";
import { paymentMethodName } from "@/features/settings/settings-model";
import { TagChip } from "@/features/settings/tag-chip";
import { filesAreStored } from "@/data/files";
import { ContactNotFound } from "./contact-form-page";
import {
  ACTIVITY_KIND_LABELS,
  contactActivity,
  summarizeActivity,
  type ActivityKind,
  type ActivityRow,
  type ActivitySummary,
} from "./contacts-activity";
import { useCustomFieldLabels } from "./contact-settings-store";
import { TagsDialog, useContactActions } from "./contacts-list-page";
import { ROLES, contactPath, countryOf, editContactPath, formatAddress } from "./contacts-model";
import { contactsStore, useContacts } from "./contacts-store";

type Tab = "ficha" | "documentos" | "facturacion" | "adjuntos";

export function ContactDetailPage({ role }: { role: ContactRole }) {
  const { id = "" } = useParams();
  // Subscribe so edits from dialogs (tags, attachments) show at once
  const contact = useContacts(role).find((c) => c.id === id);
  if (!contact) return <ContactNotFound role={role} />;
  return <ContactSheet key={contact.id} role={role} contact={contact} />;
}

function ContactSheet({ role, contact }: { role: ContactRole; contact: Contact }) {
  const config = ROLES[role];
  const today = useMemo(() => new Date(), []);
  const [params, setParams] = useSearchParams();
  const tab =
    (["ficha", "documentos", "facturacion", "adjuntos"] as const).find((t) => t === params.get("pestana")) ?? "ficha";
  const [tagging, setTagging] = useState<Contact | null>(null);

  const sales = useSalesDocuments();
  const purchases = usePurchaseInvoices();
  const expenses = useExpenses();
  const activity = useMemo(
    () => contactActivity(role, contact.id, { sales, purchases, expenses }, today),
    [role, contact.id, sales, purchases, expenses, today],
  );
  const { newDocument, groups } = useContactActions(role, contact, activity.length, setTagging);

  // The same tax ID in the other list: a client who is also a supplier
  const twin = contactsStore
    .all(config.opposite)
    .find((c) => c.taxId.replace(/^ES/, "") === contact.taxId.replace(/^ES/, ""));

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "ficha", label: "Información básica" },
    { value: "documentos", label: "Documentos", count: activity.length },
    { value: "facturacion", label: "Informes de facturación" },
    { value: "adjuntos", label: "Documentos adjuntos", count: contact.attachments?.length ?? 0 },
  ];
  const selectTab = (value: Tab) =>
    setParams(
      (p) => {
        if (value === "ficha") p.delete("pestana");
        else p.set("pestana", value);
        return p;
      },
      { replace: true },
    );

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={config.path}
              aria-label={`Volver a ${config.title.toLowerCase()}`}
              className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-10 no-underline")}
            >
              <ArrowLeft strokeWidth={1.8} aria-hidden="true" />
            </Link>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm text-muted-foreground">{config.singular}</span>
              <h1 className="m-0 truncate text-2xl font-semibold tracking-tight lg:text-3xl">{contact.name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionsMenu
              groups={groups}
              trigger={
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="lg" aria-label="Más acciones" className="w-10 px-0">
                    <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
              }
            />
            <Button variant="secondary" onClick={newDocument.run}>
              {newDocument.label}
            </Button>
            <Link to={editContactPath(role, contact.id)} className={cn(buttonVariants(), "no-underline")}>
              <Pencil strokeWidth={1.8} aria-hidden="true" />
              Editar
            </Link>
          </div>
        </header>

        {twin && (
          <p className="m-0 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            También es {ROLES[config.opposite].singular.toLowerCase()}.{" "}
            <Link
              to={contactPath(config.opposite, twin.id)}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Ver su ficha de {ROLES[config.opposite].singular.toLowerCase()}
            </Link>
          </p>
        )}

        <div
          role="tablist"
          aria-label="Secciones de la ficha"
          className="flex gap-1 overflow-x-auto border-b border-border"
        >
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`tab-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls={`panel-${t.value}`}
              onClick={() => selectTab(t.value)}
              className={cn(
                "-mb-px flex h-10 shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground",
                tab === t.value && "border-primary text-foreground",
              )}
            >
              {t.label}
              {!!t.count && (
                <span className="rounded-sm bg-muted px-1.5 text-2xs leading-5 font-semibold text-muted-foreground">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4">
          {tab === "ficha" && <BasicInfo role={role} contact={contact} />}
          {tab === "documentos" && <Documents role={role} rows={activity} />}
          {tab === "facturacion" && <Billing role={role} rows={activity} today={today} />}
          {tab === "adjuntos" && (
            <ReceiptDrop
              attachments={contact.attachments ?? []}
              onChange={(a) => contactsStore.update(role, contact.id, { attachments: a.length ? a : undefined })}
              label="Documentos adjuntos"
              prompt="Arrastra aquí contratos, mandatos SEPA u otros documentos"
              note={filesAreStored() ? "Cualquier tipo de archivo." : "Se guardan solo en esta sesión."}
              accept=""
            />
          )}
        </div>
      </div>
      <TagsDialog role={role} contact={tagging} onClose={() => setTagging(null)} />
    </TooltipProvider>
  );
}

function InfoCard({
  title,
  index,
  children,
  className,
}: {
  title: string;
  index: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex animate-rise-in flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground",
        className,
      )}
      style={{ "--i": index } as CSSProperties}
    >
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="m-0 min-w-0 break-words">{value || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

const TAX_ID_KIND = { nif: "NIF", nie: "NIE", cif: "CIF", foreign: "Extranjero" } as const;
const withholdingLabel = new Map(WITHHOLDING_GROUPS.flatMap((g) => g.options.map((o) => [o.value, o.label])));

function BasicInfo({ role, contact }: { role: ContactRole; contact: Contact }) {
  const country = countryOf(contact);
  const check = checkTaxId(contact.taxId, country);
  const address = formatAddress(contact);
  const customLabels = useCustomFieldLabels();
  const language = LANGUAGES.find((l) => l.value === contact.language)?.label;
  const numberFormat = contact.language
    ? NUMBER_FORMATS[contact.language]?.find((f) => f.value === contact.numberFormat)?.label
    : undefined;
  const e = contact.eInvoice;
  const tel = (n?: string) =>
    n ? (
      <a href={`tel:${n.replace(/\s/g, "")}`} className="text-foreground no-underline hover:text-primary">
        {n}
      </a>
    ) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InfoCard title="Datos de facturación" index={0}>
        <Rows
          rows={[
            ["Razón social", contact.name],
            [
              "NIF",
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{contact.taxId}</span>
                {check.valid ? (
                  <Badge tone="neutral">{TAX_ID_KIND[check.kind]}</Badge>
                ) : (
                  <Badge tone="danger">No válido</Badge>
                )}
              </span>,
            ],
            ["País", country],
            ...(isOtherEuCountry(country)
              ? ([["Operador intracomunitario", contact.vies ? "Inscrito en el VIES" : "No consta en el VIES"]] as [
                  string,
                  ReactNode,
                ][])
              : []),
          ]}
        />
        <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
          La comprobación del NIF en el censo de la AEAT y en el VIES llegará con el servidor.
        </p>
      </InfoCard>

      <InfoCard title="Dirección" index={1}>
        <Rows
          rows={[
            ["Dirección", contact.address],
            ["Código postal", contact.postalCode],
            ["Población", contact.city],
            ["Provincia", contact.province],
            ["País", country],
          ]}
        />
        {(contact.address || contact.city) && (
          <a
            href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 self-start text-sm font-medium text-primary no-underline hover:text-primary-hover"
          >
            <MapPin className="size-4" strokeWidth={1.8} aria-hidden="true" />
            Ver en el mapa
          </a>
        )}
      </InfoCard>

      <InfoCard title="Datos de contacto" index={2}>
        <Rows
          rows={[
            [
              "Email",
              contact.email && (
                <a href={`mailto:${contact.email}`} className="text-foreground no-underline hover:text-primary">
                  {contact.email}
                </a>
              ),
            ],
            ["Teléfono", tel(contact.phone)],
            ["Móvil", tel(contact.mobile)],
            ["Fax", contact.fax],
            [
              "Web",
              contact.website && (
                <a
                  href={/^https?:\/\//.test(contact.website) ? contact.website : `https://${contact.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-foreground no-underline hover:text-primary"
                >
                  {contact.website}
                  <ExternalLink className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                </a>
              ),
            ],
          ]}
        />
      </InfoCard>

      <InfoCard title="Condiciones por defecto" index={3}>
        <Rows
          rows={[
            ["Descuento", contact.discount ? <span className="amount">{contact.discount} %</span> : null],
            ["Retención", contact.withholding && withholdingLabel.get(contact.withholding)],
            [
              role === "client" ? "Método de cobro" : "Método de pago",
              contact.paymentMethodId && paymentMethodName(contact.paymentMethodId),
            ],
            ...(role === "client"
              ? ([
                  ["Idioma", language ?? "Por defecto del documento"],
                  ["Formato numérico", numberFormat ?? "Por defecto del documento"],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
      </InfoCard>

      <InfoCard title="Datos bancarios" index={4}>
        {contact.bankAccounts?.length ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={table.headRow}>
                  <th className={table.th}>IBAN</th>
                  <th className={table.th}>BIC</th>
                  <th className={table.th}>Notas</th>
                </tr>
              </thead>
              <tbody>
                {contact.bankAccounts.map((a) => (
                  <tr key={a.id} className={table.row}>
                    <td className={cn(table.td, "font-mono whitespace-nowrap")}>
                      {formatIban(a.iban)}
                      {a.isDefault && (
                        <span className="ml-2 font-sans text-xs font-semibold text-primary">Por defecto</span>
                      )}
                    </td>
                    <td className={cn(table.td, "font-mono")}>{a.bic ?? "—"}</td>
                    <td className={table.td}>{a.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">No hay cuentas bancarias.</p>
        )}
      </InfoCard>

      <InfoCard title="Otros" index={5}>
        <Rows
          rows={[
            [customLabels[0], contact.custom1],
            [customLabels[1], contact.custom2],
            [
              "Etiquetas",
              contact.tags?.length ? (
                <span className="flex flex-wrap gap-1">
                  {contact.tags.map((t) => (
                    <TagChip key={t} name={t} className="px-2.5 text-xs leading-6" />
                  ))}
                </span>
              ) : null,
            ],
            ["Notas", contact.notes && <span className="whitespace-pre-line">{contact.notes}</span>],
          ]}
        />
      </InfoCard>

      {role === "client" && e && (
        <InfoCard title="Factura electrónica" index={6}>
          <Rows
            rows={[
              ["Oficina contable", e.accountingOffice && <span className="font-mono">{e.accountingOffice}</span>],
              ["Órgano gestor", e.managementBody && <span className="font-mono">{e.managementBody}</span>],
              ["Unidad tramitadora", e.processingUnit && <span className="font-mono">{e.processingUnit}</span>],
              ["Órgano proponente", e.proposingBody && <span className="font-mono">{e.proposingBody}</span>],
            ]}
          />
        </InfoCard>
      )}
    </div>
  );
}

const ALL = "all";

function Documents({ role, rows }: { role: ContactRole; rows: ActivityRow[] }) {
  const [kind, setKind] = useState<ActivityKind | typeof ALL>(ALL);
  const kinds = [...new Set(rows.map((r) => r.kind))];
  const shown = kind === ALL ? rows : rows.filter((r) => r.kind === kind);

  if (rows.length === 0)
    return (
      <EmptyState
        message="Todavía no hay documentos."
        hint={
          role === "client"
            ? "Aquí aparecerán sus facturas, presupuestos y albaranes."
            : "Aquí aparecerán sus facturas recibidas y gastos."
        }
      />
    );

  return (
    <section className="flex animate-rise-in flex-col gap-3 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border">
      {kinds.length > 1 && (
        <div role="group" aria-label="Tipo de documento" className="flex flex-wrap gap-1.5 lg:px-4 lg:pt-3">
          {[ALL, ...kinds].map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k as ActivityKind | typeof ALL)}
              className={cn(
                "h-8 cursor-pointer rounded-full border border-border bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground",
                kind === k && "border-primary bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
              )}
            >
              {k === ALL ? "Todos" : ACTIVITY_KIND_LABELS[k as ActivityKind]} ·{" "}
              {k === ALL ? rows.length : rows.filter((r) => r.kind === k).length}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              <th className={table.th}>Fecha</th>
              <th className={table.th}>Tipo</th>
              <th className={table.th}>Número</th>
              <th className={table.th}>Estado</th>
              <th className={cn(table.th, "text-right")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr
                key={`${r.kind}-${r.id}`}
                className={cn(table.row, "animate-row-in")}
                style={{ "--i": i } as CSSProperties}
              >
                <td className={cn(table.td, "whitespace-nowrap text-muted-foreground")}>{formatDate(r.date)}</td>
                <td className={cn(table.td, "text-sm")}>{ACTIVITY_KIND_LABELS[r.kind]}</td>
                <td className={table.td}>
                  <Link
                    to={r.path}
                    className="block max-w-56 truncate font-mono text-sm font-medium text-foreground no-underline hover:text-primary"
                  >
                    {r.number}
                  </Link>
                </td>
                <td className={table.td}>
                  <Badge tone={r.status.tone}>{r.status.label}</Badge>
                </td>
                <td className={cn(table.td, "text-right amount font-semibold")}>{formatEUR(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Billing({ role, rows, today }: { role: ContactRole; rows: ActivityRow[]; today: Date }) {
  const [period, setPeriod] = useState<Period>(() => defaultPeriod(today));
  const all = summarizeActivity(rows);
  const inPeriod = summarizeActivity(rows, period);
  const kinds: ActivityKind[] =
    role === "client" ? ["invoice", "quote", "deliveryNote", "draft"] : ["purchase", "expense"];

  return (
    <div className="flex flex-col gap-4">
      <InfoCard title="Eficiencia" index={0}>
        <div className="flex flex-col gap-3">
          {role === "client" && (
            <Ratio
              label="Facturado sobre presupuestado"
              value={all.invoicedOverQuoted}
              help="Lo facturado frente a lo presupuestado a este cliente."
              empty="Sin presupuestos"
            />
          )}
          <Ratio
            label={role === "client" ? "Cobrado sobre facturado" : "Pagado sobre facturado"}
            value={all.settledRatio}
            help={
              role === "client"
                ? "Facturas cobradas frente al total facturado."
                : "Lo que le has pagado frente al total de sus facturas y gastos."
            }
            empty="Sin facturas"
          />
          {all.outstanding > 0 && (
            <p className="m-0 text-sm">
              <span className="text-muted-foreground">
                {role === "client" ? "Pendiente de cobro: " : "Pendiente de pago: "}
              </span>
              <span className="amount font-semibold">{formatEUR(all.outstanding)}</span>
            </p>
          )}
        </div>
      </InfoCard>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <InfoCard title="Toda la relación" index={1}>
          <SummaryTable summary={all} kinds={kinds} />
        </InfoCard>
        <InfoCard title={`Periodo ${periodCode(period)}`} index={2}>
          <PeriodSelect
            value={period}
            onChange={setPeriod}
            years={availableYears}
            today={today}
            className="self-start"
          />
          <MonthlyBars role={role} rows={rows} period={period} />
          <SummaryTable summary={inPeriod} kinds={kinds} />
        </InfoCard>
      </div>
    </div>
  );
}

function Ratio({ label, value, help, empty }: { label: string; value: number | null; help: string; empty: string }) {
  const percent = value === null ? null : Math.round(value * 100);
  return (
    <div className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[16rem_minmax(0,20rem)_auto]">
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="cursor-help text-sm">
            {label}: <span className="amount font-semibold">{percent === null ? empty : `${percent} %`}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{help}</TooltipContent>
      </Tooltip>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? 0}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full animate-reveal-x rounded-full",
            percent !== null && percent >= 80 ? "bg-success" : "bg-warning",
          )}
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function SummaryTable({ summary, kinds }: { summary: ActivitySummary; kinds: ActivityKind[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className={table.headRow}>
            <th className={table.th}>Documento</th>
            <th className={cn(table.th, "text-right")}>Número</th>
            <th className={cn(table.th, "text-right")}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {kinds.map((k) => (
            <tr key={k} className={table.row}>
              <td className={table.td}>{ACTIVITY_KIND_LABELS[k]}</td>
              <td className={cn(table.td, "text-right amount")}>{summary.byKind[k]?.count ?? 0}</td>
              <td className={cn(table.td, "text-right amount")}>{formatEUR(summary.byKind[k]?.total ?? cents(0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Invoiced (or spent) per month of the period. */
function MonthlyBars({ role, rows, period }: { role: ContactRole; rows: ActivityRow[]; period: Period }) {
  const counted: ActivityKind[] = role === "client" ? ["invoice"] : ["purchase", "expense"];
  const months = periodMonths(period).map((m) => ({
    month: m,
    total: rows
      .filter(
        (r) =>
          counted.includes(r.kind) &&
          Number(r.date.slice(0, 4)) === period.year &&
          Number(r.date.slice(5, 7)) - 1 === m,
      )
      .reduce((s, r) => cents(s + r.total), cents(0)),
  }));
  const max = Math.max(...months.map((m) => m.total), 0);
  if (max <= 0)
    return (
      <p className="m-0 text-sm text-muted-foreground">
        Sin {role === "client" ? "facturación" : "gastos"} en este periodo.
      </p>
    );
  return (
    <figure className="m-0 flex flex-col gap-1">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {role === "client" ? "Facturado por mes" : "Gastado por mes"}
      </figcaption>
      <ol className="m-0 flex h-32 list-none items-end gap-1.5 p-0">
        {months.map((m, i) => (
          <li key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={`${MONTHS_SHORT[m.month]}: ${formatEUR(m.total)}`}
                  className={cn(
                    "w-full max-w-10 origin-bottom animate-grow-up rounded-t-sm",
                    role === "client" ? "bg-chart-income" : "bg-chart-expense",
                  )}
                  style={{ height: `${Math.max(2, (m.total / max) * 100)}%`, animationDelay: `${i * 30}ms` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {MONTHS_SHORT[m.month]} · <span className="amount">{formatEUR(m.total)}</span>
              </TooltipContent>
            </Tooltip>
            <span className="text-2xs text-muted-foreground">{MONTHS_SHORT[m.month]}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
