import type { FileListing, FileUser, FileUserKind, StoredFile } from "@cuentalibre/contracts";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
  const stored = new Set(await lockFiles(tx, organizationId, added));
  const missing = added.find((id) => !stored.has(id));
  if (missing) throw new ApiError(400, "invalid_attachment", `attachments: file ${missing} wasn't uploaded.`);
}

/**
 * The IDs of those files the organization has, locked until the transaction ends so
 * none of them can be deleted meanwhile (see `deleteFile`). Whatever names a file
 * takes this lock first, or a deleted file could end up named.
 */
export async function lockFiles(tx: Tx, organizationId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await tx
    .select({ id: file.id })
    .from(file)
    .where(and(eq(file.organizationId, organizationId), inArray(file.id, ids)))
    .for("share");
  return rows.map((row) => row.id);
}

interface FileUserRow extends Record<string, unknown> {
  file_id: string;
  kind: FileUserKind;
  id: string;
  label: string | null;
  document_id: string | null;
  deleted: boolean;
}

/**
 * The records that name the organization's files in their attachments, deleted ones
 * included, by file ID. Only those naming `fileId` when one is given.
 */
export async function fileUsers(tx: Tx, organizationId: string, fileId?: string) {
  // Attachments are a jsonb array: of objects with an `id`, or of bare IDs for emails
  const names = (column: string) =>
    fileId ? sql`${sql.raw(column)} @> jsonb_build_array(jsonb_build_object('id', ${fileId}::text))` : sql`true`;
  const emailNames = fileId ? sql`m.attachments @> jsonb_build_array(${fileId}::text)` : sql`true`;
  const rows = await tx.execute<FileUserRow>(sql`
    select * from (
      select a.value ->> 'id' as file_id, d.kind, d.id, coalesce(d.number, c.name) as label,
        null::uuid as document_id, d.deleted_at is not null as deleted
      from sales_document d
      left join contact c on c.organization_id = d.organization_id and c.id = d.client_id
      cross join lateral jsonb_array_elements(coalesce(d.attachments, '[]')) a
      where d.organization_id = ${organizationId} and ${names("d.attachments")}
      union all
      select a.value ->> 'id', c.role, c.id, c.name, null, c.deleted_at is not null
      from contact c
      cross join lateral jsonb_array_elements(coalesce(c.attachments, '[]')) a
      where c.organization_id = ${organizationId} and ${names("c.attachments")}
      union all
      select a.value ->> 'id', case when p.asset is null then 'purchaseInvoice' else 'asset' end, p.id,
        concat_ws(' · ', s.name, p.number), null, p.deleted_at is not null
      from purchase_invoice p
      left join contact s on s.organization_id = p.organization_id and s.id = p.supplier_id
      cross join lateral jsonb_array_elements(coalesce(p.attachments, '[]')) a
      where p.organization_id = ${organizationId} and ${names("p.attachments")}
      union all
      select a.value ->> 'id', 'expense', e.id, coalesce(s.name, e.other_payee ->> 'name', e.concept), null,
        e.deleted_at is not null
      from expense e
      left join contact s on s.organization_id = e.organization_id and s.id = e.supplier_id
      cross join lateral jsonb_array_elements(coalesce(e.attachments, '[]')) a
      where e.organization_id = ${organizationId} and ${names("e.attachments")}
      union all
      select a.value, 'email', m.id, m.subject, m.document_id, false
      from email_message m
      cross join lateral jsonb_array_elements_text(m.attachments) a
      where m.organization_id = ${organizationId} and ${emailNames}
    ) users
    ${fileId ? sql`where file_id = ${fileId}` : sql``}
    order by deleted, kind, label`);
  const users = new Map<string, FileUser[]>();
  for (const row of rows) {
    const user: FileUser = {
      kind: row.kind,
      id: row.id,
      label: row.label || null,
      ...(row.document_id && { documentId: row.document_id }),
      deleted: row.deleted,
    };
    const list = users.get(row.file_id);
    // A record that names a file twice is still one user
    if (!list) users.set(row.file_id, [user]);
    else if (!list.some((other) => other.kind === user.kind && other.id === user.id)) list.push(user);
  }
  return users;
}

/** The organization's files, newest first, with the records that name each one. */
export async function listFiles(db: Tx, organizationId: string, quota: number): Promise<FileListing> {
  const [rows, users] = await Promise.all([
    db.select().from(file).where(eq(file.organizationId, organizationId)).orderBy(desc(file.createdAt), file.id),
    fileUsers(db, organizationId),
  ]);
  return {
    files: rows.map((row) => ({
      ...toStoredFile(row),
      uploadedAt: row.createdAt.toISOString(),
      usedBy: users.get(row.id) ?? [],
    })),
    usedBytes: rows.reduce((sum, row) => sum + row.size, 0),
    quotaBytes: quota > 0 ? quota : null,
  };
}

/**
 * Deletes a file no record names, deleted records included: a file attached to
 * one may be a supporting document that has to be kept. Returns its storage key,
 * for the caller to remove the bytes once the deletion is committed.
 */
export function deleteFile(db: Tx, organizationId: string, id: string) {
  return db.transaction(async (tx) => {
    // Waits for whatever is naming the file to commit, and stops anything naming it from now on
    const [row] = await tx
      .select({ storageKey: file.storageKey })
      .from(file)
      .where(and(eq(file.organizationId, organizationId), eq(file.id, id)))
      .for("update");
    if (!row) throw new ApiError(404, "not_found", "File not found.");
    const users = (await fileUsers(tx, organizationId, id)).get(id);
    if (users?.length)
      throw new ApiError(409, "file_in_use", "Records name this file. Remove it from their attachments first.");
    await tx.delete(file).where(and(eq(file.organizationId, organizationId), eq(file.id, id)));
    return row.storageKey;
  });
}

export interface Upload {
  id: string;
  name: string;
  contentType: string;
  body: Uint8Array;
}

/**
 * Stores the bytes, then the metadata. A file's ID can't be reused, even by a retry.
 * `quota` is the most bytes the organization's files may take in all; 0 means no limit.
 */
export function uploadFile(
  db: Tx,
  storage: FileStorage,
  scope: { organizationId: string; userId: string; quota: number },
  upload: Upload,
): Promise<StoredFile> {
  return db.transaction(async (tx) => {
    // One upload at a time per organization, so two at once can't both fit under the quota.
    // A key of its own: an upload doesn't hold up the organization's other writes.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.organizationId}, 1))`);
    if (await findFile(tx, scope.organizationId, upload.id)) alreadyUploaded();
    if (scope.quota > 0 && (await storedBytes(tx, scope.organizationId)) + upload.body.byteLength > scope.quota)
      throw new ApiError(
        413,
        "storage_quota_exceeded",
        `The organization's files can take up to ${scope.quota} bytes in all; this one doesn't fit.`,
      );
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
  });
}

/** Bytes the organization's files take. */
async function storedBytes(tx: Tx, organizationId: string) {
  const [row] = await tx
    .select({ bytes: sql<number>`coalesce(sum(${file.size}), 0)::bigint` })
    .from(file)
    .where(eq(file.organizationId, organizationId));
  return Number(row?.bytes ?? 0);
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
