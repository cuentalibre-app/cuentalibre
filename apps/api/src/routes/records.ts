import {
  changeSchema,
  storedExpenseSchema,
  storedPurchaseInvoiceSchema,
  storedSalesDocumentSchema,
  type SyncCommand,
} from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppEnv } from "../context";
import type { Db } from "../db/client";
import { ApiError, errorContent } from "../errors";
import { readOnlyError, requireOrganization, requireWritable, scopeOf } from "../middleware";
import { expensesById, liveExpenses, toExpense } from "../sync/expenses";
import { livePurchaseInvoices, purchaseInvoicesById } from "../sync/purchases";
import { liveSalesDocuments, salesDocumentsById } from "../sync/sales";
import { applyCommands } from "../sync/write";

/*
 * Plain CRUD over sales documents, received invoices and expenses for the
 * public API. Writes go through the same commands as the web app's, so they
 * are validated, locked by closed quarters and logged the same way.
 */

type Entity = "salesDocuments" | "purchaseInvoices" | "expenses";
type Change = z.infer<typeof changeSchema>;

interface Resource {
  entity: Entity;
  path: string;
  tag: string;
  /** "Sales document", for summaries and errors. */
  noun: string;
  schema: z.ZodObject;
  /** The date `from` and `to` filter on. */
  dateField: string;
  dateHelp: string;
  live: (db: Db, organizationId: string) => Promise<{ id: string }[]>;
  find: (db: Db, organizationId: string, id: string) => Promise<object | undefined>;
}

const firstLive = <T extends { deleted: boolean; record: object }>(rows: T[]) =>
  rows.find((row) => !row.deleted)?.record;

const RESOURCES: Resource[] = [
  {
    entity: "salesDocuments",
    path: "/sales-documents",
    tag: "Sales",
    noun: "Sales document",
    schema: storedSalesDocumentSchema,
    dateField: "issuedOn",
    dateHelp: "issue date",
    live: liveSalesDocuments,
    find: async (db, organizationId, id) => firstLive(await salesDocumentsById(db, organizationId, [id])),
  },
  {
    entity: "purchaseInvoices",
    path: "/purchase-invoices",
    tag: "Purchases",
    noun: "Received invoice",
    schema: storedPurchaseInvoiceSchema,
    dateField: "bookedOn",
    dateHelp: "booking date, which decides the quarter",
    live: livePurchaseInvoices,
    find: async (db, organizationId, id) => firstLive(await purchaseInvoicesById(db, organizationId, [id])),
  },
  {
    entity: "expenses",
    path: "/expenses",
    tag: "Expenses",
    noun: "Expense",
    schema: storedExpenseSchema,
    dateField: "date",
    dateHelp: "date",
    live: liveExpenses,
    find: async (db, organizationId, id) => {
      const [row] = await expensesById(db, organizationId, [id]);
      return row && !row.deletedAt ? toExpense(row) : undefined;
    },
  },
];

const tenantErrors = {
  401: errorContent("Not signed in, or the API key is invalid"),
  403: errorContent("No active organization, or the user doesn't belong to it"),
};
const json = <S extends z.ZodType>(schema: S) => ({ "application/json": { schema } });
const idParam = z.object({ id: z.uuid() });
const isoDate = z.iso.date();

async function read(c: Context<AppEnv>, resource: Resource, id: string) {
  const record = await resource.find(c.get("db"), c.get("organizationId"), id);
  if (!record) throw new ApiError(404, "not_found", `${resource.noun} not found.`);
  return record;
}

const write = (c: Context<AppEnv>, commands: SyncCommand[]) => applyCommands(c.get("db"), scopeOf(c), commands);

function resourceRoutes(resource: Resource) {
  const { entity, path, tag, noun, schema } = resource;
  const lower = noun.toLowerCase();
  const routes = new OpenAPIHono<AppEnv>();

  routes.openapi(
    createRoute({
      method: "get",
      path,
      tags: [tag],
      summary: `List ${lower}s`,
      description: `Optionally between two dates (inclusive) of their ${resource.dateHelp}.`,
      middleware: [requireOrganization] as const,
      request: { query: z.object({ from: isoDate.optional(), to: isoDate.optional() }) },
      responses: {
        200: { description: "The records", content: json(z.object({ data: z.array(schema) })) },
        ...tenantErrors,
      },
    }),
    async (c) => {
      const { from, to } = c.req.valid("query");
      const records = (await resource.live(c.get("db"), c.get("organizationId"))) as Record<string, unknown>[];
      const date = (record: Record<string, unknown>) => record[resource.dateField] as string;
      const data = records.filter((r) => (!from || date(r) >= from) && (!to || date(r) <= to));
      return c.json({ data }, 200);
    },
  );

  routes.openapi(
    createRoute({
      method: "get",
      path: `${path}/{id}`,
      tags: [tag],
      summary: `Get a ${lower}`,
      middleware: [requireOrganization] as const,
      request: { params: idParam },
      responses: {
        200: { description: noun, content: json(schema) },
        404: errorContent(`No such ${lower}`),
        ...tenantErrors,
      },
    }),
    async (c) => c.json(await read(c, resource, c.req.valid("param").id), 200),
  );

  routes.openapi(
    createRoute({
      method: "post",
      path,
      tags: [tag],
      summary: `Create a ${lower}`,
      description:
        "`id` is optional: send a UUID to make retries safe, or let the server generate one." +
        (entity === "salesDocuments"
          ? " Creates drafts, quotes and delivery notes; invoices are issued with `POST /v1/invoices`."
          : ""),
      middleware: [requireOrganization, requireWritable] as const,
      request: { body: { required: true, content: json(schema.extend({ id: z.uuid().optional() })) } },
      responses: {
        201: { description: "Created", content: json(schema) },
        400: errorContent(`Invalid ${lower}`),
        409: errorContent("The ID is already used, or its quarter is closed"),
        ...tenantErrors,
        ...readOnlyError,
      },
    }),
    async (c) => {
      const body = c.req.valid("json") as Record<string, unknown>;
      const data = { ...body, id: (body.id as string | undefined) ?? newId() };
      await write(c, [{ type: "create", entity, data } as SyncCommand]);
      return c.json(await read(c, resource, data.id), 201);
    },
  );

  routes.openapi(
    createRoute({
      method: "patch",
      path: `${path}/{id}`,
      tags: [tag],
      summary: `Change some fields of a ${lower}`,
      description: "Send only the fields to change; `null` clears an optional field.",
      middleware: [requireOrganization, requireWritable] as const,
      request: { params: idParam, body: { required: true, content: json(z.record(z.string(), z.unknown())) } },
      responses: {
        200: { description: "Updated", content: json(schema) },
        400: errorContent(`Invalid ${lower}`),
        404: errorContent(`No such ${lower}`),
        409: errorContent("An issued invoice, or one in a closed quarter, can't take this change"),
        ...tenantErrors,
        ...readOnlyError,
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      await read(c, resource, id);
      await write(c, [{ type: "update", entity, id, changes: c.req.valid("json") }]);
      return c.json(await read(c, resource, id), 200);
    },
  );

  routes.openapi(
    createRoute({
      method: "delete",
      path: `${path}/{id}`,
      tags: [tag],
      summary: `Delete a ${lower}`,
      middleware: [requireOrganization, requireWritable] as const,
      request: { params: idParam },
      responses: {
        204: { description: "Deleted" },
        404: errorContent(`No such ${lower}`),
        409: errorContent("Issued invoices, and records of a closed quarter, can't be deleted"),
        ...tenantErrors,
        ...readOnlyError,
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      await read(c, resource, id);
      await write(c, [{ type: "delete", entity, id }]);
      return c.body(null, 204);
    },
  );

  return routes;
}

const sales = RESOURCES[0]!;

const issueNew = createRoute({
  method: "post",
  path: "/invoices",
  tags: ["Sales"],
  summary: "Issue an invoice",
  description:
    "The server gives it the next number of its series and freezes its client data and totals; " +
    "from then on it can't be changed or deleted, only rectified. Send the ID of a draft to issue it " +
    "with the data sent. Under VERI*FACTU its record is created and sent to the AEAT.",
  middleware: [requireOrganization, requireWritable] as const,
  request: {
    body: {
      required: true,
      content: json(storedSalesDocumentSchema.omit({ issued: true }).extend({ id: z.uuid().optional() })),
    },
  },
  responses: {
    201: { description: "Issued", content: json(storedSalesDocumentSchema) },
    400: errorContent("Invalid invoice"),
    409: errorContent("Already issued, dated before the last invoice of its series, or in a closed quarter"),
    ...tenantErrors,
    ...readOnlyError,
  },
});

const issueDraft = createRoute({
  method: "post",
  path: "/sales-documents/{id}/issue",
  tags: ["Sales"],
  summary: "Issue a draft as it is",
  middleware: [requireOrganization, requireWritable] as const,
  request: { params: idParam },
  responses: {
    201: { description: "Issued", content: json(storedSalesDocumentSchema) },
    400: errorContent("Not a draft, or not ready to issue"),
    404: errorContent("No such draft"),
    409: errorContent("Dated before the last invoice of its series, or in a closed quarter"),
    ...tenantErrors,
    ...readOnlyError,
  },
});

type Document = z.infer<typeof storedSalesDocumentSchema>;

async function issue(c: Context<AppEnv>, data: Document) {
  const changes: Change[] = await write(c, [{ type: "issue", data: { ...data, kind: "invoice" } }]);
  return changes.find((change) => change.entity === "salesDocuments" && change.op === "upsert")!.data as Document;
}

export const recordRoutes = RESOURCES.reduce(
  (app, resource) => app.route("/", resourceRoutes(resource)),
  new OpenAPIHono<AppEnv>(),
)
  .openapi(issueNew, async (c) => {
    const body = c.req.valid("json");
    return c.json(await issue(c, { ...body, id: body.id ?? newId() } as Document), 201);
  })
  .openapi(issueDraft, async (c) => {
    const draft = (await read(c, sales, c.req.valid("param").id)) as Document;
    if (draft.kind !== "draft") throw new ApiError(400, "invalid_document", "Only drafts can be issued.");
    return c.json(await issue(c, draft), 201);
  });
