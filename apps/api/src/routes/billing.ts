import {
  billingInvoiceSchema,
  billingSchema,
  checkoutRequestSchema,
  type BillingInvoice,
} from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { customerOf, handleEvent, type Billing } from "../billing";
import { firstChargeOf, isLive, planOf } from "../billing/plan";
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
    "Only owners and administrators, signed in. During the trial the card is taken now and the first charge lands when the trial ends. Back from Stripe, the plan changes once its webhook arrives.",
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

const invoices = createRoute({
  method: "get",
  path: "/billing/invoices",
  tags: ["Billing"],
  summary: "The invoices for the organization's plan, newest first",
  description:
    "Every charge paid, with links to its PDF and to Stripe's page for it. Stripe makes the links when asked, so ask again rather than keeping them. Only owners and administrators; read-only organizations too.",
  middleware: [requireOrganization] as const,
  responses: {
    200: { description: "The invoices", content: json(z.object({ invoices: z.array(billingInvoiceSchema) })) },
    401: errorContent("Not signed in"),
    403: errorContent("No active organization, or the user isn't one of its owners or administrators"),
  },
});

const invoicePdf = createRoute({
  method: "get",
  path: "/billing/invoices/{id}/pdf",
  tags: ["Billing"],
  summary: "An invoice of the organization's plan, as a PDF",
  description:
    "Shown in the browser rather than downloaded. Only owners and administrators; read-only organizations too.",
  middleware: [requireOrganization] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The invoice",
      content: { "application/pdf": { schema: z.string().openapi({ type: "string", format: "binary" }) } },
    },
    401: errorContent("Not signed in"),
    403: errorContent("No active organization, or the user isn't one of its owners or administrators"),
    404: errorContent("Not one of the organization's invoices"),
  },
});

/**
 * The organization's paid invoices in Stripe, newest first: not the 0 € one of subscribing
 * during the trial, which charged nothing.
 */
async function paidInvoicesOf(c: Context<AppEnv>, billing: Billing) {
  requireManager(c);
  const [row] = await c
    .get("db")
    .select({ customer: subscription.stripeCustomerId })
    .from(subscription)
    .where(eq(subscription.organizationId, c.get("organizationId")));
  const paid = row ? await billing.stripe.listPaidInvoices(row.customer) : [];
  return paid.filter(
    (invoice) => invoice.amount_paid > 0 && invoice.number && invoice.invoice_pdf && invoice.hosted_invoice_url,
  );
}

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
        .select({
          id: organization.id,
          name: organization.name,
          createdAt: organization.createdAt,
          status: subscription.status,
        })
        .from(organization)
        .leftJoin(subscription, eq(subscription.organizationId, organization.id))
        .where(eq(organization.id, organizationId));
      if (isLive(org!.status ?? null))
        return errorResponse(c, 409, "already_subscribed", "The organization already has a subscription.");

      const { period, returnTo } = c.req.valid("json");
      // From the welcome steps, paying goes into the app; going back, to the plan step again
      const back = returnTo === "app" ? `${webOrigin}/` : returnUrl;
      const cancel = returnTo === "app" ? `${webOrigin}/bienvenida` : returnUrl;
      const firstCharge = firstChargeOf(org!);
      const customer = await customerOf(db, billing, org!, c.get("user")!.email);
      const session = await billing.stripe.createCheckoutSession({
        mode: "subscription",
        customer,
        client_reference_id: organizationId,
        line_items: [{ price: billing.prices[period], quantity: 1 }],
        // Stripe Tax picks the VAT from the address: 21 % in Spain, none in Canarias, Ceuta
        // and Melilla, reverse charge for EU businesses with a VAT number
        automatic_tax: { enabled: true },
        subscription_data: {
          metadata: { organization_id: organizationId },
          // Subscribing during the trial keeps its remaining days
          trial_end: firstCharge ? Math.floor(firstCharge.getTime() / 1000) : undefined,
        },
        // Our invoices need the customer's address and, for businesses, their tax ID
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        customer_update: { name: "auto", address: "auto" },
        locale: "es",
        success_url: `${back}?suscripcion=ok`,
        cancel_url: cancel,
      });
      return c.json({ url: session.url }, 200);
    })
    .openapi(invoices, async (c) =>
      c.json(
        {
          invoices: (await paidInvoicesOf(c, billing)).map((invoice): BillingInvoice => ({
            id: invoice.id,
            number: invoice.number!,
            paidAt: new Date((invoice.status_transitions.paid_at ?? invoice.created) * 1000).toISOString(),
            total: invoice.amount_paid as BillingInvoice["total"],
            url: invoice.hosted_invoice_url!,
          })),
        },
        200,
      ),
    )
    .openapi(invoicePdf, async (c) => {
      const { id } = c.req.valid("param");
      // Found among the organization's own, so no other customer's invoice can be read
      const invoice = (await paidInvoicesOf(c, billing)).find((paid) => paid.id === id);
      if (!invoice) return errorResponse(c, 404, "not_found", "No such invoice for this organization.");
      return c.body(await billing.stripe.downloadInvoicePdf(invoice), 200, {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(`Factura ${invoice.number}.pdf`)}`,
        "cache-control": "private, no-store",
      });
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
