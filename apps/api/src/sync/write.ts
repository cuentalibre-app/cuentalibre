import {
  ENTITY_ROLES,
  type Change,
  type ContactEntity,
  type RecordEntity,
  type SyncCommand,
} from "@fiscalia/contracts";
import { sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client";
import { changeLog, type LoggedEntity } from "../db/schema";
import { closeQuarter, reopenQuarter } from "./closing";
import { createContact, deleteContact, updateContact, type StoredContact } from "./contacts";
import { createExpense, deleteExpense, updateExpense } from "./expenses";
import { createPurchaseInvoice, deletePurchaseInvoice, updatePurchaseInvoice } from "./purchases";
import { changesFor, type RecordRef } from "./read";
import { createSalesDocument, deleteSalesDocument, issueInvoice, updateSalesDocument } from "./sales";

export interface Scope {
  organizationId: string;
  userId: string;
}

/**
 * Applies the commands in one transaction: all of them or none. Each one is
 * logged in the change feed. Returns the resulting state of the records they
 * touched, which the client takes as authoritative.
 */
export function applyCommands(db: Db, scope: Scope, commands: SyncCommand[]): Promise<Change[]> {
  return db.transaction(async (tx) => {
    // Serializes writes per organization, so the change feed's sequence follows commit order.
    // It also makes invoice numbering race-free: two invoices can't take the same next number.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.organizationId}, 0))`);

    const touched: RecordRef[] = [];
    for (const command of commands) {
      const ref = await apply(tx, scope.organizationId, command);
      await tx.insert(changeLog).values({
        organizationId: scope.organizationId,
        entity: ref.entity,
        recordId: ref.id,
        op: command.type,
        userId: scope.userId,
      });
      touched.push(ref);
    }
    return changesFor(tx, scope.organizationId, touched);
  });
}

/** Runs one command and returns the record it changed. */
async function apply(tx: Tx, organizationId: string, command: SyncCommand): Promise<RecordRef> {
  switch (command.type) {
    case "issue":
      await issueInvoice(tx, organizationId, command.data, command.number);
      return { entity: "sales_document", id: command.data.id };
    case "closeQuarter":
      await closeQuarter(tx, organizationId, command.period, command.closedOn);
      return { entity: "closed_quarter", id: command.period };
    case "reopenQuarter":
      await reopenQuarter(tx, organizationId, command.period);
      return { entity: "closed_quarter", id: command.period };
  }

  const id = command.type === "create" ? command.data.id : command.id;
  const service = SERVICES[command.entity];
  if (command.type === "create") await service.create(tx, organizationId, command.data);
  else if (command.type === "update") await service.update(tx, organizationId, id, command.changes);
  else await service.remove(tx, organizationId, id);
  return { entity: service.logged, id };
}

/** How each kind of record is created, updated and deleted, and the name it is logged under. */
interface RecordService {
  logged: LoggedEntity;
  create: (tx: Tx, organizationId: string, data: unknown) => Promise<void>;
  update: (tx: Tx, organizationId: string, id: string, changes: Record<string, unknown>) => Promise<void>;
  remove: (tx: Tx, organizationId: string, id: string) => Promise<void>;
}

const contactService = (entity: ContactEntity): RecordService => ({
  logged: "contact",
  create: (tx, organizationId, data) => createContact(tx, organizationId, ENTITY_ROLES[entity], data as StoredContact),
  update: (tx, organizationId, id, changes) => updateContact(tx, organizationId, ENTITY_ROLES[entity], id, changes),
  remove: (tx, organizationId, id) => deleteContact(tx, organizationId, ENTITY_ROLES[entity], id),
});

const SERVICES: Record<RecordEntity, RecordService> = {
  clients: contactService("clients"),
  suppliers: contactService("suppliers"),
  salesDocuments: {
    logged: "sales_document",
    create: createSalesDocument,
    update: updateSalesDocument,
    remove: deleteSalesDocument,
  },
  purchaseInvoices: {
    logged: "purchase_invoice",
    create: createPurchaseInvoice,
    update: updatePurchaseInvoice,
    remove: deletePurchaseInvoice,
  },
  expenses: { logged: "expense", create: createExpense, update: updateExpense, remove: deleteExpense },
};
