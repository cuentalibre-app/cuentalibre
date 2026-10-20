import { apiKeySchema, createdApiKeySchema, newApiKeySchema, type ApiKey } from "@fiscalia/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import type { Auth } from "../auth";
import type { AppEnv } from "../context";
import { apikey } from "../db/schema";
import { ApiError, errorContent } from "../errors";
import { requireOrganization, requireSession } from "../middleware";

/*
 * API keys for scripts and agents. Each acts as the user who created it, in
 * the organization that was active then, and only while the user belongs to
 * it. Only a person signed in can manage keys; a key can't.
 */

const errors = {
  401: errorContent("Not signed in, or signed in with an API key"),
  403: errorContent("No active organization, or the user doesn't belong to it"),
};
const json = <S extends z.ZodType>(schema: S) => ({ "application/json": { schema } });

type Row = typeof apikey.$inferSelect;

const organizationOf = (row: Pick<Row, "metadata">): string | undefined => {
  let metadata: unknown = row.metadata;
  // The plugin stores metadata as JSON text, sometimes stringified twice
  while (typeof metadata === "string") metadata = JSON.parse(metadata);
  return (metadata as { organizationId?: string } | null)?.organizationId;
};

const toApiKey = (row: Row): ApiKey => ({
  id: row.id,
  name: row.name ?? "",
  start: row.start ?? "",
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt?.toISOString() ?? null,
  lastUsedAt: row.lastRequest?.toISOString() ?? null,
});

/** The user's keys for the active organization, newest first. */
async function keysOf(c: Context<AppEnv>) {
  const rows = await c
    .get("db")
    .select()
    .from(apikey)
    .where(eq(apikey.referenceId, c.get("user")!.id))
    .orderBy(desc(apikey.createdAt));
  return rows.filter((row) => organizationOf(row) === c.get("organizationId"));
}

const list = createRoute({
  method: "get",
  path: "/api-keys",
  tags: ["API keys"],
  summary: "Your API keys for the active organization",
  middleware: [requireSession, requireOrganization] as const,
  responses: {
    200: { description: "The keys", content: json(z.object({ apiKeys: z.array(apiKeySchema) })) },
    ...errors,
  },
});

const create = createRoute({
  method: "post",
  path: "/api-keys",
  tags: ["API keys"],
  summary: "Create an API key",
  description:
    "The key acts as you in the active organization. Send it as `Authorization: Bearer <key>`. " +
    "Its secret is only returned now.",
  middleware: [requireSession, requireOrganization] as const,
  request: { body: { required: true, content: json(newApiKeySchema) } },
  responses: {
    201: { description: "Created", content: json(createdApiKeySchema) },
    400: errorContent("Invalid name or expiry"),
    ...errors,
  },
});

const revoke = createRoute({
  method: "delete",
  path: "/api-keys/{id}",
  tags: ["API keys"],
  summary: "Revoke an API key",
  middleware: [requireSession, requireOrganization] as const,
  request: { params: z.object({ id: z.uuid() }) },
  responses: { 204: { description: "Revoked" }, 404: errorContent("No such key"), ...errors },
});

export const apiKeyRoutes = (auth: Auth) =>
  new OpenAPIHono<AppEnv>()
    .openapi(list, async (c) => c.json({ apiKeys: (await keysOf(c)).map(toApiKey) }, 200))
    .openapi(create, async (c) => {
      const { name, expiresInDays } = c.req.valid("json");
      const created = await auth.api.createApiKey({
        body: {
          name,
          userId: c.get("user")!.id,
          metadata: { organizationId: c.get("organizationId") },
          expiresIn: expiresInDays ? expiresInDays * 86_400 : null,
        },
      });
      const [row] = await c.get("db").select().from(apikey).where(eq(apikey.id, created.id));
      return c.json({ ...toApiKey(row!), key: created.key }, 201);
    })
    .openapi(revoke, async (c) => {
      const { id } = c.req.valid("param");
      const key = (await keysOf(c)).find((row) => row.id === id);
      if (!key) throw new ApiError(404, "not_found", "API key not found.");
      await c
        .get("db")
        .delete(apikey)
        .where(and(eq(apikey.id, id), eq(apikey.referenceId, c.get("user")!.id)));
      return c.body(null, 204);
    });
