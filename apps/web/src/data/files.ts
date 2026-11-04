import type { Attachment } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { useEffect, useRef } from "react";
import { currentBackend } from "./backend";

/*
 * Files attached to records. A picked file is shown at once from an object
 * URL, but only uploaded when a command that names it is sent (see
 * `createApiBackend`), so a cancelled form leaves nothing stored.
 */

interface PendingFile {
  file: File;
  url: string;
  /** Commands naming it have been sent, so it may still be stored and must be kept. */
  sent: number;
  /** Nothing shows it anymore: once no command needs it, it can go. */
  discarded: boolean;
}

/** Files picked but not stored yet, by attachment ID. Only when there is a server to store them. */
const pending = new Map<string, PendingFile>();

/** Turns a picked file into an attachment, shown from this tab until it is stored. */
export function attachFile(file: File): Attachment {
  const attachment = { id: newId(), name: file.name, size: file.size, url: URL.createObjectURL(file) };
  if (filesAreStored()) pending.set(attachment.id, { file, url: attachment.url, sent: 0, discarded: false });
  return attachment;
}

/** Where to open an attachment: this tab's copy, or the stored file. Undefined when neither exists. */
export function attachmentUrl(attachment: Attachment): string | undefined {
  return attachment.url ?? currentBackend().fileUrl?.(attachment.id);
}

/** Whether attached files are kept beyond this browser tab. */
export const filesAreStored = () => currentBackend().upload !== undefined;

/**
 * Forgets attachments nothing will save, such as those of a cancelled form or one
 * removed before saving: their files are never uploaded. Those a command already
 * named are kept until it is answered.
 */
export function discardAttachments(attachments: Attachment[]) {
  for (const { id } of attachments) {
    const entry = pending.get(id);
    if (!entry) continue;
    entry.discarded = true;
    if (entry.sent === 0) forget(id);
  }
}

/** Discards the form's attachments when it goes away, saved or not: saved ones were already sent. */
export function useDiscardOnLeave(attachments: Attachment[]) {
  const latest = useRef(attachments);
  latest.current = attachments;
  useEffect(() => () => discardAttachments(latest.current), []);
}

/**
 * The files a command about to be sent names and still has to upload. They are
 * kept until `settleFiles` says how the command went.
 */
export function takeFiles(body: string): { id: string; file: File }[] {
  const named = [...pending].filter(([id]) => body.includes(id));
  for (const [, entry] of named) entry.sent++;
  return named.map(([id, { file }]) => ({ id, file }));
}

/**
 * After a command that named these files is answered. Once stored, the record
 * shows the stored file and the tab's copy goes; otherwise it stays for a retry,
 * unless nothing shows it anymore.
 */
export function settleFiles(ids: string[], stored: boolean) {
  for (const id of ids) {
    const entry = pending.get(id);
    if (!entry) continue;
    entry.sent--;
    if (stored || (entry.discarded && entry.sent === 0)) forget(id);
  }
}

function forget(id: string) {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  URL.revokeObjectURL(entry.url);
}
