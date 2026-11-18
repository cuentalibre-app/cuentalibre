import { planOf, trialEndOf } from "./plan";

/** How long an organization may stay read-only before it is deleted. */
export const READ_ONLY_MONTHS = 12;

/** The emails owners get before the deletion, earliest first. */
export const DELETION_NOTICES = ["6m", "1m", "1w"] as const;
export type DeletionNotice = (typeof DELETION_NOTICES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
/** The last notice always comes at least this long before the deletion. */
const LAST_NOTICE_MS = 7 * DAY_MS;

/** The same day and time some months later or earlier, on the month's last day when it has no such day. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

const latest = (a: Date, b: Date) => (a > b ? a : b);

/** When each notice is due, for an organization to be deleted at `deleteAt`. */
const dueAt: Record<DeletionNotice, (deleteAt: Date) => Date> = {
  "6m": (deleteAt) => addMonths(deleteAt, -6),
  "1m": (deleteAt) => addMonths(deleteAt, -1),
  "1w": (deleteAt) => new Date(deleteAt.getTime() - LAST_NOTICE_MS),
};

/**
 * Since when the organization has been read-only: the end of its trial or of the last
 * period it paid for, whichever is later. Null while it can write.
 */
export function readOnlySince(
  organization: { createdAt: Date },
  subscription: { status: string | null; currentPeriodEnd: Date | null } | null,
  now = new Date(),
): Date | null {
  if (planOf(organization, subscription, now).canWrite) return null;
  const trialEnd = trialEndOf(organization);
  const periodEnd = subscription?.currentPeriodEnd;
  return periodEnd ? latest(trialEnd, periodEnd) : trialEnd;
}

export type RetentionStep =
  { action: "wait" } | { action: "notify"; notice: DeletionNotice; deleteAt: Date } | { action: "delete" };

/**
 * What to do today with an organization read-only since `since`, given the notices
 * already sent for that spell and when. It is deleted 12 months after `since`, but never
 * less than a week after the last notice, so a late run postpones the deletion instead of
 * skipping the warning. Only the latest notice due is sent: one that was missed is
 * skipped, not sent days before the next one.
 */
export function retentionStep(
  since: Date,
  sent: Partial<Record<DeletionNotice, Date>>,
  now = new Date(),
): RetentionStep {
  const scheduled = addMonths(since, READ_ONLY_MONTHS);
  const lastSent = sent["1w"];
  if (lastSent)
    return now >= latest(scheduled, new Date(lastSent.getTime() + LAST_NOTICE_MS))
      ? { action: "delete" }
      : { action: "wait" };

  const due = DELETION_NOTICES.filter((notice) => now >= dueAt[notice](scheduled)).at(-1);
  if (!due || sent[due]) return { action: "wait" };
  return { action: "notify", notice: due, deleteAt: latest(scheduled, new Date(now.getTime() + LAST_NOTICE_MS)) };
}
