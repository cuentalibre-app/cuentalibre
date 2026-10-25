import { createHmac, timingSafeEqual } from "node:crypto";

/** The API version the requests and the webhook's events are read with. */
export const STRIPE_API_VERSION = "2026-09-30.endive";

/** A subscription, with the fields we read. */
export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  items: { data: { price: { id: string }; current_period_end?: number }[] };
}

/** An invoice Stripe issued for a subscription's charge, with the fields we read. */
export interface StripeInvoice {
  id: string;
  /** Null while it is a draft. */
  number: string | null;
  created: number;
  /** In cents, VAT included. */
  amount_paid: number;
  status_transitions: { paid_at: number | null };
  /** Its PDF, and the page where the customer sees it; Stripe makes them when asked. */
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

/** A webhook event; `data.object` depends on its type. */
export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/** The few Stripe endpoints billing uses. */
export interface StripeClient {
  createCustomer(params: Params, idempotencyKey: string): Promise<{ id: string }>;
  createCheckoutSession(params: Params): Promise<{ url: string }>;
  createPortalSession(params: Params): Promise<{ url: string }>;
  retrieveSubscription(id: string): Promise<StripeSubscription>;
  /** The customer's paid invoices, newest first, up to 100. */
  listPaidInvoices(customer: string): Promise<StripeInvoice[]>;
  /** Cancels it at once, without refunding the period started. */
  cancelSubscription(id: string): Promise<void>;
}

type Param = string | number | boolean | Params | Param[];
interface Params {
  [key: string]: Param | undefined;
}

/**
 * Stripe over `fetch`, without its SDK: form-encoded requests, JSON responses. Errors
 * carry Stripe's message, which names the parameter at fault but never the key.
 */
export function stripeClient(secretKey: string, fetchImpl: typeof fetch = fetch): StripeClient {
  async function send<T>(method: string, path: string, params?: Params, idempotencyKey?: string): Promise<T> {
    const response = await fetchImpl(`https://api.stripe.com${path}`, {
      method,
      headers: {
        authorization: `Bearer ${secretKey}`,
        "stripe-version": STRIPE_API_VERSION,
        ...(params && { "content-type": "application/x-www-form-urlencoded" }),
        ...(idempotencyKey && { "idempotency-key": idempotencyKey }),
      },
      body: params && encodeForm(params),
    });
    const body = (await response.json()) as T & { error?: { message?: string } };
    if (!response.ok)
      throw new Error(`Stripe ${method} ${path} failed: ${response.status} ${body.error?.message ?? ""}`);
    return body;
  }

  return {
    createCustomer: (params, idempotencyKey) => send("POST", "/v1/customers", params, idempotencyKey),
    createCheckoutSession: (params) => send("POST", "/v1/checkout/sessions", params),
    createPortalSession: (params) => send("POST", "/v1/billing_portal/sessions", params),
    retrieveSubscription: (id) => send("GET", `/v1/subscriptions/${encodeURIComponent(id)}`),
    async listPaidInvoices(customer) {
      const query = new URLSearchParams({ customer, status: "paid", limit: "100" });
      return (await send<{ data: StripeInvoice[] }>("GET", `/v1/invoices?${query}`)).data;
    },
    async cancelSubscription(id) {
      await send("DELETE", `/v1/subscriptions/${encodeURIComponent(id)}`);
    },
  };
}

/** Stripe's form encoding: nested objects and arrays as `a[b][0]=c`. */
export function encodeForm(params: Params): string {
  const pairs: [string, string][] = [];
  const add = (key: string, value: Param | undefined) => {
    if (value === undefined) return;
    if (Array.isArray(value)) value.forEach((item, index) => add(`${key}[${index}]`, item));
    else if (typeof value === "object") for (const [name, item] of Object.entries(value)) add(`${key}[${name}]`, item);
    else pairs.push([key, String(value)]);
  };
  for (const [key, value] of Object.entries(params)) add(key, value);
  return new URLSearchParams(pairs).toString();
}

/** How old an event's signature may be, against replays. */
const SIGNATURE_TOLERANCE_S = 5 * 60;

/**
 * The event in a webhook request, or null when its `Stripe-Signature` doesn't match: an
 * HMAC-SHA256 of `<timestamp>.<body>` with the endpoint's secret, made in the last five minutes.
 */
export function verifyWebhook(body: string, header: string | undefined, secret: string, now = Date.now()) {
  const parts = (header ?? "").split(",").map((part) => part.split("=", 2) as [string, string?]);
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  if (!Number.isInteger(timestamp) || Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) return null;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  const matches = parts
    .filter(([key, value]) => key === "v1" && value)
    .some(([, value]) => {
      const signature = Buffer.from(value!, "hex");
      return signature.length === expected.length && timingSafeEqual(signature, expected);
    });
  return matches ? (JSON.parse(body) as StripeEvent) : null;
}

/** A `Stripe-Signature` header for the body, as Stripe would send it; for tests. */
export function signWebhook(body: string, secret: string, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
