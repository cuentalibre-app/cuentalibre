import { jsPDF } from "jspdf";
import { zipSync } from "fflate";
import qrcode from "qrcode-generator";
import { applyRate, cents, eurosToCents, lineBase, WITHHOLDING_RATES, type InvoiceTotals } from "@fiscalia/core";
import type { SalesDocument, SalesLine } from "@fiscalia/contracts";
import { businessName } from "@/features/settings/settings-model";
import { settingsStore } from "@/features/settings/settings-store";
import { printOptions, type PrintOptions } from "./invoice-settings";
import {
  documentLocale,
  hexToRgb,
  mix,
  paymentText,
  PDF_FONTS,
  pdfFormat,
  pdfLabels,
  pdfText,
  TEMPLATE_STYLES,
  type PdfFont,
  type PdfFormat,
  type PdfLabels,
  type Rgb,
  type TemplateStyle,
} from "./pdf-look";
import { clientOf, documentFileName, documentTotals, KINDS } from "./sales-model";

/*
 * PDF export. Loaded on demand (dynamic import) so jsPDF stays out of the main bundle.
 * The layout follows the template chosen in the settings of the document's kind,
 * after the reference app's (see pdf-look.ts); text, line and paper colors and the font
 * come from there too.
 */

const LEFT = 15;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const RIGHT = PAGE_WIDTH - LEFT;
/** Lowest point anything but the side footer reaches. */
const FOOT = PAGE_HEIGHT - 12;
const QR_SIZE = 32;
const LINE = 4;

type Align = "left" | "right" | "center";

/** Issuer or client details, as printed in the header. */
interface Party {
  name: string;
  taxId: string;
  address?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  paymentMethodId?: string;
}

/** Everything a drawing step needs: the document, its look and where the pen is. */
interface Sheet {
  pdf: jsPDF;
  doc: SalesDocument;
  client: Party;
  options: PrintOptions;
  style: TemplateStyle;
  font: PdfFont;
  ink: Rgb;
  muted: Rgb;
  rule: Rgb;
  /** Light tint of the line color, for Clásica's table headers. */
  soft: Rgb;
  paper: Rgb;
  t: PdfLabels;
  f: PdfFormat;
  totals: InvoiceTotals;
  y: number;
}

function render(doc: SalesDocument): jsPDF {
  const options = printOptions(doc.kind);
  const { look } = options;
  const contact = clientOf(doc);
  const ink = hexToRgb(look.textColor);
  const paper = hexToRgb(look.backgroundColor);
  const rule = hexToRgb(look.lineColor);
  const locale = documentLocale(doc, contact, look);
  const s: Sheet = {
    pdf: new jsPDF({ unit: "mm", format: "a4" }),
    doc,
    client: { ...contact, phone: contact.phone || contact.mobile },
    options,
    style: TEMPLATE_STYLES[look.template],
    font: PDF_FONTS[look.font],
    ink,
    muted: mix(ink, paper, 0.4),
    rule,
    soft: mix(rule, paper, 0.8),
    paper,
    t: pdfLabels(locale.language),
    f: pdfFormat(locale),
    totals: documentTotals(doc),
    y: LEFT,
  };

  paintPaper(s);
  s.y = drawQrCode(s);
  HEADERS[s.style.family](s);
  drawLines(s);
  if (s.style.traditional) {
    if (options.showPrices) drawTraditionalTotals(s);
    drawClosing(s);
    drawNotes(s);
  } else {
    if (s.style.family === "avantGarde") drawPayment(s);
    drawNotes(s);
    if (options.showPrices) drawFootTotals(s);
  }
  drawFooter(s);
  return s.pdf;
}

/* ───────────────────────── Drawing helpers ───────────────────────── */

/** Courier is much wider than the other built-in fonts: smaller, so the columns still fit. */
const fontSize = (s: Sheet, size: number) => (s.font === "courier" ? size * 0.85 : size);

interface TextStyle {
  size?: number;
  bold?: boolean;
  color?: Rgb;
  align?: Align;
}

function write(s: Sheet, text: string | string[], x: number, y: number, style: TextStyle = {}) {
  const { size = 8.5, bold = false, color = s.ink, align = "left" } = style;
  s.pdf
    .setFont(s.font, bold ? "bold" : "normal")
    .setFontSize(fontSize(s, size))
    .setTextColor(...color)
    .text(typeof text === "string" ? pdfText(text) : text.map(pdfText), x, y, { align });
}

function wrap(s: Sheet, text: string, width: number, size = 8.5, bold = false): string[] {
  s.pdf.setFont(s.font, bold ? "bold" : "normal").setFontSize(fontSize(s, size));
  return s.pdf.splitTextToSize(pdfText(text), width) as string[];
}

function line(s: Sheet, x1: number, y1: number, x2: number, y2: number, width = 0.2, color = s.rule) {
  s.pdf
    .setDrawColor(...color)
    .setLineWidth(width)
    .line(x1, y1, x2, y2);
}

function fill(s: Sheet, x: number, y: number, w: number, h: number, color: Rgb) {
  s.pdf.setFillColor(...color).rect(x, y, w, h, "F");
}

function frame(s: Sheet, x: number, y: number, w: number, h: number, width = 0.2) {
  s.pdf
    .setDrawColor(...s.rule)
    .setLineWidth(width)
    .rect(x, y, w, h);
}

/** The paper color under everything; white paper needs nothing. */
function paintPaper(s: Sheet) {
  if (s.paper.every((c) => c === 255)) return;
  fill(s, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, s.paper);
}

function newPage(s: Sheet) {
  s.pdf.addPage();
  paintPaper(s);
  s.y = LEFT + 3;
}

/* ───────────────────────── Shared header pieces ───────────────────────── */

/** "Factura", "Factura rectificativa", "Presupuesto"… */
function kindName({ doc, t }: Sheet) {
  return doc.series === "rectifying" ? t.rectifyingInvoice : t.kinds[doc.kind];
}

/** "Fecha de vencimiento" on invoices, "Fecha de validez" on drafts and quotes; nothing on delivery notes. */
function dueLabel({ doc, t }: Sheet, short = false) {
  if (!KINDS[doc.kind].dueLabel || !doc.dueOn) return null;
  if (doc.kind !== "invoice") return t.validUntil;
  return short ? t.due : t.dueDate;
}

/**
 * Under VERI*FACTU the invoice carries the QR code of its record, between 30 and
 * 40 mm wide, top right. Returns where the content starts. The top left is the
 * logo's place once the organization can upload one.
 */
function drawQrCode(s: Sheet): number {
  const verifactu = s.doc.issued?.verifactu;
  if (!verifactu) return LEFT + 3;
  const x = RIGHT - QR_SIZE;
  const y = 13;
  write(s, "QR tributario:", RIGHT - QR_SIZE / 2, y - 2, { size: 7, align: "center" });
  const qr = qrcode(0, "M");
  qr.addData(verifactu.qrUrl);
  qr.make();
  const count = qr.getModuleCount();
  const module = QR_SIZE / count;
  s.pdf.setFillColor(0, 0, 0);
  for (let row = 0; row < count; row++)
    for (let col = 0; col < count; col++)
      if (qr.isDark(row, col)) s.pdf.rect(x + col * module, y + row * module, module, module, "F");
  write(s, "VERI*FACTU", RIGHT - QR_SIZE / 2, y + QR_SIZE + 3, { size: 7, align: "center" });
  return y + QR_SIZE + 9;
}

/**
 * Clásica lists the tax ID last, after "Url:"; the others right under the name.
 * The first line is the name, printed bold.
 */
function partyLines(s: Sheet, p: Party): string[] {
  const { t } = s;
  const classic = s.style.family === "classic";
  const town = [p.postalCode, p.city].filter(Boolean).join(" ");
  const region = [p.province, p.country].filter(Boolean).join(", ");
  const taxId = p.taxId && `${t.taxId}: ${p.taxId}`;
  const lines = [
    p.name,
    !classic && taxId,
    p.address,
    town,
    region,
    p.phone && `${t.phone}: ${p.phone}`,
    p.email,
    p.website && (classic ? `${t.web}: ${p.website}` : p.website),
    classic && taxId,
  ];
  return lines.filter(Boolean) as string[];
}

/** Draws a party block from `y` and returns where it ends. */
function drawParty(s: Sheet, p: Party, x: number, y: number, width: number, heading?: string): number {
  if (heading) {
    write(s, `${heading}:`, x, y + 1, { size: 12, bold: true });
    y += 6;
  }
  partyLines(s, p).forEach((text, i) => {
    const size = i === 0 ? 9 : 8.5;
    const wrapped = wrap(s, text, width, size, i === 0);
    write(s, wrapped, x, y + 3, { size, bold: i === 0 });
    y += wrapped.length * LINE;
  });
  return y;
}

function issuer(): Party {
  const { profile } = settingsStore.get();
  return { ...profile, name: businessName(profile) };
}

/** Label and value pairs, e.g. "Número de factura: 2026-0047", that each template lays out its way. */
function metaRows(s: Sheet, { due = true, short = false } = {}): [string, string][] {
  const { doc, t, f } = s;
  const rows: [string, string][] = [];
  if (doc.number) rows.push([t.numberOf[doc.kind], doc.number]);
  rows.push([t.date, f.date(doc.issuedOn)]);
  const label = dueLabel(s, short);
  if (due && label && doc.dueOn) rows.push([label, f.date(doc.dueOn)]);
  return rows;
}

/* ───────────────────────── Headers, one per template family ───────────────────────── */

const HEADERS: Record<TemplateStyle["family"], (s: Sheet) => void> = {
  /** Issuer with the date on the right, the centered title, the number and the client in a box. */
  classic(s) {
    const { doc, t, f } = s;
    const top = s.y;
    write(s, f.date(doc.issuedOn), RIGHT, top + 3, { size: 11, bold: true, align: "right" });
    s.y = drawParty(s, issuer(), LEFT, top, 110) + 9;
    write(s, kindName(s).toUpperCase(), PAGE_WIDTH / 2, s.y, { size: 18, bold: true, align: "center" });
    s.y += 10;
    if (doc.number) {
      write(s, `${t.numberOf[doc.kind]}: ${doc.number}`, LEFT, s.y, { size: 11, bold: true });
      s.y += 5;
    }
    const boxTop = s.y;
    const end = drawParty(s, s.client, LEFT + 3, boxTop + 2, RIGHT - LEFT - 6);
    frame(s, LEFT, boxTop, RIGHT - LEFT, end - boxTop + 3, 0.3);
    s.y = end + 11;
  },

  /** Issuer and client side by side, then the big title with the number and dates. */
  modern(s) {
    const top = s.y;
    const end = Math.max(drawParty(s, issuer(), LEFT, top, 80), drawParty(s, s.client, 112, top, 80));
    s.y = end + 14;
    write(s, kindName(s).toUpperCase(), LEFT, s.y, { size: 28, bold: true, color: mix(s.ink, s.paper, 0.25) });
    let y = s.y - 7;
    for (const [label, value] of metaRows(s, { due: !s.style.traditional })) {
      write(s, `${label}:`, 135, y);
      write(s, value, RIGHT, y, { align: "right" });
      y += 4.5;
    }
    s.y = Math.max(s.y + 8, y + 5);
  },

  /** Number and dates under the code, ruled; then the issuer, and the client between two bars. */
  professional(s) {
    let y = s.y;
    for (const [label, value] of metaRows(s, { due: !s.style.traditional, short: true })) {
      write(s, `${label}:`, 168, y + 3, { align: "right" });
      write(s, value, RIGHT, y + 3, { align: "right" });
      line(s, 128, y + 5, RIGHT, y + 5, 0.3);
      y += 6.5;
    }
    const top = y + 6;
    const issuerEnd = drawParty(s, issuer(), LEFT, top + 6, 80);
    const clientEnd = drawParty(s, s.client, 112, top, 78, s.t.client);
    line(s, 108, top - 3, 108, clientEnd + 1, 0.9);
    line(s, RIGHT, top - 3, RIGHT, clientEnd + 1, 0.9);
    s.y = Math.max(issuerEnd, clientEnd) + 12;
  },

  /** Number and title over a striped bar, the parties, and the dates in a small table. */
  avantGarde(s) {
    const { doc, t, f } = s;
    s.y += 4;
    if (doc.number)
      write(s, `${t.numberOf[doc.kind]}: ${doc.number}`, LEFT + 2, s.y, {
        size: 12,
        bold: true,
        color: mix(s.rule, [0, 0, 0], 0.35),
      });
    write(s, kindName(s), RIGHT, s.y, { size: 22, bold: true, color: s.muted, align: "right" });
    // Stripes in shades of the line color
    let x = LEFT;
    for (const [share, tint] of [
      [0.42, 0],
      [0.12, 0.35],
      [0.3, 0.15],
      [0.16, 0.5],
    ] as const) {
      const width = (RIGHT - LEFT) * share;
      fill(s, x, s.y + 2.5, width, 2.2, mix(s.rule, s.paper, tint));
      x += width;
    }
    const top = s.y + 11;
    const end = Math.max(drawParty(s, issuer(), LEFT + 2, top + 6, 80), drawParty(s, s.client, 112, top, 80, t.client));

    s.y = end + 8;
    const cells: [string, string][] = [[t.date, f.date(doc.issuedOn)]];
    const due = dueLabel(s, true);
    if (due && doc.dueOn) cells.push([due, f.date(doc.dueOn)]);
    cells.forEach(([label, value], i) => {
      const cx = LEFT + i * 24;
      fill(s, cx, s.y, 24, 5, s.rule);
      write(s, label, cx + 12, s.y + 3.6, { color: s.paper, align: "center" });
      frame(s, cx, s.y + 5, 24, 5);
      write(s, value, cx + 12, s.y + 8.6, { align: "center" });
    });
    s.y += 18;
  },
};

/* ───────────────────────── Lines ───────────────────────── */

/** One table column, right of the concept: its header, width and how a line fills it. */
interface Column {
  label: string;
  width: number;
  value: (line: SalesLine) => string;
}

function columns(s: Sheet): Column[] {
  const { options, f, t } = s;
  const units = (line: SalesLine) => {
    const quantity = f.quantity(line.quantity);
    return options.showProductUnits && line.unit ? `${quantity} ${line.unit}` : quantity;
  };
  const vat = (line: SalesLine) => applyRate(lineBase(line), line.vatRate);
  // Only when some line has a discount: a column of 0 % says nothing
  const discount: Column[] = s.doc.lines.some((line) => line.discount)
    ? [{ label: t.discount, width: 14, value: (line) => f.percent(line.discount) }]
    : [];
  const taxes = options.showTaxes;

  if (s.style.traditional) {
    if (!options.showPrices) return [{ label: t.quantity, width: 24, value: units }];
    const columns: Column[] = [
      { label: t.quantity, width: 30, value: (line) => `${units(line)} x ${f.money(eurosToCents(line.unitPrice))}` },
      ...discount,
      { label: t.baseShort, width: 25, value: (line) => f.money(lineBase(line)) },
    ];
    if (taxes)
      columns.push({ label: t.vat, width: 33, value: (line) => `${f.percent(line.vatRate)} (${f.money(vat(line))})` });
    return columns;
  }

  if (!options.showPrices) return [{ label: t.units, width: 20, value: units }];
  const columns: Column[] = [
    { label: t.units, width: 13, value: units },
    { label: t.unitBase, width: 23, value: (line) => f.money(eurosToCents(line.unitPrice)) },
    ...discount,
    { label: t.lineBase, width: 25, value: (line) => f.money(lineBase(line)) },
  ];
  if (taxes)
    columns.push(
      { label: t.vatRate, width: 16, value: (line) => f.percent(line.vatRate) },
      { label: t.vat, width: 22, value: (line) => f.money(vat(line)) },
    );
  return columns;
}

/** Right edge of each column, the last one at the right margin. */
function columnEdges(cols: Column[]): number[] {
  let right = RIGHT;
  const edges: number[] = [];
  for (const col of [...cols].reverse()) {
    edges.unshift(right);
    right -= col.width;
  }
  return edges;
}

function drawTableHeader(s: Sheet, cols: Column[], edges: number[]) {
  const { family } = s.style;
  const height = 6;
  const top = s.y;
  const filled = family === "professional" || family === "avantGarde";
  const color = filled ? s.paper : s.ink;
  const classic = family === "classic";
  const label = (text: string) => (classic ? text.toUpperCase() : text);

  if (filled) fill(s, LEFT, top, RIGHT - LEFT, height, s.rule);
  if (classic) fill(s, LEFT, top, RIGHT - LEFT, height, s.soft);
  if (family === "modern") line(s, LEFT, top + height, RIGHT, top + height, 0.3);
  if (classic || family === "avantGarde") {
    frame(s, LEFT, top, RIGHT - LEFT, height, 0.3);
    cols.forEach((col, i) => line(s, edges[i]! - col.width, top, edges[i]! - col.width, top + height, 0.3));
  }

  const baseline = top + 4.2;
  write(s, label(s.t.concept), LEFT + 1.5, baseline, { bold: classic, color });
  cols.forEach((col, i) => {
    const x = classic ? edges[i]! - col.width / 2 : edges[i]! - 1.5;
    write(s, label(col.label), x, baseline, { bold: classic, color, align: classic ? "center" : "right" });
  });
  s.y = top + height;
}

function drawLines(s: Sheet) {
  const { doc, options, t, f } = s;
  const { family } = s.style;
  const cols = columns(s);
  const edges = columnEdges(cols);
  const conceptRight = edges[0]! - cols[0]!.width;
  const grid = family === "classic" || family === "avantGarde";
  const indent = grid ? 1.5 : 4;

  drawTableHeader(s, cols, edges);
  doc.lines.forEach((item, index) => {
    const concept = wrap(s, item.concept, conceptRight - LEFT - 3);
    const extra = [
      item.detail,
      options.showServicePeriod &&
        item.serviceFrom &&
        item.serviceTo &&
        `${t.period}: ${f.date(item.serviceFrom)} - ${f.date(item.serviceTo)}`,
    ].filter(Boolean) as string[];
    const detail = extra.length ? wrap(s, extra.join("\n"), RIGHT - LEFT - indent - 2, 8) : [];
    const main = concept.length * LINE + 2;
    const height = main + (detail.length ? detail.length * 3.6 + 1.5 : 0) + (grid ? 0 : 1.5);

    if (s.y + height > FOOT - 8) {
      newPage(s);
      drawTableHeader(s, cols, edges);
    }
    const top = s.y;
    write(s, concept, LEFT + 1.5, top + 4.2);
    cols.forEach((col, i) => write(s, col.value(item), edges[i]! - 1.5, top + 4.2, { align: "right" }));
    if (detail.length) write(s, detail, LEFT + indent, top + main + 3, { size: 8 });
    s.y = top + height;

    if (grid) {
      line(s, LEFT, top, LEFT, s.y);
      line(s, RIGHT, top, RIGHT, s.y);
      cols.forEach((col, i) => line(s, edges[i]! - col.width, top, edges[i]! - col.width, top + main));
      if (detail.length) line(s, LEFT, top + main, RIGHT, top + main);
      line(s, LEFT, s.y, RIGHT, s.y);
    } else if (family === "professional" && index < doc.lines.length - 1) {
      s.pdf.setLineDashPattern([0.6, 0.6], 0);
      line(s, LEFT, s.y, RIGHT, s.y, 0.2, s.muted);
      s.pdf.setLineDashPattern([], 0);
    }
  });

  if (family === "professional") line(s, LEFT, s.y + 0.5, RIGHT, s.y + 0.5, 0.8);
  if (family === "modern" && s.style.traditional) line(s, LEFT, s.y + 0.5, RIGHT, s.y + 0.5, 0.8, s.ink);
  s.y += 6;
}

/* ───────────────────────── Totals ───────────────────────── */

type BreakdownRow = [base: string, type: string, tax: string];
type TotalRow = [label: string, value: string];

/** VAT rates to print, and the withholding as one more row of the breakdown. */
function breakdownRows({ totals, options, t, f, doc }: Sheet): BreakdownRow[] {
  const rows: BreakdownRow[] = totals.vatBreakdown
    .filter((r) => r.vat || !options.hideZeroTaxes)
    .map((r) => [f.money(r.base), `${t.vat} ${f.percent(r.rate)}`, f.money(r.vat)]);
  if (totals.withholding)
    rows.push([
      f.money(totals.base),
      `${t.withholding} ${f.percent(WITHHOLDING_RATES[doc.withholding])}`,
      f.money(cents(-totals.withholding)),
    ]);
  return rows;
}

/** Total rows: the base, VAT (per rate in the traditional templates), then the rest. The last row is the total. */
function totalRows(s: Sheet, { longBase = false, vatPerRate = false, totalVat = true } = {}): TotalRow[] {
  const { totals, options, t, f, doc } = s;
  if (!options.showTaxes) return [[`${t.totalUntaxed}:`, f.money(totals.base)]];

  const rows: TotalRow[] = [[`${longBase ? t.totalBaseLong : t.totalBase}:`, f.money(totals.base)]];
  const vatLabel = totalVat ? t.totalVat : t.vat;
  if (vatPerRate) {
    for (const r of totals.vatBreakdown)
      if (r.vat || !options.hideZeroTaxes) rows.push([`${vatLabel} ${f.percent(r.rate)}:`, f.money(r.vat)]);
  } else {
    rows.push([`${vatLabel}:`, f.money(totals.vat)]);
  }
  if (totals.surcharge) rows.push([`${t.surcharge}:`, f.money(totals.surcharge)]);
  if (totals.withholding)
    rows.push([
      `${t.withholding} ${f.percent(WITHHOLDING_RATES[doc.withholding])}:`,
      f.money(cents(-totals.withholding)),
    ]);
  if (totals.supplies) rows.push([`${t.supplies}:`, f.money(totals.supplies)]);
  rows.push([`${t.total.toUpperCase()}:`, f.money(totals.total)]);
  return rows;
}

/** Traditional templates: the totals right after the lines, without a breakdown. */
function drawTraditionalTotals(s: Sheet) {
  const { family } = s.style;
  const rows = totalRows(s, { longBase: family !== "classic", vatPerRate: true, totalVat: family === "modern" });
  if (s.y + rows.length * 5 + 6 > FOOT) newPage(s);

  if (family === "classic") {
    const x = 130;
    const top = s.y;
    rows.forEach(([label, value], i) => {
      const last = i === rows.length - 1;
      s.y += last ? 6 : 4.5;
      write(s, label, x + 2, s.y, { size: last ? 10 : 8.5, bold: last });
      write(s, value, RIGHT - 2, s.y, { size: last ? 10 : 8.5, bold: last, align: "right" });
    });
    s.y += 2.5;
    frame(s, x, top, RIGHT - x, s.y - top, 0.3);
    s.y += 10;
    return;
  }

  rows.forEach(([label, value], i) => {
    const last = i === rows.length - 1;
    if (last && family === "professional") line(s, 125, s.y + 1.5, RIGHT, s.y + 1.5, 0.6);
    s.y += last ? 7 : 5;
    const size = last ? 13 : 8.5;
    write(s, label, 168, s.y, { size, bold: last, align: "right" });
    write(s, value, RIGHT, s.y, { size, bold: last, align: "right" });
  });
  s.y += 12;
}

/** Traditional templates: due date and how to pay, under the totals. */
function drawClosing(s: Sheet) {
  const { doc, f } = s;
  const classic = s.style.family === "classic";
  const due = dueLabel(s);
  if (due && doc.dueOn) {
    write(s, `${due}: ${f.date(doc.dueOn)}`, LEFT, s.y, { bold: classic });
    s.y += classic ? 10 : 8;
  }
  const payment = paymentLine(s);
  if (!payment) return;
  if (!classic) {
    write(s, `${s.t.information}:`, LEFT, s.y + 1, { size: 13, bold: true });
    s.y += 7;
  }
  const lines = wrap(s, payment, RIGHT - LEFT, 8.5, classic);
  write(s, lines, classic ? LEFT + 2 : LEFT, s.y, { bold: classic });
  s.y += lines.length * LINE + 4;
}

/** Vanguardista: how to pay, right under the lines. */
function drawPayment(s: Sheet) {
  const payment = paymentLine(s);
  if (!payment) return;
  write(s, wrap(s, payment, RIGHT - LEFT), LEFT, s.y);
  s.y += 8;
}

/** The newer templates: the tax breakdown and the totals, at the foot of the last page. */
function drawFootTotals(s: Sheet) {
  const { family } = s.style;
  const breakdown = s.options.showTaxes ? breakdownRows(s) : [];
  const totals = totalRows(s);
  const payment = family === "avantGarde" ? null : paymentLine(s);
  const due = family === "classic" ? dueLabel(s) : null;

  const breakdownHeight = breakdown.length ? 6 + breakdown.length * 5 : 0;
  const totalsHeight = totals.length * 4.6 + 4;
  const stacked = family === "classic" || family === "modern";
  const height =
    (due ? 8 : 0) +
    (stacked ? breakdownHeight + totalsHeight + 2 : 5 * (Math.max(breakdown.length, totals.length) + 1)) +
    (payment ? 10 : 0);
  if (s.y + height > FOOT) newPage(s);
  s.y = Math.max(s.y, FOOT - height);

  if (due && s.doc.dueOn) {
    write(s, `${due}: ${s.f.date(s.doc.dueOn)}`, LEFT, s.y + 3, { bold: true });
    s.y += 8;
  }
  if (family === "classic") classicFoot(s, breakdown, totals);
  else if (family === "modern") modernFoot(s, breakdown, totals);
  else boxedFoot(s, breakdown, totals);

  if (payment) {
    const classic = family === "classic";
    s.y += 7;
    write(s, wrap(s, payment, RIGHT - LEFT, 8.5, classic), LEFT + 2, s.y, { bold: classic });
  }
}

/** Clásica: a grey-headed breakdown on the right, the framed totals under it. */
function classicFoot(s: Sheet, breakdown: BreakdownRow[], totals: TotalRow[]) {
  const x = 75;
  const width = (RIGHT - x) / 3;
  if (breakdown.length) {
    const top = s.y;
    fill(s, x, top, RIGHT - x, 6, s.soft);
    [s.t.taxBase, s.t.taxType, s.t.tax].forEach((label, i) =>
      write(s, label.toUpperCase(), x + width * i + width / 2, top + 4.2, { bold: true, align: "center" }),
    );
    breakdown.forEach(([base, type, tax], r) => {
      const y = top + 6 + r * 5 + 3.6;
      write(s, base, x + width - 1.5, y, { align: "right" });
      write(s, type, x + width * 2 - 1.5, y, { align: "right" });
      write(s, tax, RIGHT - 1.5, y, { align: "right" });
    });
    s.y = top + 6 + breakdown.length * 5;
    frame(s, x, top, RIGHT - x, s.y - top, 0.3);
    line(s, x, top + 6, RIGHT, top + 6, 0.3);
    for (const i of [1, 2]) line(s, x + width * i, top, x + width * i, s.y, 0.3);
  }
  const top = s.y;
  const boxX = x + width;
  totals.forEach(([label, value], i) => {
    const last = i === totals.length - 1;
    s.y += last ? 5.5 : 4.4;
    // Labels start at the box's edge, in line with the "Tipo impuesto" column above
    write(s, label, boxX + 1.5, s.y, { size: last ? 10 : 8, bold: true });
    write(s, value, RIGHT - 1.5, s.y, { size: last ? 10 : 8, bold: true, align: "right" });
  });
  s.y += 2;
  frame(s, boxX, top, RIGHT - boxX, s.y - top, 0.3);
}

/** Moderna: an open breakdown on the right, a rule, and the totals with a large total. */
function modernFoot(s: Sheet, breakdown: BreakdownRow[], totals: TotalRow[]) {
  const x = 100;
  if (breakdown.length) {
    write(s, s.t.taxBase, 128, s.y + 4, { align: "right" });
    write(s, s.t.taxType, 158, s.y + 4, { align: "center" });
    write(s, s.t.tax, RIGHT, s.y + 4, { align: "right" });
    line(s, x, s.y + 5.5, RIGHT, s.y + 5.5);
    s.y += 6;
    for (const [base, type, tax] of breakdown) {
      s.y += 4;
      write(s, base, 128, s.y, { align: "right" });
      write(s, type, 158, s.y, { align: "center" });
      write(s, tax, RIGHT, s.y, { align: "right" });
      s.y += 1;
    }
    line(s, x, s.y + 1.5, RIGHT, s.y + 1.5, 0.4, s.ink);
    s.y += 2;
  }
  totals.forEach(([label, value], i) => {
    const last = i === totals.length - 1;
    s.y += last ? 6.5 : 4.4;
    const size = last ? 14 : 8;
    write(s, label, RIGHT - 28, s.y, { size, bold: true, align: "right" });
    write(s, value, RIGHT, s.y, { size, bold: true, align: "right" });
  });
}

/**
 * Elegante and Vanguardista: the breakdown and a "Totales" table side by side,
 * headed in the line color; ruled rows in Elegante, a full grid in Vanguardista.
 */
function boxedFoot(s: Sheet, breakdown: BreakdownRow[], totals: TotalRow[]) {
  const grid = s.style.family === "avantGarde";
  const top = s.y;
  const row = 5;

  if (breakdown.length) {
    const x = LEFT;
    const edges = [x + 30, x + 56, 100];
    const anchor = (i: number) => (i === 1 ? edges[1]! - 13 : edges[i]! - 1.5);
    const align = (i: number) => (i === 1 ? "center" : "right");
    fill(s, x, top, 100 - x, row, s.rule);
    [s.t.taxBase, s.t.taxType, s.t.tax].forEach((label, i) =>
      write(s, label, anchor(i), top + 3.6, { color: s.paper, align: align(i) }),
    );
    breakdown.forEach((cells, r) => {
      const y = top + row * (r + 1);
      cells.forEach((text, i) => write(s, text, anchor(i), y + 3.6, { align: align(i) }));
      if (grid) {
        frame(s, x, y, 100 - x, row);
        for (const e of edges.slice(0, 2)) line(s, e, y, e, y + row);
      } else {
        line(s, x, y + row, 100, y + row, 0.3);
      }
    });
  }

  const x = 115;
  fill(s, x, top, RIGHT - x, row, s.rule);
  // Labels start at one edge, under the heading, whatever their length
  write(s, s.t.totals, x + 1.5, top + 3.6, { color: s.paper });
  totals.forEach(([label, value], i) => {
    const last = i === totals.length - 1;
    const y = top + row * (i + 1);
    write(s, label, x + 1.5, y + 3.6, { size: last ? 9.5 : 8.5, bold: last });
    write(s, value, RIGHT - 1.5, y + 3.6, { size: last ? 9.5 : 8.5, bold: last, align: "right" });
    if (grid) {
      frame(s, x, y, RIGHT - x, row);
      line(s, 169, y, 169, y + row);
    } else {
      line(s, x, y + row, RIGHT, y + row, 0.3);
    }
  });
  s.y = top + row * (Math.max(breakdown.length, totals.length) + 1);
}

/**
 * "A pagar por transferencia bancaria en la cuenta ES91…", from the client's method or the default one.
 * Cash says nothing worth printing.
 */
function paymentLine(s: Sheet): string | null {
  if (s.doc.kind !== "invoice" && s.doc.kind !== "draft") return null;
  const { paymentMethods, defaultPaymentMethodId } = settingsStore.get();
  const id = s.client.paymentMethodId ?? defaultPaymentMethodId;
  const method = paymentMethods.find((m) => m.id === id);
  return method && method.type !== "cash" ? paymentText(s.t, method) : null;
}

/* ───────────────────────── Notes and footer ───────────────────────── */

/** The document's public notes. */
function drawNotes(s: Sheet) {
  const notes = s.doc.publicNotes.trim();
  if (!notes) return;
  const text = wrap(s, notes, RIGHT - LEFT, 8);
  if (s.y + text.length * 3.8 > FOOT) newPage(s);
  write(s, text, LEFT, s.y, { size: 8, color: s.muted });
  s.y += text.length * 3.8 + 4;
}

/** The fixed footer, up the left margin of every page. */
function drawFooter(s: Sheet) {
  const footer = s.options.footer.trim();
  if (!footer) return;
  const lines = wrap(s, footer, 250, 6.5);
  for (let page = 1; page <= s.pdf.getNumberOfPages(); page++) {
    s.pdf.setPage(page);
    lines.forEach((text, i) => {
      s.pdf
        .setFont(s.font, "normal")
        .setFontSize(fontSize(s, 6.5))
        .setTextColor(...s.ink)
        .text(text, 7 + i * 2.8, FOOT, { angle: 90 });
    });
  }
}

/* ───────────────────────── Export ───────────────────────── */

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  // Give the browser a moment to start the download before freeing the blob
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** The document's PDF as a file, to attach it to an email. */
export function documentPdfFile(doc: SalesDocument): File {
  return new File([render(doc).output("blob")], documentFileName(doc, "pdf"), { type: "application/pdf" });
}

export function downloadDocumentPdf(doc: SalesDocument) {
  render(doc).save(documentFileName(doc, "pdf"));
}

/** Shows the PDF in a tab opened beforehand (synchronously, so pop-up blockers allow it), to read or print. */
export function showDocumentPdf(doc: SalesDocument, tab: Window) {
  tab.location.href = URL.createObjectURL(render(doc).output("blob"));
}

/** Every document as its own PDF, packed in one .zip. */
export function downloadPdfZip(docs: SalesDocument[], name: string) {
  const files = Object.fromEntries(
    docs.map((doc) => [documentFileName(doc, "pdf"), new Uint8Array(render(doc).output("arraybuffer"))] as const),
  );
  // PDFs are already compressed: store them as they are
  const zip = zipSync(files, { level: 0 });
  save(new Blob([zip], { type: "application/zip" }), `${name}.zip`);
}
