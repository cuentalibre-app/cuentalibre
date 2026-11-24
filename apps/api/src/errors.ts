import { z } from "@hono/zod-openapi";
import { DrizzleQueryError } from "drizzle-orm";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const errorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi("Error");

export function errorResponse<S extends ContentfulStatusCode>(c: Context, status: S, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

/**
 * The error as it may be logged or reported. A failed query carries its parameters
 * (amounts, tax IDs, names) and the database's detail on the rows involved; what's
 * kept is the SQL, which has none, the database's error code, the table and column
 * or constraint, and the stack.
 */
export function redactError(error: unknown): unknown {
  if (!(error instanceof DrizzleQueryError)) return error;
  const cause = error.cause as { code?: string; table?: string; column?: string; constraint?: string } | undefined;
  const where = (["code", "table", "column", "constraint"] as const)
    .filter((key) => cause?.[key])
    .map((key) => `${key} ${cause![key]}`)
    .join(", ");
  const redacted = new Error(`Failed query: ${error.query}${where ? ` (${where})` : ""}`);
  redacted.name = "DrizzleQueryError";
  // The stack starts with the message, which holds the parameters and may span lines
  const stack = error.stack ?? "";
  const messageAt = stack.indexOf(error.message);
  const afterMessage = messageAt === -1 ? "" : stack.slice(messageAt + error.message.length);
  const frames = afterMessage.split("\n").filter((line) => line.startsWith("    at "));
  redacted.stack = [`${redacted.name}: ${redacted.message}`, ...frames].join("\n");
  return redacted;
}

/** Logs an error after `message`, redacted as `redactError` does. */
export function logError(message: string, error: unknown) {
  console.error(message, redactError(error));
}

type Issue = z.core.$ZodIssue;

/**
 * The first problem of a failed parse as `path: message`, short enough for a
 * person or an agent to fix the request. A union names the branch that came
 * closest instead of listing every alternative.
 */
export function describeIssues(issues: readonly Issue[], prefix: PropertyKey[] = []): string | undefined {
  const issue = issues[0];
  if (!issue) return undefined;
  const path = [...prefix, ...issue.path];
  if (issue.code === "invalid_union" && issue.errors.length > 0) {
    const closest = issue.errors.reduce((best, branch) => (branch.length < best.length ? branch : best));
    const inner = describeIssues(closest, path);
    if (inner) return inner;
  }
  return path.length ? `${path.map(String).join(".")}: ${issue.message}` : issue.message;
}

/** The OpenAPI entry for an error status. */
export const errorContent = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});

/** Thrown by services to answer with a JSON error; `app.onError` turns it into the response. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
