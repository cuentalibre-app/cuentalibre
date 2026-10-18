import { ENTITY_ROLES, type Change, type SyncCommand } from "@fiscalia/contracts";
import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { changeLog } from "../db/schema";
import { createContact, deleteContact, updateContact } from "./contacts";
import { changesFor } from "./read";

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
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.organizationId}, 0))`);

    const touched: string[] = [];
    for (const command of commands) {
      const role = ENTITY_ROLES[command.entity];
      const id = command.type === "create" ? command.data.id : command.id;
      if (command.type === "create") await createContact(tx, scope.organizationId, role, command.data);
      else if (command.type === "update") await updateContact(tx, scope.organizationId, role, id, command.changes);
      else await deleteContact(tx, scope.organizationId, role, id);

      await tx.insert(changeLog).values({
        organizationId: scope.organizationId,
        entity: "contact",
        recordId: id,
        op: command.type,
        userId: scope.userId,
      });
      if (!touched.includes(id)) touched.push(id);
    }
    return changesFor(tx, scope.organizationId, touched);
  });
}
