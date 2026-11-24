import { extractionRequestSchema, extractionUsageSchema, purchaseExtractionSchema } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { extractPurchase } from "../ai/extract";
import { readingUsage } from "../ai/readings";
import type { AppEnv } from "../context";
import { ApiError, errorContent } from "../errors";
import { readOnlyError, requireOrganization, requireWritable } from "../middleware";

const json = <S extends z.ZodType>(schema: S) => ({ "application/json": { schema } });

const extract = createRoute({
  method: "post",
  path: "/purchases/extract",
  tags: ["Purchases"],
  summary: "Read a received invoice or receipt with AI",
  description:
    "Upload the PDF or photo first (`POST /v1/files`). An AI model reads it and the answer is a draft for a " +
    "received invoice (`kind: invoice`) or an expense (`kind: ticket`): nothing is saved. `issues` lists the fields " +
    "to check before saving: missing ones, impossible values (a tax ID with a wrong check digit, a VAT rate Spain " +
    "doesn't use) and amounts that don't add up. `supplierId` is the saved supplier with the draft's tax ID. " +
    "PDFs with a text layer send their text to the model; photos and scans send the file itself. PDFs of " +
    "more than 10 pages are refused, rather than read in part. Photos over 1.5 MB, " +
    "HEIC ones and those stored sideways are sent as an upright JPEG of at most 2400 px. A file read before " +
    "(the same bytes) isn't sent to the model again, and doesn't count towards the monthly limit, if the " +
    "server has one (`GET /v1/purchases/extract/usage`); readings that fail don't count either.",
  middleware: [requireOrganization, requireWritable] as const,
  request: { body: { required: true, content: json(extractionRequestSchema) } },
  responses: {
    200: { description: "The draft", content: json(purchaseExtractionSchema) },
    404: errorContent("No such file"),
    415: errorContent(
      "The file isn't a PDF or a JPEG, PNG, HEIC, WebP or GIF image, or can't be read (`unsupported_file`)",
    ),
    413: errorContent("The PDF has more than 10 pages or 50 000 characters of text (`document_too_long`)"),
    429: errorContent("The organization has read this month's documents (`ai_quota_exceeded`)"),
    502: errorContent("The AI provider failed, or its answer couldn't be read (`ai_failed`)"),
    503: errorContent("This server has no AI model set up (`ai_unavailable`)"),
    401: errorContent("Not signed in"),
    403: errorContent("No active organization, or the user doesn't belong to it"),
    ...readOnlyError,
  },
});

const usage = createRoute({
  method: "get",
  path: "/purchases/extract/usage",
  tags: ["Purchases"],
  summary: "Documents read with AI this month",
  description:
    "How many documents the organization has had read with AI this calendar month (Spain's time), and the " +
    "server's monthly limit, if it has one. Reading a file already read, and readings that failed, don't count.",
  middleware: [requireOrganization] as const,
  responses: {
    200: { description: "The usage", content: json(extractionUsageSchema) },
    503: errorContent("This server has no AI model set up (`ai_unavailable`)"),
    401: errorContent("Not signed in"),
    403: errorContent("No active organization, or the user doesn't belong to it"),
  },
});

const requireAi = (ai: AppEnv["Variables"]["ai"]) => {
  if (!ai) throw new ApiError(503, "ai_unavailable", "This server isn't set up to read documents with AI.");
  return ai;
};

export const purchaseRoutes = new OpenAPIHono<AppEnv>()
  .openapi(extract, async (c) => {
    const provider = requireAi(c.get("ai"));
    const { fileId } = c.req.valid("json");
    const ai = { provider, limits: c.get("aiLimits") };
    return c.json(await extractPurchase(c.get("db"), c.get("storage"), ai, c.get("organizationId"), fileId), 200);
  })
  .openapi(usage, async (c) => {
    requireAi(c.get("ai"));
    return c.json(await readingUsage(c.get("db"), c.get("organizationId"), c.get("aiLimits")), 200);
  });
