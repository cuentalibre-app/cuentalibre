import type { PurchaseExtraction } from "@cuentalibre/contracts";
import { checkPurchaseDraft, findSupplierByTaxId } from "@cuentalibre/core";
import { extractText } from "unpdf";
import type { Db } from "../db/client";
import { ApiError } from "../errors";
import type { FileStorage } from "../storage";
import { liveContacts } from "../sync/contacts";
import { findFile } from "../sync/files";
import { EXTRACTION_PROMPT, modelAnswerJsonSchema, modelAnswerSchema, toDraft } from "./answer";
import { AiError, type AiProvider, type ModelInput } from "./provider";

/** Below this many letters and digits, a PDF's text layer is empty or noise: it is read as a scan. */
const MIN_TEXT_CHARACTERS = 40;
/** An invoice's text fits easily; anything longer is cut, so a huge PDF can't run up the bill. */
const MAX_TEXT_CHARACTERS = 20_000;

/** The type of a file by its first bytes, which can't be faked by its name or upload type. */
export function sniffType(bytes: Uint8Array): "pdf" | "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(1, 4) === "PNG" && bytes[0] === 0x89) return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  return null;
}

/** The PDF's text layer, or null when it has none worth reading (a scan) or can't be parsed. */
async function pdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    // pdf.js takes ownership of the buffer it reads, so it gets a copy
    const { text } = await extractText(bytes.slice(), { mergePages: true });
    const characters = text.replace(/[^\p{L}\p{N}]/gu, "").length;
    return characters >= MIN_TEXT_CHARACTERS ? text.slice(0, MAX_TEXT_CHARACTERS) : null;
  } catch {
    return null;
  }
}

/** What the model reads from a file: a PDF's text if it has one, else the file itself. */
export async function modelInput(bytes: Uint8Array): Promise<ModelInput> {
  const type = sniffType(bytes);
  if (!type) throw new ApiError(415, "unsupported_file", "Only PDFs and JPEG, PNG, WebP or GIF images can be read.");
  if (type !== "pdf") return { kind: "image", mediaType: type, data: bytes };
  const text = await pdfText(bytes);
  return text ? { kind: "text", text } : { kind: "pdf", data: bytes };
}

/**
 * Reads an uploaded invoice or receipt with the model and returns a draft for the
 * purchase form, with the fields that don't add up and the supplier it belongs to.
 * Saves nothing.
 */
export async function extractPurchase(
  db: Db,
  storage: FileStorage,
  provider: AiProvider,
  organizationId: string,
  fileId: string,
): Promise<PurchaseExtraction> {
  const row = await findFile(db, organizationId, fileId);
  const stream = row && (await storage.get(row.storageKey));
  if (!row || !stream) throw new ApiError(404, "not_found", "File not found.");
  const input = await modelInput(new Uint8Array(await new Response(stream).arrayBuffer()));

  let answer: unknown;
  try {
    answer = await provider.complete(input, { prompt: EXTRACTION_PROMPT, schema: modelAnswerJsonSchema });
  } catch (error) {
    if (!(error instanceof AiError)) throw error;
    console.error(`Reading file ${fileId} failed: ${error.message}`);
    throw new ApiError(502, "ai_failed", "The AI provider couldn't read the document. Try again later.");
  }
  const parsed = modelAnswerSchema.safeParse(answer);
  if (!parsed.success) {
    console.error(
      `Reading file ${fileId}: the answer doesn't match the schema`,
      parsed.error.issues.slice(0, 3).map(({ path, message }) => ({ path, message })),
    );
    throw new ApiError(502, "ai_failed", "The AI model's answer couldn't be read. Try again, or use another model.");
  }

  const draft = toDraft(parsed.data);
  const suppliers = await liveContacts(db, organizationId, "supplier");
  return {
    draft,
    supplierId: findSupplierByTaxId(draft.supplier.taxId, suppliers)?.id ?? null,
    issues: checkPurchaseDraft(draft),
    source: input.kind,
  };
}
