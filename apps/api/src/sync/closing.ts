import type { ClosedQuarter } from "@fiscalia/contracts";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Tx } from "../db/client";
import { closedQuarter } from "../db/schema";
import { ApiError } from "../errors";

type ClosedQuarterRow = typeof closedQuarter.$inferSelect;

export const toClosedQuarter = (row: ClosedQuarterRow): ClosedQuarter => ({
  period: row.period,
  closedOn: row.closedOn,
});

/** Closes a quarter, or updates the date of one already closed. */
export async function closeQuarter(tx: Tx, organizationId: string, period: string, closedOn: string) {
  await tx
    .insert(closedQuarter)
    .values({ organizationId, period, closedOn })
    .onConflictDoUpdate({
      target: [closedQuarter.organizationId, closedQuarter.period],
      set: { closedOn, deletedAt: null },
    });
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
