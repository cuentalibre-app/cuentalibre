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

/** The identification every page opens with, after its start marker. */
function identification(type: string, filer: AeatFiler, year: number, quarter: Quarter): string[] {
  return [
    blanks(1), // complementary page indicator
    type,
    aeatText(filerTaxId(filer.taxId), 9),
    aeatText(filer.surnames, 60),
    aeatText(filer.name, 20),
    String(year),
    periodCode(quarter),
  ];
}

/** Record designs of forms 111, 115 and 130 by the first year they apply to; the 2019 ones are still current. */
const FIRST_YEAR = 2019;

function checkYear(form: string, year: number) {
  if (year < FIRST_YEAR) throw new RangeError(`No form ${form} record design for ${year}`);
}

/**
 * Declaration type of a 130: I (deposit) to pay; B when a negative result is left to deduct in
 * the following quarters of the year; N for a zero result, or a negative one in Q4, when there
 * is nothing left to deduct it from. Paying by direct debit (U) is chosen in the sede, with the
 * IBAN, rather than in the file.
 */
export function declarationType130(result: Cents, quarter: Quarter): "I" | "B" | "N" {
  if (result > 0) return "I";
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
): string {
  checkYear("130", form.year);
  const page1 = page(
    [
      "<T13001000>",
      ...identification(declarationType130(form.result, form.quarter), filer, form.year, form.quarter),
      ...BOXES_130.map((box) => aeatAmount(form.boxes[box] ?? 0, 17, SIGNED_130.has(box))),
      blanks(1), // complementary return
      blanks(13), // receipt number of the return it complements
      blanks(34), // IBAN of a direct debit
      blanks(96),
      blanks(13), // electronic stamp
      "</T13001000>",
    ],
    600,
  );
  return envelope("130", form.year, periodCode(form.quarter), [page1]);
}

/**
 * Declaration type of a withholding return (111, 115): I (deposit) to pay, N with nothing to pay.
 * As with the 130, direct debit (U) is chosen in the sede.
 */
export function declarationTypeWithholdings(result: number): "I" | "N" {
  return result > 0 ? "I" : "N";
}

/** Boxes of the 111 in groups of three: number of perceptors, amount paid and withholding. */
const PERCEPTOR_GROUPS_111 = ["01", "04", "07", "10", "13", "16", "19", "22", "25"];

/**
 * The file the 111 online form imports: one page of 1000 positions. Box 29, the result of
 * earlier returns, is the only signed one and only applies to complementary returns, which
 * are not covered.
 */
export function file111(form: { year: number; quarter: Quarter; boxes: Boxes }, filer: AeatFiler): string {
  checkYear("111", form.year);
  const box = (n: number) => form.boxes[String(n).padStart(2, "0")] ?? 0;
  const page1 = page(
    [
      "<T11101000>",
      ...identification(declarationTypeWithholdings(box(30)), filer, form.year, form.quarter),
      ...PERCEPTOR_GROUPS_111.flatMap((first) => {
        const n = Number(first);
        return [aeatAmount(box(n), 8, false), aeatAmount(box(n + 1), 17, false), aeatAmount(box(n + 2), 17, false)];
      }),
      aeatAmount(box(28), 17, false),
      aeatAmount(box(29), 17, true),
      aeatAmount(box(30), 17, false),
      blanks(1), // complementary return
      blanks(13), // receipt number of the return it complements
      blanks(1), // reserved: filed by the Administration for a partner college
      blanks(34), // IBAN of a direct debit
      blanks(389),
      blanks(13), // electronic stamp
      "</T11101000>",
    ],
    1000,
  );
  return envelope("111", form.year, periodCode(form.quarter), [page1]);
}

/** The file the 115 online form imports: one page of 500 positions. Complementary returns are not covered. */
export function file115(form: { year: number; quarter: Quarter; boxes: Boxes }, filer: AeatFiler): string {
  checkYear("115", form.year);
  const box = (key: string) => form.boxes[key] ?? 0;
  const page1 = page(
    [
      "<T11501000>",
      ...identification(declarationTypeWithholdings(box("05")), filer, form.year, form.quarter),
      aeatAmount(box("01"), 15, false),
      ...["02", "03", "04", "05"].map((key) => aeatAmount(box(key), 17, false)),
      blanks(1), // complementary return
      blanks(13), // receipt number of the return it complements
      blanks(34), // IBAN of a direct debit
      blanks(236),
      blanks(13), // electronic stamp
      "</T11501000>",
    ],
    500,
  );
  return envelope("115", form.year, periodCode(form.quarter), [page1]);
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
