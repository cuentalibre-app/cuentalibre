import type { ExtractionUsage } from "@cuentalibre/contracts";
import { newId, readingMonth } from "@cuentalibre/core";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import type { Db, Tx } from "../db/client";
import { aiReading } from "../db/schema";
import { ApiError } from "../errors";
import { lockOrganization } from "../sync/write";
import type { ModelInput, TokenUsage } from "./provider";

/*
 * Documents read with AI: the monthly limit and the cache of answers. A reading is
 * reserved before the model is called, so concurrent ones can't go past the limit,
 * and released if the call fails. The same file read again by the same model and
 * prompt reuses the answer: it doesn't call the model nor count.
 */

export interface AiLimits {
  /** Most documents a month per organization; 0 means no limit. */
  monthlyDocuments: number;
  /** Dollars per million tokens; null when unknown. */
  inputPrice: number | null;
  outputPrice: number | null;
}

/** What a cached answer is found by. */
export interface ReadingKey {
  organizationId: string;
  fileHash: string;
  model: string;
  promptVersion: string;
}

/** The answer this model gave for this file and prompt, if it read it before. */
export async function cachedReading(db: Db, key: ReadingKey) {
  const [row] = await db
    .select({ answer: aiReading.answer, source: aiReading.source })
    .from(aiReading)
    .where(
      and(
        eq(aiReading.organizationId, key.organizationId),
        eq(aiReading.fileHash, key.fileHash),
        eq(aiReading.model, key.model),
        eq(aiReading.promptVersion, key.promptVersion),
        isNotNull(aiReading.answer),
      ),
    )
    .orderBy(desc(aiReading.createdAt))
    .limit(1);
  return row?.source ? { answer: row.answer, source: row.source } : null;
}

async function readingsIn(db: Tx, organizationId: string, month: string) {
  const [row] = await db
    .select({ n: count() })
    .from(aiReading)
    .where(and(eq(aiReading.organizationId, organizationId), eq(aiReading.month, month)));
  return row?.n ?? 0;
}

/** The organization's readings this month, against its limit. */
export async function readingUsage(db: Db, organizationId: string, limits: AiLimits): Promise<ExtractionUsage> {
  const month = readingMonth(new Date());
  return {
    used: await readingsIn(db, organizationId, month),
    limit: limits.monthlyDocuments || null,
    month,
  };
}

/**
 * Counts a reading towards this month before the model is called, or refuses it if the
 * organization reached its limit. Returns the reading's ID, to record or release it.
 */
export async function reserveReading(db: Db, key: ReadingKey, limits: AiLimits): Promise<string> {
  const month = readingMonth(new Date());
  return db.transaction(async (tx) => {
    // Concurrent readings count each other against the limit
    await lockOrganization(tx, key.organizationId);
    const max = limits.monthlyDocuments;
    if (max > 0 && (await readingsIn(tx, key.organizationId, month)) >= max)
      throw new ApiError(
        429,
        "ai_quota_exceeded",
        `The organization has read its ${max} documents with AI this month; the count starts afresh on the 1st.`,
      );
    const id = newId();
    await tx.insert(aiReading).values({ ...key, id, month });
    return id;
  });
}

/** Gives back a reading whose model call failed: it doesn't count, and nothing is cached. */
export async function releaseReading(db: Db, organizationId: string, id: string) {
  await db.delete(aiReading).where(and(eq(aiReading.organizationId, organizationId), eq(aiReading.id, id)));
}

/** What a call costs, in millionths of a dollar, when the model's prices are known. */
export function costMicros(usage: TokenUsage | null, { inputPrice, outputPrice }: AiLimits): number | null {
  if (!usage || inputPrice === null || outputPrice === null) return null;
  // Prices are per million tokens, so tokens × price is already in millionths
  return Math.round(usage.inputTokens * inputPrice + usage.outputTokens * outputPrice);
}

/** Keeps the model's answer for the file, with what it took. */
export async function recordReading(
  db: Db,
  organizationId: string,
  id: string,
  reading: { answer: unknown; source: ModelInput["kind"]; usage: TokenUsage | null; limits: AiLimits },
) {
  await db
    .update(aiReading)
    .set({
      answer: reading.answer,
      source: reading.source,
      inputTokens: reading.usage?.inputTokens ?? null,
      outputTokens: reading.usage?.outputTokens ?? null,
      costMicros: costMicros(reading.usage, reading.limits),
    })
    .where(and(eq(aiReading.organizationId, organizationId), eq(aiReading.id, id)));
}
