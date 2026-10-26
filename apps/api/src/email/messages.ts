import { emailRequestSchema, type EmailMessage } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Db, Tx } from "../db/client";
import { emailMessage, file, organization, salesDocument, user } from "../db/schema";
import { ApiError } from "../errors";
import { complete, enqueue } from "../outbox/outbox";
import { MAX_ATTEMPTS, RetryLater, type Handler } from "../outbox/worker";
import type { FileStorage } from "../storage";
import { readSettings } from "../sync/settings";
import { lockOrganization, type Scope } from "../sync/write";
import { issuerName } from "../verifactu/record";
import { PermanentEmailError, type Mailer } from "./mailer";

type Row = typeof emailMessage.$inferSelect;

export const toEmailMessage = (row: Row): EmailMessage => ({
  id: row.id,
  documentId: row.documentId,
  to: row.to,
  cc: row.cc,
  subject: row.subject,
  status: row.status,
  error: row.error,
  createdAt: row.createdAt.toISOString(),
  sentAt: row.sentAt?.toISOString() ?? null,
});

/** Who sends an email: the scope's user, maybe through an API key, within the organization's quota. */
export interface Sender extends Scope {
  apiKeyId: string | null;
  /** Most recipients the organization's emails reach in a day and in 30 days; 0 means no limit. */
  quota: { daily: number; monthly: number };
}

const DAY = 24 * 60 * 60 * 1000;

/** Recipients (to and cc) of the organization's emails since then, whether they went out or not. */
async function recipientsSince(tx: Tx, organizationId: string, since: Date) {
  const [row] = await tx
    .select({
      n: sql<number>`coalesce(sum(cardinality(${emailMessage.to}) + cardinality(${emailMessage.cc})), 0)::int`,
    })
    .from(emailMessage)
    .where(and(eq(emailMessage.organizationId, organizationId), gte(emailMessage.createdAt, since)));
  return row?.n ?? 0;
}

/** Refuses an email that would take the organization past its daily or monthly recipients. */
async function checkQuota(tx: Tx, organizationId: string, quota: Sender["quota"], recipients: number) {
  const now = Date.now();
  const limits = [
    { max: quota.daily, days: 1, period: "day" },
    { max: quota.monthly, days: 30, period: "30 days" },
  ];
  for (const { max, days, period } of limits) {
    if (max > 0 && (await recipientsSince(tx, organizationId, new Date(now - days * DAY))) + recipients > max)
      throw new ApiError(
        429,
        "email_quota_exceeded",
        `The organization can email up to ${max} recipients (to and cc) every ${period}; try again later.`,
      );
  }
}

/**
 * Queues an email from the business: its name as the sender's, replies to
 * its email address (or the user's). It is sent in the background.
 */
export async function queueEmail(db: Db, sender: Sender, request: z.output<typeof emailRequestSchema>) {
  const { organizationId } = sender;
  return db.transaction(async (tx) => {
    // Also makes concurrent sends count each other against the quota
    await lockOrganization(tx, organizationId);
    const [document] = await tx
      .select({ id: salesDocument.id })
      .from(salesDocument)
      .where(
        and(
          eq(salesDocument.organizationId, organizationId),
          eq(salesDocument.id, request.documentId),
          isNull(salesDocument.deletedAt),
        ),
      );
    if (!document) throw new ApiError(400, "invalid_email", "documentId: no such document.");
    const attachments = [...new Set(request.attachments)];
    if (attachments.length > 0) {
      const found = await tx
        .select({ id: file.id })
        .from(file)
        .where(and(eq(file.organizationId, organizationId), inArray(file.id, attachments)));
      if (found.length !== attachments.length)
        throw new ApiError(400, "invalid_attachment", "attachments: upload the files first.");
    }
    await checkQuota(tx, organizationId, sender.quota, request.to.length + request.cc.length);

    const { businessProfile: profile } = await readSettings(tx, organizationId);
    const [org] = await tx
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId));
    const [author] = sender.userId
      ? await tx.select({ email: user.email }).from(user).where(eq(user.id, sender.userId))
      : [];

    const [row] = await tx
      .insert(emailMessage)
      .values({
        organizationId,
        id: newId(),
        documentId: request.documentId,
        to: request.to,
        cc: request.cc,
        replyTo: profile.email.trim() || author?.email || null,
        fromName: profile.tradeName.trim() || issuerName(profile) || org!.name,
        subject: request.subject,
        body: request.body,
        attachments,
        sentBy: sender.userId,
        apiKeyId: sender.apiKeyId,
      })
      .returning();
    await enqueue(tx, { organizationId, topic: "email", payload: { id: row!.id } });
    return toEmailMessage(row!);
  });
}

/** The organization's emails, newest first; only those of a document when one is given. */
export async function listEmails(db: Db, organizationId: string, documentId?: string) {
  const rows = await db
    .select()
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.organizationId, organizationId),
        documentId ? eq(emailMessage.documentId, documentId) : undefined,
      ),
    )
    .orderBy(desc(emailMessage.createdAt))
    .limit(200);
  return rows.map(toEmailMessage);
}

async function bytesOf(stream: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Sends a queued email with its attachments. A final refusal, or too many failed tries, marks it failed. */
export function emailHandler(db: Db, storage: FileStorage, mailer: Mailer | null): Handler {
  return async (job) => {
    if (!mailer) throw new RetryLater("Email is off.", new Date(Date.now() + 3_600_000));
    const where = and(eq(emailMessage.organizationId, job.organizationId), eq(emailMessage.id, String(job.payload.id)));
    const [message] = await db.select().from(emailMessage).where(where);
    if (!message || message.status !== "queued") return;

    const files = message.attachments.length
      ? await db
          .select()
          .from(file)
          .where(and(eq(file.organizationId, job.organizationId), inArray(file.id, message.attachments)))
      : [];
    const attachments = [];
    for (const stored of files) {
      const body = await storage.get(stored.storageKey);
      if (!body) throw new Error(`The file ${stored.name} is missing from storage.`);
      attachments.push({ filename: stored.name, contentType: stored.contentType, content: await bytesOf(body) });
    }

    try {
      await mailer.send({
        fromName: message.fromName,
        ...(message.replyTo && { replyTo: message.replyTo }),
        to: message.to,
        cc: message.cc,
        subject: message.subject,
        text: message.body,
        attachments,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const final = error instanceof PermanentEmailError || job.attempts >= MAX_ATTEMPTS;
      await db
        .update(emailMessage)
        .set({ error: reason, ...(final && { status: "failed" as const }) })
        .where(where);
      if (final) return complete(db, job.id);
      throw error;
    }
    await db.update(emailMessage).set({ status: "sent", sentAt: new Date(), error: null }).where(where);
  };
}
