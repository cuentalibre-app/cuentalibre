import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { Link } from "react-router";
import { cents, eurosToCents, lineBase, type Cents, type InvoiceTotals } from "@fiscalia/core";
import type { Attachment, Contact, Payment, SalesLine } from "@fiscalia/contracts";
import { cn } from "@fiscalia/ui/lib/cn";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { table } from "@fiscalia/ui/lib/table";
import { countryOf } from "@/features/contacts/contacts-model";
import { AttachmentList } from "@/features/purchases/form-parts";
import { paymentMethodName } from "@/features/settings/settings-model";
import { formatDate } from "@/lib/format";
import { ratePercent } from "./sales-model";

/*
 * Building blocks of the detail dialogs opened from a document's number in the lists
 * (as the reference app's "Detalle de la factura"): read-only, with the edit form one click away.
 */

/**
 * The document's number in a list: a plain click opens its detail dialog, while a
 * modified or middle click keeps the link's default and opens the form in a new tab.
 */
export function DetailLink({ onOpen, ...props }: ComponentProps<typeof Link> & { onOpen: () => void }) {
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen();
  };
  return <Link {...props} aria-haspopup="dialog" onClick={open} />;
}

/**
 * For the dialog's `onOpenAutoFocus`: focuses the panel itself, so it opens to read
 * rather than with a ring on its first button. Tab still walks the buttons.
 */
export function focusPanel(event: Event) {
  event.preventDefault();
  (event.currentTarget as HTMLElement).focus();
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-md font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Label and value pairs; empty values show a dash, as in the reference app. */
export function DetailList({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="m-0 min-w-0 break-words">{value === "" || value == null ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const yesNo = (value: boolean) => (value ? "Sí" : "No");

export function ContactDetails({ contact }: { contact: Contact }) {
  return (
    <DetailList
      items={[
        ["Nombre o razón social", contact.name],
        ["NIF", contact.taxId && <span className="font-mono">{contact.taxId}</span>],
        ["Dirección", contact.address],
        ["Código postal", contact.postalCode],
        ["Población", contact.city],
        ["Provincia", contact.province],
        ["País", contact.id ? countryOf(contact) : ""],
      ]}
    />
  );
}

/** The document's lines, with the base and VAT rate of each one. */
export function LinesTable({ lines }: { lines: SalesLine[] }) {
  const th = cn(table.th, "px-2.5 first:pl-3 last:pr-3");
  const td = cn(table.td, "px-2.5 first:pl-3 last:pr-3");
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className={table.headRow}>
            <th scope="col" className={th}>
              Concepto
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              Precio
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              Cant.
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              Dto.
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              Base
            </th>
            <th scope="col" className={cn(th, "text-right")}>
              IVA
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-border last:border-b-0">
              <td className={td}>
                <span className="block">{line.concept || "—"}</span>
                {line.detail && <span className="block text-xs text-muted-foreground">{line.detail}</span>}
                {line.serviceFrom && line.serviceTo && (
                  <span className="block text-xs text-muted-foreground">
                    Del {formatDate(line.serviceFrom)} al {formatDate(line.serviceTo)}
                  </span>
                )}
              </td>
              <td className={cn(td, "text-right amount whitespace-nowrap")}>
                {formatEUR(eurosToCents(line.unitPrice))}
              </td>
              <td className={cn(td, "text-right amount whitespace-nowrap")}>
                {String(line.quantity).replace(".", ",")}
                {line.unit && ` ${line.unit}`}
              </td>
              <td className={cn(td, "text-right amount whitespace-nowrap text-muted-foreground")}>
                {line.discount ? ratePercent(line.discount) : "—"}
              </td>
              <td className={cn(td, "text-right amount whitespace-nowrap")}>{formatEUR(lineBase(line))}</td>
              <td className={cn(td, "text-right amount whitespace-nowrap text-muted-foreground")}>
                {ratePercent(line.vatRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Subtotal, VAT per rate and what is added or taken off, down to the total. */
export function TotalsList({ totals }: { totals: InvoiceTotals }) {
  const rows: [string, Cents][] = [
    ["Base imponible", totals.base],
    ...totals.vatBreakdown.filter((r) => r.rate > 0).map((r): [string, Cents] => [`IVA ${ratePercent(r.rate)}`, r.vat]),
    ...(totals.surcharge ? [["Recargo de equivalencia", totals.surcharge] as [string, Cents]] : []),
    ...(totals.withholding ? [["Retención", cents(-totals.withholding)] as [string, Cents]] : []),
    ...(totals.supplies ? [["Suplidos", totals.supplies] as [string, Cents]] : []),
  ];
  return (
    <dl className="m-0 ml-auto flex w-full max-w-72 flex-col gap-1 text-sm">
      {rows.map(([label, amount]) => (
        <div key={label} className="flex justify-between gap-6">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="m-0 amount">{formatEUR(amount)}</dd>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-6 border-t border-border pt-1.5 font-semibold">
        <dt>Total</dt>
        <dd className="m-0 amount">{formatEUR(totals.total)}</dd>
      </div>
    </dl>
  );
}

/** Payments of a received invoice or collections of an issued one, oldest first. */
export function PaymentsTable({ payments, empty }: { payments: Payment[]; empty: string }) {
  if (payments.length === 0) return <p className="m-0 text-sm text-muted-foreground">{empty}</p>;
  const td = cn(table.td, "px-2.5 first:pl-3 last:pr-3");
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className={table.headRow}>
            <th scope="col" className={cn(table.th, "px-2.5 first:pl-3 last:pr-3")}>
              Fecha
            </th>
            <th scope="col" className={cn(table.th, "px-2.5 first:pl-3 last:pr-3")}>
              Método de pago
            </th>
            <th scope="col" className={cn(table.th, "px-2.5 text-right first:pl-3 last:pr-3")}>
              Cantidad
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-b-0">
              <td className={cn(td, "whitespace-nowrap")}>{formatDate(p.date)}</td>
              <td className={td}>{paymentMethodName(p.paymentMethodId) ?? "Método eliminado"}</td>
              <td className={cn(td, "text-right amount")}>{formatEUR(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The files kept with the record, to open them from the detail. */
export function AttachmentsSection({ attachments = [] }: { attachments?: Attachment[] }) {
  return (
    <DetailSection title={attachments.length ? `Documentos adjuntos (${attachments.length})` : "Documentos adjuntos"}>
      {attachments.length ? (
        <AttachmentList attachments={attachments} />
      ) : (
        <p className="m-0 text-sm text-muted-foreground">No hay documentos adjuntos.</p>
      )}
    </DetailSection>
  );
}

/** The dialog's buttons, pinned under the scrolling content. */
export function DetailFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky -bottom-5 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-border bg-popover px-5 py-3">
      {children}
    </div>
  );
}
