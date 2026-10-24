import { storedFileSchema } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";
import { ApiError, errorContent, errorResponse } from "../errors";
import { readOnlyError, requireOrganization, requireWritable } from "../middleware";
import { findFile, uploadFile } from "../sync/files";

/*
 * Uploaded files. Records name them by ID in their `attachments`; the bytes
 * live in the storage adapter. Files don't change once uploaded.
 */

/** Types a browser may show in a tab. Anything else is downloaded, so an uploaded page can't run as ours. */
const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Stops reading an upload as soon as it is larger than allowed. */
const limitUpload = createMiddleware<AppEnv>((c, next) =>
  bodyLimit({
    // Room for the multipart envelope around the file
    maxSize: c.get("fileMaxBytes") + 64 * 1024,
    onError: (c) => errorResponse(c, 413, "file_too_large", "The file is too large."),
  })(c, next),
);

const tenantErrors = {
  401: errorContent("Not signed in"),
  403: errorContent("No active organization, or the user doesn't belong to it"),
};

const upload = createRoute({
  method: "post",
  path: "/files",
  tags: ["Files"],
  summary: "Upload a file",
  description:
    "Send it as `multipart/form-data`. `id` is optional: the web app sends the attachment's ID, " +
    "so it can show the file before the upload ends. Name the file in a record's `attachments` afterwards.",
  middleware: [requireOrganization, requireWritable, limitUpload] as const,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.instanceof(File).openapi({ type: "string", format: "binary" }),
            id: z.uuid().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Uploaded", content: { "application/json": { schema: storedFileSchema } } },
    400: errorContent("No file"),
    409: errorContent("The ID is already used"),
    413: errorContent("The file is too large"),
    ...tenantErrors,
    ...readOnlyError,
  },
});

const download = createRoute({
  method: "get",
  path: "/files/{id}",
  tags: ["Files"],
  summary: "Download a file",
  middleware: [requireOrganization] as const,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: { description: "The file's bytes" },
    404: errorContent("No such file"),
    ...tenantErrors,
  },
});

export const fileRoutes = new OpenAPIHono<AppEnv>()
  .openapi(upload, async (c) => {
    const { file, id } = c.req.valid("form");
    if (file.size > c.get("fileMaxBytes")) throw new ApiError(413, "file_too_large", "The file is too large.");
    const stored = await uploadFile(
      c.get("db"),
      c.get("storage"),
      { organizationId: c.get("organizationId"), userId: c.get("user")!.id },
      {
        id: id ?? newId(),
        name: file.name || "archivo",
        contentType: file.type || "application/octet-stream",
        body: new Uint8Array(await file.arrayBuffer()),
      },
    );
    return c.json(stored, 201);
  })
  .openapi(download, async (c) => {
    const row = await findFile(c.get("db"), c.get("organizationId"), c.req.valid("param").id);
    const body = row && (await c.get("storage").get(row.storageKey));
    if (!row || !body) throw new ApiError(404, "not_found", "File not found.");
    const inline = INLINE_TYPES.has(row.contentType);
    return c.body(body, 200, {
      "content-type": inline ? row.contentType : "application/octet-stream",
      "content-length": String(row.size),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      "x-content-type-options": "nosniff",
      // A file never changes, but only the organization's members may read it
      "cache-control": "private, max-age=31536000, immutable",
    }) as never;
  });
