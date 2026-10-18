import { ENTITY_ROLES, type Change, type Changes, type Workspace } from "@fiscalia/contracts";
import { and, asc, eq, gt, max } from "drizzle-orm";
import type { Db, Tx } from "../db/client";
import { changeLog } from "../db/schema";
import { contactsById, liveContacts, toContact, type ContactRow } from "./contacts";

const entityOf = (row: ContactRow) => (row.role === ENTITY_ROLES.clients ? "clients" : "suppliers");

/**
 * Everything the client keeps, with the cursor it was read at. Read in one
 * repeatable-read snapshot, so the data and the cursor match exactly.
 */
export function readWorkspace(db: Db, organizationId: string): Promise<Workspace> {
  return db.transaction(
    async (tx) => {
      const [last] = await tx
        .select({ seq: max(changeLog.seq) })
        .from(changeLog)
        .where(eq(changeLog.organizationId, organizationId));
      const contacts = await liveContacts(tx, organizationId);
      const workspace: Workspace = { cursor: last?.seq ?? 0, clients: [], suppliers: [] };
      for (const row of contacts) workspace[entityOf(row)].push(toContact(row));
      return workspace;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/**
 * The records that changed after `since`, each once with its latest state. A
 * page covers at most `limit` log entries; `cursor` is the last one it covers.
 */
export function readChanges(db: Db, organizationId: string, since: number, limit: number): Promise<Changes> {
  return db.transaction(
    async (tx) => {
      const entries = await tx
        .select({ seq: changeLog.seq, recordId: changeLog.recordId })
        .from(changeLog)
        .where(and(eq(changeLog.organizationId, organizationId), gt(changeLog.seq, since)))
        .orderBy(asc(changeLog.seq))
        .limit(limit + 1);
      const page = entries.slice(0, limit);
      return {
        cursor: page.at(-1)?.seq ?? since,
        changes: await changesFor(tx, organizationId, [...new Set(page.map((entry) => entry.recordId))]),
        hasMore: entries.length > limit,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/** The current state of the given records, as changes. */
export async function changesFor(tx: Tx, organizationId: string, ids: string[]): Promise<Change[]> {
  const rows = await contactsById(tx, organizationId, ids);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id): Change[] => {
    const row = byId.get(id);
    if (!row) return [];
    return row.deletedAt
      ? [{ op: "delete", entity: entityOf(row), id }]
      : [{ op: "upsert", entity: entityOf(row), data: toContact(row) }];
  });
}
