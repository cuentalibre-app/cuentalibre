import type {
  BusinessProfile,
  EmailTemplate,
  EmailTemplateSettings,
  SalesDocument,
  SalesKind,
} from "@cuentalibre/contracts";
import { fillPlaceholders } from "@cuentalibre/core";
import { formatEUR } from "@cuentalibre/ui/lib/format";
import { businessName } from "@/features/settings/settings-model";
import { formatDate } from "@/lib/format";
import { clientOf, documentTotals, KINDS, printedDocument } from "./sales-model";
import { salesStore } from "./sales-store";

/* The subject and message of the email that sends a sales document, written from a template. */

/** The document data a template can show, written `{{name}}`. */
export const EMAIL_PLACEHOLDERS = [
  { name: "numero", label: "Número" },
  { name: "fecha", label: "Fecha" },
  { name: "vencimiento", label: "Vencimiento o validez" },
  { name: "total", label: "Total" },
  { name: "cliente", label: "Cliente" },
  { name: "negocio", label: "Tu negocio" },
] as const;

export const EMAIL_PLACEHOLDER_NAMES = EMAIL_PLACEHOLDERS.map((p) => p.name);

/** Stands for cuentalibre's own text in the template pickers. */
export const BUILT_IN_TEMPLATE = "builtIn";

type Text = Pick<EmailTemplate, "subject" | "body">;

/** cuentalibre's own subject and message, used until the business makes a template its default. */
export function builtInEmailTemplate(kind: SalesKind, rectifying = false): Text {
  const singular = rectifying ? "Factura rectificativa" : KINDS[kind].singular;
  const noun = rectifying ? "la factura rectificativa" : KINDS[kind].noun;
  return {
    subject: `${singular} {{numero}} · {{negocio}}`,
    body: `Hola,\n\nTe adjunto ${noun} {{numero}} por importe de {{total}}.\n\nUn saludo,\n{{negocio}}`,
  };
}

/** The templates for a kind of document, by name. */
export const templatesFor = (settings: EmailTemplateSettings, kind: SalesKind) =>
  settings.templates.filter((t) => t.kind === kind).sort((a, b) => a.name.localeCompare(b.name, "es"));

/** The template a kind starts with: its default, or cuentalibre's own text. */
export const defaultTemplateId = (settings: EmailTemplateSettings, kind: SalesKind) =>
  settings.defaults[kind] ?? BUILT_IN_TEMPLATE;

/** What each placeholder says for a document. */
export function placeholderValues(doc: SalesDocument, profile: BusinessProfile): Record<string, string> {
  return {
    numero: doc.number ?? "",
    fecha: formatDate(doc.issuedOn),
    vencimiento: doc.dueOn ? formatDate(doc.dueOn) : "",
    // What the attached document says: a substitution's total is the corrected invoice's
    total: formatEUR(
      documentTotals(printedDocument(doc, doc.rectifiesId ? salesStore.get(doc.rectifiesId) : undefined)).total,
    ),
    cliente: doc.clientId ? clientOf(doc).name : "",
    negocio: businessName(profile),
  };
}

/** The subject and message a template (or cuentalibre's own text) gives for a document. */
export function writeEmail(
  settings: EmailTemplateSettings,
  templateId: string,
  doc: SalesDocument,
  profile: BusinessProfile,
): Text {
  const template =
    settings.templates.find((t) => t.id === templateId && t.kind === doc.kind) ??
    builtInEmailTemplate(doc.kind, doc.series === "rectifying");
  const values = placeholderValues(doc, profile);
  return {
    // Without a number, "Factura  · Estudio" would keep a double space
    subject: fillPlaceholders(template.subject, values)
      .replace(/\s{2,}/g, " ")
      .trim(),
    body: fillPlaceholders(template.body, values),
  };
}
