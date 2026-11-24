import { createHash } from "node:crypto";
import type { PurchaseExtraction } from "@cuentalibre/contracts";
import { checkPurchaseDraft, findSupplierByTaxId } from "@cuentalibre/core";
import { getDocumentProxy } from "unpdf";
import type { Db } from "../db/client";
import { ApiError } from "../errors";
import type { FileStorage } from "../storage";
import { liveContacts } from "../sync/contacts";
import { findFile } from "../sync/files";
import { EXTRACTION_PROMPT, modelAnswerJsonSchema, modelAnswerSchema, toDraft, type ModelAnswer } from "./answer";
import { ImageError, prepareImage, type ImageType } from "./image";
import { AiError, type AiProvider, type ModelInput } from "./provider";
import { cachedReading, recordReading, releaseReading, reserveReading, type AiLimits } from "./readings";

/** Below this many letters and digits, a PDF's text layer is empty or noise: it is read as a scan. */
const MIN_TEXT_CHARACTERS = 40;
/**
 * Longest PDF read: invoices are far shorter, and each page costs parsing time and
 * tokens. A longer one is refused rather than read in part, as its totals may be past the cut.
 */
export const MAX_PDF_PAGES = 10;
/** Ten dense pages of text fit; more is refused, for the same reason. */
export const MAX_TEXT_CHARACTERS = 50_000;

const tooLong = () =>
  new ApiError(
    413,
    "document_too_long",
    `Only PDFs of up to ${MAX_PDF_PAGES} pages and ${MAX_TEXT_CHARACTERS} characters can be read.`,
  );

/** Major brands of HEIF files, HEIC (iPhone photos) among them. */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/** The type of a file by its first bytes, which can't be faked by its name or upload type. */
export function sniffType(bytes: Uint8Array): "pdf" | ImageType | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(1, 4) === "PNG" && bytes[0] === 0x89) return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(8, 12))) return "image/heic";
  return null;
}

/**
 * Control characters, or the replacement character, where a PDF's font has glyphs
 * without a Unicode mapping: pdf.js gives them as NUL, so "9BF0758D-8798006" reads
 * "9BF0758D\u00008798006". Such a text layer can't be trusted to the digit.
 */
const UNMAPPED_GLYPHS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;

/**
 * A PDF's extracted text, if it is worth sending: null when it is empty or noise (a
 * scan) or has unmapped glyphs, and then the model reads the file itself.
 */
export function readableText(text: string): string | null {
  if (text.length > MAX_TEXT_CHARACTERS) throw tooLong();
  if (UNMAPPED_GLYPHS.test(text)) return null;
  const characters = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (characters < MIN_TEXT_CHARACTERS) return null;
  return text;
}

/**
 * The PDF's text layer, or null when it isn't worth reading or can't be parsed.
 * Throws `document_too_long` past the page or text limit, even with an unreadable text layer.
 */
async function pdfText(bytes: Uint8Array): Promise<string | null> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // pdf.js takes ownership of the buffer it reads, so it gets a copy
    pdf = await getDocumentProxy(bytes.slice());
  } catch {
    return null;
  }
  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw tooLong();
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const { items } = await (await pdf.getPage(number)).getTextContent();
      pages.push(items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : "")).join(""));
    }
    // Spaces collapsed, line breaks kept, at most one blank line
    const text = pages
      .join("\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    return readableText(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** What the model reads from a file: a PDF's text if it has one, else the file itself. */
export async function modelInput(bytes: Uint8Array): Promise<ModelInput> {
  const type = sniffType(bytes);
  if (!type)
    throw new ApiError(415, "unsupported_file", "Only PDFs and JPEG, PNG, HEIC, WebP or GIF images can be read.");
  if (type !== "pdf") {
    try {
      return { kind: "image", ...(await prepareImage(type, bytes)) };
    } catch (error) {
      if (!(error instanceof ImageError)) throw error;
      throw new ApiError(415, "unsupported_file", "The image couldn't be read.");
    }
  }
  const text = await pdfText(bytes);
  return text ? { kind: "text", text } : { kind: "pdf", data: bytes };
}

const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

/** Raise when `modelInput` changes what the model is given for a file. */
const INPUT_VERSION = 3;

/**
 * Changes with the prompt, the answer's schema or `INPUT_VERSION`, so files are read
 * afresh after any of them changes.
 */
export const PROMPT_VERSION = sha256(
  `${INPUT_VERSION}\n${EXTRACTION_PROMPT}${JSON.stringify(modelAnswerJsonSchema)}`,
).slice(0, 16);

/** Calls the model and checks its answer, throwing a 502 for the user when either fails. */
async function askModel(provider: AiProvider, input: ModelInput, fileId: string) {
  let completion: Awaited<ReturnType<AiProvider["complete"]>>;
  try {
    completion = await provider.complete(input, { prompt: EXTRACTION_PROMPT, schema: modelAnswerJsonSchema });
  } catch (error) {
    if (!(error instanceof AiError)) throw error;
    console.error(`Reading file ${fileId} failed: ${error.message}`);
    throw new ApiError(502, "ai_failed", "The AI provider couldn't read the document. Try again later.");
  }
  const parsed = modelAnswerSchema.safeParse(completion.answer);
  if (!parsed.success) {
    console.error(
      `Reading file ${fileId}: the answer doesn't match the schema`,
      parsed.error.issues.slice(0, 3).map(({ path, message }) => ({ path, message })),
    );
    throw new ApiError(502, "ai_failed", "The AI model's answer couldn't be read. Try again, or use another model.");
  }
  return { answer: parsed.data, usage: completion.usage };
}

/**
 * The model's answer for the file: the one it gave before for the same bytes and
 * prompt, or a new one, counted towards the month's limit only if the call succeeds.
 */
async function readFile(
  db: Db,
  provider: AiProvider,
  limits: AiLimits,
  organizationId: string,
  fileId: string,
  bytes: Uint8Array,
): Promise<{ answer: ModelAnswer; source: ModelInput["kind"] }> {
  const key = { organizationId, fileHash: sha256(bytes), model: provider.model, promptVersion: PROMPT_VERSION };
  const cached = await cachedReading(db, key);
  const cachedAnswer = cached && modelAnswerSchema.safeParse(cached.answer);
  if (cached && cachedAnswer?.success) return { answer: cachedAnswer.data, source: cached.source };

  // Before preparing the file, so an organization over its limit can't make the server decode files
  const readingId = await reserveReading(db, key, limits);
  try {
    const input = await modelInput(bytes);
    const { answer, usage } = await askModel(provider, input, fileId);
    await recordReading(db, organizationId, readingId, { answer, source: input.kind, usage, limits });
    return { answer, source: input.kind };
  } catch (error) {
    await releaseReading(db, organizationId, readingId);
    throw error;
  }
}

/**
 * Reads an uploaded invoice or receipt with the model and returns a draft for the
 * purchase form, with the fields that don't add up and the supplier it belongs to.
 * Saves nothing. A file read before isn't sent to the model again; the checks and
 * the supplier are worked out afresh, as contacts change.
 */
export async function extractPurchase(
  db: Db,
  storage: FileStorage,
  ai: { provider: AiProvider; limits: AiLimits },
  organizationId: string,
  fileId: string,
): Promise<PurchaseExtraction> {
  const row = await findFile(db, organizationId, fileId);
  const stream = row && (await storage.get(row.storageKey));
  if (!row || !stream) throw new ApiError(404, "not_found", "File not found.");
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const { answer, source } = await readFile(db, ai.provider, ai.limits, organizationId, fileId, bytes);

  const draft = toDraft(answer);
  const suppliers = await liveContacts(db, organizationId, "supplier");
  return {
    draft,
    supplierId: findSupplierByTaxId(draft.supplier.taxId, suppliers)?.id ?? null,
    issues: checkPurchaseDraft(draft),
    source,
  };
}
