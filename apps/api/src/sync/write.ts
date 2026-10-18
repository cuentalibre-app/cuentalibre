import { ENTITY_ROLES, type Change, type SyncCommand } from "@fiscalia/contracts";
import { sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client";
import { changeLog } from "../db/schema";
import { closeQuarter, reopenQuarter } from "./closing";
import { createContact, deleteContact, updateContact } from "./contacts";
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
  if (command.entity === "salesDocuments") {
    if (command.type === "create") await createSalesDocument(tx, organizationId, command.data);
    else if (command.type === "update") await updateSalesDocument(tx, organizationId, id, command.changes);
    else await deleteSalesDocument(tx, organizationId, id);
    return { entity: "sales_document", id };
  }

  const role = ENTITY_ROLES[command.entity];
  if (command.type === "create") await createContact(tx, organizationId, role, command.data);
  else if (command.type === "update") await updateContact(tx, organizationId, role, id, command.changes);
  else await deleteContact(tx, organizationId, role, id);
  return { entity: "contact", id };
}
