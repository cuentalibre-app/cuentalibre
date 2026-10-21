import type { Attachment } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { currentBackend } from "./backend";

/*
 * Files attached to records. A picked file is shown at once from an object
 * URL while it uploads in the background; the record that names it is only
 * sent once the upload is done (see `createApiBackend`).
 */

/** Turns a picked file into an attachment and starts storing it. */
export function attachFile(file: File): Attachment {
  const attachment = { id: newId(), name: file.name, size: file.size, url: URL.createObjectURL(file) };
  currentBackend().upload?.(attachment.id, file);
  return attachment;
}

/** Where to open an attachment: this tab's copy, or the stored file. Undefined when neither exists. */
export function attachmentUrl(attachment: Attachment): string | undefined {
  return attachment.url ?? currentBackend().fileUrl?.(attachment.id);
}

/** Whether attached files are kept beyond this browser tab. */
export const filesAreStored = () => currentBackend().upload !== undefined;
