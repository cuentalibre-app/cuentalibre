import { jsPDF } from "jspdf";
import type { Cents } from "@fiscalia/core";
import { formatEUR } from "@fiscalia/ui/lib/format";
import type { PnlRow } from "./pnl-rows";

/*
 * PDF of the profit and loss report, loaded on demand like the invoice PDF. Helvetica only
 * covers WinAnsi, so amounts swap the typographic minus and non-breaking spaces.
 */

const MARGIN = 18;
const RIGHT = 210 - MARGIN;
const COLUMNS = [RIGHT - 38, RIGHT];

const pdfText = (text: string) => text.replace(/−/g, "-").replace(/[  ]/g, " ");
const eur = (amount: Cents) => pdfText(formatEUR(amount));

export interface PnlPdf {
  business: string;
  taxId: string;
  generatedOn: string;
  periodLabel: string;
  years: [number, number];
  rows: PnlRow[];
  fileName: string;
}

export function downloadPnlPdf({ business, taxId, generatedOn, periodLabel, years, rows, fileName }: PnlPdf) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN + 4;

  pdf.setFont("helvetica", "bold").setFontSize(17).setTextColor(20).text("Informe de Pérdidas y Ganancias", MARGIN, y);
  y += 4;
  pdf.setDrawColor(20).setLineWidth(0.4).line(MARGIN, y, RIGHT, y);
  y += 6;
  pdf.setFont("helvetica", "bold").setFontSize(9);
  pdf.text(`Empresa: ${business}`, MARGIN, y);
  pdf.text(`Generado en fecha: ${generatedOn}`, RIGHT, y, { align: "right" });
  y += 5;
  pdf.text(`NIF: ${taxId}`, MARGIN, y);
  pdf.text(`Periodo: ${periodLabel}`, RIGHT, y, { align: "right" });
  y += 3;
  pdf.line(MARGIN, y, RIGHT, y);

  y += 12;
  pdf.setFillColor(20, 20, 20).rect(MARGIN, y - 5.5, RIGHT - MARGIN, 8, "F");
  pdf.setTextColor(255).setFontSize(10);
  years.forEach((year, i) => pdf.text(String(year), COLUMNS[i]! - 2, y, { align: "right" }));
  pdf.setTextColor(20);
  y += 10;

  for (const row of rows) {
    if (y > 275) {
      pdf.addPage();
      y = MARGIN + 4;
    }
    const indent = row.kind === "line" ? 4 : row.kind === "account" ? 10 : 0;
    const size = row.kind === "account" ? 8.5 : row.kind === "line" ? 9.5 : 11;
    const bold = row.kind === "section" || row.kind === "result";
    if (row.kind === "result" || (row.kind === "section" && row !== rows[0])) y += 3;
    pdf
      .setFont("helvetica", bold ? "bold" : "normal")
      .setFontSize(size)
      .setTextColor(row.kind === "account" ? 100 : 20);
    pdf.text(pdfText(row.kind === "result" ? row.label.toUpperCase() : row.label), MARGIN + indent, y);
    row.values.forEach((v, i) =>
      pdf.text(eur(v), COLUMNS[i]! - (row.kind === "section" || row.kind === "result" ? 0 : 2), y, { align: "right" }),
    );
    if (row.kind === "section")
      pdf
        .setDrawColor(120)
        .setLineWidth(0.2)
        .line(MARGIN, y + 1.8, RIGHT, y + 1.8);
    y += row.kind === "section" ? 7 : row.kind === "result" ? 9 : 5.5;
  }

  pdf.save(fileName);
}
