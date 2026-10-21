import type { StoredFile } from "@cuentalibre/contracts";
import { and, eq, inArray } from "drizzle-orm";
import type { Tx } from "../db/client";
import { file } from "../db/schema";
import { ApiError } from "../errors";
import type { FileStorage } from "../storage";

type FileRow = typeof file.$inferSelect;

export const toStoredFile = (row: FileRow): StoredFile => ({
  id: row.id,
  name: row.name,
  size: row.size,
  contentType: row.contentType,
});

/**
 * Attachments a record gains must name files the organization uploaded, so a
 * record can't point at a file that was never stored. Those it already had
 * are left alone: they may predate file storage.
 */
export async function checkAttachments(
  tx: Tx,
  organizationId: string,
  attachments: { id: string }[] | undefined,
  previous: { id: string }[] = [],
) {
  const known = new Set(previous.map((attachment) => attachment.id));
  const added = [...new Set((attachments ?? []).map((a) => a.id).filter((id) => !known.has(id)))];
  if (added.length === 0) return;
  const found = await tx
    .select({ id: file.id })
    .from(file)
    .where(and(eq(file.organizationId, organizationId), inArray(file.id, added)));
  const stored = new Set(found.map((row) => row.id));
  const missing = added.find((id) => !stored.has(id));
  if (missing) throw new ApiError(400, "invalid_attachment", `attachments: file ${missing} wasn't uploaded.`);
}

export interface Upload {
  id: string;
  name: string;
  contentType: string;
  body: Uint8Array;
}

/** Stores the bytes, then the metadata. A file's ID can't be reused, even by a retry. */
export async function uploadFile(
  tx: Tx,
  storage: FileStorage,
  scope: { organizationId: string; userId: string },
  upload: Upload,
): Promise<StoredFile> {
  if (await findFile(tx, scope.organizationId, upload.id)) alreadyUploaded();
  // A key of its own per upload: a racing upload with the same ID can't overwrite these bytes
  const storageKey = `${scope.organizationId}/${upload.id}/${crypto.randomUUID()}`;
  await storage.put(storageKey, upload.body, upload.contentType);
  const [row] = await tx
    .insert(file)
    .values({
      organizationId: scope.organizationId,
      id: upload.id,
      name: upload.name,
      contentType: upload.contentType,
      size: upload.body.byteLength,
      storageKey,
      uploadedBy: scope.userId,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) alreadyUploaded();
  return toStoredFile(row);
}

export async function findFile(tx: Tx, organizationId: string, id: string) {
  const [row] = await tx
    .select()
    .from(file)
    .where(and(eq(file.organizationId, organizationId), eq(file.id, id)));
  return row;
}

function alreadyUploaded(): never {
  throw new ApiError(409, "already_exists", "A file with this ID already exists.");
}
