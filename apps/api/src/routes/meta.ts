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

const signInMethodsSchema = z.object({ google: z.boolean(), email: z.boolean(), billing: z.boolean() });

const signInMethods = createRoute({
  method: "get",
  path: "/sign-in-methods",
  tags: ["Meta"],
  summary: "How people can sign in to this instance, besides email and password",
  description:
    "`google`: sign in with Google. `email`: the instance sends email, so people verify their address and reset a forgotten password. `billing`: the instance charges for its plan (cuentalibre Cloud).",
  responses: {
    200: {
      description: "The sign-in methods",
      content: { "application/json": { schema: signInMethodsSchema } },
    },
  },
});

export const metaRoutes = (methods: z.infer<typeof signInMethodsSchema>) =>
  new OpenAPIHono<AppEnv>()
    .openapi(health, async (c) => {
      try {
        await c.get("db").execute(sql`select 1`);
      } catch {
        return errorResponse(c, 503, "database_unavailable", "The database is unreachable.");
      }
      return c.json({ status: "ok" as const }, 200);
    })
    .openapi(signInMethods, (c) => c.json(methods, 200));
