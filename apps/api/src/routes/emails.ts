import { emailMessageSchema, emailRequestSchema } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../context";
import { listEmails, queueEmail } from "../email/messages";
import { ApiError, errorContent } from "../errors";
import { readOnlyError, requireOrganization, requireWritable, scopeOf } from "../middleware";

const tenantErrors = {
  401: errorContent("Not signed in"),
  403: errorContent("No active organization, or the user doesn't belong to it"),
};
const json = <S extends z.ZodType>(schema: S) => ({ "application/json": { schema } });

const send = createRoute({
  method: "post",
  path: "/emails",
  tags: ["Email"],
  summary: "Send an email, such as an invoice to its client",
  description:
    "Upload the attachments first (`POST /v1/files`). The email is queued and sent in the background: " +
    "follow its `status` with `GET /v1/emails`. It goes out with the business's name and replies go to its email.",
  middleware: [requireOrganization, requireWritable] as const,
  request: { body: { required: true, content: json(emailRequestSchema) } },
  responses: {
    202: { description: "Queued", content: json(emailMessageSchema) },
    400: errorContent("Invalid email, or an attachment that wasn't uploaded"),
    503: errorContent("This server can't send email"),
    ...tenantErrors,
    ...readOnlyError,
  },
});

const list = createRoute({
  method: "get",
  path: "/emails",
  tags: ["Email"],
  summary: "Emails sent from the organization, newest first",
  middleware: [requireOrganization] as const,
  request: { query: z.object({ documentId: z.uuid().optional() }) },
  responses: {
    200: { description: "The emails", content: json(z.object({ emails: z.array(emailMessageSchema) })) },
    ...tenantErrors,
  },
});

export const emailRoutes = new OpenAPIHono<AppEnv>()
  .openapi(send, async (c) => {
    if (!c.get("mailer")) throw new ApiError(503, "email_unavailable", "This server isn't set up to send email.");
    return c.json(await queueEmail(c.get("db"), scopeOf(c), c.req.valid("json")), 202);
  })
  .openapi(list, async (c) =>
    c.json({ emails: await listEmails(c.get("db"), c.get("organizationId"), c.req.valid("query").documentId) }, 200),
  );
