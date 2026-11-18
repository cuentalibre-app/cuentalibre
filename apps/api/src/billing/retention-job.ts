import { and, eq, lte, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { deletionNotice, membership, organization, subscription, user } from "../db/schema";
import { deletionNoticeEmail } from "../email/account-emails";
import type { Mailer } from "../email/mailer";
import { reportError } from "../error-reporting";
import { cleanUpDeleted, deleteOrganizations } from "../organization-deletion";
import type { FileStorage } from "../storage";
import type { Billing } from ".";
import { TRIAL_DAYS } from "./plan";
import { addMonths, READ_ONLY_MONTHS, readOnlySince, retentionStep, type DeletionNotice } from "./retention";

export interface RetentionDeps {
  db: Db;
  storage: FileStorage;
  billing: Billing;
  /** The mailer for account emails. Without one no notice goes out, so nothing is ever deleted. */
  mailer: Mailer | null;
  webOrigin: string;
}

const REQUEST = { method: "JOB", route: "retention" };
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sends the notices that are due and deletes the organizations whose time is up. Safe to
 * run often and from several processes: each organization is handled under its own lock,
 * and a notice is stored only once it was sent, so a failure retries it on the next run.
 */
export async function runRetention(deps: RetentionDeps, now = new Date()) {
  // Only organizations whose first notice may be due: read-only at least 6 months, which
  // takes at least a trial plus 6 months from their creation
  const cutoff = new Date(addMonths(now, 6 - READ_ONLY_MONTHS).getTime() - TRIAL_DAYS * DAY_MS);
  const candidates = await deps.db
    .select({ id: organization.id })
    .from(organization)
    .leftJoin(subscription, eq(subscription.organizationId, organization.id))
    .where(
      and(
        lte(organization.createdAt, cutoff),
        sql`coalesce(${subscription.status}, '') not in ('active', 'trialing', 'past_due')`,
      ),
    );
  for (const { id } of candidates) {
    await handle(deps, id, now).catch((error: unknown) => {
      console.error(`Retention of organization ${id} failed:`, error);
      reportError(error, REQUEST);
    });
  }
}

async function handle(deps: RetentionDeps, organizationId: string, now: Date) {
  const deleted = await deps.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 2))`);
    // Read again under the lock: a webhook may have just renewed it
    const [org] = await tx
      .select({
        name: organization.name,
        createdAt: organization.createdAt,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      })
      .from(organization)
      .leftJoin(subscription, eq(subscription.organizationId, organization.id))
      .where(eq(organization.id, organizationId))
      .for("update", { of: organization });
    if (!org) return null;
    const since = readOnlySince(org, org, now);
    if (!since) return null;

    const sent = await tx
      .select({ notice: deletionNotice.notice, sentAt: deletionNotice.sentAt })
      .from(deletionNotice)
      .where(and(eq(deletionNotice.organizationId, organizationId), eq(deletionNotice.readOnlySince, since)));
    const step = retentionStep(
      since,
      Object.fromEntries(sent.map((row) => [row.notice, row.sentAt])) as Partial<Record<DeletionNotice, Date>>,
      now,
    );

    if (step.action === "delete") return deleteOrganizations(tx, [organizationId]);
    if (step.action === "notify" && deps.mailer) {
      const owners = await tx
        .select({ email: user.email })
        .from(membership)
        .innerJoin(user, eq(user.id, membership.userId))
        .where(and(eq(membership.organizationId, organizationId), eq(membership.role, "owner")));
      if (!owners.length) return null;
      await deps.mailer.send(
        deletionNoticeEmail(
          owners.map((row) => row.email),
          { name: org.name, readOnlySince: since, deleteAt: step.deleteAt },
          deps.webOrigin,
        ),
      );
      await tx
        .insert(deletionNotice)
        .values({ organizationId, readOnlySince: since, notice: step.notice, sentAt: now });
    }
    return null;
  });
  if (deleted) {
    console.log(`Deleted organization ${organizationId} after ${READ_ONLY_MONTHS} months read-only`);
    await cleanUpDeleted(deleted, deps.storage, deps.billing, REQUEST);
  }
}

/** Runs `runRetention` every hour in the background. Returns a function that stops it. */
export function startRetention(deps: RetentionDeps, intervalMs = 60 * 60 * 1000): () => Promise<void> {
  let stopped = false;
  let running = Promise.resolve();
  const tick = () => {
    if (stopped) return;
    running = runRetention(deps)
      .catch((error: unknown) => {
        console.error("Retention:", error);
        reportError(error, REQUEST);
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, intervalMs);
      });
  };
  let timer = setTimeout(tick, 60_000);
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}
