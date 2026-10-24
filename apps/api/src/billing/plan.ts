import type { Plan } from "@cuentalibre/contracts";

/** Free days for a new organization, with no card. */
export const TRIAL_DAYS = 30;

/** Stripe statuses that pay, and those that keep access while Stripe retries a failed charge. */
const PAYING = new Set(["active", "trialing"]);
const RETRYING = new Set(["past_due"]);

/**
 * What an organization may do on Cloud: write while it pays, while Stripe retries a
 * failed charge, or during its trial; read and export only, otherwise (`requireWritable`).
 */
export function planOf(
  organization: { createdAt: Date },
  subscription: { status: string | null } | null,
  now = new Date(),
): Plan {
  const trialEnd = new Date(organization.createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const status = subscription?.status ?? "";
  const plan = (value: Plan["status"], canWrite: boolean): Plan => ({
    status: value,
    canWrite,
    trialEndsAt: trialEnd.toISOString(),
  });
  if (PAYING.has(status)) return plan("active", true);
  if (RETRYING.has(status)) return plan("pastDue", true);
  if (now < trialEnd) return plan("trial", true);
  return plan("readOnly", false);
}

/** A subscription that still charges or may charge again: it must be cancelled when its organization goes. */
export const isLive = (status: string | null) =>
  status !== null && !["canceled", "incomplete_expired"].includes(status);
