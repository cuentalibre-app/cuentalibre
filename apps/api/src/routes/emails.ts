import { emailMessageSchema, emailRequestSchema, emailSenderSchema } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../context";
import { listEmails, queueEmail, senderOf } from "../email/messages";
import { ApiError, errorContent } from "../errors";
import { readOnlyError, requireOrganization, requireVerifiedEmail, requireWritable, scopeOf } from "../middleware";

const tenantErrors = {
  401: errorContent("Not signed in"),
  403: errorContent("No active organization, or the user doesn't belong to it"),
};
const json = <S extends z.ZodType>(schema: S) => ({ "application/json": { schema } });

const send = createRoute({
  method: "post",
  path: "/emails",
  tags: ["Email"],
  summary: "Send a sales document, such as an invoice to its client",
  description:
    "Upload the attachments first (`POST /v1/files`). The email is queued and sent in the background: " +
    "follow its `status` with `GET /v1/emails`. It goes out as `GET /v1/emails/sender` says, replying to `replyTo` if given; " +
    "`bccMe` also sends a blind copy to the sending user. " +
    "Only users with a verified email can send, and each organization reaches a limited number of recipients " +
    "(to, cc and bcc) a day and a month.",
  middleware: [requireOrganization, requireWritable, requireVerifiedEmail] as const,
  request: { body: { required: true, content: json(emailRequestSchema) } },
  responses: {
    202: { description: "Queued", content: json(emailMessageSchema) },
    400: errorContent("Invalid email, or an attachment that wasn't uploaded"),
    429: errorContent("The organization reached its daily or monthly email recipients"),
    503: errorContent("This server can't send email"),
    ...tenantErrors,
    403: errorContent("No active organization, the user doesn't belong to it, or their email isn't verified"),
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

const getSender = createRoute({
  method: "get",
  path: "/emails/sender",
  tags: ["Email"],
  summary: "Who emails go out from",
  description:
    "The business's name at the instance's address: sending from people's own addresses would fail spam checks. " +
    "Replies go to `replyTo`: the business's email, or else the user's.",
  middleware: [requireOrganization] as const,
  responses: {
    200: { description: "The sender", content: json(emailSenderSchema) },
    503: errorContent("This server can't send email"),
    ...tenantErrors,
  },
});

export const emailRoutes = new OpenAPIHono<AppEnv>()
  .openapi(send, async (c) => {
    if (!c.get("mailer")) throw new ApiError(503, "email_unavailable", "This server isn't set up to send email.");
    const sender = { ...scopeOf(c), apiKeyId: c.get("apiKeyId"), quota: c.get("emailQuota") };
    return c.json(await queueEmail(c.get("db"), sender, c.req.valid("json")), 202);
  })
  .openapi(getSender, async (c) => {
    const mailer = c.get("mailer");
    if (!mailer) throw new ApiError(503, "email_unavailable", "This server isn't set up to send email.");
    const { organizationId, userId } = scopeOf(c);
    const { name, replyTo } = await senderOf(c.get("db"), organizationId, userId);
    return c.json({ name, address: mailer.address, replyTo }, 200);
  })
  .openapi(list, async (c) =>
    c.json({ emails: await listEmails(c.get("db"), c.get("organizationId"), c.req.valid("query").documentId) }, 200),
  );
