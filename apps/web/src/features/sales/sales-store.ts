import type { SalesDocument, SalesKind } from "@fiscalia/contracts";
import { createCollection } from "@/data/collection";
import { releaseDocumentStock, syncDocumentStock } from "@/features/catalog/catalog-store";
import { initialSalesDocuments } from "@/mocks/sales";

/** Sales documents. Changes apply instantly and are sent to the backend (see `@/data`). */
const documents = createCollection<SalesDocument>("salesDocuments", initialSalesDocuments, { addAt: "start" });

export function useSalesDocuments(): SalesDocument[] {
  return documents.use();
}

/** Every change goes through the catalog too, which moves the stock of the products sold. */
export const salesStore = {
  get: documents.get,
  all: documents.all,
  /** `origin` is the kind of document it was made from, such as the quote it invoices. */
  add: (doc: SalesDocument, origin?: SalesKind) => {
    void documents.add(doc);
    syncDocumentStock(doc, origin);
  },
  update: (id: string, changes: Partial<SalesDocument>) => {
    const before = documents.get(id);
    if (!before) return;
    void documents.update(id, changes);
    // Issuing a draft keeps its id and changes its kind
    const after = documents.get(id)!;
    syncDocumentStock(after, before.kind !== after.kind ? before.kind : undefined);
  },
  remove: (id: string) => {
    const doc = documents.get(id);
    void documents.remove(id);
    if (doc) releaseDocumentStock(doc);
  },
};
