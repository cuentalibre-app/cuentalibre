import type { Contact, ContactRole } from "@fiscalia/contracts";
import { createCollection } from "@/data/collection";
import { syncCollection } from "@/data/sync";
import { initialClients, initialSuppliers } from "@/mocks/contacts";

/** Clients and suppliers. Changes apply instantly and are sent to the backend (see `@/data`). */
const contacts = {
  client: createCollection<Contact>("clients", initialClients),
  supplier: createCollection<Contact>("suppliers", initialSuppliers),
};
syncCollection("clients", contacts.client);
syncCollection("suppliers", contacts.supplier);

export function useContacts(role: ContactRole): Contact[] {
  return contacts[role].use();
}

export const contactsStore = {
  get: (role: ContactRole, id: string) => contacts[role].get(id),
  all: (role: ContactRole) => contacts[role].all(),
  add: (role: ContactRole, contact: Contact) => contacts[role].add(contact),
  update: (role: ContactRole, id: string, changes: Partial<Contact>) => contacts[role].update(id, changes),
  remove: (role: ContactRole, id: string) => contacts[role].remove(id),
};
