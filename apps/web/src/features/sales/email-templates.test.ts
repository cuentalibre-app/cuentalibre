import type { EmailTemplateSettings, SalesDocument } from "@cuentalibre/contracts";
import { describe, expect, it } from "vitest";
import { initialSalesDocuments } from "@/mocks/sales";
import { initialProfile } from "@/mocks/settings";
import { BUILT_IN_TEMPLATE, defaultTemplateId, placeholderValues, templatesFor, writeEmail } from "./email-templates";

const invoice = initialSalesDocuments.find((d) => d.kind === "invoice" && d.number)!;
const quote = initialSalesDocuments.find((d) => d.kind === "quote")!;
const none: EmailTemplateSettings = { templates: [], defaults: {} };
const reminder = {
  id: "t1",
  name: "Recordatorio",
  kind: "invoice" as const,
  subject: "Recordatorio: factura {{numero}}",
  body: "Hola {{cliente}}, la factura {{numero}} de {{TOTAL}} vence el {{vencimiento}}.",
};
const values = placeholderValues(invoice, initialProfile);

describe("writeEmail", () => {
  it("writes cuentalibre's own text without templates", () => {
    const email = writeEmail(none, BUILT_IN_TEMPLATE, invoice, initialProfile);
    expect(email.subject).toBe(`Factura ${invoice.number} · ${values.negocio}`);
    expect(email.body).toContain(`Te adjunto la factura ${invoice.number} por importe de ${values.total}.`);
  });

  it("names the kind of document with its article", () => {
    expect(writeEmail(none, BUILT_IN_TEMPLATE, quote, initialProfile).body).toContain("Te adjunto el presupuesto");
    const rectifying: SalesDocument = { ...invoice, series: "rectifying" };
    expect(writeEmail(none, BUILT_IN_TEMPLATE, rectifying, initialProfile).subject).toMatch(/^Factura rectificativa /);
  });

  it("fills a template's placeholders", () => {
    const email = writeEmail({ templates: [reminder], defaults: {} }, "t1", invoice, initialProfile);
    expect(email.subject).toBe(`Recordatorio: factura ${invoice.number}`);
    expect(email.body).toBe(
      `Hola ${values.cliente}, la factura ${invoice.number} de ${values.total} vence el ${values.vencimiento}.`,
    );
  });

  it("ignores a template of another kind", () => {
    const email = writeEmail({ templates: [reminder], defaults: {} }, "t1", quote, initialProfile);
    expect(email.subject).toMatch(/^Presupuesto /);
  });

  it("drops the space a missing number leaves", () => {
    const unnumbered: SalesDocument = { ...invoice, number: null };
    expect(writeEmail(none, BUILT_IN_TEMPLATE, unnumbered, initialProfile).subject).toBe(`Factura · ${values.negocio}`);
  });
});

describe("template choice", () => {
  const settings: EmailTemplateSettings = {
    templates: [reminder, { ...reminder, id: "t2", name: "Aviso", kind: "quote" }],
    defaults: { invoice: "t1" },
  };

  it("starts each kind with its default, or cuentalibre's text", () => {
    expect(defaultTemplateId(settings, "invoice")).toBe("t1");
    expect(defaultTemplateId(settings, "quote")).toBe(BUILT_IN_TEMPLATE);
  });

  it("lists a kind's templates only", () => {
    expect(templatesFor(settings, "quote").map((t) => t.id)).toEqual(["t2"]);
  });
});
