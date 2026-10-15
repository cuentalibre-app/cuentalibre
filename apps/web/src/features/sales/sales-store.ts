import { useSyncExternalStore } from "react";
import { initialSalesDocuments, type SalesDocument } from "@/mocks/sales";

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

export const salesStore = {
  get: (id: string) => documents.find((d) => d.id === id),
  all: () => documents,
  add: (doc: SalesDocument) => commit([doc, ...documents]),
  update: (id: string, changes: Partial<SalesDocument>) =>
    commit(documents.map((d) => (d.id === id ? { ...d, ...changes } : d))),
  remove: (id: string) => commit(documents.filter((d) => d.id !== id)),
};
