import { newId, questionDay } from "@cuentalibre/core";
import { and, count, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { aiChatQuestion } from "../db/schema";
import { ApiError } from "../errors";
import { lockOrganization } from "../sync/write";
import type { ChatUsage } from "./chat";

/*
 * Questions to the help chat: the daily limit per organization. A question is reserved
 * before the model is called, so concurrent ones can't go past the limit, and released
 * if the provider fails before answering.
 */

/** Counts a question towards today, or refuses it if the organization reached its limit (0 means none). */
export async function reserveQuestion(db: Db, organizationId: string, model: string, dailyLimit: number) {
  const day = questionDay(new Date());
  return db.transaction(async (tx) => {
    // Concurrent questions count each other against the limit
    await lockOrganization(tx, organizationId);
    if (dailyLimit > 0) {
      const [row] = await tx
        .select({ n: count() })
        .from(aiChatQuestion)
        .where(and(eq(aiChatQuestion.organizationId, organizationId), eq(aiChatQuestion.day, day)));
      if ((row?.n ?? 0) >= dailyLimit)
        throw new ApiError(
          429,
          "ai_quota_exceeded",
          `The organization has asked its ${dailyLimit} questions to the help chat today; the count starts afresh at midnight.`,
        );
    }
    const id = newId();
    await tx.insert(aiChatQuestion).values({ organizationId, id, day, model });
    return id;
  });
}

/** Gives back a question the provider didn't answer. */
export async function releaseQuestion(db: Db, organizationId: string, id: string) {
  await db
    .delete(aiChatQuestion)
    .where(and(eq(aiChatQuestion.organizationId, organizationId), eq(aiChatQuestion.id, id)));
}

/** Keeps what the answer took. */
export async function recordQuestion(db: Db, organizationId: string, id: string, usage: ChatUsage) {
  await db
    .update(aiChatQuestion)
    .set(usage)
    .where(and(eq(aiChatQuestion.organizationId, organizationId), eq(aiChatQuestion.id, id)));
}
