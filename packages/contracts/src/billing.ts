import { z } from "zod";

/** How often a Cloud subscription is charged. */
export const billingPeriodSchema = z.enum(["monthly", "quarterly", "yearly"]);
export type BillingPeriod = z.infer<typeof billingPeriodSchema>;

/**
 * What an organization may do on Cloud: `trial` during its free days, `active` while
 * it pays, `pastDue` while Stripe retries a failed charge, and `readOnly` otherwise.
 */
export const planStatusSchema = z.enum(["trial", "active", "pastDue", "readOnly"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const planSchema = z.object({
  status: planStatusSchema,
  /** False when read-only: it can still read and export everything. */
  canWrite: z.boolean(),
  trialEndsAt: z.iso.datetime(),
});
export type Plan = z.infer<typeof planSchema>;

/** The organization's Stripe subscription, as the last webhook left it. */
export const subscriptionSchema = z.object({
  /** Null for a price this instance doesn't sell any more. */
  period: billingPeriodSchema.nullable(),
  /** Stripe's own status: `active`, `past_due`, `canceled`… */
  status: z.string(),
  /** When the paid period ends: the next charge, or the end of access if it is cancelled. */
  currentPeriodEnd: z.iso.datetime().nullable(),
  /** Cancelled, but paid until `currentPeriodEnd`. */
  cancelAtPeriodEnd: z.boolean(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const billingSchema = z.object({
  plan: planSchema,
  /** Null until the organization subscribes. */
  subscription: subscriptionSchema.nullable(),
});
export type Billing = z.infer<typeof billingSchema>;

export const checkoutRequestSchema = z.object({ period: billingPeriodSchema });
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
