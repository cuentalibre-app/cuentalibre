import { billingSchema, checkoutRequestSchema } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { customerOf, handleEvent, type Billing } from "../billing";
import { isLive, planOf } from "../billing/plan";
import { verifyWebhook } from "../billing/stripe";
import type { AppEnv } from "../context";
import { organization, subscription } from "../db/schema";
import { ApiError, errorContent, errorResponse } from "../errors";
import { requireOrganization, requireSession } from "../middleware";

const tenantErrors = {
  401: errorContent("Not signed in"),
  403: errorContent("No active organization, or the user doesn't belong to it"),
};
const json = <S extends z.ZodType>(schema: S) => ({ "application/json": { schema } });
const redirect = z.object({ url: z.url() });

const current = createRoute({
  method: "get",
  path: "/billing",
  tags: ["Billing"],
  summary: "The active organization's plan and subscription",
  description:
    "`plan` says what the organization may do: write during its trial, while it pays and while a failed charge is retried; otherwise read and export only.",
  middleware: [requireOrganization] as const,
  responses: {
    200: { description: "The plan", content: json(billingSchema) },
    ...tenantErrors,
  },
});

const checkout = createRoute({
  method: "post",
  path: "/billing/checkout",
  tags: ["Billing"],
  summary: "Start paying for the organization: a Stripe Checkout page to open",
  description:
    "Only owners and administrators, signed in. Back from Stripe, the plan changes once its webhook arrives.",
  middleware: [requireSession, requireOrganization] as const,
  request: { body: { required: true, content: json(checkoutRequestSchema) } },
  responses: {
    200: { description: "Where to send the person", content: json(redirect) },
    401: errorContent("Not signed in, or signed in with an API key"),
    403: errorContent("No active organization, or the user isn't one of its owners or administrators"),
    409: errorContent("The organization already has a subscription: change it in the portal"),
  },
});

const portal = createRoute({
  method: "post",
  path: "/billing/portal",
  tags: ["Billing"],
  summary: "Manage the subscription: a Stripe customer portal page to open",
  description:
    "Change the period, the card or the billing details, see past invoices or cancel at the end of the period. Only owners and administrators, signed in.",
  middleware: [requireSession, requireOrganization] as const,
  responses: {
    200: { description: "Where to send the person", content: json(redirect) },
    401: errorContent("Not signed in, or signed in with an API key"),
    403: errorContent("No active organization, or the user isn't one of its owners or administrators"),
    409: errorContent("The organization has never subscribed"),
  },
});

function requireManager(c: Context<AppEnv>) {
  if (c.get("role") === "member")
    throw new ApiError(403, "forbidden", "Only the organization's owners and administrators manage its plan.");
}

/**
 * Charging for Cloud, mounted only when the instance bills. The webhook stays out of the
 * OpenAPI document: only Stripe calls it, signed with the endpoint's secret.
 */
export const billingRoutes = (billing: Billing, webOrigin: string) => {
  const returnUrl = `${webOrigin}/configuracion/plan`;
  return new OpenAPIHono<AppEnv>()
    .openapi(current, async (c) => {
      const db = c.get("db");
      const organizationId = c.get("organizationId");
      const [org] = await db
        .select({ createdAt: organization.createdAt })
        .from(organization)
        .where(eq(organization.id, organizationId));
      const [row] = await db.select().from(subscription).where(eq(subscription.organizationId, organizationId));
      return c.json(
        {
          plan: planOf(org!, row ?? null),
          subscription: row?.status
            ? {
                period: row.period,
                status: row.status,
                currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
                cancelAtPeriodEnd: row.cancelAtPeriodEnd,
              }
            : null,
        },
        200,
      );
    })
    .openapi(checkout, async (c) => {
      requireManager(c);
      const db = c.get("db");
      const organizationId = c.get("organizationId");
      const [org] = await db
        .select({ id: organization.id, name: organization.name, status: subscription.status })
        .from(organization)
        .leftJoin(subscription, eq(subscription.organizationId, organization.id))
        .where(eq(organization.id, organizationId));
      if (isLive(org!.status ?? null))
        return errorResponse(c, 409, "already_subscribed", "The organization already has a subscription.");

      const customer = await customerOf(db, billing, org!, c.get("user")!.email);
      const session = await billing.stripe.createCheckoutSession({
        mode: "subscription",
        customer,
        client_reference_id: organizationId,
        line_items: [{ price: billing.prices[c.req.valid("json").period], quantity: 1 }],
        subscription_data: { default_tax_rates: [billing.taxRate], metadata: { organization_id: organizationId } },
        // Our invoices need the customer's address and, for businesses, their tax ID
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        customer_update: { name: "auto", address: "auto" },
        locale: "es",
        success_url: `${returnUrl}?suscripcion=ok`,
        cancel_url: returnUrl,
      });
      return c.json({ url: session.url }, 200);
    })
    .openapi(portal, async (c) => {
      requireManager(c);
      const [row] = await c
        .get("db")
        .select({ customer: subscription.stripeCustomerId, status: subscription.status })
        .from(subscription)
        .where(eq(subscription.organizationId, c.get("organizationId")));
      if (!row?.status) return errorResponse(c, 409, "no_subscription", "The organization has never subscribed.");
      const session = await billing.stripe.createPortalSession({ customer: row.customer, return_url: returnUrl });
      return c.json({ url: session.url }, 200);
    })
    .post("/billing/webhook", async (c) => {
      const event = verifyWebhook(await c.req.text(), c.req.header("stripe-signature"), billing.webhookSecret);
      if (!event) return errorResponse(c, 400, "invalid_signature", "The Stripe signature doesn't match.");
      await handleEvent(c.get("db"), billing, event);
      return c.json({ received: true }, 200);
    });
};
