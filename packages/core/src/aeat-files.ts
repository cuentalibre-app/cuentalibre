import { normalizeTaxId } from "./contacts";
import type { Cents } from "./money";
import type { Key349 } from "./informative-returns";
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
  /** Contact phone, which informative returns such as the 349 ask for. */
  phone?: string;
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

/* ───────────────────────── Form 303: quarterly VAT ───────────────────────── */

/**
 * Record designs of form 303 by the first year they apply to. The 2026 one adds boxes 165–170
 * among the rest of page 1, a flag for fuel deliveries and box 112 on page 3.
 */
export const FIRST_YEAR_303 = 2025;
const design303 = (year: number) => (year >= 2026 ? 2026 : 2025);

/** Rate boxes, in percent with two decimals in five positions ("02100" is 21 %). */
const RATES_303 = new Set(["151", "166", "02", "154", "05", "08", "157", "169", "17", "20", "23", "65"]);

/** Unsigned boxes (type Num in the design); the rest of the 303's boxes take a sign. */
const UNSIGNED_303 = new Set([
  "150", "152", "165", "167", "01", "03", "153", "155", "04", "06", "07", "09", "10", "11", "12", "13",
  "156", "158", "168", "170", "16", "18", "19", "21", "22", "24",
  "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "77", "110", "78", "87", "70", "109", "112", "111",
]); // prettier-ignore

/** Boxes of the general regime on page 1, in the order of each design. */
const LIQUIDATION_303 = {
  2025: [
    "150", "151", "152", "01", "02", "03", "153", "154", "155", "04", "05", "06", "07", "08", "09",
    "10", "11", "12", "13", "14", "15", "156", "157", "158", "16", "17", "18", "19", "20", "21", "22", "23", "24",
    "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41",
    "42", "43", "44", "45", "46", "165", "166", "167", "168", "169", "170",
  ],
  2026: [
    "150", "151", "152", "165", "166", "167", "01", "02", "03", "153", "154", "155", "04", "05", "06", "07", "08", "09",
    "10", "11", "12", "13", "14", "15", "156", "157", "158", "168", "169", "170",
    "16", "17", "18", "19", "20", "21", "22", "23", "24",
    "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41",
    "42", "43", "44", "45", "46",
  ],
}; // prettier-ignore

/** Additional information and result boxes at the start of page 3, the same in both designs. */
const RESULT_303 = ["59", "60", "120", "122", "123", "124", "62", "63", "74", "75", "76", "64", "65", "66", "77", "110", "78", "87", "68"]; // prettier-ignore

/** Volume of operations of the year on page 4, the last box being their total. */
const VOLUME_303 = ["80", "81", "93", "94", "83", "84", "125", "126", "127", "128", "86", "95", "96", "97", "98", "79", "99", "88"]; // prettier-ignore

/** Share of the result by territory on page 4: Álava, Gipuzkoa, Bizkaia, Navarra and the common territory. */
const TERRITORIES_303 = ["89", "90", "91", "92", "107"];

/** A box of the 303 as its design takes it: rates in five positions, amounts in 17, signed or not. */
function box303(boxes: Boxes, box: string): string {
  const value = boxes[box] ?? 0;
  if (RATES_303.has(box)) return aeatAmount(Math.round(value * 100), 5, false);
  return aeatAmount(value, 17, !UNSIGNED_303.has(box));
}

/**
 * Declaration type of a 303: I (deposit) to pay; C when a negative result is carried to the
 * following periods; D for a refund, only in Q4; N for a zero result. As with the 130, direct
 * debit (U) is chosen in the sede, and so is the account of a refund.
 */
export function declarationType303(result: Cents, quarter: Quarter, refund: boolean): "I" | "C" | "D" | "N" {
  if (result > 0) return "I";
  if (result === 0) return "N";
  return quarter === 4 && refund ? "D" : "C";
}

/** Annual information of the last 303 for filers exempt from form 390. */
export interface Annual303 {
  /** Activities ordered by volume, the main one first: type of form 036 and IAE epígrafe. */
  activities: { type: string; code: string }[];
  /** Whether the filer has to file form 347 for the year: box D. */
  thirdParties: boolean;
  /** Volume of operations (80…88) and share by territory (89…107, in percent). */
  boxes: Boxes;
}

export interface Return303 {
  year: number;
  quarter: Quarter;
  boxes: Boxes;
  result: Cents;
  hasActivity: boolean;
  /** Q4 with a negative result: ask for a refund instead of carrying it to the next year. */
  refund: boolean;
  /** Special cash accounting regime (criterio de caja). */
  cashBasis: boolean;
  /** Q4 of a filer exempt from form 390; null for everyone else. */
  annual: Annual303 | null;
}

/** "1" for yes and "2" for no, as the design's flags take them. */
const yesNo = (yes: boolean) => (yes ? "1" : "2");

/** IAE epígrafe without its dots: "843.9" goes as "8439". */
const epigraph = (code: string) => aeatText(code.replace(/[^0-9A-Za-z]/g, ""), 4);

function page1of303(form: Return303, filer: AeatFiler, design: 2025 | 2026): string {
  const last = form.quarter === 4;
  const annual = last ? form.annual : null;
  return page(
    [
      "<T30301000>",
      blanks(1), // complementary page indicator
      declarationType303(form.result, form.quarter, form.refund),
      aeatText(filerTaxId(filer.taxId), 9),
      aeatText(`${filer.surnames} ${filer.name}`, 80),
      String(form.year),
      periodCode(form.quarter),
      "2", // files exclusively with a foral administration
      "2", // monthly refund register (REDEME)
      "3", // simplified regime: no, only the general one
      "2", // joint return
      yesNo(form.cashBasis),
      "2", // recipient of operations under the cash accounting regime
      "2", // opts for the special proration: the AEAT rejects a blank in any quarter
      "2", // revokes the special proration
      "2", // insolvency proceedings
      blanks(8), // date of the insolvency order
      blanks(1), // type of return under insolvency
      "2", // SII
      last ? yesNo(annual !== null) : "0", // exempt from form 390
      annual ? yesNo((annual.boxes["88"] ?? 0) !== 0) : "0", // yearly volume of operations other than zero
      ...(design === 2026 ? ["0"] : []), // may deduct the payment on account of fuel deliveries: only monthly
      ...LIQUIDATION_303[design].map((box) => box303(form.boxes, box)),
      blanks(design === 2026 ? 521 : 522),
      blanks(13), // electronic stamp
      "</T30301000>",
    ],
    1581,
  );
}

function page3of303(form: Return303, design: 2025 | 2026): string {
  const noActivity = !form.hasActivity && form.result === 0 && (form.boxes["110"] ?? 0) === 0;
  const results = design === 2026 ? ["108", "69", "70", "109", "112", "71"] : ["69", "70", "109", "71"];
  const rectification = [
    blanks(1), // rectifying return
    blanks(13), // receipt number of the return it rectifies
    blanks(1), // cancel or change the direct debit of the rectified return
  ];
  return page(
    [
      "<T30303000>",
      ...[...RESULT_303, ...results].map((box) => box303(form.boxes, box)),
      noActivity ? "X" : blanks(1),
      ...rectification,
      ...(design === 2026
        ? [box303(form.boxes, "111"), blanks(2), blanks(546)] // [111] and the two reasons of a rectification
        : [box303(form.boxes, "108"), blanks(17), blanks(120), blanks(2), blanks(443)]),
      "</T30303000>",
    ],
    1017,
  );
}

/** Page 4: activities and volume of operations of the year, only for filers exempt from form 390. */
function page4of303(annual: Annual303): string {
  const activities = annual.activities.slice(0, 6); // the main one and five more fit
  return page(
    [
      "<T30304000>",
      blanks(1), // complementary page indicator
      ...Array.from({ length: 6 }, (_, i) => {
        const activity = activities[i];
        return activity ? aeatText(activity.type, 3) + epigraph(activity.code) : blanks(7);
      }),
      annual.thirdParties ? "X" : blanks(1),
      ...TERRITORIES_303.map((box) => aeatAmount(Math.round((annual.boxes[box] ?? 0) * 100), 5, false)),
      ...VOLUME_303.map((box) => aeatAmount(annual.boxes[box] ?? 0, 17, true)),
      blanks(600),
      "</T30304000>",
    ],
    998,
  );
}

/** Bank details of a refund or direct debit, left blank: they are entered in the sede. */
function bankPage303(): string {
  return page(["<T303DID00>", blanks(11), blanks(34), blanks(70), blanks(35), blanks(30), blanks(2), "0", blanks(617), "</T303DID00>"], 823); // prettier-ignore
}

/**
 * The file the 303 online form imports: page 1 (identification and general regime), page 3
 * (additional information and result), page 4 in Q4 for filers exempt from form 390, and the
 * bank details page. Page 2 (simplified regime), page 5 (proration) and rectifying returns are
 * not covered.
 */
export function file303(form: Return303, filer: AeatFiler): string {
  if (form.year < FIRST_YEAR_303) throw new RangeError(`No form 303 record design for ${form.year}`);
  const design = design303(form.year);
  const pages = [page1of303(form, filer, design), page3of303(form, design)];
  if (form.quarter === 4 && form.annual) pages.push(page4of303(form.annual));
  pages.push(bankPage303());
  return envelope("303", form.year, periodCode(form.quarter), pages);
}

/* ─────────────────── Form 349: intra-EU operations ─────────────────── */

/**
 * Record design of form 349 (Orden EHA/769/2010 as amended by HAC/1274/2020), first used for
 * 2021 returns. Unlike self-assessments it is the informative returns' format: records of 500
 * positions, one per line, and amounts without sign as euros and cents.
 */
export const FIRST_YEAR_349 = 2021;

/** An operator record, or the rectification of one for an earlier period. */
export interface Operator349 {
  /** Country code and number of the operator's EU VAT number. */
  code: string;
  number: string;
  name: string;
  key: Key349;
  base: Cents;
}

export interface Rectified349 extends Operator349 {
  /** Year and period ("1T", "05") the rectified bases were declared in. */
  year: number;
  period: string;
  /** Base declared before the rectification; `base` is the one after it. */
  declared: Cents;
}

export interface Return349 {
  year: number;
  /** "1T"… "4T", or "01"… "12" for a monthly return. */
  period: string;
  /** Monthly return covering the first two months of a quarter. */
  bimonthly: boolean;
  operations: Operator349[];
  rectifications: Rectified349[];
}

/**
 * Period of a 349 from its months (0-based): a quarter, a month, or the first two months of a
 * quarter, which go as a return of the second month. A whole year has no code since 2021.
 */
export function period349(months: number[]): { period: string; bimonthly: boolean } | null {
  const first = months[0];
  if (first === undefined || months.some((m, i) => m !== first + i)) return null;
  const month = (m: number) => String(m + 1).padStart(2, "0");
  if (months.length === 1) return { period: month(first), bimonthly: false };
  if (first % 3 !== 0) return null;
  if (months.length === 3) return { period: `${first / 3 + 1}T`, bimonthly: false };
  if (months.length === 2) return { period: month(first + 1), bimonthly: true };
  return null;
}

/** Digits of a phone number, without the Spanish prefix, in the nine positions of the design. */
function phone349(phone = ""): string {
  const digits = phone.replace(/\D/g, "").replace(/^(0034|34)(?=\d{9}$)/, "");
  return digits.length === 9 ? digits : "0".repeat(9);
}

/** The start every record of the 349 shares: type, form, year and the declarant's NIF. */
function head349(type: "1" | "2", year: number, filer: AeatFiler): string[] {
  return [type, "349", String(year), aeatText(filerTaxId(filer.taxId), 9)];
}

/** The operator's VAT number and name, and the key: positions 76 to 133 of every type 2 record. */
function operator349(op: Operator349): string[] {
  return [aeatText(op.code, 2), aeatText(op.number, 15), aeatText(op.name, 40), op.key];
}

/**
 * The file the 349 online form imports: the declarant record and one record per operator and
 * key, then the rectifications of earlier periods. Complementary and substitute returns are
 * not covered, nor goods sent under call-off stock (keys R, D and C) or triangular operations.
 */
export function file349(form: Return349, filer: AeatFiler): string {
  if (form.year < FIRST_YEAR_349) throw new RangeError(`No form 349 record design for ${form.year}`);
  const name = aeatText(`${filer.surnames} ${filer.name}`, 40);
  const declarant = page(
    [
      ...head349("1", form.year, filer),
      name,
      blanks(1),
      phone349(filer.phone),
      name, // person to contact: the declarant
      "349".padEnd(13, "0"), // receipt number: the sede assigns it
      blanks(2), // complementary or substitute return
      "0".repeat(13), // receipt number of the return it complements or substitutes
      form.period,
      aeatAmount(form.operations.length, 9, false),
      aeatAmount(sumOf(form.operations), 15, false),
      aeatAmount(form.rectifications.length, 9, false),
      aeatAmount(sumOf(form.rectifications), 15, false),
      form.bimonthly ? "X" : blanks(1),
      blanks(204),
      blanks(9), // NIF of the legal representative of a minor
      blanks(101),
    ],
    500,
  );
  const substitute = blanks(17 + 40); // receiver who replaces another under call-off stock (key C)
  const operations = form.operations.map((op) =>
    page(
      [
        ...head349("2", form.year, filer),
        blanks(58),
        ...operator349(op),
        aeatAmount(op.base, 13, false),
        blanks(32),
        substitute,
        blanks(265),
      ],
      500,
    ),
  );
  const rectifications = form.rectifications.map((op) =>
    page(
      [
        ...head349("2", form.year, filer),
        blanks(58),
        ...operator349(op),
        blanks(13),
        String(op.year),
        op.period,
        aeatAmount(op.base, 13, false),
        aeatAmount(op.declared, 13, false),
        substitute,
        blanks(265),
      ],
      500,
    ),
  );
  return [declarant, ...operations, ...rectifications].map((record) => `${record}\r\n`).join("");
}

const sumOf = (ops: { base: Cents }[]) => ops.reduce((total, op) => total + op.base, 0);

/** Name of the downloaded file: "130_2026_3T.txt", "349_2026_05.txt". */
export function aeatFileName(form: string, year: number, period: Quarter | string | null): string {
  const code = typeof period === "number" ? periodCode(period) : period;
  return `${form}_${year}${code === null ? "" : `_${code}`}.txt`;
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
