import { jsPDF } from "jspdf";
import { zipSync } from "fflate";
import { cents, eurosToCents, lineBase, WITHHOLDING_RATES, type Cents } from "@fiscalia/core";
import { formatEUR } from "@fiscalia/ui/lib/format";
import { formatDate } from "@/lib/format";
import { addressLine, businessName } from "@/features/settings/settings-model";
import { settingsStore } from "@/features/settings/settings-store";
import type { SalesDocument } from "@/mocks/sales";
import { printOptions } from "./invoice-settings";
import { clientOf, documentFileName, documentTotals, KINDS, OPERATION_TYPES } from "./sales-model";

/*
 * PDF export. Loaded on demand (dynamic import) so jsPDF stays out of the main bundle.
 * The built-in Helvetica only covers WinAnsi, so amounts swap the typographic minus and
 * non-breaking spaces for plain characters.
 */

const MARGIN = 18;
const PAGE_WIDTH = 210;
const RIGHT = PAGE_WIDTH - MARGIN;

const pdfText = (text: string) => text.replace(/−/g, "-").replace(/[  ]/g, " ");
const eur = (amount: Cents) => pdfText(formatEUR(amount));
const percent = (rate: number) => `${String(Math.round(rate * 10_000) / 100).replace(".", ",")} %`;

/** "Factura 2026-0046" or "Borrador" when the document has no number yet. */
function title(doc: SalesDocument) {
  const { singular } = KINDS[doc.kind];
  const name = doc.series === "rectifying" ? "Factura rectificativa" : singular;
  return doc.number ? `${name} ${doc.number}` : name;
}

function render(doc: SalesDocument): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const client = clientOf(doc);
  const totals = documentTotals(doc);
  const config = KINDS[doc.kind];
  const options = printOptions(doc.kind);
  let y = MARGIN + 4;

  pdf.setFont("helvetica", "bold").setFontSize(18).text(title(doc), MARGIN, y);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(100);
  y += 7;
  pdf.text(`Fecha: ${formatDate(doc.issuedOn)}`, MARGIN, y);
  if (config.dueLabel && doc.dueOn) pdf.text(`${config.dueLabel}: ${formatDate(doc.dueOn)}`, MARGIN + 50, y);

  // Issuer and client side by side
  y += 12;
  const party = (label: string, lines: string[], x: number) => {
    pdf.setFontSize(8).setTextColor(120).text(label.toUpperCase(), x, y);
    pdf.setFontSize(10).setTextColor(20);
    lines.forEach((line, i) => {
      pdf.setFont("helvetica", i === 0 ? "bold" : "normal").text(line, x, y + 6 + i * 5);
    });
  };
  const { profile } = settingsStore.get();
  party("Emisor", [businessName(profile), `NIF ${profile.taxId}`, addressLine(profile)], MARGIN);
  party("Cliente", [client.name, `NIF ${client.taxId}`], PAGE_WIDTH / 2 + 4);

  // Lines
  y += 30;
  const cols = { concept: MARGIN, qty: 120, price: 145, amount: RIGHT };
  pdf.setFillColor(242, 241, 237).rect(MARGIN - 2, y - 5, RIGHT - MARGIN + 4, 8, "F");
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(90);
  pdf.text("CONCEPTO", cols.concept, y);
  // Without prices the quantity takes the last column
  const qtyX = options.showPrices ? cols.qty : cols.amount;
  pdf.text("CANT.", qtyX, y, { align: "right" });
  if (options.showPrices) {
    pdf.text("PRECIO", cols.price, y, { align: "right" });
    pdf.text("IMPORTE", cols.amount, y, { align: "right" });
  }

  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(20);
  y += 9;
  for (const line of doc.lines) {
    const concept = pdf.splitTextToSize(line.concept, cols.qty - cols.concept - 14) as string[];
    if (y + concept.length * 5 > 250) {
      pdf.addPage();
      y = MARGIN + 4;
    }
    pdf.text(concept, cols.concept, y);
    const extra = [
      line.detail,
      options.showServicePeriod &&
        line.serviceFrom &&
        line.serviceTo &&
        `Periodo: ${formatDate(line.serviceFrom)} – ${formatDate(line.serviceTo)}`,
    ].filter(Boolean) as string[];
    if (extra.length) {
      const text = pdf.splitTextToSize(pdfText(extra.join("\n")), cols.qty - cols.concept - 14) as string[];
      pdf
        .setFontSize(8)
        .setTextColor(110)
        .text(text, cols.concept, y + concept.length * 5);
      pdf.setFontSize(10).setTextColor(20);
      y += text.length * 4;
    }
    const quantity = String(line.quantity).replace(".", ",");
    pdf.text(options.showProductUnits && line.unit ? `${quantity} ${line.unit}` : quantity, qtyX, y, {
      align: "right",
    });
    if (options.showPrices) {
      pdf.text(eur(eurosToCents(line.unitPrice)), cols.price, y, { align: "right" });
      pdf.text(eur(lineBase(line)), cols.amount, y, { align: "right" });
    }
    if (options.showPrices && line.discount) {
      pdf.setFontSize(8).setTextColor(110);
      pdf.text(`Descuento ${percent(line.discount)}`, cols.concept, y + concept.length * 5);
      pdf.setFontSize(10).setTextColor(20);
      y += 4;
    }
    y += concept.length * 5 + 3;
    pdf.setDrawColor(225).line(MARGIN, y - 4, RIGHT, y - 4);
  }

  // Totals, right aligned
  y += 4;
  const row = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 12 : 10);
    pdf.text(label, 140, y, { align: "right" });
    pdf.text(value, RIGHT, y, { align: "right" });
    y += bold ? 8 : 6;
  };
  if (options.showPrices && options.showTaxes) {
    row("Base imponible", eur(totals.base));
    for (const r of totals.vatBreakdown) if (r.vat || !options.hideZeroTaxes) row(`IVA ${percent(r.rate)}`, eur(r.vat));
    if (totals.surcharge) row("Recargo de equivalencia", eur(totals.surcharge));
    if (totals.withholding)
      row(`Retención IRPF ${percent(WITHHOLDING_RATES[doc.withholding])}`, eur(cents(-totals.withholding)));
    if (totals.supplies) row("Suplidos", eur(totals.supplies));
    pdf.setDrawColor(180).line(110, y - 3, RIGHT, y - 3);
    y += 3;
    row("Total", eur(totals.total), true);
  } else if (options.showPrices) {
    // Taxes hidden: the total is the taxable base
    pdf.setDrawColor(180).line(110, y - 3, RIGHT, y - 3);
    y += 3;
    row("Total (impuestos no incluidos)", eur(totals.base), true);
  }

  // Legal mentions and notes
  const notes: string[] = [];
  const operation = OPERATION_TYPES.find((o) => o.value === doc.operationType);
  if (doc.operationType === "intraEu") notes.push("Operación intracomunitaria sin IVA: inversión del sujeto pasivo.");
  else if (doc.operationType !== "national" && operation) notes.push(`Operación ${operation.label.toLowerCase()}.`);
  if (doc.publicNotes) notes.push(doc.publicNotes);
  if (notes.length) {
    y += 6;
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
    pdf.text(pdf.splitTextToSize(notes.join("\n"), RIGHT - MARGIN) as string[], MARGIN, y);
  }

  // Fixed footer, up the left margin of every page
  const footer = pdfText(options.footer.trim());
  if (footer) {
    pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(130);
    const lines = pdf.splitTextToSize(footer, 260) as string[];
    for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
      pdf.setPage(page);
      lines.forEach((line, i) => pdf.text(line, 8 + i * 3, 285, { angle: 90 }));
    }
  }

  return pdf;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  // Give the browser a moment to start the download before freeing the blob
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
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
