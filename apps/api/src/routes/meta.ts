import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../context";
import { errorContent, errorResponse } from "../errors";

const health = createRoute({
  method: "get",
  path: "/health",
  tags: ["Meta"],
  summary: "Check that the API and its database are up",
  responses: {
    200: {
      description: "Healthy",
      content: { "application/json": { schema: z.object({ status: z.literal("ok") }) } },
    },
    503: errorContent("The database is unreachable"),
  },
});

export const metaRoutes = new OpenAPIHono<AppEnv>().openapi(health, async (c) => {
  try {
    await c.get("db").execute(sql`select 1`);
  } catch {
    return errorResponse(c, 503, "database_unavailable", "The database is unreachable.");
  }
  return c.json({ status: "ok" as const }, 200);
});
