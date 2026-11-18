import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { addMonths, readOnlySince, retentionStep } from "./billing/retention";
import { runRetention, type RetentionDeps } from "./billing/retention-job";
import { deletionNotice, file, membership, organization, subscription } from "./db/schema";
import type { Mailer, OutgoingEmail } from "./email/mailer";
import { app, createOrganization, db, signUp, storage } from "./test/harness";
import { stripe, subscribe, testBilling } from "./test/stripe";

const at = (iso: string) => new Date(iso);

describe("addMonths", () => {
  it("keeps the day and time, or takes the month's last day", () => {
    expect(addMonths(at("2026-01-15T10:00:00Z"), 12)).toEqual(at("2027-01-15T10:00:00Z"));
    expect(addMonths(at("2026-01-31T10:00:00Z"), 1)).toEqual(at("2026-02-28T10:00:00Z"));
    expect(addMonths(at("2027-03-31T10:00:00Z"), -6)).toEqual(at("2026-09-30T10:00:00Z"));
  });
});

describe("readOnlySince", () => {
  const createdAt = at("2026-01-01T10:00:00Z");
  const late = at("2027-06-01T00:00:00Z");

  it("is null while the organization can write", () => {
    expect(readOnlySince({ createdAt }, null, at("2026-01-20T00:00:00Z"))).toBeNull();
    expect(readOnlySince({ createdAt }, { status: "active", currentPeriodEnd: null }, late)).toBeNull();
  });

  it("starts when the trial ends, or when the last period paid ends if that is later", () => {
    expect(readOnlySince({ createdAt }, null, late)).toEqual(at("2026-01-31T10:00:00Z"));
    const periodEnd = at("2026-09-01T00:00:00Z");
    expect(readOnlySince({ createdAt }, { status: "canceled", currentPeriodEnd: periodEnd }, late)).toEqual(periodEnd);
    expect(
      readOnlySince({ createdAt }, { status: "canceled", currentPeriodEnd: at("2026-01-10T00:00:00Z") }, late),
    ).toEqual(at("2026-01-31T10:00:00Z"));
  });
});

describe("retentionStep", () => {
  const since = at("2026-01-31T10:00:00Z");
  // Deleted on 2027-01-31; notices on 2026-07-31, 2026-12-31 and 2027-01-24

  it("sends each notice when it is due, once, telling the deletion date", () => {
    expect(retentionStep(since, {}, at("2026-07-31T09:00:00Z"))).toEqual({ action: "wait" });
    expect(retentionStep(since, {}, at("2026-07-31T10:00:00Z"))).toEqual({
      action: "notify",
      notice: "6m",
      deleteAt: at("2027-01-31T10:00:00Z"),
    });
    const sixMonths = { "6m": at("2026-07-31T10:00:00Z") };
    expect(retentionStep(since, sixMonths, at("2026-12-30T10:00:00Z"))).toEqual({ action: "wait" });
    expect(retentionStep(since, sixMonths, at("2026-12-31T10:00:00Z"))).toMatchObject({ notice: "1m" });
    expect(
      retentionStep(since, { ...sixMonths, "1m": at("2026-12-31T10:00:00Z") }, at("2027-01-24T10:00:00Z")),
    ).toEqual({ action: "notify", notice: "1w", deleteAt: at("2027-01-31T10:00:00Z") });
  });

  it("deletes once the date comes, after the last notice", () => {
    const sent = { "1w": at("2027-01-24T10:00:00Z") };
    expect(retentionStep(since, sent, at("2027-01-31T09:59:00Z"))).toEqual({ action: "wait" });
    expect(retentionStep(since, sent, at("2027-01-31T10:00:00Z"))).toEqual({ action: "delete" });
  });

  it("never deletes without the last notice, nor less than a week after it", () => {
    expect(retentionStep(since, {}, at("2027-03-01T00:00:00Z"))).toEqual({
      action: "notify",
      notice: "1w",
      deleteAt: at("2027-03-08T00:00:00Z"),
    });
    const sent = { "1w": at("2027-03-01T00:00:00Z") };
    expect(retentionStep(since, sent, at("2027-03-07T23:00:00Z"))).toEqual({ action: "wait" });
    expect(retentionStep(since, sent, at("2027-03-08T00:00:00Z"))).toEqual({ action: "delete" });
  });

  it("skips a missed notice instead of sending two in a row", () => {
    // The 6-month notice was never sent; the one-month one is due
    expect(retentionStep(since, {}, at("2027-01-02T00:00:00Z"))).toMatchObject({ action: "notify", notice: "1m" });
  });
});

describe("runRetention", () => {
  const sent: OutgoingEmail[] = [];
  const failure: { error: Error | null } = { error: null };
  const testMailer: Mailer = {
    address: "hola@cuentalibre.test",
    async send(email) {
      if (failure.error) throw failure.error;
      sent.push(email);
    },
  };
  const deps = (mailer: Mailer | null = testMailer): RetentionDeps => ({
    db,
    storage,
    billing: testBilling,
    mailer,
    webOrigin: "https://app.cuentalibre.test",
  });

  beforeEach(() => {
    sent.length = 0;
    failure.error = null;
  });

  /** An organization made on `createdAt`, with one file; its trial ends 30 days later. */
  async function oldOrganization(createdAt: Date) {
    const owner = await signUp("Ana", app);
    const org = await createOrganization(owner, "Ana SL");
    const form = new FormData();
    form.set("file", new File(["%PDF-1.4"], "factura.pdf", { type: "application/pdf" }));
    expect((await owner.request("/v1/files", { method: "POST", form })).status).toBe(201);
    await db.update(organization).set({ createdAt }).where(eq(organization.id, org.id));
    return { ...org, email: owner.email };
  }

  const exists = async (id: string) =>
    (await db.select({ id: organization.id }).from(organization).where(eq(organization.id, id))).length > 0;

  it("warns the owners 6 months, 1 month and 1 week before, then deletes the organization and its files", async () => {
    // Read-only from 2025-01-31 10:00; deleted on 2026-01-31
    const org = await oldOrganization(at("2025-01-01T10:00:00Z"));
    const [stored] = await db.select({ key: file.storageKey }).from(file).where(eq(file.organizationId, org.id));

    await runRetention(deps(), at("2025-07-31T09:00:00Z"));
    expect(sent.filter((email) => email.to.includes(org.email))).toHaveLength(0);

    for (const day of ["2025-07-31T10:00:00Z", "2025-07-31T11:00:00Z"]) await runRetention(deps(), at(day));
    const first = sent.filter((email) => email.to.includes(org.email));
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ to: [org.email], subject: "«Ana SL» se borrará el 31 de enero de 2026" });
    expect(first[0]!.text).toContain("no tiene suscripción desde el 31 de enero de 2025");
    expect(first[0]!.text).toContain("https://app.cuentalibre.test/configuracion/plan");
    expect(first[0]!.text).toContain("https://app.cuentalibre.test/exportar");

    await runRetention(deps(), at("2025-12-31T10:00:00Z"));
    await runRetention(deps(), at("2026-01-24T10:00:00Z"));
    expect(sent.filter((email) => email.to.includes(org.email))).toHaveLength(3);
    expect(await db.select().from(deletionNotice).where(eq(deletionNotice.organizationId, org.id))).toHaveLength(3);

    await runRetention(deps(), at("2026-01-31T09:00:00Z"));
    expect(await exists(org.id)).toBe(true);
    await runRetention(deps(), at("2026-01-31T10:00:00Z"));
    expect(await exists(org.id)).toBe(false);
    expect(await db.select().from(membership).where(eq(membership.organizationId, org.id))).toHaveLength(0);
    await expect(storage.get(stored!.key)).resolves.toBeNull();
  });

  it("retries a notice whose email failed, and never deletes without a mailer", async () => {
    const org = await oldOrganization(at("2025-01-01T10:00:00Z"));
    failure.error = new Error("SMTP down");
    await runRetention(deps(), at("2025-08-01T00:00:00Z"));
    expect(await db.select().from(deletionNotice).where(eq(deletionNotice.organizationId, org.id))).toHaveLength(0);
    failure.error = null;
    await runRetention(deps(), at("2025-08-01T01:00:00Z"));
    expect(sent.filter((email) => email.to.includes(org.email))).toHaveLength(1);

    const other = await oldOrganization(at("2025-01-01T10:00:00Z"));
    for (const day of ["2025-08-01", "2026-01-01", "2026-01-25", "2026-03-01"])
      await runRetention(deps(null), at(`${day}T12:00:00Z`));
    expect(await exists(other.id)).toBe(true);
  });

  it("leaves paying organizations alone, and counts a lapsed one from the end of its last period", async () => {
    const org = await oldOrganization(at("2025-01-01T10:00:00Z"));
    const live = subscribe(`cus_${org.id}`);
    await db.insert(subscription).values({
      organizationId: org.id,
      stripeCustomerId: `cus_${org.id}`,
      stripeSubscriptionId: live.id,
      status: "active",
      currentPeriodEnd: at("2026-03-01T00:00:00Z"),
    });
    await runRetention(deps(), at("2026-02-01T00:00:00Z"));
    expect(sent.filter((email) => email.to.includes(org.email))).toHaveLength(0);

    // Cancelled: read-only from 2026-03-01, so deleted on 2027-03-01
    await db.update(subscription).set({ status: "canceled" }).where(eq(subscription.organizationId, org.id));
    await runRetention(deps(), at("2026-08-31T00:00:00Z"));
    expect(sent.filter((email) => email.to.includes(org.email))).toHaveLength(0);
    await runRetention(deps(), at("2026-09-01T00:00:00Z"));
    expect(sent.find((email) => email.to.includes(org.email))?.subject).toBe(
      "«Ana SL» se borrará el 1 de marzo de 2027",
    );

    // Subscribing again stops it
    await db.update(subscription).set({ status: "active" }).where(eq(subscription.organizationId, org.id));
    await runRetention(deps(), at("2027-04-01T00:00:00Z"));
    expect(await exists(org.id)).toBe(true);
  });

  it("cancels a subscription Stripe still holds when it deletes the organization", async () => {
    const org = await oldOrganization(at("2025-01-01T10:00:00Z"));
    const unpaid = subscribe(`cus_${org.id}`, "monthly", "unpaid");
    await db.insert(subscription).values({
      organizationId: org.id,
      stripeCustomerId: `cus_${org.id}`,
      stripeSubscriptionId: unpaid.id,
      status: "unpaid",
      currentPeriodEnd: at("2025-02-01T00:00:00Z"),
    });
    await runRetention(deps(), at("2026-01-25T00:00:00Z"));
    await runRetention(deps(), at("2026-02-02T00:00:00Z"));
    expect(await exists(org.id)).toBe(false);
    expect(stripe.subscriptions.get(unpaid.id)?.status).toBe("canceled");
  });
});
