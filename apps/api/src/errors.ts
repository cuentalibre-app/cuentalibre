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

/** The OpenAPI entry for an error status. */
export const errorContent = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});
