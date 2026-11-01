import {
  ENTITY_ROLES,
  type Change,
  type ContactEntity,
  type PlainEntity,
  type RecordEntity,
  type SyncCommand,
} from "@cuentalibre/contracts";
import type { VerifactuEnvironment } from "@cuentalibre/core";
import { sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client";
import { changeLog, type LoggedEntity } from "../db/schema";
import { closeQuarter, reopenQuarter } from "./closing";
import { createContact, deleteContact, updateContact, type StoredContact } from "./contacts";
import { createExpense, deleteExpense, updateExpense } from "./expenses";
import { createPlain, deletePlain, loggedAs, PLAIN_ENTITIES, updatePlain } from "./plain";
import { createPurchaseInvoice, deletePurchaseInvoice, updatePurchaseInvoice } from "./purchases";
import { changesFor, type RecordRef } from "./read";
import { correctRecord, createSalesDocument, deleteSalesDocument, issueInvoice, updateSalesDocument } from "./sales";
import { saveSettings } from "./settings";

export interface Scope {
  organizationId: string;
  /** Null for work the server does by itself. */
  userId: string | null;
  /** Which AEAT environment VERI*FACTU records are made for: it decides where their QR code points. */
  verifactuEnvironment: VerifactuEnvironment;
}

/**
 * Serializes writes per organization, so the change feed's sequence follows commit order.
 * It also makes invoice numbering and the VERI*FACTU chain race-free.
 */
export async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`);
}

/**
 * Applies the commands in one transaction: all of them or none. Each one is
 * logged in the change feed. Returns the resulting state of the records they
 * touched, which the client takes as authoritative.
 */
export function applyCommands(db: Db, scope: Scope, commands: SyncCommand[]): Promise<Change[]> {
  return db.transaction(async (tx) => {
    await lockOrganization(tx, scope.organizationId);

    const touched: RecordRef[] = [];
    for (const command of commands) {
      const refs = await apply(tx, scope, command);
      await tx.insert(changeLog).values(
        refs.map((ref) => ({
          organizationId: scope.organizationId,
          entity: ref.entity,
          recordId: ref.id,
          op: command.type,
          userId: scope.userId,
        })),
      );
      touched.push(...refs);
    }
    return changesFor(tx, scope.organizationId, touched);
  });
}

/** Runs one command and returns the records it changed. */
async function apply(tx: Tx, scope: Scope, command: SyncCommand): Promise<RecordRef[]> {
  const { organizationId } = scope;
  switch (command.type) {
    case "issue":
      await issueInvoice(tx, organizationId, command.data, command.number, scope.verifactuEnvironment);
      return [{ entity: "sales_document", id: command.data.id }];
    case "correctRecord":
      await correctRecord(tx, organizationId, command.id, command.client);
      return [{ entity: "sales_document", id: command.id }];
    case "closeQuarter": {
      const returns = command.returns ?? [];
      await closeQuarter(tx, organizationId, command.period, command.closedOn, returns);
      return [
        { entity: "closed_quarter", id: command.period },
        ...returns.map((filed): RecordRef => ({ entity: "filed_return", id: filed.id })),
      ];
    }
    case "reopenQuarter":
      await reopenQuarter(tx, organizationId, command.period);
      return [{ entity: "closed_quarter", id: command.period }];
    case "saveSettings":
      await saveSettings(tx, organizationId, command.section, command.data);
      return [{ entity: "organization_setting", id: command.section }];
  }

  const id = command.type === "create" ? command.data.id : command.id;
  const service = SERVICES[command.entity];
  if (command.type === "create") await service.create(tx, organizationId, command.data);
  else if (command.type === "update") await service.update(tx, organizationId, id, command.changes);
  else await service.remove(tx, organizationId, id);
  return [{ entity: service.logged, id }];
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

const plainService = (entity: PlainEntity): RecordService => ({
  logged: loggedAs(entity),
  create: (tx, organizationId, data) => createPlain(tx, organizationId, entity, data),
  update: (tx, organizationId, id, changes) => updatePlain(tx, organizationId, entity, id, changes),
  remove: (tx, organizationId, id) => deletePlain(tx, organizationId, entity, id),
});

const SERVICES: Record<RecordEntity, RecordService> = {
  ...(Object.fromEntries(PLAIN_ENTITIES.map((entity) => [entity, plainService(entity)])) as Record<
    PlainEntity,
    RecordService
  >),
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
