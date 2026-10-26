import { contactRoleSchema, storedContactSchema, type ContactEntity, type ContactRole } from "@cuentalibre/contracts";
import { newId, sameTaxId } from "@cuentalibre/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppEnv } from "../context";
import { ApiError, errorContent } from "../errors";
import { readOnlyError, requireOrganization, requireWritable, scopeOf } from "../middleware";
import { findContact, liveContacts, toContact } from "../sync/contacts";
import { applyCommands } from "../sync/write";

/*
 * Plain CRUD over contacts for the public API. Writes go through the same
 * commands as the web app's, so they are validated and logged the same way.
 */

const contactWithRole = storedContactSchema.extend({ role: contactRoleSchema });
const ENTITIES: Record<ContactRole, ContactEntity> = { client: "clients", supplier: "suppliers" };

const tenantErrors = {
  401: errorContent("Not signed in"),
  403: errorContent("No active organization, or the user doesn't belong to it"),
};
const idParam = z.object({ id: z.uuid() });
const json = <S extends z.ZodType>(schema: S) => ({ "application/json": { schema } });

const list = createRoute({
  method: "get",
  path: "/contacts",
  tags: ["Contacts"],
  summary: "List clients and suppliers",
  middleware: [requireOrganization] as const,
  request: {
    query: z.object({
      role: contactRoleSchema.optional(),
      taxId: z
        .string()
        .optional()
        .openapi({ description: "Only contacts with this tax ID, ignoring separators and the ES prefix" }),
    }),
  },
  responses: {
    200: { description: "The contacts", content: json(z.object({ contacts: z.array(contactWithRole) })) },
    ...tenantErrors,
  },
});

const get = createRoute({
  method: "get",
  path: "/contacts/{id}",
  tags: ["Contacts"],
  summary: "Get a contact",
  middleware: [requireOrganization] as const,
  request: { params: idParam },
  responses: {
    200: { description: "The contact", content: json(contactWithRole) },
    404: errorContent("No such contact"),
    ...tenantErrors,
  },
});

const create = createRoute({
  method: "post",
  path: "/contacts",
  tags: ["Contacts"],
  summary: "Create a contact",
  description: "`id` is optional: send a UUID to make retries safe, or let the server generate one.",
  middleware: [requireOrganization, requireWritable] as const,
  request: {
    body: { required: true, content: json(contactWithRole.extend({ id: z.uuid().optional() })) },
  },
  responses: {
    201: { description: "Created", content: json(contactWithRole) },
    400: errorContent("Invalid contact"),
    409: errorContent("The ID is already used"),
    ...tenantErrors,
    ...readOnlyError,
  },
});

const update = createRoute({
  method: "patch",
  path: "/contacts/{id}",
  tags: ["Contacts"],
  summary: "Change some fields of a contact",
  description: "Send only the fields to change; `null` clears an optional field. The role can't change.",
  middleware: [requireOrganization, requireWritable] as const,
  request: { params: idParam, body: { required: true, content: json(z.record(z.string(), z.unknown())) } },
  responses: {
    200: { description: "Updated", content: json(contactWithRole) },
    400: errorContent("Invalid contact"),
    404: errorContent("No such contact"),
    ...tenantErrors,
    ...readOnlyError,
  },
});

const remove = createRoute({
  method: "delete",
  path: "/contacts/{id}",
  tags: ["Contacts"],
  summary: "Delete a contact",
  middleware: [requireOrganization, requireWritable] as const,
  request: { params: idParam },
  responses: {
    204: { description: "Deleted" },
    404: errorContent("No such contact"),
    409: errorContent("Received invoices or expenses still name the supplier"),
    ...tenantErrors,
    ...readOnlyError,
  },
});

export const contactRoutes = new OpenAPIHono<AppEnv>()
  .openapi(list, async (c) => {
    const { role, taxId } = c.req.valid("query");
    const all = await liveContacts(c.get("db"), c.get("organizationId"), role);
    // Duplicates are accepted, so clients that create in bulk can look a tax ID up first
    const rows = taxId === undefined ? all : all.filter((row) => sameTaxId(row.taxId, taxId));
    return c.json({ contacts: rows.map((row) => ({ ...toContact(row), role: row.role })) }, 200);
  })
  .openapi(get, async (c) => {
    const row = await findContact(c.get("db"), c.get("organizationId"), c.req.valid("param").id);
    if (!row) throw notFound();
    return c.json({ ...toContact(row), role: row.role }, 200);
  })
  .openapi(create, async (c) => {
    const { role, ...data } = c.req.valid("json");
    const record = { ...data, id: data.id ?? newId() };
    await applyCommands(c.get("db"), scopeOf(c), [{ type: "create", entity: ENTITIES[role], data: record }]);
    return c.json(await read(c, record.id), 201);
  })
  .openapi(update, async (c) => {
    const { id } = c.req.valid("param");
    const changes = c.req.valid("json");
    const existing = await findContact(c.get("db"), c.get("organizationId"), id);
    if (!existing) throw notFound();
    if ("role" in changes && changes.role !== existing.role) {
      throw new ApiError(400, "invalid_contact", "role: can't be changed.");
    }
    delete changes.role;
    await applyCommands(c.get("db"), scopeOf(c), [{ type: "update", entity: ENTITIES[existing.role], id, changes }]);
    return c.json(await read(c, id), 200);
  })
  .openapi(remove, async (c) => {
    const { id } = c.req.valid("param");
    const existing = await findContact(c.get("db"), c.get("organizationId"), id);
    if (!existing) throw notFound();
    await applyCommands(c.get("db"), scopeOf(c), [{ type: "delete", entity: ENTITIES[existing.role], id }]);
    return c.body(null, 204);
  });

async function read(c: Context<AppEnv>, id: string) {
  const row = await findContact(c.get("db"), c.get("organizationId"), id);
  if (!row) throw notFound();
  return { ...toContact(row), role: row.role };
}

const notFound = () => new ApiError(404, "not_found", "Contact not found.");
