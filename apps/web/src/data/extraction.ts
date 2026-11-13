import type { Attachment, PurchaseExtraction } from "@cuentalibre/contracts";
import { ApiError } from "./api";
import { currentBackend } from "./backend";
import { storeNow } from "./files";

/*
 * Reading received invoices and receipts with AI, on servers that have a model
 * set up. The file is stored first, since the server reads it from storage;
 * what comes back is a draft for the form, and nothing is saved.
 */

/** Reads an attachment, storing its file first if it is only in this tab. */
export async function readAttachment(attachment: Attachment): Promise<PurchaseExtraction> {
  const extract = currentBackend().extractPurchase;
  if (!extract) throw new ApiError(503, "ai_unavailable", "Reading documents needs a server.");
  await storeNow(attachment);
  return extract(attachment.id);
}

/** Why a reading failed, for the user. */
export function readingError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : null;
  switch (code) {
    case "unsupported_file":
      return "No se puede leer este archivo: tiene que ser un PDF o una foto.";
    case "file_too_large":
      return "El archivo es demasiado grande para guardarlo.";
    case "ai_unavailable":
      return "Este servidor no tiene configurada la lectura con IA.";
    default:
      return "No se han podido leer los datos. Vuelve a intentarlo o rellénalos a mano.";
  }
}
