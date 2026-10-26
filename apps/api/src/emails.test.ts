import { DEFAULT_ORGANIZATION_SETTINGS, type CreatedApiKey, type EmailMessage } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { emailMessage, user } from "./db/schema";
import { PermanentEmailError } from "./email/mailer";
import { db, mailerFailure, sentEmails, withApiKey, type Client } from "./test/harness";
import { runJobs } from "./test/outbox";
import { client, document, errorCode, member, send } from "./test/sync";

const pdf = new TextEncoder().encode("%PDF-1.7 factura");

async function uploadPdf(user: Client) {
  const id = newId();
  const form = new FormData();
  form.set("id", id);
  form.set("file", new File([pdf], "Factura 2026-0001.pdf", { type: "application/pdf" }));
  expect((await user.request("/v1/files", { method: "POST", form })).status).toBe(201);
  return id;
}

/** A member whose email is verified, with a client and a draft to send them. */
async function sender(name = "Ana") {
  const person = await member(name);
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, person.email));
  const norte = client();
  const draft = document(norte.id);
  await send(person, [
    { type: "create", entity: "clients", data: norte },
    { type: "create", entity: "salesDocuments", data: draft },
  ]);
  return Object.assign(person, { documentId: draft.id });
}

const email = (fields: Record<string, unknown> = {}) => ({
  to: ["cliente@example.com"],
  subject: "Factura 2026-0001",
  body: "Hola,\n\nTe adjunto la factura.",
  ...fields,
});

async function sendEmail(user: Client, body: Record<string, unknown>) {
  return user.request("/v1/emails", { method: "POST", body });
}

async function emails(user: Client, documentId?: string) {
  const response = await user.request(`/v1/emails${documentId ? `?documentId=${documentId}` : ""}`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { emails: EmailMessage[] }).emails;
}

beforeEach(() => {
  sentEmails.length = 0;
  mailerFailure.error = null;
});

describe("emails", () => {
  it("queues an invoice with its PDF and sends it from the business", async () => {
    const ana = await member();
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, ana.email));
    const norte = client();
    const draft = document(norte.id);
    await send(ana, [
      {
        type: "saveSettings",
        section: "businessProfile",
        data: { ...DEFAULT_ORGANIZATION_SETTINGS.businessProfile, tradeName: "Estudio Lucía", email: "hola@lucia.es" },
      },
      { type: "create", entity: "clients", data: norte },
      { type: "create", entity: "salesDocuments", data: draft },
    ]);
    const fileId = await uploadPdf(ana);

    const response = await sendEmail(ana, email({ documentId: draft.id, cc: ["yo@lucia.es"], attachments: [fileId] }));
    expect(response.status).toBe(202);
    const queued = (await response.json()) as EmailMessage;
    expect(queued).toMatchObject({ status: "queued", documentId: draft.id, to: ["cliente@example.com"], sentAt: null });

    await runJobs();
    expect(sentEmails).toEqual([
      {
        fromName: "Estudio Lucía",
        replyTo: "hola@lucia.es",
        to: ["cliente@example.com"],
        cc: ["yo@lucia.es"],
        subject: "Factura 2026-0001",
        text: "Hola,\n\nTe adjunto la factura.",
        attachments: [{ filename: "Factura 2026-0001.pdf", contentType: "application/pdf", content: pdf }],
      },
    ]);
    const [sent] = await emails(ana, draft.id);
    expect(sent).toMatchObject({ id: queued.id, status: "sent", error: null });
    expect(sent!.sentAt).not.toBeNull();
  });

  it("replies to the user when the business has no email", async () => {
    const ana = await sender();
    expect((await sendEmail(ana, email({ documentId: ana.documentId }))).status).toBe(202);
    await runJobs();
    expect(sentEmails[0]).toMatchObject({ fromName: "Ana SL", replyTo: ana.email });
  });

  it("only attaches the organization's files and sends one of its documents", async () => {
    const ana = await sender();
    const bea = await sender("Bea");
    const theirs = await uploadPdf(bea);

    const foreignFile = await sendEmail(ana, email({ documentId: ana.documentId, attachments: [theirs] }));
    expect(foreignFile.status).toBe(400);
    expect(await errorCode(foreignFile)).toBe("invalid_attachment");
    const unknownDocument = await sendEmail(ana, email({ documentId: newId() }));
    expect(unknownDocument.status).toBe(400);
    const theirDocument = await sendEmail(ana, email({ documentId: bea.documentId }));
    expect(theirDocument.status).toBe(400);
    const noDocument = await sendEmail(ana, email());
    expect(noDocument.status).toBe(400);
    const noRecipient = await sendEmail(ana, email({ documentId: ana.documentId, to: [] }));
    expect(noRecipient.status).toBe(400);
    expect(await emails(ana)).toEqual([]);
  });

  it("only lets users with a verified email send, with an API key too", async () => {
    const ana = await sender();
    await db.update(user).set({ emailVerified: false }).where(eq(user.email, ana.email));
    const created = await ana.request("/v1/api-keys", { method: "POST", body: { name: "Script" } });
    const { key } = (await created.json()) as CreatedApiKey;

    for (const client of [ana, withApiKey(key)]) {
      const response = await sendEmail(client, email({ documentId: ana.documentId }));
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe("email_unverified");
    }
    expect(await emails(ana)).toEqual([]);

    await db.update(user).set({ emailVerified: true }).where(eq(user.email, ana.email));
    const response = await sendEmail(withApiKey(key), email({ documentId: ana.documentId }));
    expect(response.status).toBe(202);
    const { id } = (await response.json()) as EmailMessage;
    const [row] = await db.select().from(emailMessage).where(eq(emailMessage.id, id));
    expect(row).toMatchObject({ sentBy: expect.any(String), apiKeyId: expect.any(String) });
  });

  it("counts recipients against the organization's daily quota", async () => {
    const ana = await sender();
    const many = (n: number, domain: string) => Array.from({ length: n }, (_, i) => `p${i}@${domain}`);
    // 50 a day by default: two emails reach 40 people, a third with 20 more would pass it
    for (let i = 0; i < 2; i++) {
      const response = await sendEmail(
        ana,
        email({ documentId: ana.documentId, to: many(10, "a.es"), cc: many(10, "b.es") }),
      );
      expect(response.status).toBe(202);
    }
    const over = await sendEmail(
      ana,
      email({ documentId: ana.documentId, to: many(10, "a.es"), cc: many(10, "b.es") }),
    );
    expect(over.status).toBe(429);
    expect(await errorCode(over)).toBe("email_quota_exceeded");
    // What fits still goes
    const fits = await sendEmail(ana, email({ documentId: ana.documentId, to: many(10, "a.es") }));
    expect(fits.status).toBe(202);
    expect(await emails(ana)).toHaveLength(3);

    // Other organizations have their own
    const bea = await sender("Bea");
    expect((await sendEmail(bea, email({ documentId: bea.documentId }))).status).toBe(202);
  });

  it("retries a failed send, and gives up when the server refuses it", async () => {
    const ana = await sender();
    await sendEmail(ana, email({ documentId: ana.documentId }));
    mailerFailure.error = new Error("Connection timed out");
    await runJobs();
    expect((await emails(ana))[0]).toMatchObject({ status: "queued", error: "Connection timed out" });

    const bea = await sender("Bea");
    await sendEmail(bea, email({ documentId: bea.documentId }));
    mailerFailure.error = new PermanentEmailError("550 Mailbox unavailable");
    await runJobs();
    expect((await emails(bea))[0]).toMatchObject({ status: "failed", error: "550 Mailbox unavailable" });
    expect(sentEmails).toEqual([]);
  });
});
