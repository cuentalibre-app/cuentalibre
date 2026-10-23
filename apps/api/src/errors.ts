import { z } from "@hono/zod-openapi";
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
