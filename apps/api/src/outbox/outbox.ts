import { and, eq, isNull, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { outbox, type OutboxTopic } from "../db/schema";

export type Job = typeof outbox.$inferSelect;

interface NewJob {
  organizationId: string;
  topic: OutboxTopic;
  payload?: Record<string, unknown>;
  /** Only one unfinished job per organization and key: enqueuing another while one waits does nothing. */
  key?: string;
  runAfter?: Date;
}

/** Queues background work. Call it in the transaction of the change that needs it, so both commit or neither. */
export async function enqueue(tx: Tx, job: NewJob) {
  await tx
    .insert(outbox)
    .values({
      organizationId: job.organizationId,
      topic: job.topic,
      payload: job.payload ?? {},
      key: job.key ?? null,
      runAfter: job.runAfter ?? new Date(),
    })
    .onConflictDoNothing({
      target: [outbox.organizationId, outbox.key],
      where: sql`${outbox.key} is not null and ${outbox.doneAt} is null and ${outbox.failedAt} is null`,
    });
}

/** Marks a job done. Handlers that queue a follow-up with the same key call it first. */
export async function complete(tx: Tx, id: number) {
  await tx
    .update(outbox)
    .set({ doneAt: new Date(), lockedUntil: null })
    .where(and(eq(outbox.id, id), isNull(outbox.doneAt)));
}
