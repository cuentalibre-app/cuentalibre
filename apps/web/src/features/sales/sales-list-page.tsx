import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  FileArchive,
  FileCode2,
  FileDown,
  FileX2,
  Mail,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { cents, periodKey, periodMonths, sumBy, toIsoDate, type Cents, type Period } from "@fiscalia/core";
import type { SalesDocument, SalesKind } from "@fiscalia/contracts";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import { DropdownMenuTrigger } from "@fiscalia/ui/components/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@fiscalia/ui/components/select";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@fiscalia/ui/components/tooltip";
import { useLockedQuarter } from "@/features/closing/closing-store";
import { AnimatedAmount } from "@/components/animated-amount";
import { PeriodSelect } from "@/components/period-select";
import { formatDate, formatPercent, formatShortDate, periodCode } from "@/lib/format";
import { usePeriod } from "@/lib/use-period";
import { availableYears } from "@/mocks/data";
import {
  KINDS,
  STATUS,
  clientOf,
  displayStatus,
  documentTotals,
  laterInvoice,
  nextNumber,
  outstandingOf,
  periodKeyOf,
  type StatusKey,
} from "./sales-model";
import { canSendEmail } from "@/data/email";
import { PaymentDialog, SendDialog, sendWithMailClient, TagsDialog } from "./document-dialogs";
import { AttachmentsDialog } from "@/features/purchases/form-parts";
import { OPEN_STATUSES, listPreferencesStore } from "./list-preferences";
import { ActionsMenu, EmptyState, IconAction, SortHeader, downloadCsv, type Action } from "./list-parts";
import { salesStore, useSalesDocuments } from "./sales-store";

const ALL = "all";
/** Status filter for the quotes and delivery notes not invoiced or rejected yet. */
const OPEN = "open";

interface Row {
  doc: SalesDocument;
  client: { name: string; taxId: string };
  status: StatusKey;
  base: Cents;
  vat: Cents;
  withholding: Cents;
  total: Cents;
  /** What is still to be collected of an invoice. */
  outstanding: Cents;
}

const MONTH_NAME = new Intl.DateTimeFormat("es-ES", { month: "long" });

const isOpen = (status: StatusKey) => (OPEN_STATUSES as StatusKey[]).includes(status);

function inPeriod(isoDate: string, period: Period): boolean {
  const [year, month] = isoDate.split("-").map(Number);
  return year === period.year && periodMonths(period).includes(month! - 1);
}

function sum(rows: Row[], key: "base" | "vat" | "withholding" | "total" | "outstanding") {
  return sumBy(rows, (r) => r[key]);
}

export function SalesListPage({ kind }: { kind: SalesKind }) {
  const config = KINDS[kind];
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const [query, setQuery] = useState("");
  // Quotes and delivery notes open with the default filters of "Ordenación y filtrado"
  const defaults = kind === "quote" || kind === "deliveryNote" ? listPreferencesStore.get()[kind] : null;
  const [status, setStatus] = useState<string>(defaults?.status === "open" ? OPEN : ALL);
  const [thisMonth, setThisMonth] = useState(defaults?.date === "month");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const documents = useSalesDocuments();

  // The month filter replaces the period until another period is picked
  const monthPrefix = toIsoDate(today).slice(0, 7);
  const periodRows = useMemo(
    () =>
      documents
        .filter(
          (d) => d.kind === kind && (thisMonth ? d.issuedOn.startsWith(monthPrefix) : inPeriod(d.issuedOn, period)),
        )
        .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || (b.number ?? "").localeCompare(a.number ?? ""))
        .map((doc): Row => ({
          doc,
          client: clientOf(doc),
          status: displayStatus(doc, today),
          ...documentTotals(doc),
          outstanding: doc.kind === "invoice" ? outstandingOf(doc) : cents(0),
        })),
    [documents, kind, period, today, thisMonth, monthPrefix],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = periodRows.filter(
      (r) =>
        (status === ALL || r.status === status || (status === OPEN && isOpen(r.status))) &&
        (!q || [r.doc.number ?? "", r.client.name, r.client.taxId].some((v) => v.toLowerCase().includes(q))),
    );
    return sortRows(matching, sort);
  }, [periodRows, query, status, sort]);

  const filtered = query.trim() !== "" || status !== ALL || thisMonth;
  const exportName = `${config.title} ${periodCode(period)}`.toLowerCase().replaceAll(" ", "-");
  const [exporting, setExporting] = useState(false);

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-4 lg:px-8 lg:pt-6 lg:pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">{config.title}</h1>
        <Link to={config.newPath} className={cn(buttonVariants(), "hidden no-underline lg:inline-flex")}>
          <Plus strokeWidth={2} aria-hidden="true" />
          {config.newLabel}
        </Link>
      </header>

      {kind === "invoice" && <InvoiceSummary rows={periodRows} />}

      <section
        aria-label={`Listado de ${config.title.toLowerCase()}`}
        className="flex animate-rise-in flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-border"
        style={{ "--i": 1 } as CSSProperties}
      >
        <div className="flex flex-wrap items-center gap-2.5 pb-3 lg:px-4 lg:py-3">
          <div className="flex h-10 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-lg border border-input px-3 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring lg:max-w-80">
            <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, cliente o NIF"
              aria-label="Buscar"
              className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          {config.statuses.length > 0 && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Filtrar por estado" className="min-w-44 font-medium">
                <span className="flex-1 text-left">
                  <SelectValue />
                </span>
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los estados</SelectItem>
                {defaults && <SelectItem value={OPEN}>Pendientes</SelectItem>}
                {config.statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <PeriodSelect
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setThisMonth(false);
            }}
            years={availableYears}
            today={today}
          />
          {thisMonth && (
            <button
              type="button"
              onClick={() => setThisMonth(false)}
              aria-label="Quitar el filtro del mes en curso"
              className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-primary-soft px-3 text-sm font-medium text-primary hover:bg-accent"
            >
              Solo {MONTH_NAME.format(today)}
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="md"
              disabled={rows.length === 0}
              onClick={() => exportCsv(rows, exportName)}
            >
              <Download strokeWidth={1.8} aria-hidden="true" />
              CSV
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={rows.length === 0 || exporting}
              aria-label={`Descargar ${rows.length} PDF en un .zip`}
              title="Un PDF por documento, en un .zip"
              onClick={async () => {
                setExporting(true);
                try {
                  const { downloadPdfZip } = await import("./sales-pdf");
                  downloadPdfZip(
                    rows.map((r) => r.doc),
                    exportName,
                  );
                } finally {
                  setExporting(false);
                }
              }}
            >
              <FileArchive strokeWidth={1.8} aria-hidden="true" />
              PDF (.zip)
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            message={filtered ? "Ningún resultado coincide con la búsqueda." : config.empty}
            hint={filtered ? "Prueba con otro término o estado." : "Puedes cambiar el periodo en el selector."}
            action={
              !filtered && (
                <Link to={config.newPath} className={cn(buttonVariants({ variant: "secondary" }), "mt-3 no-underline")}>
                  <Plus strokeWidth={2} aria-hidden="true" />
                  {config.newLabel}
                </Link>
              )
            }
          />
        ) : (
          <>
            {/* Keyed by period so the rows replay their entrance when it changes, like the dashboard */}
            <DocumentsTable key={`table-${periodKey(period)}`} kind={kind} rows={rows} sort={sort} onSort={setSort} />
            <DocumentsList key={`list-${periodKey(period)}`} rows={rows} />
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Same figures as the dashboard for the same period: "Ingresos" is the taxable base (as in
 * Inicio) and the collection cards use totals with VAT (as in its "Estado de cobro").
 */
function InvoiceSummary({ rows }: { rows: Row[] }) {
  const of = (statuses: StatusKey[]) => rows.filter((r) => statuses.includes(r.status));
  const invoices = (n: number) => (n === 1 ? "1 factura" : `${n} facturas`);
  const total = sum(rows, "total");
  const pending = sum(rows, "outstanding");
  const paid = cents(total - pending);
  const overdue = sum(of(["overdue"]), "outstanding");
  const stats: { label: string; value: Cents; detail: ReactNode }[] = [
    {
      label: "Ingresos",
      value: sum(rows, "base"),
      detail: `Sin IVA · IVA repercutido ${formatEUR(sum(rows, "vat"))}`,
    },
    {
      label: "Total facturado",
      value: total,
      detail: `${invoices(rows.length)} · con IVA y retención`,
    },
    {
      label: "Cobrado",
      value: paid,
      detail: `${invoices(of(["paid"]).length)} · ${formatPercent(total ? (paid / total) * 100 : 0)}`,
    },
    {
      label: "Pendiente de cobro",
      value: pending,
      detail:
        overdue > 0 ? (
          <span className="text-destructive">{formatEUR(overdue)} vencido</span>
        ) : (
          `${invoices(of(["pending", "partial"]).length)} en plazo`
        ),
    },
  ];
  return (
    <dl className="m-0 grid animate-rise-in grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3.5 lg:px-4 lg:py-3">
          <dt className="text-md font-semibold text-foreground lg:text-lg">{s.label}</dt>
          <dd className="m-0 amount text-xl font-semibold">
            <AnimatedAmount value={s.value} />
          </dd>
          <dd className="m-0 text-sm text-muted-foreground">{s.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

type SortKey = "number" | "date" | "client" | "status" | "base" | "vat" | "withholding" | "total";
type SortDir = "asc" | "desc";
interface Sort {
  key: SortKey;
  dir: SortDir;
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "number", label: "Nº" },
  { key: "date", label: "Fecha" },
  { key: "client", label: "Cliente" },
  { key: "status", label: "Estado" },
  { key: "base", label: "Base\nimponible", numeric: true },
  { key: "vat", label: "IVA", numeric: true },
  { key: "withholding", label: "Retención", numeric: true },
  { key: "total", label: "Total", numeric: true },
];

const byText = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  number: (a, b) => byText(a.doc.number ?? "", b.doc.number ?? ""),
  date: (a, b) => a.doc.issuedOn.localeCompare(b.doc.issuedOn) || byText(a.doc.number ?? "", b.doc.number ?? ""),
  client: (a, b) => byText(a.client.name, b.client.name),
  status: (a, b) => byText(STATUS[a.status].label, STATUS[b.status].label),
  base: (a, b) => a.base - b.base,
  vat: (a, b) => a.vat - b.vat,
  withholding: (a, b) => a.withholding - b.withholding,
  total: (a, b) => a.total - b.total,
};

const DEFAULT_SORT: Sort = { key: "date", dir: "desc" };

function sortRows(rows: Row[], sort: Sort): Row[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * COMPARE[sort.key](a, b));
}

/** Clicking the active column flips it; a new column starts with the most useful direction. */
function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  const textual = key === "client" || key === "status" || key === "number";
  return { key, dir: textual && key !== "number" ? "asc" : "desc" };
}

function DocumentsTable({
  kind,
  rows,
  sort,
  onSort,
}: {
  kind: SalesKind;
  rows: Row[];
  sort: Sort;
  onSort: (sort: Sort) => void;
}) {
  // Tighter than the default so nine columns fit on a laptop screen.
  const th = cn(table.th, "px-3");
  const td = cn(table.td, "px-3");
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={300}>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              {COLUMNS.map((c) => (
                <SortHeader
                  key={c.key}
                  label={c.label}
                  numeric={c.numeric}
                  dir={sort.key === c.key ? sort.dir : null}
                  onClick={() => onSort(nextSort(sort, c.key))}
                  className={th}
                />
              ))}
              <th scope="col" className={cn(th, "text-center")}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.doc.id}
                className={cn(table.row, "animate-row-in", r.status === "overdue" && "bg-destructive-soft/40")}
                style={{ "--i": i } as CSSProperties}
              >
                <td className={cn(td, "font-mono text-sm whitespace-nowrap")}>
                  <Link
                    to={`${KINDS[kind].path}/${r.doc.id}`}
                    className="text-foreground no-underline hover:text-primary"
                  >
                    {r.doc.number ?? <span className="font-sans text-muted-foreground">Sin número</span>}
                  </Link>
                </td>
                <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDate(r.doc.issuedOn)}</td>
                <td className={td}>
                  <div className="flex flex-col">
                    <span className="font-medium whitespace-nowrap">{r.client.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{r.client.taxId}</span>
                  </div>
                </td>
                <td className={td}>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </td>
                <td className={cn(td, "text-right amount")}>{formatEUR(r.base)}</td>
                <td className={cn(td, "text-right amount text-muted-foreground")}>{formatEUR(r.vat)}</td>
                <td className={cn(td, "text-right amount text-muted-foreground")}>
                  {r.withholding ? formatEUR(cents(-r.withholding)) : "—"}
                </td>
                <td className={cn(td, "text-right amount font-semibold")}>{formatEUR(r.total)}</td>
                <td className={cn(td, "px-1.5 first:pl-1.5 last:pr-1.5")}>
                  <QuickActions doc={r.doc} status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted font-semibold">
              <td colSpan={4} className={cn(td, "text-sm text-muted-foreground")}>
                {rows.length} {rows.length === 1 ? "documento" : "documentos"}
              </td>
              <td className={cn(td, "text-right amount")}>
                <AnimatedAmount value={sum(rows, "base")} />
              </td>
              <td className={cn(td, "text-right amount")}>
                <AnimatedAmount value={sum(rows, "vat")} />
              </td>
              <td className={cn(td, "text-right amount")}>
                <AnimatedAmount value={cents(-sum(rows, "withholding"))} />
              </td>
              <td className={cn(td, "text-right amount")}>
                <AnimatedAmount value={sum(rows, "total")} />
              </td>
              <td className={td} />
            </tr>
          </tfoot>
        </table>
      </div>
    </TooltipProvider>
  );
}

function DocumentsList({ rows }: { rows: Row[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
      {rows.map((r, i) => (
        <li
          key={r.doc.id}
          className="flex animate-row-in items-center gap-1 border-b border-divider"
          style={{ "--i": i } as CSSProperties}
        >
          <Link
            to={`${KINDS[r.doc.kind].path}/${r.doc.id}`}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-3 text-foreground no-underline transition-opacity duration-150 active:opacity-60"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{r.client.name}</span>
              <span className="text-sm text-muted-foreground">
                {r.doc.number ?? "Sin número"} · {formatShortDate(r.doc.issuedOn)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="amount text-base">{formatEUR(r.total)}</span>
              <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
            </div>
          </Link>
          <RowActions doc={r.doc} status={r.status} />
        </li>
      ))}
      <li className="flex justify-between py-3 text-sm text-muted-foreground">
        <span>
          {rows.length} {rows.length === 1 ? "documento" : "documentos"}
        </span>
        <span>
          Total <AnimatedAmount value={sum(rows, "total")} className="amount font-semibold text-foreground" />
        </span>
      </li>
    </ul>
  );
}

/** Every operation available on a document, grouped so the menu can split them with separators. */
function useDocumentActions(doc: SalesDocument, status: StatusKey) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"payment" | "attachments" | "tags" | "send" | null>(null);
  const config = KINDS[doc.kind];
  const label = doc.number ?? "sin número";
  const attachments = doc.attachments ?? [];
  // Drafts can't be issued into a closed quarter
  const lockedQuarter = useLockedQuarter()(doc.issuedOn);

  const attach: Action = {
    label: attachments.length > 0 ? `Documentos adjuntos (${attachments.length})` : "Adjuntar documentos",
    icon: Paperclip,
    run: () => setDialog("attachments"),
  };

  const pdf: Action = {
    label: "Descargar PDF",
    icon: FileDown,
    run: () => void import("./sales-pdf").then((m) => m.downloadDocumentPdf(doc)),
  };

  const tags = doc.tags ?? [];
  const extras = {
    view: {
      label: `Ver ${config.singular.toLowerCase()} ${doc.number ?? ""}`.trim(),
      icon: ArrowRight,
      run: () => {
        // Opened now, while the click still counts, and filled once the PDF code loads
        const tab = window.open("", "_blank");
        if (tab) void import("./sales-pdf").then((m) => m.showDocumentPdf(doc, tab));
      },
    },
    payments: {
      label: "Gestionar el cobro",
      icon: CircleDollarSign,
      run: () => setDialog("payment"),
    },
    tags: {
      label: tags.length > 0 ? `Gestionar etiquetas (${tags.length})` : "Gestionar etiquetas",
      icon: Tag,
      run: () => setDialog("tags"),
    },
    facturae: {
      label: "Exportar Facturae",
      icon: FileCode2,
      run: () =>
        void import("./sales-facturae").then((m) => {
          const problems = m.facturaeProblems(doc);
          if (problems.length > 0) window.alert(`Para exportar la factura en Facturae falta ${problems.join(" y ")}.`);
          else m.downloadFacturae(doc);
        }),
    },
    send: {
      label: `Enviar ${config.singular.toLowerCase()}`,
      icon: Mail,
      run: () => (canSendEmail() ? setDialog("send") : sendWithMailClient(doc)),
    },
  } satisfies Record<string, Action>;

  const issueDraft = () => {
    const later = laterInvoice(doc.series, doc.issuedOn, salesStore.all());
    if (later) {
      window.alert(
        `No se puede emitir: la factura ${later.number} de esta serie es del ${formatDate(later.issuedOn)} y este borrador tiene una fecha anterior. Cambia su fecha antes de emitirlo.`,
      );
      return;
    }
    salesStore.issue({
      ...doc,
      kind: "invoice",
      status: "pending",
      number: nextNumber("invoice", doc.series, doc.issuedOn, salesStore.all()),
    });
    navigate(`${KINDS.invoice.path}?periodo=${periodKeyOf(doc.issuedOn)}`);
  };

  const workflow = doc.kind === "quote" || doc.kind === "deliveryNote";
  let primary: Action | null = null;
  if (doc.kind === "invoice") {
    primary = extras.payments;
  } else if (doc.kind === "draft") {
    primary = lockedQuarter
      ? { label: "Emitir factura (trimestre cerrado)", icon: ReceiptText }
      : { label: "Emitir factura", icon: ReceiptText, run: issueDraft };
  } else if (workflow && status !== "invoiced") {
    primary = {
      label: "Convertir en factura",
      icon: ReceiptText,
      run: () => navigate(`${KINDS.invoice.newPath}?desde=${doc.id}`),
    };
  }

  const transitions: Action[] = workflow
    ? (
        [
          { to: "sent", label: "Marcar como enviado", icon: Send },
          { to: "accepted", label: "Marcar como aceptado", icon: ThumbsUp },
          { to: "rejected", label: "Marcar como rechazado", icon: ThumbsDown },
        ] as const
      )
        .filter((t) => t.to !== status)
        .map((t) => ({ label: t.label, icon: t.icon, run: () => salesStore.update(doc.id, { status: t.to }) }))
    : [];

  const isInvoice = doc.kind === "invoice";
  const groups: Action[][] = [
    [
      extras.view,
      {
        label: isInvoice ? `Ver los datos de ${config.noun}` : `Editar ${config.singular.toLowerCase()}`,
        icon: Pencil,
        run: () => navigate(`${config.path}/${doc.id}`),
      },
      { label: "Crear por copia", icon: Copy, run: () => navigate(`${config.newPath}?desde=${doc.id}`) },
    ],
    [...(primary ? [primary] : []), ...transitions, attach, extras.tags],
    [pdf, ...(isInvoice ? [extras.facturae] : []), extras.send],
    isInvoice && doc.series === "normal"
      ? [
          {
            label: "Generar factura rectificativa",
            icon: FileX2,
            run: () => navigate(`${config.newPath}?desde=${doc.id}&rectificar=1`),
          },
        ]
      : [],
    // Issued invoices are never deleted: they are corrected with a rectifying invoice
    isInvoice
      ? []
      : [
          {
            label: `Eliminar ${config.singular.toLowerCase()} ${doc.number ?? ""}`.trim(),
            icon: Trash2,
            danger: true,
            run: () => {
              if (window.confirm(`¿Eliminar ${config.noun} ${label}? No se puede deshacer.`)) salesStore.remove(doc.id);
            },
          },
        ],
  ].filter((g) => g.length > 0);

  const close = (open: boolean) => !open && setDialog(null);
  const dialogs =
    dialog === "payment" ? (
      <PaymentDialog doc={doc} onOpenChange={close} />
    ) : dialog === "attachments" ? (
      <AttachmentsDialog
        title={`Documentos de ${config.noun} ${label}`}
        attachments={attachments}
        examples="Contratos, albaranes firmados, pedidos del cliente…"
        onChange={(next) => salesStore.update(doc.id, { attachments: next })}
        onOpenChange={close}
      />
    ) : dialog === "tags" ? (
      <TagsDialog doc={doc} title={`${config.noun} ${label}`} onOpenChange={close} />
    ) : dialog === "send" ? (
      <SendDialog doc={doc} onOpenChange={close} />
    ) : null;

  return {
    attach,
    pdf,
    primary,
    groups,
    dialogs,
    attachments: attachments.length,
    label: `${config.noun} ${label}`,
  };
}

/** Desktop: the usual operations one click away, the rest behind the arrow. */
function QuickActions({ doc, status }: { doc: SalesDocument; status: StatusKey }) {
  const { attach, pdf, primary, groups, dialogs, attachments, label } = useDocumentActions(doc, status);
  return (
    <div className="flex items-center justify-center gap-0.5">
      {dialogs}
      <IconAction action={attach} badge={attachments} />
      <IconAction action={pdf} />
      {primary ? <IconAction action={primary} /> : <span className="size-8" aria-hidden="true" />}
      <ActionsMenu
        groups={groups}
        trigger={
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-8 px-0" aria-label={`Más acciones de ${label}`}>
                  <ChevronDown strokeWidth={1.8} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Más acciones</TooltipContent>
          </Tooltip>
        }
      />
    </div>
  );
}

/** Mobile: everything in one menu. */
function RowActions({ doc, status }: { doc: SalesDocument; status: StatusKey }) {
  const { groups, dialogs, label } = useDocumentActions(doc, status);
  return (
    <>
      {dialogs}
      <ActionsMenu
        groups={groups}
        trigger={
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Acciones de ${label}`}>
              <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        }
      />
    </>
  );
}

function exportCsv(rows: Row[], name: string) {
  downloadCsv(
    ["Número", "Fecha", "Cliente", "NIF", "Estado", "Base imponible", "IVA", "Retención", "Total"],
    rows.map((r) => [
      r.doc.number ?? "",
      r.doc.issuedOn,
      r.client.name,
      r.client.taxId,
      STATUS[r.status].label,
      r.base,
      r.vat,
      r.withholding,
      r.total,
    ]),
    name,
  );
}
