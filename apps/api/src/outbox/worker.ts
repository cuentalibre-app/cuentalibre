import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { outbox, type OutboxTopic } from "../db/schema";
import { complete, type Job } from "./outbox";

/** Runs one job. Throwing retries it later; `RetryLater` says when. */
export type Handler = (job: Job) => Promise<void>;
export type Handlers = Record<OutboxTopic, Handler>;

/** A failure worth retrying at a given time. */
export class RetryLater extends Error {
  constructor(
    message: string,
    readonly at?: Date,
  ) {
    super(message);
  }
}

/** After this many failed attempts a job is given up on. */
export const MAX_ATTEMPTS = 12;
/** How long a worker holds a job; if it dies, another one takes the job after this. */
const LEASE = "5 minutes";

/** 30 s, 1 min, 2 min… up to an hour between attempts. */
const backoff = (attempts: number) => new Date(Date.now() + Math.min(30_000 * 2 ** (attempts - 1), 3_600_000));

/** Takes the next due job, if any, for this worker. */
async function claim(db: Db): Promise<Job | undefined> {
  const rows = await db.execute<{ id: number }>(sql`
    update ${outbox} set locked_until = now() + ${LEASE}::interval, attempts = attempts + 1
    where id = (
      select id from ${outbox}
      where done_at is null and failed_at is null and run_after <= now()
        and (locked_until is null or locked_until < now())
      order by run_after, id
      limit 1
      for update skip locked
    )
    returning id`);
  const id = rows[0]?.id;
  if (id === undefined) return undefined;
  const [job] = await db
    .select()
    .from(outbox)
    .where(eq(outbox.id, Number(id)));
  return job;
}

/** Runs the jobs that are due, one after another, and returns how many ran. */
export async function runDueJobs(db: Db, handlers: Handlers, limit = 50): Promise<number> {
  let ran = 0;
  for (; ran < limit; ran++) {
    const job = await claim(db);
    if (!job) break;
    try {
      await handlers[job.topic](job);
      await complete(db, job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = job.attempts >= MAX_ATTEMPTS;
      if (!(error instanceof RetryLater)) console.warn(`Outbox job ${job.id} (${job.topic}) failed:`, message);
      await db
        .update(outbox)
        .set({
          lastError: message,
          lockedUntil: null,
          // Waiting when asked to isn't a failed attempt
          ...(error instanceof RetryLater && { attempts: job.attempts - 1 }),
          ...(failed && !(error instanceof RetryLater)
            ? { failedAt: new Date() }
            : { runAfter: error instanceof RetryLater && error.at ? error.at : backoff(job.attempts) }),
        })
        .where(eq(outbox.id, job.id));
    }
  }
  return ran;
}

/** Polls the outbox in the background. Returns a function that stops it. */
export function startWorker(db: Db, handlers: Handlers, intervalMs = 2_000): () => Promise<void> {
  let stopped = false;
  let running = Promise.resolve();
  const tick = () => {
    if (stopped) return;
    running = runDueJobs(db, handlers)
      .then(() => undefined)
      .catch((error: unknown) => console.error("Outbox worker:", error))
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, intervalMs);
      });
  };
  let timer = setTimeout(tick, intervalMs);
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}
