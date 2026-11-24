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

/** "diciembre": the month after `today`'s, when the monthly limit starts afresh. */
export function nextMonthName(today = new Date()): string {
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return next.toLocaleDateString("es-ES", { month: "long" });
}

/** Whether trying the same reading again may work: not when the month's limit is reached, nor for a document too long. */
export const canRetryReading = (error: unknown) =>
  !(error instanceof ApiError && (error.code === "ai_quota_exceeded" || error.code === "document_too_long"));

/** Why a reading failed, for the user. */
export function readingError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : null;
  switch (code) {
    case "ai_quota_exceeded":
      return `Has leído con IA todos los documentos de este mes. Podrás leer más desde el 1 de ${nextMonthName()}; mientras, rellena los datos a mano.`;
    case "unsupported_file":
      return "No se puede leer este archivo: tiene que ser un PDF o una foto.";
    case "document_too_long":
      return "El documento es demasiado largo para leerlo con IA. Rellena los datos a mano.";
    case "file_too_large":
      return "El archivo es demasiado grande para guardarlo.";
    case "ai_unavailable":
      return "Este servidor no tiene configurada la lectura con IA.";
    default:
      return "No se han podido leer los datos. Vuelve a intentarlo o rellénalos a mano.";
  }
}
