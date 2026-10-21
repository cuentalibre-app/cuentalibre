import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Check, ChevronRight, Copy } from "lucide-react";
import { cents, sumBy, type Cents } from "@cuentalibre/core";
import { cn } from "@cuentalibre/ui/lib/cn";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { table } from "@cuentalibre/ui/lib/table";
import { formatDate } from "@/lib/format";
import type { PartyBooks } from "./party-operations";
import { clipboardValue, useCopied } from "./tax-form";

/*
 * Records of the informative forms (perceptors of the 190, landlords of the 180, declared
 * parties of the 347, operators of the 349): one row each, every value copyable to type it in
 * the AEAT form, and the documents behind it one click away.
 */

export type RecordValue = { text: string; copy?: string; mono?: boolean; muted?: boolean } | { amount: Cents };

export interface RecordColumn {
  label: string;
  /** Amounts align right and add up in the footer. */
  amount?: boolean;
  /** Hidden below the large breakpoint, where the row folds into a card. */
  secondary?: boolean;
}

export interface RecordRow {
  id: string;
  /** Main line on mobile: usually the name. */
  title: string;
  values: RecordValue[];
  documentIds: string[];
}

const isAmount = (v: RecordValue): v is { amount: Cents } => "amount" in v;

function CopyValue({ value, copied, onCopy }: { value: RecordValue; copied: boolean; onCopy: () => void }) {
  const text = isAmount(value) ? formatEUR(value.amount) : value.text;
  if (!isAmount(value) && !value.text) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCopy();
      }}
      aria-label={`Copiar ${text}`}
      className={cn(
        "group inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors duration-150 hover:bg-accent",
        isAmount(value) && "amount",
        !isAmount(value) && value.mono && "font-mono text-sm",
        !isAmount(value) && value.muted && "text-muted-foreground",
        isAmount(value) && value.amount === 0 && "text-muted-foreground",
      )}
    >
      <span className="truncate">{text}</span>
      <span className="grid size-3.5 shrink-0 place-items-center text-muted-foreground" aria-hidden="true">
        {copied ? (
          <Check className="size-3.5 animate-fade-in text-success" strokeWidth={2} />
        ) : (
          <Copy
            className="size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            strokeWidth={1.8}
          />
        )}
      </span>
    </button>
  );
}

const copyText = (v: RecordValue) => (isAmount(v) ? clipboardValue(v.amount) : (v.copy ?? v.text));

function DocumentList({ books, ids }: { books: PartyBooks; ids: string[] }) {
  const docs = ids
    .map((id) => books.documents.get(id))
    .filter((d) => d !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));
  const amountOf = new Map(books.ops.map((o) => [o.id, o]));
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {docs.map((d) => {
        const op = amountOf.get(d.id);
        return (
          <li key={d.id}>
            <Link
              to={d.to}
              className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1 text-sm text-foreground no-underline hover:bg-accent"
            >
              <span className="text-muted-foreground">{formatDate(d.date)}</span>
              <span className="truncate">
                <span className="text-muted-foreground">{d.kind}</span>{" "}
                <span className="font-mono font-medium">{d.number || "sin número"}</span>
              </span>
              {op && (
                <span className="amount text-muted-foreground">
                  {formatEUR(op.base)}
                  {op.withholding !== 0 && <> · ret. {formatEUR(op.withholding)}</>}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RecordsTable({
  label,
  columns,
  rows,
  books,
  empty,
  footerLabel = "Total",
}: {
  label: string;
  columns: RecordColumn[];
  rows: RecordRow[];
  books: PartyBooks;
  empty: ReactNode;
  footerLabel?: string;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copied, copy] = useCopied();
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const totals = columns.map((c, i) =>
    c.amount
      ? sumBy(rows, (r) => (isAmount(r.values[i]!) ? (r.values[i] as { amount: Cents }).amount : cents(0)))
      : null,
  );
  const firstAmount = columns.findIndex((c) => c.amount);
  const th = cn(table.th, "px-2.5");
  const td = cn(table.td, "px-2.5");

  if (rows.length === 0) {
    return (
      <p className="m-0 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
        <table aria-label={label} className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className={table.headRow}>
              <th scope="col" className={cn(th, "w-8")}>
                <span className="sr-only">Documentos</span>
              </th>
              {columns.map((c) => (
                <th key={c.label} scope="col" className={cn(th, c.amount && "text-right")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const expanded = open.has(r.id);
              return (
                <Fragment key={r.id}>
                  <tr
                    className={cn(table.row, "animate-row-in cursor-pointer")}
                    style={{ "--i": i } as CSSProperties}
                    onClick={() => toggle(r.id)}
                  >
                    <td className={td}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Ocultar" : "Ver"} los ${r.documentIds.length} documentos de ${r.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(r.id);
                        }}
                        className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent"
                      >
                        <ChevronRight
                          className={cn("size-4 transition-transform duration-150", expanded && "rotate-90")}
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </button>
                    </td>
                    {r.values.map((v, j) => (
                      <td key={j} className={cn(td, columns[j]!.amount && "text-right whitespace-nowrap", "max-w-64")}>
                        <CopyValue
                          value={v}
                          copied={copied === `${r.id}:${j}`}
                          onCopy={() => copy(`${r.id}:${j}`, copyText(v))}
                        />
                      </td>
                    ))}
                  </tr>
                  {expanded && (
                    <tr className="border-b border-border bg-muted/40">
                      <td className={td} />
                      <td className={cn(td, "py-2")} colSpan={columns.length}>
                        <DocumentList books={books} ids={r.documentIds} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {firstAmount >= 0 && rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/50 font-semibold">
                <td className={td} colSpan={firstAmount + 1}>
                  {footerLabel}
                </td>
                {totals.slice(firstAmount).map((t, j) => (
                  <td key={j} className={cn(td, "text-right amount whitespace-nowrap")}>
                    {t === null ? null : <span className="pr-6">{formatEUR(t)}</span>}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ul aria-label={label} className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
        {rows.map((r) => {
          const expanded = open.has(r.id);
          return (
            <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-border p-3.5">
              <span className="font-medium">{r.title}</span>
              <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {r.values.map((v, j) => (
                  <div key={j} className={cn("flex min-w-0 flex-col", columns[j]!.secondary && "hidden sm:flex")}>
                    <dt className="text-xs text-muted-foreground">{columns[j]!.label}</dt>
                    <dd className="m-0 -ml-1 min-w-0">
                      <CopyValue
                        value={v}
                        copied={copied === `${r.id}:${j}`}
                        onCopy={() => copy(`${r.id}:${j}`, copyText(v))}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggle(r.id)}
                className="flex cursor-pointer items-center gap-1 self-start text-sm text-primary"
              >
                <ChevronRight
                  className={cn("size-4 transition-transform duration-150", expanded && "rotate-90")}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                {r.documentIds.length === 1 ? "1 documento" : `${r.documentIds.length} documentos`}
              </button>
              {expanded && <DocumentList books={books} ids={r.documentIds} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}
