import { createApp } from "../app";
import { createAuth } from "../auth";
import { createBilling } from "../billing";
import { signWebhook, type StripeInvoice, type StripeSubscription } from "../billing/stripe";
import type { Env } from "../env";
import { accountMailer, db, env, mailer, storage } from "./harness";

export const prices = { monthly: "price_monthly", quarterly: "price_quarterly", yearly: "price_yearly" };
const webhookSecret = "whsec_test";

export const billingEnv: Env = {
  ...env,
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_WEBHOOK_SECRET: webhookSecret,
  STRIPE_PRICE_MONTHLY: prices.monthly,
  STRIPE_PRICE_QUARTERLY: prices.quarterly,
  STRIPE_PRICE_YEARLY: prices.yearly,
  STRIPE_TAX_RATE: "txr_vat21",
};

/**
 * Stripe in memory: the endpoints billing calls, with the requests they got. Tests put
 * subscriptions in `subscriptions` as Stripe would hold them after a checkout.
 */
export const stripe = {
  requests: [] as { method: string; path: string; form: URLSearchParams; idempotencyKey: string | null }[],
  customers: new Map<string, string>(),
  subscriptions: new Map<string, StripeSubscription>(),
  /** Invoices by customer, in any status, newest first. */
  invoices: new Map<string, (StripeInvoice & { status: string })[]>(),
  /** Requests to fail, as Stripe being down. */
  down: false,
};

let counter = 0;

async function fakeStripe(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : input);
  const method = init?.method ?? "GET";
  const headers = new Headers(init?.headers);
  stripe.requests.push({
    method,
    path: url.pathname,
    form: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    idempotencyKey: headers.get("idempotency-key"),
  });
  const reply = (body: unknown, status = 200) => Response.json(body, { status });
  if (stripe.down) return reply({ error: { message: "Stripe is down" } }, 500);

  const [, , resource, id] = url.pathname.split("/");
  if (method === "POST" && resource === "customers") {
    const key = headers.get("idempotency-key") ?? `${++counter}`;
    if (!stripe.customers.has(key)) stripe.customers.set(key, `cus_${++counter}`);
    return reply({ id: stripe.customers.get(key) });
  }
  if (method === "POST" && url.pathname === "/v1/checkout/sessions")
    return reply({ url: `https://checkout.stripe.com/c/pay/cs_test_${++counter}` });
  if (method === "POST" && url.pathname === "/v1/billing_portal/sessions")
    return reply({ url: `https://billing.stripe.com/p/session/test_${++counter}` });
  if (url.hostname === "pay.stripe.com")
    return new Response(`%PDF-1.4 ${url.pathname}`, { headers: { "content-type": "application/octet-stream" } });
  if (method === "GET" && url.pathname === "/v1/invoices") {
    const status = url.searchParams.get("status");
    const found = (stripe.invoices.get(url.searchParams.get("customer") ?? "") ?? []).filter(
      (invoice) => !status || invoice.status === status,
    );
    return reply({ object: "list", data: found, has_more: false });
  }
  if (resource === "subscriptions" && id) {
    const found = stripe.subscriptions.get(id);
    if (!found) return reply({ error: { message: `No such subscription: '${id}'` } }, 404);
    if (method === "DELETE") found.status = "canceled";
    return reply(found);
  }
  return reply({ error: { message: `Unrecognized request URL (${method}: ${url.pathname})` } }, 404);
}

/** Billing against the Stripe above. */
export const testBilling = createBilling(billingEnv, fakeStripe)!;

export const billingApp = createApp({
  db,
  auth: createAuth(db, billingEnv, accountMailer),
  env: billingEnv,
  storage,
  mailer,
  billing: testBilling,
});

/** A subscription in Stripe, as a checkout for the customer leaves it. */
export function subscribe(customer: string, period: keyof typeof prices = "monthly", status = "active") {
  const id = `sub_${++counter}`;
  const subscription: StripeSubscription = {
    id,
    customer,
    status,
    cancel_at_period_end: false,
    cancel_at: null,
    items: { data: [{ price: { id: prices[period] }, current_period_end: 1_800_000_000 }] },
  };
  stripe.subscriptions.set(id, subscription);
  return subscription;
}

/** Sends a webhook event to the billing app, signed as Stripe signs it. */
export async function sendEvent(type: string, object: Record<string, unknown>, id = `evt_${++counter}`) {
  const body = JSON.stringify({ id, type, data: { object } });
  return billingApp.request("/v1/billing/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signWebhook(body, webhookSecret) },
    body,
  });
}

/** An invoice Stripe issued the customer, newest first among theirs. */
export function invoice(customer: string, amountPaid: number, status = "paid", paidAt = 1_792_860_934) {
  const id = `in_${++counter}`;
  const issued = {
    id,
    number: `CL-${String(counter).padStart(4, "0")}`,
    created: paidAt,
    amount_paid: status === "paid" ? amountPaid : 0,
    status,
    status_transitions: { paid_at: status === "paid" ? paidAt : null },
    invoice_pdf: `https://pay.stripe.com/invoice/${id}/pdf`,
    hosted_invoice_url: `https://invoice.stripe.com/i/${id}`,
  };
  stripe.invoices.set(customer, [issued, ...(stripe.invoices.get(customer) ?? [])]);
  return issued;
}
