import { jsPDF } from "jspdf";
import { formatDuration } from "@fiscalia/core";
import { weekdayName } from "./working-hours-model";
import {
  intervalLabel,
  signatureDays,
  slashDate,
  totalLabel,
  type ReportRange,
  type WorkerReport,
} from "./worked-hours-report";

/*
 * PDFs of the worked-hours reports, loaded on demand like the other PDFs. Helvetica
 * only covers WinAnsi, so the en dash of the intervals becomes a hyphen.
 */

const MARGIN = 16;
const WIDTH = 210;
const RIGHT = WIDTH - MARGIN;
const BOTTOM = 297 - 22;

const pdfText = (text: string) => text.replace(/–/g, "-").replace(/[  ]/g, " ");

interface Business {
  name: string;
  taxId: string;
  address: string;
}

interface Column {
  label: string;
  x: number;
  width: number;
  align?: "right";
}

function header(pdf: jsPDF, title: string, lines: [string, string][]): number {
  let y = MARGIN + 4;
  pdf.setFont("helvetica", "bold").setFontSize(16).setTextColor(20).text(title, MARGIN, y);
  y += 4;
  pdf.setDrawColor(20).setLineWidth(0.4).line(MARGIN, y, RIGHT, y);
  y += 6;
  pdf.setFontSize(9);
  for (const [left, right] of lines) {
    pdf.setFont("helvetica", "normal").text(pdfText(left), MARGIN, y);
    pdf.text(pdfText(right), RIGHT, y, { align: "right" });
    y += 5;
  }
  pdf.line(MARGIN, y - 2, RIGHT, y - 2);
  return y + 6;
}

function tableHead(pdf: jsPDF, columns: Column[], y: number): number {
  pdf.setFillColor(235, 235, 235).rect(MARGIN, y - 5, RIGHT - MARGIN, 7.5, "F");
  pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(60);
  for (const c of columns) pdf.text(c.label, c.align ? c.x + c.width - 2 : c.x + 2, y, { align: c.align ?? "left" });
  pdf.setTextColor(20);
  return y + 7;
}

/** Writes a row; long cells wrap. Returns the next row's baseline. */
function row(pdf: jsPDF, columns: Column[], cells: string[], y: number, bold = false): number {
  pdf.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8.5);
  const wrapped = cells.map((cell, i) => pdf.splitTextToSize(pdfText(cell), columns[i]!.width - 4) as string[]);
  const lines = Math.max(1, ...wrapped.map((w) => w.length));
  wrapped.forEach((text, i) => {
    const c = columns[i]!;
    pdf.text(text, c.align ? c.x + c.width - 2 : c.x + 2, y, { align: c.align ?? "left" });
  });
  const next = y + lines * 4 + 2.5;
  pdf
    .setDrawColor(220)
    .setLineWidth(0.2)
    .line(MARGIN, next - 4, RIGHT, next - 4);
  return next;
}

function columnsOf(widths: [string, number, "right"?][]): Column[] {
  let x = MARGIN;
  return widths.map(([label, width, align]) => {
    const c = { label, x, width, align };
    x += width;
    return c;
  });
}

/** Day-by-day table of the extended report and the signature sheet. */
const DAY_COLUMNS = columnsOf([
  ["Fecha", 22],
  ["Día", 20],
  ["Registros", 44],
  ["Horas", 32, "right"],
  ["Sin cerrar", 18, "right"],
  ["Comentarios", 42],
]);

const businessLines = (business: Business, range: ReportRange, generatedOn: string): [string, string][] => [
  [`Empresa: ${business.name}`, `Generado el ${generatedOn}`],
  [`NIF: ${business.taxId}`, `Periodo: ${range.label}`],
];

/* ─────────────────────────────── Detailed report ─────────────────────────────── */

export interface DetailedPdf {
  business: Business;
  range: ReportRange;
  reports: WorkerReport[];
  extended: boolean;
  generatedOn: string;
  fileName: string;
}

export function downloadDetailedPdf({ business, range, reports, extended, generatedOn, fileName }: DetailedPdf) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = header(pdf, "Informe de horas trabajadas", businessLines(business, range, generatedOn));

  if (!extended) {
    const columns = columnsOf([
      ["Persona", 86],
      ["Total de horas", 36, "right"],
      ["Total días", 28, "right"],
      ["Sin cerrar", 28, "right"],
    ]);
    y = tableHead(pdf, columns, y);
    for (const r of reports)
      y = row(
        pdf,
        columns,
        [r.worker.name, formatDuration(r.totals.minutes), String(r.totals.days), String(r.totals.unclosed)],
        y,
      );
  } else {
    const columns = DAY_COLUMNS;
    reports.forEach((r, i) => {
      if (i > 0) y += 6;
      if (y > BOTTOM - 30) {
        pdf.addPage();
        y = MARGIN + 6;
      }
      pdf
        .setFont("helvetica", "bold")
        .setFontSize(11)
        .text(pdfText(`${r.worker.name} – ${range.label}`), MARGIN, y);
      y = tableHead(pdf, columns, y + 7);
      if (r.days.length === 0) y = row(pdf, columns, ["Sin registros en el periodo", "", "", "", "", ""], y);
      for (const d of r.days) {
        if (y > BOTTOM) {
          pdf.addPage();
          y = tableHead(pdf, columns, MARGIN + 6);
        }
        y = row(
          pdf,
          columns,
          [
            slashDate(d.date),
            weekdayName(d.date),
            d.entries.map(intervalLabel).join("\n"),
            formatDuration(d.minutes),
            String(d.unclosed),
            d.comments.join("\n"),
          ],
          y,
        );
      }
      y = row(pdf, columns, ["", "", "TOTAL", totalLabel(r.totals), String(r.totals.unclosed), ""], y, true);
    });
  }

  pdf.save(fileName);
}

/* ─────────────────────────────── Signature sheet ─────────────────────────────── */

export interface SignaturePdf {
  business: Business;
  range: ReportRange;
  reports: WorkerReport[];
  generatedOn: string;
  fileName: string;
}

/** One page per person with the day-by-day record and room for both signatures. */
export function downloadSignaturePdf({ business, range, reports, generatedOn, fileName }: SignaturePdf) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const columns = DAY_COLUMNS;

  reports.forEach((r, i) => {
    if (i > 0) pdf.addPage();
    let y = header(pdf, "Registro de jornada", [
      ...businessLines(business, range, generatedOn),
      [`Centro de trabajo: ${business.address}`, ""],
      [`Trabajador: ${r.worker.name}`, r.worker.email],
    ]);
    y = tableHead(pdf, columns, y);
    for (const d of signatureDays(r, range))
      y = row(
        pdf,
        columns,
        [
          slashDate(d.date),
          weekdayName(d.date),
          d.entries.length ? d.entries.map(intervalLabel).join("\n") : "—",
          d.entries.length ? formatDuration(d.minutes) : "—",
          d.entries.length ? String(d.unclosed) : "",
          d.comments.join("\n"),
        ],
        y,
      );
    y = row(pdf, columns, ["", "", "TOTAL", totalLabel(r.totals), String(r.totals.unclosed), ""], y, true);

    // Signature boxes, kept together at the foot of the page
    y = Math.max(y + 12, BOTTOM - 46);
    const boxWidth = (RIGHT - MARGIN - 10) / 2;
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(20);
    ["Firma de la empresa", "Firma del trabajador"].forEach((label, k) => {
      const x = MARGIN + k * (boxWidth + 10);
      pdf.text(label, x, y);
      pdf
        .setDrawColor(150)
        .setLineWidth(0.3)
        .rect(x, y + 3, boxWidth, 26);
    });
    pdf.text(`En ________________, a ____ de ______________ de ${range.to.slice(0, 4)}`, MARGIN, y + 38);
    pdf
      .setFontSize(7.5)
      .setTextColor(110)
      .text(
        "Registro diario de jornada conforme al artículo 34.9 del Estatuto de los Trabajadores. Se conserva durante cuatro años.",
        MARGIN,
        297 - 10,
      );
  });

  pdf.save(fileName);
}
