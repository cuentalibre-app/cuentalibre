import { DEFAULT_ORGANIZATION_SETTINGS, type EmailMessage } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { beforeEach, describe, expect, it } from "vitest";
import { PermanentEmailError } from "./email/mailer";
import { mailerFailure, sentEmails, type Client } from "./test/harness";
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
    const ana = await member();
    expect((await sendEmail(ana, email())).status).toBe(202);
    await runJobs();
    expect(sentEmails[0]).toMatchObject({ fromName: "Ana SL", replyTo: ana.email });
  });

  it("only attaches the organization's files and names its documents", async () => {
    const ana = await member();
    const bea = await member("Bea");
    const theirs = await uploadPdf(bea);

    const foreignFile = await sendEmail(ana, email({ attachments: [theirs] }));
    expect(foreignFile.status).toBe(400);
    expect(await errorCode(foreignFile)).toBe("invalid_attachment");
    const unknownDocument = await sendEmail(ana, email({ documentId: newId() }));
    expect(unknownDocument.status).toBe(400);
    const noRecipient = await sendEmail(ana, email({ to: [] }));
    expect(noRecipient.status).toBe(400);
    expect(await emails(ana)).toEqual([]);
  });

  it("retries a failed send, and gives up when the server refuses it", async () => {
    const ana = await member();
    await sendEmail(ana, email());
    mailerFailure.error = new Error("Connection timed out");
    await runJobs();
    expect((await emails(ana))[0]).toMatchObject({ status: "queued", error: "Connection timed out" });

    const bea = await member("Bea");
    await sendEmail(bea, email());
    mailerFailure.error = new PermanentEmailError("550 Mailbox unavailable");
    await runJobs();
    expect((await emails(bea))[0]).toMatchObject({ status: "failed", error: "550 Mailbox unavailable" });
    expect(sentEmails).toEqual([]);
  });
});
