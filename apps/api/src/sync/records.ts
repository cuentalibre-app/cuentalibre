import type { z } from "zod";
import { ApiError, describeIssues } from "../errors";

/* Helpers shared by the services that store records sent as commands. */

/** JSON with sorted keys, to compare values regardless of key order. */
export const canonical = (value: unknown) =>
  JSON.stringify(value, (_, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );

/**
 * The record with the changes applied over it. `null` clears an optional
 * field, and stays as the value of a field that takes null (`dueOn`).
 */
export function mergeChanges(
  schema: z.ZodObject,
  current: object,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(current as Record<string, unknown>) };
  for (const [field, value] of Object.entries(changes)) {
    if (value === null && !schema.shape[field]?.safeParse(null).success) delete merged[field];
    else merged[field] = value;
  }
  return merged;
}

/** Fields the changes give a different value; sending a field with the value it has is no change. */
export function touchedFields<T extends object>(before: T, after: T, changes: Record<string, unknown>) {
  return Object.keys(changes).filter(
    (field) => canonical(after[field as keyof T]) !== canonical(before[field as keyof T]),
  );
}

/** Parses with the schema or answers 400 with `code`, naming the first offending field. */
export function parseOr<S extends z.ZodType>(schema: S, data: unknown, code: string): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;
  throw new ApiError(400, code, describeIssues(parsed.error.issues) ?? "Invalid record.");
}

/** The first ID that appears twice in a record's lines or payments, which are edited by it. */
export function repeatedId(items: readonly { id: string }[] | undefined): string | undefined {
  const seen = new Set<string>();
  for (const { id } of items ?? []) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return undefined;
}

export function alreadyExists(): never {
  throw new ApiError(409, "already_exists", "A record with this ID already exists.");
}
