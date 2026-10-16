import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  FileArchive,
  FileDown,
  FileX2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Undo2,
} from "lucide-react";
import { periodKey, periodMonths, type Period } from "@fiscalia/core";
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
import type { SalesDocument, SalesKind } from "@/mocks/sales";
import {
  KINDS,
  STATUS,
  clientOf,
  displayStatus,
  documentTotals,
  nextNumber,
  periodKeyOf,
  type StatusKey,
} from "./sales-model";
import { ActionsMenu, EmptyState, IconAction, SortHeader, downloadCsv, pickFiles, type Action } from "./list-parts";
import { salesStore, useSalesDocuments } from "./sales-store";

const ALL = "all";

interface Row {
  doc: SalesDocument;
  client: { name: string; taxId: string };
  status: StatusKey;
  base: number;
  vat: number;
  withholding: number;
  total: number;
}

function inPeriod(isoDate: string, period: Period): boolean {
  const [year, month] = isoDate.split("-").map(Number);
  return year === period.year && periodMonths(period).includes(month! - 1);
}

function sum(rows: Row[], key: "base" | "vat" | "withholding" | "total") {
  return rows.reduce((acc, r) => acc + r[key], 0);
}

export function SalesListPage({ kind }: { kind: SalesKind }) {
  const config = KINDS[kind];
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = usePeriod(today);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const documents = useSalesDocuments();

  const periodRows = useMemo(
    () =>
      documents
        .filter((d) => d.kind === kind && inPeriod(d.issuedOn, period))
        .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || (b.number ?? "").localeCompare(a.number ?? ""))
        .map((doc): Row => ({ doc, client: clientOf(doc), status: displayStatus(doc, today), ...documentTotals(doc) })),
    [documents, kind, period, today],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = periodRows.filter(
      (r) =>
        (status === ALL || r.status === status) &&
        (!q || [r.doc.number ?? "", r.client.name, r.client.taxId].some((v) => v.toLowerCase().includes(q))),
    );
    return sortRows(matching, sort);
  }, [periodRows, query, status, sort]);

  const filtered = query.trim() !== "" || status !== ALL;
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
                {config.statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
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
  const paid = sum(of(["paid"]), "total");
  const overdue = sum(of(["overdue"]), "total");
  const stats: { label: string; value: number; detail: ReactNode }[] = [
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
      value: sum(of(["pending", "overdue"]), "total"),
      detail:
        overdue > 0 ? (
          <span className="text-destructive">{formatEUR(overdue)} vencido</span>
        ) : (
          `${invoices(of(["pending"]).length)} en plazo`
        ),
    },
  ];
  return (
    <dl className="m-0 grid animate-rise-in grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3.5 lg:px-4 lg:py-3">
          <dt className="text-sm text-muted-foreground">{s.label}</dt>
          <dd className="m-0 amount text-xl font-semibold">
            <AnimatedAmount value={s.value} />
          </dd>
          <dd className="m-0 text-xs text-muted-foreground">{s.detail}</dd>
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
                  {r.withholding ? formatEUR(-r.withholding) : "—"}
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
                <AnimatedAmount value={-sum(rows, "withholding")} />
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
  const config = KINDS[doc.kind];
  const label = doc.number ?? "sin número";
  const attachments = doc.attachments ?? [];
  // Invoices of a closed quarter can't change, and drafts can't be issued into one
  const lockedQuarter = useLockedQuarter()(doc.issuedOn);
  const locked = doc.kind === "invoice" && lockedQuarter !== null;

  const attach: Action = {
    label: attachments.length > 0 ? `Adjuntar archivos (${attachments.length})` : "Adjuntar archivos",
    icon: Paperclip,
    run: () =>
      pickFiles((files) => {
        if (files.length === 0) return;
        const added = files.map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size }));
        salesStore.update(doc.id, { attachments: [...attachments, ...added] });
      }),
  };

  const pdf: Action = {
    label: "Descargar PDF",
    icon: FileDown,
    run: () => void import("./sales-pdf").then((m) => m.downloadDocumentPdf(doc)),
  };

  const issueDraft = () => {
    const year = Number(doc.issuedOn.slice(0, 4));
    salesStore.update(doc.id, {
      kind: "invoice",
      status: "pending",
      number: nextNumber("invoice", doc.series, year, salesStore.all()),
    });
    navigate(`${KINDS.invoice.path}?periodo=${periodKeyOf(doc.issuedOn)}`);
  };

  const workflow = doc.kind === "quote" || doc.kind === "deliveryNote";
  let primary: Action | null = null;
  if (doc.kind === "invoice") {
    primary =
      doc.status === "paid"
        ? { label: "Marcar como pendiente", icon: Undo2, run: () => salesStore.update(doc.id, { status: "pending" }) }
        : {
            label: "Marcar como cobrada",
            icon: CircleDollarSign,
            run: () => salesStore.update(doc.id, { status: "paid" }),
          };
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

  const groups: Action[][] = [
    [
      {
        label: `${locked ? "Ver" : "Editar"} ${config.singular.toLowerCase()}`,
        icon: Pencil,
        run: () => navigate(`${config.path}/${doc.id}`),
      },
      { label: "Crear por copia", icon: Copy, run: () => navigate(`${config.newPath}?desde=${doc.id}`) },
    ],
    [...(primary ? [primary] : []), ...transitions, attach, pdf],
    doc.kind === "invoice" && doc.series === "normal"
      ? [
          {
            label: "Generar factura rectificativa",
            icon: FileX2,
            run: () => navigate(`${config.newPath}?desde=${doc.id}&rectificar=1`),
          },
        ]
      : [],
    [
      {
        label:
          `Eliminar ${config.singular.toLowerCase()} ${doc.number ?? ""}`.trim() +
          (locked ? " (trimestre cerrado)" : ""),
        icon: Trash2,
        danger: true,
        run: locked
          ? undefined
          : () => {
              if (window.confirm(`¿Eliminar ${config.noun} ${label}? No se puede deshacer.`)) salesStore.remove(doc.id);
            },
      },
    ],
  ].filter((g) => g.length > 0);

  return { attach, pdf, primary, groups, attachments: attachments.length, label: `${config.noun} ${label}` };
}

/** Desktop: the usual operations one click away, the rest behind the arrow. */
function QuickActions({ doc, status }: { doc: SalesDocument; status: StatusKey }) {
  const { attach, pdf, primary, groups, attachments, label } = useDocumentActions(doc, status);
  return (
    <div className="flex items-center justify-center gap-0.5">
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
  const { groups, label } = useDocumentActions(doc, status);
  return (
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
