import { ENTITY_ROLES, type Change, type Changes, type PlainEntity, type Workspace } from "@cuentalibre/contracts";
import { and, asc, eq, gt, max } from "drizzle-orm";
import type { Db, Tx } from "../db/client";
import { changeLog, type LoggedEntity } from "../db/schema";
import {
  closedQuartersByPeriod,
  filedReturnsById,
  liveClosedQuarters,
  liveFiledReturns,
  toClosedQuarter,
  toFiledReturn,
} from "./closing";
import { contactsById, liveContacts, toContact, type ContactRow } from "./contacts";
import { expensesById, liveExpenses, toExpense } from "./expenses";
import { livePlain, loggedAs, PLAIN_ENTITIES, plainById } from "./plain";
import { livePurchaseInvoices, purchaseInvoicesById } from "./purchases";
import { liveSalesDocuments, salesDocumentsById } from "./sales";
import { readSettings, settingsBySection } from "./settings";

const entityOf = (row: ContactRow) => (row.role === ENTITY_ROLES.clients ? "clients" : "suppliers");

/** A record named in the change log. */
export interface RecordRef {
  entity: LoggedEntity;
  id: string;
}

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
      const plain = Object.fromEntries(
        await Promise.all(
          PLAIN_ENTITIES.map(async (entity) => [entity, await livePlain(tx, organizationId, entity)] as const),
        ),
      ) as unknown as Pick<Workspace, PlainEntity>;
      const workspace: Workspace = {
        cursor: last?.seq ?? 0,
        clients: [],
        suppliers: [],
        salesDocuments: await liveSalesDocuments(tx, organizationId),
        purchaseInvoices: await livePurchaseInvoices(tx, organizationId),
        expenses: await liveExpenses(tx, organizationId),
        closedQuarters: (await liveClosedQuarters(tx, organizationId)).map(toClosedQuarter),
        filedReturns: await liveFiledReturns(tx, organizationId),
        ...plain,
        settings: await readSettings(tx, organizationId),
      };
      for (const row of await liveContacts(tx, organizationId)) workspace[entityOf(row)].push(toContact(row));
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
        .select({ seq: changeLog.seq, entity: changeLog.entity, id: changeLog.recordId })
        .from(changeLog)
        .where(and(eq(changeLog.organizationId, organizationId), gt(changeLog.seq, since)))
        .orderBy(asc(changeLog.seq))
        .limit(limit + 1);
      const page = entries.slice(0, limit);
      return {
        cursor: page.at(-1)?.seq ?? since,
        changes: await changesFor(tx, organizationId, page),
        hasMore: entries.length > limit,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/** The current state of the given records, as changes, each once in order of first mention. */
export async function changesFor(tx: Tx, organizationId: string, refs: RecordRef[]): Promise<Change[]> {
  const unique = [...new Map(refs.map((ref) => [`${ref.entity}:${ref.id}`, ref])).values()];
  const idsOf = (entity: LoggedEntity) => unique.filter((ref) => ref.entity === entity).map((ref) => ref.id);

  const changes = new Map<string, Change>();
  for (const row of await contactsById(tx, organizationId, idsOf("contact"))) {
    const entity = entityOf(row);
    changes.set(
      `contact:${row.id}`,
      row.deletedAt ? { op: "delete", entity, id: row.id } : { op: "upsert", entity, data: toContact(row) },
    );
  }
  for (const doc of await salesDocumentsById(tx, organizationId, idsOf("sales_document"))) {
    changes.set(
      `sales_document:${doc.id}`,
      doc.deleted
        ? { op: "delete", entity: "salesDocuments", id: doc.id }
        : { op: "upsert", entity: "salesDocuments", data: doc.record },
    );
  }
  for (const invoice of await purchaseInvoicesById(tx, organizationId, idsOf("purchase_invoice"))) {
    changes.set(
      `purchase_invoice:${invoice.id}`,
      invoice.deleted
        ? { op: "delete", entity: "purchaseInvoices", id: invoice.id }
        : { op: "upsert", entity: "purchaseInvoices", data: invoice.record },
    );
  }
  for (const row of await expensesById(tx, organizationId, idsOf("expense"))) {
    changes.set(
      `expense:${row.id}`,
      row.deletedAt
        ? { op: "delete", entity: "expenses", id: row.id }
        : { op: "upsert", entity: "expenses", data: toExpense(row) },
    );
  }
  for (const row of await closedQuartersByPeriod(tx, organizationId, idsOf("closed_quarter"))) {
    changes.set(
      `closed_quarter:${row.period}`,
      row.deletedAt
        ? { op: "delete", entity: "closedQuarters", id: row.period }
        : { op: "upsert", entity: "closedQuarters", data: toClosedQuarter(row) },
    );
  }
  for (const row of await filedReturnsById(tx, organizationId, idsOf("filed_return")))
    changes.set(`filed_return:${row.id}`, { op: "upsert", entity: "filedReturns", data: toFiledReturn(row) });
  for (const row of await settingsBySection(tx, organizationId, idsOf("organization_setting")))
    changes.set(`organization_setting:${row.section}`, {
      op: "upsert",
      entity: "settings",
      data: { section: row.section, data: row.data },
    });
  for (const entity of PLAIN_ENTITIES) {
    const logged = loggedAs(entity);
    for (const { id, record } of await plainById(tx, organizationId, entity, idsOf(logged)))
      changes.set(
        `${logged}:${id}`,
        record ? ({ op: "upsert", entity, data: record } as Change) : { op: "delete", entity, id },
      );
  }
  return unique.flatMap((ref) => changes.get(`${ref.entity}:${ref.id}`) ?? []);
}
