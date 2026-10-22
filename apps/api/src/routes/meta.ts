import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { hasGoogleSignIn } from "../auth";
import type { AppEnv } from "../context";
import type { Env } from "../env";
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

const signInMethods = createRoute({
  method: "get",
  path: "/sign-in-methods",
  tags: ["Meta"],
  summary: "How people can sign in to this instance, besides email and password",
  responses: {
    200: {
      description: "The sign-in methods",
      content: { "application/json": { schema: z.object({ google: z.boolean() }) } },
    },
  },
});

export const metaRoutes = (env: Env) =>
  new OpenAPIHono<AppEnv>()
    .openapi(health, async (c) => {
      try {
        await c.get("db").execute(sql`select 1`);
      } catch {
        return errorResponse(c, 503, "database_unavailable", "The database is unreachable.");
      }
      return c.json({ status: "ok" as const }, 200);
    })
    .openapi(signInMethods, (c) => c.json({ google: hasGoogleSignIn(env) }, 200));
