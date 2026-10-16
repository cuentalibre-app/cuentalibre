import { useSyncExternalStore } from "react";
import { initialClients, initialSuppliers, type Contact, type ContactRole } from "@/mocks/contacts";

/**
 * In-memory clients and suppliers. Changes apply instantly and last until
 * reload; this is where the API cache will go once there is a backend.
 */
let contacts: Record<ContactRole, Contact[]> = { client: initialClients, supplier: initialSuppliers };
const listeners = new Set<() => void>();

function commit(role: ContactRole, next: Contact[]) {
  contacts = { ...contacts, [role]: next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useContacts(role: ContactRole): Contact[] {
  return useSyncExternalStore(subscribe, () => contacts[role]);
}

export const contactsStore = {
  get: (role: ContactRole, id: string) => contacts[role].find((c) => c.id === id),
  all: (role: ContactRole) => contacts[role],
  add: (role: ContactRole, contact: Contact) => commit(role, [...contacts[role], contact]),
  update: (role: ContactRole, id: string, changes: Partial<Contact>) =>
    commit(
      role,
      contacts[role].map((c) => (c.id === id ? { ...c, ...changes } : c)),
    ),
  remove: (role: ContactRole, id: string) =>
    commit(
      role,
      contacts[role].filter((c) => c.id !== id),
    ),
};
