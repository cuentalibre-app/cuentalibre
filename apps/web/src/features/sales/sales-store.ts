import type { IssuedSnapshot, SalesDocument, SalesKind } from "@cuentalibre/contracts";
import { createCollection } from "@/data/collection";
import { syncCollection } from "@/data/sync";
import { releaseDocumentStock, syncDocumentStock } from "@/features/catalog/catalog-store";
import { initialSalesDocuments } from "@/mocks/sales";

/** Sales documents. Changes apply instantly and are sent to the backend (see `@/data`). */
const documents = createCollection<SalesDocument>("salesDocuments", initialSalesDocuments, { addAt: "start" });
syncCollection("salesDocuments", documents);

export function useSalesDocuments(): SalesDocument[] {
  return documents.use();
}

/** Every change goes through the catalog too, which moves the stock of the products sold. */
export const salesStore = {
  get: documents.get,
  all: documents.all,
  /** Drafts, quotes and delivery notes; invoices are issued. `origin` is the kind it was made from. */
  add: (doc: SalesDocument, origin?: SalesKind) => {
    void documents.add(doc);
    syncDocumentStock(doc, origin);
  },
  update: (id: string, changes: Partial<SalesDocument>) => {
    const before = documents.get(id);
    if (!before) return;
    void documents.update(id, changes);
    syncDocumentStock(documents.get(id)!);
  },
  /**
   * Issues an invoice, new or from the draft with the same ID. The number it
   * carries is a forecast: the server gives it the next one of its series and
   * freezes it. An imported invoice keeps its own number.
   */
  issue: (invoice: SalesDocument, { origin, imported = false }: { origin?: SalesKind; imported?: boolean } = {}) => {
    const before = documents.get(invoice.id);
    void documents.write(invoice, [
      { type: "issue", data: invoice, ...(imported && invoice.number ? { number: invoice.number } : {}) },
    ]);
    syncDocumentStock(invoice, before && before.kind !== invoice.kind ? before.kind : origin);
  },
  /**
   * Corrects the VERI*FACTU record of an invoice the AEAT rejected or
   * accepted with errors: the invoice takes the client's data as fixed, and
   * the new record waits to be sent.
   */
  correctRecord: (id: string, client: IssuedSnapshot["client"]) => {
    const invoice = documents.get(id);
    const verifactu = invoice?.issued?.verifactu;
    if (!invoice?.issued || !verifactu) return;
    void documents.write(
      { ...invoice, issued: { ...invoice.issued, client, verifactu: { status: "pending", qrUrl: verifactu.qrUrl } } },
      [{ type: "correctRecord", id, client }],
    );
  },
  remove: (id: string) => {
    const doc = documents.get(id);
    void documents.remove(id);
    if (doc) releaseDocumentStock(doc);
  },
};
