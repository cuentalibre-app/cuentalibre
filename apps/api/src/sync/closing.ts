import type { ClosedQuarter, FiledReturn } from "@cuentalibre/contracts";
import { periodKey, quarterOfDate } from "@cuentalibre/core";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Tx } from "../db/client";
import { closedQuarter, filedReturn } from "../db/schema";
import { ApiError } from "../errors";
import { alreadyExists } from "./records";

type ClosedQuarterRow = typeof closedQuarter.$inferSelect;
type FiledReturnRow = typeof filedReturn.$inferSelect;

export const toClosedQuarter = (row: ClosedQuarterRow): ClosedQuarter => ({
  period: row.period,
  closedOn: row.closedOn,
});

export const toFiledReturn = (row: FiledReturnRow): FiledReturn => ({
  id: row.id,
  form: row.form,
  period: row.period,
  boxes: row.boxes,
  result: row.result as FiledReturn["result"],
  filedOn: row.filedOn,
});

/**
 * Closes a quarter, or updates the date of one already closed, and stores
 * its returns as filed. Filed returns are never replaced: each close adds a
 * new version.
 */
export async function closeQuarter(
  tx: Tx,
  organizationId: string,
  period: string,
  closedOn: string,
  returns: FiledReturn[] = [],
) {
  const forms = new Set<string>();
  for (const filed of returns) {
    if (filed.period !== period)
      throw new ApiError(400, "invalid_filed_return", `A return of ${filed.period} can't be filed closing ${period}.`);
    if (forms.has(filed.form))
      throw new ApiError(400, "invalid_filed_return", `Form ${filed.form} is filed twice for ${period}.`);
    forms.add(filed.form);
  }
  await tx
    .insert(closedQuarter)
    .values({ organizationId, period, closedOn })
    .onConflictDoUpdate({
      target: [closedQuarter.organizationId, closedQuarter.period],
      set: { closedOn, deletedAt: null },
    });
  if (returns.length === 0) return;
  const stored = await tx
    .insert(filedReturn)
    .values(returns.map((filed) => ({ ...filed, organizationId })))
    .onConflictDoNothing()
    .returning({ id: filedReturn.id });
  if (stored.length < returns.length) alreadyExists();
}

/** Every version of every filed return, oldest first. */
export async function liveFiledReturns(tx: Tx, organizationId: string) {
  const rows = await tx
    .select()
    .from(filedReturn)
    .where(eq(filedReturn.organizationId, organizationId))
    .orderBy(asc(filedReturn.createdAt), asc(filedReturn.id));
  return rows.map(toFiledReturn);
}

export function filedReturnsById(tx: Tx, organizationId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return tx
    .select()
    .from(filedReturn)
    .where(and(eq(filedReturn.organizationId, organizationId), inArray(filedReturn.id, ids)));
}

export async function reopenQuarter(tx: Tx, organizationId: string, period: string) {
  const [row] = await tx
    .update(closedQuarter)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(closedQuarter.organizationId, organizationId),
        eq(closedQuarter.period, period),
        isNull(closedQuarter.deletedAt),
      ),
    )
    .returning({ period: closedQuarter.period });
  if (!row) throw new ApiError(404, "not_found", "This quarter isn't closed.");
}

/** Closed quarters, oldest first. */
export function liveClosedQuarters(tx: Tx, organizationId: string) {
  return tx
    .select()
    .from(closedQuarter)
    .where(and(eq(closedQuarter.organizationId, organizationId), isNull(closedQuarter.deletedAt)))
    .orderBy(closedQuarter.period);
}

/** Current rows, tombstones included, for the given periods. */
export function closedQuartersByPeriod(tx: Tx, organizationId: string, periods: string[]) {
  if (periods.length === 0) return Promise.resolve([]);
  return tx
    .select()
    .from(closedQuarter)
    .where(and(eq(closedQuarter.organizationId, organizationId), inArray(closedQuarter.period, periods)));
}

/** Rejects a write dated in a closed quarter. */
export async function checkQuarterOpen(tx: Tx, organizationId: string, isoDate: string) {
  if (await isQuarterClosed(tx, organizationId, isoDate))
    throw new ApiError(
      409,
      "quarter_closed",
      `Quarter ${periodKey(quarterOfDate(isoDate))} is closed; reopen it first.`,
    );
}

export async function isQuarterClosed(tx: Tx, organizationId: string, isoDate: string) {
  const [closed] = await tx
    .select({ period: closedQuarter.period })
    .from(closedQuarter)
    .where(
      and(
        eq(closedQuarter.organizationId, organizationId),
        eq(closedQuarter.period, periodKey(quarterOfDate(isoDate))),
        isNull(closedQuarter.deletedAt),
      ),
    );
  return closed !== undefined;
}
