import { normalizeTaxId } from "./contacts";
import type { Cents } from "./money";
import type { Quarter } from "./period";
import type { Boxes } from "./tax-returns";

/*
 * The files the AEAT's online forms import ("Importar" in the sede): fixed-width
 * text laid out by each form's record design (diseño de registro). A file wraps
 * the form's pages in a `<T…>` envelope; every page is a positional record with
 * its own start and end markers. The files are encoded as ISO-8859-1.
 */

/** Who files: the taxpayer the boxes belong to. */
export interface AeatFiler {
  taxId: string;
  /** Surnames of a person, or the company name. */
  surnames: string;
  /** First name of a person; empty for a company. */
  name: string;
}

/** How a positive result is paid: a deposit with an NRC or payment slip, or a direct debit. */
export type AeatPayment = { kind: "deposit" } | { kind: "directDebit"; iban: string };

/**
 * Text as alphanumeric fields take it: upper case, only letters, digits and blanks, left
 * aligned and padded with blanks. Accents go; Ñ and Ç stay, as ISO-8859-1 has them.
 */
export function aeatText(value: string, length: number): string {
  const clean = [...value.toUpperCase()]
    .map((ch) => (ch === "Ñ" || ch === "Ç" ? ch : ch.normalize("NFD").replace(/[̀-ͯ]/g, "")))
    .join("")
    .replace(/[^A-Z0-9ÑÇ]+/g, " ")
    .trim();
  return clean.slice(0, length).padEnd(length, " ");
}

/**
 * An amount in cents as numeric fields take it: right aligned, padded with zeros and
 * without decimal point. Signed fields put an N first when the amount is negative;
 * unsigned fields reject it.
 */
export function aeatAmount(value: number, length: number, signed: boolean): string {
  if (!Number.isInteger(value)) throw new RangeError(`Amount ${value} is not a whole number of cents`);
  if (value < 0 && !signed) throw new RangeError(`Amount ${value} can't be negative in this field`);
  const digits = String(Math.abs(value));
  const width = value < 0 ? length - 1 : length;
  if (digits.length > width) throw new RangeError(`Amount ${value} doesn't fit in ${length} positions`);
  return (value < 0 ? "N" : "") + digits.padStart(width, "0");
}

const blanks = (length: number) => " ".repeat(length);

/** Period as the designs write it: "1T"… "4T". */
const periodCode = (quarter: Quarter) => `${quarter}T`;

/**
 * The envelope around a form's pages: the opening tag, the `<AUX>` block (program version
 * and developer NIF, left blank) and the closing tag.
 */
function envelope(form: string, year: number, period: string, pages: string[]): string {
  const tag = `${form}0${year}${period}0000`;
  const aux = `<AUX>${blanks(70)}${blanks(4)}${blanks(4)}${blanks(9)}${blanks(213)}</AUX>`;
  return `<T${tag}>${aux}${pages.join("")}</T${tag}>`;
}

/** Checks that a page came out as long as its design says, so a field never shifts the rest. */
function page(fields: string[], length: number): string {
  const record = fields.join("");
  if (record.length !== length) throw new RangeError(`Record is ${record.length} positions long, not ${length}`);
  return record;
}

export function filerTaxId(taxId: string): string {
  return normalizeTaxId(taxId).replace(/^ES(?=[0-9A-Z]{9}$)/, "");
}

/** Form 130 designs by first year they apply to; the 2019 one (version 1.2) is still current. */
const FIRST_YEAR_130 = 2019;

/**
 * Declaration type of a 130: I (deposit) or U (direct debit) to pay; B when a negative result
 * is left to deduct in the following quarters of the year; N for a zero result, or a negative
 * one in Q4, when there is nothing left to deduct it from.
 */
export function declarationType130(result: Cents, quarter: Quarter, payment: AeatPayment): "I" | "U" | "B" | "N" {
  if (result > 0) return payment.kind === "directDebit" ? "U" : "I";
  return result < 0 && quarter < 4 ? "B" : "N";
}

/**
 * Signed boxes of the 130 (type N in the design); the rest only take zero or more. The design
 * lists box 12 as unsigned, but it is [07] + [11] and box 14, its difference with 13, is signed.
 */
const SIGNED_130 = new Set(["03", "07", "11", "12", "14", "17", "19"]);
const BOXES_130 = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"]; // prettier-ignore

/** The file the 130 online form imports: one page of 600 positions. Complementary returns are not covered. */
export function file130(
  form: { year: number; quarter: Quarter; boxes: Boxes; result: Cents },
  filer: AeatFiler,
  payment: AeatPayment,
): string {
  if (form.year < FIRST_YEAR_130) throw new RangeError(`No form 130 record design for ${form.year}`);
  const iban = payment.kind === "directDebit" && form.result > 0 ? normalizeTaxId(payment.iban) : "";
  const period = periodCode(form.quarter);
  const page1 = page(
    [
      "<T13001000>",
      blanks(1), // complementary page indicator
      declarationType130(form.result, form.quarter, payment),
      aeatText(filerTaxId(filer.taxId), 9),
      aeatText(filer.surnames, 60),
      aeatText(filer.name, 20),
      String(form.year),
      period,
      ...BOXES_130.map((box) => aeatAmount(form.boxes[box] ?? 0, 17, SIGNED_130.has(box))),
      blanks(1), // complementary return
      blanks(13), // receipt number of the return it complements
      aeatText(iban, 34),
      blanks(96),
      blanks(13), // electronic stamp
      "</T13001000>",
    ],
    600,
  );
  return envelope("130", form.year, period, [page1]);
}

/** Name of the downloaded file: "130_2026_3T.txt". */
export function aeatFileName(form: string, year: number, quarter: Quarter | null): string {
  return `${form}_${year}${quarter === null ? "" : `_${periodCode(quarter)}`}.txt`;
}

/** The bytes of a file as ISO-8859-1, the encoding the AEAT reads. */
export function aeatBytes(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) throw new RangeError(`Character ${text[i]} has no ISO-8859-1 code`);
    bytes[i] = code;
  }
  return bytes;
}
