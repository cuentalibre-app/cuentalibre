import type { BillingPeriod } from "@cuentalibre/contracts";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { stripeEvent, subscription } from "../db/schema";
import type { Env } from "../env";
import { reportError } from "../error-reporting";
import { isLive } from "./plan";
import { stripeClient, type StripeClient, type StripeEvent, type StripeSubscription } from "./stripe";

/** Charging for Cloud: present only when the instance has the `STRIPE_*` variables. */
export interface Billing {
  stripe: StripeClient;
  webhookSecret: string;
  prices: Record<BillingPeriod, string>;
  /** The VAT rate added on top of the prices. */
  taxRate: string;
}

export function createBilling(env: Env, fetchImpl: typeof fetch = fetch): Billing | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return {
    stripe: stripeClient(env.STRIPE_SECRET_KEY, fetchImpl),
    webhookSecret: env.STRIPE_WEBHOOK_SECRET!,
    prices: {
      monthly: env.STRIPE_PRICE_MONTHLY!,
      quarterly: env.STRIPE_PRICE_QUARTERLY!,
      yearly: env.STRIPE_PRICE_YEARLY!,
    },
    taxRate: env.STRIPE_TAX_RATE!,
  };
}

/**
 * The organization's Stripe customer, made the first time someone goes to pay. The
 * idempotency key makes two requests at once get the same customer.
 */
export async function customerOf(
  db: Db,
  billing: Billing,
  organization: { id: string; name: string },
  email: string,
): Promise<string> {
  const [row] = await db
    .select({ id: subscription.stripeCustomerId })
    .from(subscription)
    .where(eq(subscription.organizationId, organization.id));
  if (row) return row.id;
  const customer = await billing.stripe.createCustomer(
    { name: organization.name, email, preferred_locales: ["es"], metadata: { organization_id: organization.id } },
    `customer-${organization.id}`,
  );
  await db
    .insert(subscription)
    .values({ organizationId: organization.id, stripeCustomerId: customer.id })
    .onConflictDoNothing();
  return customer.id;
}

/** Events that may change a subscription; the rest are acknowledged and ignored. */
const SUBSCRIPTION_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

/** The subscription an event is about, wherever its type keeps it. */
function subscriptionIdOf(event: StripeEvent): string | null {
  const object = event.data.object as {
    id?: string;
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } } | null } | null;
  };
  if (event.type.startsWith("customer.subscription.")) return object.id ?? null;
  const reference = object.subscription ?? object.parent?.subscription_details?.subscription ?? null;
  return typeof reference === "string" ? reference : (reference?.id ?? null);
}

/**
 * Handles a webhook event once: reads the subscription it is about fresh from Stripe, so
 * events arriving late or out of order can't leave an old state behind, and stores it.
 */
export async function handleEvent(db: Db, billing: Billing, event: StripeEvent) {
  if (!SUBSCRIPTION_EVENTS.has(event.type)) return;
  const [seen] = await db.select({ id: stripeEvent.id }).from(stripeEvent).where(eq(stripeEvent.id, event.id));
  if (seen) return;
  const id = subscriptionIdOf(event);
  const current = id ? await billing.stripe.retrieveSubscription(id) : null;

  await db.transaction(async (tx) => {
    const [fresh] = await tx
      .insert(stripeEvent)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvent.id });
    if (!fresh || !current) return;

    const [row] = await tx
      .select()
      .from(subscription)
      .where(eq(subscription.stripeCustomerId, current.customer))
      .for("update");
    // A customer we don't know: another instance's, or of an organization already deleted
    if (!row) return;
    if (row.stripeSubscriptionId && row.stripeSubscriptionId !== current.id && isLive(row.status)) {
      // A second subscription while the first still charges, as from two checkouts at once
      if (isLive(current.status)) {
        const error = new Error(
          `Organization ${row.organizationId} has two live subscriptions: ${row.stripeSubscriptionId} and ${current.id}`,
        );
        console.error(error);
        reportError(error, { method: "POST", route: "/v1/billing/webhook" });
      }
      return;
    }
    await tx
      .update(subscription)
      .set(subscriptionFields(billing, current))
      .where(eq(subscription.organizationId, row.organizationId));
  });
}

function subscriptionFields(billing: Billing, current: StripeSubscription) {
  const [item] = current.items.data;
  const period = (Object.keys(billing.prices) as BillingPeriod[]).find((key) => billing.prices[key] === item?.price.id);
  return {
    stripeSubscriptionId: current.id,
    period: period ?? null,
    status: current.status,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: current.cancel_at_period_end || current.cancel_at !== null,
  };
}
