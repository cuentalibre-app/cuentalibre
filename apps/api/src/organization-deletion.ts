import { inArray } from "drizzle-orm";
import type { Billing } from "./billing";
import { isLive } from "./billing/plan";
import type { Tx } from "./db/client";
import { file, organization, subscription } from "./db/schema";
import { reportError } from "./error-reporting";
import type { FileStorage } from "./storage";

/** What outlives a deleted organization's rows, to clean up once its transaction commits. */
export interface DeletedOrganizations {
  storageKeys: string[];
  subscriptionIds: string[];
}

/**
 * Deletes organizations with everything they hold, which cascades from them: records,
 * settings, files, memberships, outbox… Their stored files and live subscriptions are
 * returned for `cleanUpDeleted`, to run after the commit.
 */
export async function deleteOrganizations(tx: Tx, ids: string[]): Promise<DeletedOrganizations> {
  if (!ids.length) return { storageKeys: [], subscriptionIds: [] };
  const files = await tx.select({ key: file.storageKey }).from(file).where(inArray(file.organizationId, ids));
  const subscriptions = await tx
    .select({ id: subscription.stripeSubscriptionId, status: subscription.status })
    .from(subscription)
    .where(inArray(subscription.organizationId, ids));
  await tx.delete(organization).where(inArray(organization.id, ids));
  return {
    storageKeys: files.map((row) => row.key),
    subscriptionIds: subscriptions.filter((row) => row.id && isLive(row.status)).map((row) => row.id!),
  };
}

/**
 * After the commit: a file left behind by a failure here is unreachable, never a dangling
 * row. Nobody is left to use what a subscription would pay for, so it is cancelled; a
 * failure must reach someone, who cancels it by hand.
 */
export async function cleanUpDeleted(
  { storageKeys, subscriptionIds }: DeletedOrganizations,
  storage: FileStorage,
  billing: Billing | null,
  request: { method: string; route: string },
) {
  for (const key of storageKeys) {
    await storage.delete(key).catch((error: unknown) => console.error(`Couldn't delete file ${key}`, error));
  }
  for (const id of subscriptionIds) {
    await billing?.stripe.cancelSubscription(id).catch((error: unknown) => {
      console.error(`Couldn't cancel subscription ${id}`, error);
      reportError(error, request);
    });
  }
}
