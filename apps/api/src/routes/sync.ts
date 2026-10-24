import { changeSchema, changesSchema, commandSchema, cursorSchema, workspaceSchema } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../context";
import { errorContent } from "../errors";
import { readOnlyError, requireOrganization, requireWritable, scopeOf } from "../middleware";
import { readChanges, readWorkspace } from "../sync/read";
import { applyCommands } from "../sync/write";

const tenantErrors = {
  401: errorContent("Not signed in"),
  403: errorContent("No active organization, or the user doesn't belong to it"),
};

const workspace = createRoute({
  method: "get",
  path: "/workspace",
  tags: ["Sync"],
  summary: "Everything the app keeps for the active organization",
  description: "Downloaded once at boot. Then follow `/sync` from the returned cursor.",
  middleware: [requireOrganization] as const,
  responses: {
    200: { description: "The workspace", content: { "application/json": { schema: workspaceSchema } } },
    ...tenantErrors,
  },
});

const sync = createRoute({
  method: "get",
  path: "/sync",
  tags: ["Sync"],
  summary: "Records that changed after a cursor",
  description: "Each changed record appears once, with its latest state. Ask again with `cursor` while `hasMore`.",
  middleware: [requireOrganization] as const,
  request: {
    query: z.object({
      since: z.coerce.number().pipe(cursorSchema),
      limit: z.coerce.number().int().min(1).max(1000).default(500),
    }),
  },
  responses: {
    200: { description: "The changes", content: { "application/json": { schema: changesSchema } } },
    400: errorContent("Invalid cursor"),
    ...tenantErrors,
  },
});

const commands = createRoute({
  method: "post",
  path: "/commands",
  tags: ["Sync"],
  summary: "Apply changes, all of them or none",
  description:
    "Commands run in order in one transaction; if any is rejected, nothing is saved. " +
    "Returns the resulting state of the records they touched.",
  middleware: [requireOrganization, requireWritable] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ commands: z.array(commandSchema).min(1).max(500) }) } },
    },
  },
  responses: {
    200: {
      description: "Applied",
      content: { "application/json": { schema: z.object({ changes: z.array(changeSchema) }) } },
    },
    400: errorContent("A command is invalid"),
    404: errorContent("A command refers to a record that doesn't exist"),
    409: errorContent("A create reuses an existing ID"),
    ...tenantErrors,
    ...readOnlyError,
  },
});

export const syncRoutes = new OpenAPIHono<AppEnv>()
  .openapi(workspace, async (c) => c.json(await readWorkspace(c.get("db"), c.get("organizationId")), 200))
  .openapi(sync, async (c) => {
    const { since, limit } = c.req.valid("query");
    return c.json(await readChanges(c.get("db"), c.get("organizationId"), since, limit), 200);
  })
  .openapi(commands, async (c) => {
    const changes = await applyCommands(c.get("db"), scopeOf(c), c.req.valid("json").commands);
    return c.json({ changes }, 200);
  });
