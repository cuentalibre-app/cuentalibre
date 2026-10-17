import { useSyncExternalStore } from "react";
import { releaseDocumentStock, syncDocumentStock } from "@/features/catalog/catalog-store";
import { initialSalesDocuments, type SalesDocument, type SalesKind } from "@/mocks/sales";

/**
 * In-memory sales documents. Changes apply instantly and last until reload;
 * this is where the API cache will go once there is a backend.
 */
let documents = initialSalesDocuments;
const listeners = new Set<() => void>();

function commit(next: SalesDocument[]) {
  documents = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSalesDocuments(): SalesDocument[] {
  return useSyncExternalStore(subscribe, () => documents);
}

/** Every change goes through the catalog too, which moves the stock of the products sold. */
export const salesStore = {
  get: (id: string) => documents.find((d) => d.id === id),
  all: () => documents,
  /** `origin` is the kind of document it was made from, such as the quote it invoices. */
  add: (doc: SalesDocument, origin?: SalesKind) => {
    commit([doc, ...documents]);
    syncDocumentStock(doc, origin);
  },
  update: (id: string, changes: Partial<SalesDocument>) => {
    const before = documents.find((d) => d.id === id);
    if (!before) return;
    const after = { ...before, ...changes };
    commit(documents.map((d) => (d.id === id ? after : d)));
    // Issuing a draft keeps its id and changes its kind
    syncDocumentStock(after, before.kind !== after.kind ? before.kind : undefined);
  },
  remove: (id: string) => {
    const doc = documents.find((d) => d.id === id);
    commit(documents.filter((d) => d.id !== id));
    if (doc) releaseDocumentStock(doc);
  },
};
