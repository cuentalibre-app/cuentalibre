import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  FilePlus2,
  FileX2,
  MoreHorizontal,
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
import { periodMonths, type Period } from "@fiscalia/core";
import { Badge } from "@fiscalia/ui/components/badge";
import { Button, buttonVariants } from "@fiscalia/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fiscalia/ui/components/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@fiscalia/ui/components/select";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { PeriodSelect } from "@/components/period-select";
import { formatDate, formatShortDate, periodCode, periodRange } from "@/lib/format";
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
    return periodRows.filter(
      (r) =>
        (status === ALL || r.status === status) &&
        (!q || [r.doc.number ?? "", r.client.name, r.client.taxId].some((v) => v.toLowerCase().includes(q))),
    );
  }, [periodRows, query, status]);

  const filtered = query.trim() !== "" || status !== ALL;

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 lg:gap-6 lg:px-10 lg:pt-8 lg:pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          <h1 className="m-0 w-full text-2xl font-semibold tracking-tight sm:w-auto lg:text-3xl">{config.title}</h1>
          <PeriodSelect value={period} onChange={setPeriod} years={availableYears} today={today} />
          <span className="text-sm text-muted-foreground">{periodRange(period)}</span>
        </div>
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
        <div className="flex flex-wrap items-center gap-2.5 pb-3 lg:px-5 lg:py-4">
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
          <Button
            variant="secondary"
            size="md"
            className="ml-auto"
            disabled={rows.length === 0}
            onClick={() => downloadCsv(rows, `${config.title} ${periodCode(period)}`)}
          >
            <Download strokeWidth={1.8} aria-hidden="true" />
            Exportar
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            message={filtered ? "Ningún resultado coincide con la búsqueda." : config.empty}
            hint={
              filtered ? "Prueba con otro término o estado." : "Puedes cambiar el periodo con el selector de arriba."
            }
            action={
              !filtered && (
                <Link to={config.newPath} className="font-medium text-primary no-underline hover:text-primary-hover">
                  {config.newLabel}
                </Link>
              )
            }
          />
        ) : (
          <>
            <DocumentsTable kind={kind} rows={rows} />
            <DocumentsList rows={rows} />
          </>
        )}
      </section>

    </div>
  );
}

function InvoiceSummary({ rows }: { rows: Row[] }) {
  const of = (statuses: StatusKey[]) => rows.filter((r) => statuses.includes(r.status));
  const stats = [
    {
      label: "Facturado",
      value: sum(rows, "total"),
      detail: `${rows.length} facturas · base ${formatEUR(sum(rows, "base"))}`,
    },
    { label: "Cobrado", value: sum(of(["paid"]), "total"), detail: `${of(["paid"]).length} facturas` },
    {
      label: "Pendiente de cobro",
      value: sum(of(["pending", "overdue"]), "total"),
      detail: `${of(["pending"]).length} en plazo`,
    },
    {
      label: "Vencido",
      value: sum(of(["overdue"]), "total"),
      detail: `${of(["overdue"]).length} sin cobrar`,
      danger: true,
    },
  ];
  return (
    <dl className="m-0 grid animate-rise-in grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3.5 lg:px-5 lg:py-4">
          <dt className="text-sm text-muted-foreground">{s.label}</dt>
          <dd className={cn("amount m-0 text-xl font-semibold", s.danger && s.value > 0 && "text-destructive")}>
            {formatEUR(s.value)}
          </dd>
          <dd className="m-0 text-xs text-muted-foreground">{s.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

const amountHeaders = ["Base imponible", "IVA", "Retención", "Total"] as const;

function DocumentsTable({ kind, rows }: { kind: SalesKind; rows: Row[] }) {
  const th = "border-y border-border px-4 py-2.5 font-medium first:pl-5 last:pr-5";
  const td = "px-4 py-3 first:pl-5 last:pr-5";
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[880px] border-collapse">
        <thead>
          <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th scope="col" className={th}>
              Nº
            </th>
            <th scope="col" className={th}>
              Fecha
            </th>
            <th scope="col" className={th}>
              Cliente
            </th>
            <th scope="col" className={th}>
              Estado
            </th>
            {amountHeaders.map((h) => (
              <th key={h} scope="col" className={cn(th, "text-right")}>
                {h}
              </th>
            ))}
            <th scope="col" className={th}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.doc.id}
              className={cn(
                "border-b border-divider transition-colors duration-150 hover:bg-muted",
                r.status === "overdue" && "bg-destructive-soft/40",
              )}
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
                  <span className="font-medium">{r.client.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.client.taxId}</span>
                </div>
              </td>
              <td className={td}>
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
              </td>
              <td className={cn(td, "amount text-right")}>{formatEUR(r.base)}</td>
              <td className={cn(td, "amount text-right text-muted-foreground")}>{formatEUR(r.vat)}</td>
              <td className={cn(td, "amount text-right text-muted-foreground")}>
                {r.withholding ? formatEUR(-r.withholding) : "—"}
              </td>
              <td className={cn(td, "amount text-right font-semibold")}>{formatEUR(r.total)}</td>
              <td className={cn(td, "w-12 text-right")}>
                <RowActions doc={r.doc} status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted font-semibold">
            <td colSpan={4} className={cn(td, "text-sm text-muted-foreground")}>
              {rows.length} {rows.length === 1 ? "documento" : "documentos"}
            </td>
            <td className={cn(td, "amount text-right")}>{formatEUR(sum(rows, "base"))}</td>
            <td className={cn(td, "amount text-right")}>{formatEUR(sum(rows, "vat"))}</td>
            <td className={cn(td, "amount text-right")}>{formatEUR(-sum(rows, "withholding"))}</td>
            <td className={cn(td, "amount text-right")}>{formatEUR(sum(rows, "total"))}</td>
            <td className={td} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DocumentsList({ rows }: { rows: Row[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
      {rows.map((r) => (
        <li key={r.doc.id} className="flex items-center gap-1 border-b border-divider">
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
          Total <span className="amount font-semibold text-foreground">{formatEUR(sum(rows, "total"))}</span>
        </span>
      </li>
    </ul>
  );
}

function RowActions({ doc, status }: { doc: SalesDocument; status: StatusKey }) {
  const navigate = useNavigate();
  const config = KINDS[doc.kind];
  const label = doc.number ?? "sin número";

  const remove = () => {
    if (window.confirm(`¿Eliminar ${config.noun} ${label}? No se puede deshacer.`)) salesStore.remove(doc.id);
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
  const transitions: { to: SalesDocument["status"]; label: string; icon: typeof Send }[] = [
    { to: "sent", label: "Marcar como enviado", icon: Send },
    { to: "accepted", label: "Marcar como aceptado", icon: ThumbsUp },
    { to: "rejected", label: "Marcar como rechazado", icon: ThumbsDown },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Acciones de ${config.noun} ${label}`}>
          <MoreHorizontal strokeWidth={1.8} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => navigate(`${config.path}/${doc.id}`)}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        {doc.kind === "draft" && (
          <DropdownMenuItem onSelect={issueDraft}>
            <ReceiptText aria-hidden="true" />
            Emitir factura
          </DropdownMenuItem>
        )}
        {doc.kind === "invoice" &&
          (doc.status === "paid" ? (
            <DropdownMenuItem onSelect={() => salesStore.update(doc.id, { status: "pending" })}>
              <Undo2 aria-hidden="true" />
              Marcar como pendiente
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => salesStore.update(doc.id, { status: "paid" })}>
              <CircleDollarSign aria-hidden="true" />
              Marcar como cobrada
            </DropdownMenuItem>
          ))}
        {workflow && status !== "invoiced" && (
          <>
            <DropdownMenuItem onSelect={() => navigate(`${KINDS.invoice.newPath}?desde=${doc.id}`)}>
              <ReceiptText aria-hidden="true" />
              Convertir en factura
            </DropdownMenuItem>
            {transitions
              .filter((t) => t.to !== status)
              .map((t) => (
                <DropdownMenuItem key={t.to} onSelect={() => salesStore.update(doc.id, { status: t.to })}>
                  <t.icon aria-hidden="true" />
                  {t.label}
                </DropdownMenuItem>
              ))}
          </>
        )}
        <DropdownMenuItem onSelect={() => navigate(`${config.newPath}?desde=${doc.id}`)}>
          <Copy aria-hidden="true" />
          Duplicar
        </DropdownMenuItem>
        {doc.kind === "invoice" && doc.series === "normal" && (
          <DropdownMenuItem onSelect={() => navigate(`${config.newPath}?desde=${doc.id}&rectificar=1`)}>
            <FileX2 aria-hidden="true" />
            Crear rectificativa
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={remove} className="text-destructive [&_svg]:text-destructive">
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({ message, hint, action }: { message: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 border-t border-border px-5 py-14 text-center">
      <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {action ? <FilePlus2 strokeWidth={1.8} aria-hidden="true" /> : <Search strokeWidth={1.8} aria-hidden="true" />}
      </span>
      <p className="m-0 font-medium">{message}</p>
      <p className="m-0 text-sm text-muted-foreground">{hint}</p>
      {action}
    </div>
  );
}

/** Semicolon-separated with decimal commas, so Excel in Spanish opens it as-is. */
function downloadCsv(rows: Row[], name: string) {
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const lines = [
    ["Número", "Fecha", "Cliente", "NIF", "Estado", "Base imponible", "IVA", "Retención", "Total"],
    ...rows.map((r) => [
      r.doc.number ?? "",
      r.doc.issuedOn,
      r.client.name,
      r.client.taxId,
      STATUS[r.status].label,
      num(r.base),
      num(r.vat),
      num(r.withholding),
      num(r.total),
    ]),
  ].map((cells) => cells.map((c) => `"${c.replaceAll('"', '""')}"`).join(";"));

  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `${name.toLowerCase().replaceAll(" ", "-")}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
