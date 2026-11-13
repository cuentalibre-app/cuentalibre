import { extractionRequestSchema, purchaseExtractionSchema } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { extractPurchase } from "../ai/extract";
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
    "PDFs with a text layer send their text to the model; photos and scans send the file itself. Photos over 1.5 MB, " +
    "HEIC ones and those stored sideways are sent as an upright JPEG of at most 2400 px.",
  middleware: [requireOrganization, requireWritable] as const,
  request: { body: { required: true, content: json(extractionRequestSchema) } },
  responses: {
    200: { description: "The draft", content: json(purchaseExtractionSchema) },
    404: errorContent("No such file"),
    415: errorContent(
      "The file isn't a PDF or a JPEG, PNG, HEIC, WebP or GIF image, or can't be read (`unsupported_file`)",
    ),
    502: errorContent("The AI provider failed, or its answer couldn't be read (`ai_failed`)"),
    503: errorContent("This server has no AI model set up (`ai_unavailable`)"),
    401: errorContent("Not signed in"),
    403: errorContent("No active organization, or the user doesn't belong to it"),
    ...readOnlyError,
  },
});

export const purchaseRoutes = new OpenAPIHono<AppEnv>().openapi(extract, async (c) => {
  const ai = c.get("ai");
  if (!ai) throw new ApiError(503, "ai_unavailable", "This server isn't set up to read documents with AI.");
  const { fileId } = c.req.valid("json");
  return c.json(await extractPurchase(c.get("db"), c.get("storage"), ai, c.get("organizationId"), fileId), 200);
});
