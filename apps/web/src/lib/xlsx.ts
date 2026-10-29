import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { excelSerialToIso, formatSpanishDate, isoToExcelSerial } from "@cuentalibre/core";

/*
 * Just enough of the Office Open XML spreadsheet format to export listings and
 * read the files people import, without a spreadsheet library: text goes in as
 * inline strings, numbers as numbers, dates as date serials shown dd/mm/yyyy,
 * and the header row in bold.
 */

/** A date cell, for files that want real dates rather than text, such as the AEAT's books. */
export interface DateCell {
  date: string;
}

export type Cell = string | number | DateCell | null;

/** The text a cell shows. */
const cellText = (value: Cell): string =>
  value === null ? "" : typeof value === "object" ? formatSpanishDate(value.date) : String(value);

export interface Sheet {
  name: string;
  header: string[];
  rows: Cell[][];
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const escapeXml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Control characters other than tab and newlines are not valid XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** "A", "B"… "Z", "AA"… for a zero-based column index. */
function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function columnIndex(name: string): number {
  return [...name].reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

/** Sheet names: at most 31 characters, none of []:*?/\ and unique within the workbook. */
function sheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    const base = raw.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Hoja";
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
    used.add(name.toLowerCase());
    return name;
  });
}

function cellXml(value: Cell, ref: string, style: number): string {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : "";
  if (typeof value === "object") return `<c r="${ref}" s="3"><v>${isoToExcelSerial(value.date)}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const all = [sheet.header, ...sheet.rows];
  const columns = Math.max(sheet.header.length, ...sheet.rows.map((r) => r.length));
  // Width from the longest text in the column, within reason
  const widths = Array.from({ length: columns }, (_, c) => {
    const longest = Math.max(...all.map((row) => cellText(row[c] ?? null).length));
    return Math.min(60, Math.max(10, longest + 2));
  });
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const rows = all
    .map((row, r) => {
      // Style 1: bold header; style 2: numbers with two decimals
      const cells = row
        .map((value, c) => cellXml(value, `${columnName(c)}${r + 1}`, r === 0 ? 1 : typeof value === "number" ? 2 : 0))
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return (
    `${XML_HEAD}<worksheet xmlns="${NS}" xmlns:r="${REL_NS}">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

const STYLES =
  `${XML_HEAD}<styleSheet xmlns="${NS}">` +
  `<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>` +
  `</styleSheet>`;

/** An .xlsx workbook with one sheet per listing. */
export function xlsxBlob(sheets: Sheet[]): Blob {
  const names = sheetNames(sheets.map((s) => s.name));
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        `</Types>`,
    ),
    "_rels/.rels": strToU8(
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `${XML_HEAD}<workbook xmlns="${NS}" xmlns:r="${REL_NS}"><sheets>` +
        names.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        `</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ),
    "xl/styles.xml": strToU8(STYLES),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet));
  });
  return new Blob([zipSync(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Semicolon-separated with decimal commas, so Excel in Spanish opens it as-is. */
export function csvText(sheet: Sheet): string {
  const cell = (c: Cell) => (typeof c === "number" ? String(c).replace(".", ",") : cellText(c));
  const lines = [sheet.header, ...sheet.rows].map((cells) =>
    cells.map((c) => `"${String(cell(c)).replaceAll('"', '""')}"`).join(";"),
  );
  return `﻿${lines.join("\r\n")}`;
}

/** One listing as a CSV file, or several zipped together. */
export function csvBlob(sheets: Sheet[]): { blob: Blob; extension: "csv" | "zip" } {
  if (sheets.length === 1) return { blob: new Blob([csvText(sheets[0]!)], { type: "text/csv;charset=utf-8" }), extension: "csv" };
  const names = sheetNames(sheets.map((s) => s.name));
  const files = Object.fromEntries(sheets.map((s, i) => [`${names[i]}.csv`, strToU8(csvText(s))]));
  return { blob: new Blob([zipSync(files)], { type: "application/zip" }), extension: "zip" };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  // Let the download start before releasing the URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type SpreadsheetFormat = "xlsx" | "csv";

/** Downloads the listings in the chosen format. `name` has no extension. */
export function downloadSheets(sheets: Sheet[], format: SpreadsheetFormat, name: string) {
  if (format === "xlsx") return downloadBlob(xlsxBlob(sheets), `${name}.xlsx`);
  const { blob, extension } = csvBlob(sheets);
  downloadBlob(blob, `${name}.${extension}`);
}

/* ───────────────────────── Reading ───────────────────────── */

export class SpreadsheetError extends Error {}

const parseXml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
const byTag = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS("*", tag));

/** Built-in number formats that show a date. */
const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/** Which cell styles format their number as a date. */
function dateStyles(stylesXml: string | undefined): Set<number> {
  const dates = new Set<number>();
  if (!stylesXml) return dates;
  const doc = parseXml(stylesXml);
  const custom = new Map(
    byTag(doc, "numFmt").map((f) => [Number(f.getAttribute("numFmtId")), f.getAttribute("formatCode") ?? ""]),
  );
  const isDateCode = (code: string) => /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, ""));
  const cellXfs = byTag(doc, "cellXfs")[0];
  if (!cellXfs) return dates;
  byTag(cellXfs, "xf").forEach((xf, i) => {
    const id = Number(xf.getAttribute("numFmtId") ?? 0);
    if (DATE_FORMAT_IDS.has(id) || (custom.has(id) && isDateCode(custom.get(id)!))) dates.add(i);
  });
  return dates;
}

/** Rows of the first sheet of an .xlsx file, as text. Dates come back as dd/mm/yyyy. */
function readXlsx(data: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new SpreadsheetError("El archivo está dañado o no es un Excel (.xlsx).");
  }
  const text = (path: string) => (files[path] ? strFromU8(files[path]!) : undefined);
  const workbook = text("xl/workbook.xml");
  if (!workbook) throw new SpreadsheetError("El archivo no es un libro de Excel (.xlsx).");

  // The first sheet in the workbook's order, through its relationship
  const firstSheet = byTag(parseXml(workbook), "sheet")[0];
  const relId = firstSheet?.getAttributeNS(REL_NS, "id") ?? firstSheet?.getAttribute("r:id");
  const rels = text("xl/_rels/workbook.xml.rels");
  let target = "worksheets/sheet1.xml";
  if (rels && relId) {
    const rel = byTag(parseXml(rels), "Relationship").find((r) => r.getAttribute("Id") === relId);
    target = rel?.getAttribute("Target") ?? target;
  }
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  const sheet = text(sheetPath);
  if (!sheet) throw new SpreadsheetError("No se ha encontrado ninguna hoja en el archivo.");

  const sharedXml = text("xl/sharedStrings.xml");
  const shared = sharedXml
    ? byTag(parseXml(sharedXml), "si").map((si) =>
        byTag(si, "t")
          .filter((t) => !t.parentElement || t.parentElement.localName !== "rPh")
          .map((t) => t.textContent ?? "")
          .join(""),
      )
    : [];
  const dates = dateStyles(text("xl/styles.xml"));

  const rows: string[][] = [];
  for (const row of byTag(parseXml(sheet), "row")) {
    const index = Number(row.getAttribute("r") ?? rows.length + 1) - 1;
    const cells: string[] = [];
    byTag(row, "c").forEach((c, i) => {
      const ref = c.getAttribute("r");
      const col = ref ? columnIndex(ref.replace(/\d+$/, "")) : i;
      const type = c.getAttribute("t");
      const raw = byTag(c, "v")[0]?.textContent ?? "";
      let value: string;
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = byTag(c, "t").map((t) => t.textContent ?? "").join("");
      else if (type === "b") value = raw === "1" ? "VERDADERO" : "FALSO";
      else if (type === "str" || type === "e") value = raw;
      else if (raw !== "" && dates.has(Number(c.getAttribute("s") ?? 0)))
        value = formatSpanishDate(excelSerialToIso(Number(raw)));
      else value = raw;
      cells[col] = value;
    });
    rows[index] = Array.from(cells, (v) => v ?? "");
  }
  return Array.from(rows, (r) => r ?? []);
}

/** Rows of a CSV file. The separator is the one (; , or tab) that appears most in the first line. */
export function parseCsv(text: string): string[][] {
  const content = text.replace(/^﻿/, "");
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const separator = [";", ",", "\t"]
    .map((s) => ({ s, n: firstLine.split(s).length }))
    .sort((a, b) => b.n - a.n)[0]!.s;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    if (quoted) {
      if (ch === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === separator) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Rows of an imported .xlsx or .csv file, as text, header included. */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const data = new Uint8Array(await file.arrayBuffer());
  // .xlsx files are ZIP archives: "PK"
  if (data[0] === 0x50 && data[1] === 0x4b) return readXlsx(data);
  // Legacy .xls files are OLE compound documents
  if (data[0] === 0xd0 && data[1] === 0xcf)
    throw new SpreadsheetError(
      "Los archivos .xls (Excel 97-2003) no se pueden leer. Ábrelo en Excel y guárdalo como .xlsx o .csv.",
    );
  if (name.endsWith(".xlsx")) throw new SpreadsheetError("El archivo está dañado o no es un Excel (.xlsx).");
  // Anything else is read as text: UTF-8, or Windows-1252 when that fails (CSV saved by older Excel)
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    text = new TextDecoder("windows-1252").decode(data);
  }
  return parseCsv(text);
}
