import type { Billing, BillingInvoice } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { firstChargeOf, planOf } from "./billing/plan";
import { encodeForm, signWebhook, verifyWebhook } from "./billing/stripe";
import { membership, organization, session, subscription } from "./db/schema";
import { loadEnv } from "./env";
import { app, createOrganization, db, signUp, type Client } from "./test/harness";
import { billingApp, billingEnv, invoice, prices, sendEvent, stripe, subscribe } from "./test/stripe";

const DAY = 24 * 60 * 60 * 1000;

async function owner(name = "Ana") {
  const client = await signUp(name, billingApp);
  const org = await createOrganization(client, `${name} SL`);
  return Object.assign(client, { organizationId: org.id });
}

async function billingOf(client: Client) {
  const response = await client.request("/v1/billing");
  expect(response.status).toBe(200);
  return (await response.json()) as Billing;
}

/** Goes through checkout and back: the customer it made, and the subscription Stripe holds for it. */
async function subscribed(client: Client & { organizationId: string }, period: keyof typeof prices = "monthly") {
  const response = await client.request("/v1/billing/checkout", { method: "POST", body: { period } });
  expect(response.status).toBe(200);
  const [row] = await billingDb(client.organizationId);
  const created = subscribe(row!.stripeCustomerId, period);
  expect((await sendEvent("checkout.session.completed", { subscription: created.id })).status).toBe(200);
  return created;
}

const billingDb = (organizationId: string) =>
  db.select().from(subscription).where(eq(subscription.organizationId, organizationId));

const retrievals = () => stripe.requests.filter((request) => request.method === "GET").length;

beforeEach(() => {
  stripe.requests.length = 0;
  stripe.down = false;
});

describe("planOf", () => {
  const createdAt = new Date("2026-10-01T10:00:00Z");

  it("lets a new organization write during its 30-day trial, and only read after it", () => {
    expect(planOf({ createdAt }, null, new Date("2026-10-30T10:00:00Z"))).toEqual({
      status: "trial",
      canWrite: true,
      trialEndsAt: "2026-10-31T10:00:00.000Z",
    });
    expect(planOf({ createdAt }, null, new Date("2026-10-31T10:00:00Z"))).toMatchObject({
      status: "readOnly",
      canWrite: false,
    });
  });

  it("keeps writing while it pays and while Stripe retries a failed charge", () => {
    const late = new Date("2027-06-01T00:00:00Z");
    expect(planOf({ createdAt }, { status: "active" }, late)).toMatchObject({ status: "active", canWrite: true });
    expect(planOf({ createdAt }, { status: "past_due" }, late)).toMatchObject({ status: "pastDue", canWrite: true });
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", null])
      expect(planOf({ createdAt }, { status }, late)).toMatchObject({ status: "readOnly", canWrite: false });
  });

  it("falls back to the trial when a subscription ends within it", () => {
    expect(planOf({ createdAt }, { status: "canceled" }, new Date(createdAt.getTime() + 2 * DAY))).toMatchObject({
      status: "trial",
    });
  });
});

describe("firstChargeOf", () => {
  const createdAt = new Date("2026-10-01T10:00:00Z");

  it("charges a subscription taken during the trial when the trial ends, unless it ends within two days", () => {
    const trialEnd = new Date("2026-10-31T10:00:00Z");
    expect(firstChargeOf({ createdAt }, createdAt)).toEqual(trialEnd);
    expect(firstChargeOf({ createdAt }, new Date("2026-10-29T08:00:00Z"))).toEqual(trialEnd);
    expect(firstChargeOf({ createdAt }, new Date("2026-10-29T10:00:00Z"))).toBeNull();
    expect(firstChargeOf({ createdAt }, new Date("2026-11-15T10:00:00Z"))).toBeNull();
  });
});

describe("the Stripe client", () => {
  it("encodes nested parameters as Stripe expects", () => {
    expect(
      decodeURIComponent(
        encodeForm({ line_items: [{ price: "price_1", quantity: 1 }], metadata: { a: "b" }, skip: undefined }),
      ),
    ).toBe("line_items[0][price]=price_1&line_items[0][quantity]=1&metadata[a]=b");
  });

  it("only takes webhook events signed with the secret in the last five minutes", () => {
    const body = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: {} } });
    const now = Date.now();
    expect(verifyWebhook(body, signWebhook(body, "whsec_a", now), "whsec_a", now)?.id).toBe("evt_1");
    expect(verifyWebhook(body, `t=1,v1=00,${signWebhook(body, "whsec_a", now)}`, "whsec_a", now)?.id).toBeUndefined();
    expect(verifyWebhook(body, `${signWebhook(body, "whsec_a", now)},v1=00`, "whsec_a", now)?.id).toBe("evt_1");
    expect(verifyWebhook(body, signWebhook(body, "whsec_b", now), "whsec_a", now)).toBeNull();
    expect(verifyWebhook(`${body} `, signWebhook(body, "whsec_a", now), "whsec_a", now)).toBeNull();
    expect(verifyWebhook(body, signWebhook(body, "whsec_a", now - 6 * 60 * 1000), "whsec_a", now)).toBeNull();
    expect(verifyWebhook(body, undefined, "whsec_a", now)).toBeNull();
  });
});

describe("billing", () => {
  it("is off unless every Stripe variable is set", async () => {
    expect(() => loadEnv({ STRIPE_SECRET_KEY: "sk_test_x" })).toThrow(/Billing needs all of/);
    expect(loadEnv({}).STRIPE_SECRET_KEY).toBeUndefined();

    const ana = await signUp();
    await createOrganization(ana, "Ana SL");
    expect((await ana.request("/v1/billing")).status).toBe(404);
    expect((await app.request("/v1/billing/webhook", { method: "POST", body: "{}" })).status).toBe(404);
    expect((await (await billingApp.request("/v1/sign-in-methods")).json()) as object).toMatchObject({
      billing: true,
    });
  });

  it("starts a new organization on its trial, with no subscription", async () => {
    const ana = await owner();
    const billing = await billingOf(ana);
    expect(billing.subscription).toBeNull();
    expect(billing.plan).toMatchObject({ status: "trial", canWrite: true });
    expect(new Date(billing.plan.trialEndsAt).getTime() - Date.now()).toBeGreaterThan(29 * DAY);
  });

  it("sends an owner to Stripe Checkout for the period chosen, with VAT and one customer per organization", async () => {
    const ana = await owner();
    const first = await ana.request("/v1/billing/checkout", { method: "POST", body: { period: "yearly" } });
    expect(first.status).toBe(200);
    expect(((await first.json()) as { url: string }).url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    await ana.request("/v1/billing/checkout", { method: "POST", body: { period: "monthly" } });

    const customers = stripe.requests.filter((request) => request.path === "/v1/customers");
    expect(customers).toHaveLength(1);
    expect(customers[0]!.idempotencyKey).toBe(`customer-${ana.organizationId}`);
    expect(customers[0]!.form.get("email")).toBe(ana.email);
    expect(customers[0]!.form.get("metadata[organization_id]")).toBe(ana.organizationId);

    const [checkout] = stripe.requests.filter((request) => request.path === "/v1/checkout/sessions");
    const [row] = await billingDb(ana.organizationId);
    expect(Object.fromEntries(checkout!.form)).toMatchObject({
      mode: "subscription",
      customer: row!.stripeCustomerId,
      client_reference_id: ana.organizationId,
      "line_items[0][price]": prices.yearly,
      "automatic_tax[enabled]": "true",
      "subscription_data[metadata][organization_id]": ana.organizationId,
      "tax_id_collection[enabled]": "true",
      success_url: `${billingEnv.WEB_ORIGIN}/configuracion/plan?suscripcion=ok`,
      cancel_url: `${billingEnv.WEB_ORIGIN}/configuracion/plan`,
    });
    expect(row!.status).toBeNull();
  });

  it("keeps the trial's remaining days when subscribing during it, and charges at once after it", async () => {
    const ana = await owner();
    await ana.request("/v1/billing/checkout", { method: "POST", body: { period: "monthly" } });
    const [org] = await db.select().from(organization).where(eq(organization.id, ana.organizationId));
    const trialEnd = Math.floor((org!.createdAt.getTime() + 30 * DAY) / 1000);
    const checkouts = () => stripe.requests.filter((request) => request.path === "/v1/checkout/sessions");
    expect(checkouts()[0]!.form.get("subscription_data[trial_end]")).toBe(String(trialEnd));

    await db
      .update(organization)
      .set({ createdAt: new Date(Date.now() - 40 * DAY) })
      .where(eq(organization.id, ana.organizationId));
    await ana.request("/v1/billing/checkout", { method: "POST", body: { period: "monthly" } });
    expect(checkouts()[1]!.form.has("subscription_data[trial_end]")).toBe(false);
  });

  it("sends people subscribing from the welcome steps into the app, or back to the plan step", async () => {
    const ana = await owner();
    const response = await ana.request("/v1/billing/checkout", {
      method: "POST",
      body: { period: "yearly", returnTo: "app" },
    });
    expect(response.status).toBe(200);
    const [checkout] = stripe.requests.filter((request) => request.path === "/v1/checkout/sessions");
    expect(checkout!.form.get("success_url")).toBe(`${billingEnv.WEB_ORIGIN}/?suscripcion=ok`);
    expect(checkout!.form.get("cancel_url")).toBe(`${billingEnv.WEB_ORIGIN}/bienvenida`);
  });

  it("only lets owners and administrators, signed in, manage the plan", async () => {
    const ana = await owner();
    const bea = await signUp("Bea", billingApp);
    const { user: beaUser } = (await (await bea.request("/v1/me")).json()) as { user: { id: string } };
    const beaId = beaUser.id;
    await db
      .insert(membership)
      .values({ id: newId(), organizationId: ana.organizationId, userId: beaId, role: "member" });
    await db.update(session).set({ activeOrganizationId: ana.organizationId }).where(eq(session.userId, beaId));

    expect((await billingOf(bea)).plan.status).toBe("trial");
    const refused = await bea.request("/v1/billing/checkout", { method: "POST", body: { period: "monthly" } });
    expect(refused.status).toBe(403);
    expect((await bea.request("/v1/billing/portal", { method: "POST" })).status).toBe(403);

    const created = await ana.request("/v1/api-keys", { method: "POST", body: { name: "Script" } });
    const { key } = (await created.json()) as { key: string };
    const withKey = await billingApp.request("/v1/billing/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ period: "monthly" }),
    });
    expect(withKey.status).toBe(401);
  });

  it("stores the subscription from the webhook, and turns away a second checkout", async () => {
    const ana = await owner();
    const created = await subscribed(ana, "quarterly");

    expect(await billingOf(ana)).toEqual({
      plan: expect.objectContaining({ status: "active", canWrite: true }),
      subscription: {
        period: "quarterly",
        status: "active",
        currentPeriodEnd: new Date(1_800_000_000 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      },
    });
    const [row] = await billingDb(ana.organizationId);
    expect(row!.stripeSubscriptionId).toBe(created.id);

    const again = await ana.request("/v1/billing/checkout", { method: "POST", body: { period: "yearly" } });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { code: "already_subscribed" } });
  });

  it("follows changes, failed charges and cancellations, reading the subscription fresh from Stripe", async () => {
    const ana = await owner();
    const created = await subscribed(ana);

    created.items.data[0]!.price.id = prices.yearly;
    await sendEvent("customer.subscription.updated", { id: created.id, status: "this copy is stale" });
    expect((await billingOf(ana)).subscription).toMatchObject({ period: "yearly", status: "active" });

    created.status = "past_due";
    await sendEvent("invoice.payment_failed", { parent: { subscription_details: { subscription: created.id } } });
    expect((await billingOf(ana)).plan).toMatchObject({ status: "pastDue", canWrite: true });

    created.status = "active";
    created.cancel_at_period_end = true;
    await sendEvent("invoice.paid", { subscription: created.id });
    expect((await billingOf(ana)).subscription).toMatchObject({ status: "active", cancelAtPeriodEnd: true });

    created.status = "canceled";
    await sendEvent("customer.subscription.deleted", { id: created.id });
    // Still within its trial, as it was created today
    expect((await billingOf(ana)).plan.status).toBe("trial");
    await db
      .update(organization)
      .set({ createdAt: new Date(Date.now() - 40 * DAY) })
      .where(eq(organization.id, ana.organizationId));
    expect((await billingOf(ana)).plan).toMatchObject({ status: "readOnly", canWrite: false });

    // Subscribing again after cancelling is a new checkout and a new subscription
    const renewed = await ana.request("/v1/billing/checkout", { method: "POST", body: { period: "monthly" } });
    expect(renewed.status).toBe(200);
  });

  it("handles each event once, and ignores the ones it doesn't need", async () => {
    const ana = await owner();
    const created = await subscribed(ana);
    const before = retrievals();
    expect((await sendEvent("invoice.paid", { subscription: created.id }, "evt_once")).status).toBe(200);
    expect((await sendEvent("invoice.paid", { subscription: created.id }, "evt_once")).status).toBe(200);
    expect(retrievals()).toBe(before + 1);

    expect((await sendEvent("customer.created", { id: "cus_x" })).status).toBe(200);
    expect(retrievals()).toBe(before + 1);
  });

  it("leaves alone subscriptions of customers it doesn't know, and a second live one", async () => {
    const ana = await owner();
    const first = await subscribed(ana);
    expect((await sendEvent("customer.subscription.created", { id: subscribe("cus_unknown").id })).status).toBe(200);

    const [row] = await billingDb(ana.organizationId);
    const second = subscribe(row!.stripeCustomerId, "yearly");
    await sendEvent("customer.subscription.created", { id: second.id });
    const [after] = await billingDb(ana.organizationId);
    expect(after).toMatchObject({ stripeSubscriptionId: first.id, period: "monthly" });
  });

  it("rejects webhook calls without Stripe's signature", async () => {
    const response = await billingApp.request("/v1/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=00" },
      body: JSON.stringify({ id: "evt_forged", type: "invoice.paid", data: { object: {} } }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_signature" } });
  });

  it("opens the customer portal once the organization has subscribed", async () => {
    const ana = await owner();
    const early = await ana.request("/v1/billing/portal", { method: "POST" });
    expect(early.status).toBe(409);
    expect(await early.json()).toMatchObject({ error: { code: "no_subscription" } });

    await subscribed(ana);
    const response = await ana.request("/v1/billing/portal", { method: "POST" });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { url: string }).url).toMatch(/^https:\/\/billing\.stripe\.com\//);
    const [request] = stripe.requests.filter((r) => r.path === "/v1/billing_portal/sessions");
    expect(request!.form.get("return_url")).toBe(`${billingEnv.WEB_ORIGIN}/configuracion/plan`);
  });

  it("lists the invoices Stripe issued for the plan, with their links, and none before subscribing", async () => {
    const ana = await owner();
    const listed = async () => {
      const response = await ana.request("/v1/billing/invoices");
      expect(response.status).toBe(200);
      return ((await response.json()) as { invoices: BillingInvoice[] }).invoices;
    };
    expect(await listed()).toEqual([]);
    expect(stripe.requests.some((request) => request.path === "/v1/invoices")).toBe(false);

    const created = await subscribed(ana);
    // The 0 € invoice of subscribing during the trial, then the charges
    invoice(created.customer, 0, "paid", 1_790_000_000);
    const first = invoice(created.customer, 604, "paid", 1_792_860_934);
    invoice(created.customer, 604, "open", 1_795_452_934);
    const second = invoice(created.customer, 4236, "paid", 1_795_452_934);

    expect(await listed()).toEqual([
      {
        id: second.id,
        number: second.number,
        paidAt: new Date(1_795_452_934 * 1000).toISOString(),
        total: 4236,
        url: second.hosted_invoice_url,
      },
      expect.objectContaining({ id: first.id, total: 604 }),
    ]);
    const [request] = stripe.requests.filter((r) => r.path === "/v1/invoices");
    expect(request!.method).toBe("GET");
  });

  it("shows an invoice's PDF in the browser, only the organization's own", async () => {
    const ana = await owner();
    const created = await subscribed(ana);
    const paid = invoice(created.customer, 604);
    const trial = invoice(created.customer, 0);

    const response = await ana.request(`/v1/billing/invoices/${paid.id}/pdf`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename*=UTF-8''${encodeURIComponent(`Factura ${paid.number}.pdf`)}`,
    );
    expect(await response.text()).toBe(`%PDF-1.4 ${new URL(paid.invoice_pdf).pathname}`);

    expect((await ana.request(`/v1/billing/invoices/${trial.id}/pdf`)).status).toBe(404);
    const bea = await owner("Bea");
    expect((await bea.request(`/v1/billing/invoices/${paid.id}/pdf`)).status).toBe(404);
    const beaSubscription = await subscribed(bea);
    invoice(beaSubscription.customer, 604);
    expect((await bea.request(`/v1/billing/invoices/${paid.id}/pdf`)).status).toBe(404);
  });

  it("only shows the invoices to owners and administrators, and still once the organization is read-only", async () => {
    const ana = await owner();
    const created = await subscribed(ana);
    invoice(created.customer, 604);
    created.status = "canceled";
    await sendEvent("customer.subscription.deleted", { id: created.id });
    await db
      .update(organization)
      .set({ createdAt: new Date(Date.now() - 400 * DAY) })
      .where(eq(organization.id, ana.organizationId));
    expect((await billingOf(ana)).plan.status).toBe("readOnly");
    const response = await ana.request("/v1/billing/invoices");
    expect(response.status).toBe(200);
    expect(((await response.json()) as { invoices: unknown[] }).invoices).toHaveLength(1);

    const bea = await signUp("Bea", billingApp);
    const { user } = (await (await bea.request("/v1/me")).json()) as { user: { id: string } };
    await db
      .insert(membership)
      .values({ id: newId(), organizationId: ana.organizationId, userId: user.id, role: "member" });
    await db.update(session).set({ activeOrganizationId: ana.organizationId }).where(eq(session.userId, user.id));
    expect((await bea.request("/v1/billing/invoices")).status).toBe(403);
  });

  it("cancels the subscriptions of the organizations a deleted account takes with it", async () => {
    const ana = await owner();
    const created = await subscribed(ana);
    const deleted = await ana.request("/v1/me", { method: "DELETE", body: { password: "a-long-password" } });
    expect(deleted.status).toBe(204);
    expect(created.status).toBe("canceled");
    expect(stripe.requests.filter((request) => request.method === "DELETE")).toEqual([
      expect.objectContaining({ path: `/v1/subscriptions/${created.id}` }),
    ]);
  });

  it("still deletes the account when Stripe can't cancel, and says so", async () => {
    const ana = await owner();
    await subscribed(ana);
    stripe.down = true;
    const deleted = await ana.request("/v1/me", { method: "DELETE", body: { password: "a-long-password" } });
    expect(deleted.status).toBe(204);
    expect(await billingDb(ana.organizationId)).toEqual([]);
  });
});

describe("the plan", () => {
  const age = (organizationId: string, days: number) =>
    db
      .update(organization)
      .set({ createdAt: new Date(Date.now() - days * DAY) })
      .where(eq(organization.id, organizationId));
  const addSupplier = (client: Client, name: string) =>
    client.request("/v1/contacts", { method: "POST", body: { role: "supplier", name, taxId: "B11111119" } });

  it("turns away writes once the trial ends, keeps reads, and writes again after subscribing", async () => {
    const ana = await owner();
    expect((await addSupplier(ana, "Before")).status).toBe(201);
    await age(ana.organizationId, 31);

    const rejected = await addSupplier(ana, "After");
    expect(rejected.status).toBe(402);
    expect(await rejected.json()).toMatchObject({ error: { code: "subscription_required" } });
    const command = { type: "create", entity: "clients", data: { id: newId(), name: "Sync" } };
    expect((await ana.request("/v1/commands", { method: "POST", body: { commands: [command] } })).status).toBe(402);
    expect((await ana.request("/v1/files", { method: "POST", form: new FormData() })).status).toBe(402);

    expect((await ana.request("/v1/workspace")).status).toBe(200);
    const contacts = await ana.request("/v1/contacts");
    expect(contacts.status).toBe(200);
    expect(await contacts.json()).toMatchObject({ contacts: [expect.objectContaining({ name: "Before" })] });

    await subscribed(ana);
    expect((await addSupplier(ana, "Paying")).status).toBe(201);
  });

  it("never stops a self-hosted instance from writing", async () => {
    const ana = await signUp();
    const org = await createOrganization(ana, "Ana SL");
    await age(org.id, 400);
    expect((await addSupplier(ana, "Still here")).status).toBe(201);
  });
});
