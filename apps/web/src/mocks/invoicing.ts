import type { NoteTemplate } from "@fiscalia/contracts";

/** Sample note templates until there is a backend. Payment methods live in the settings; products, in the catalog. */

export const initialNoteTemplates: NoteTemplate[] = [
  {
    id: "n1",
    title: "Pago por transferencia",
    text: "Forma de pago: transferencia bancaria a ES12 3456 7890 1234 5678 9012.",
  },
  {
    id: "n2",
    title: "Operación intracomunitaria",
    text: "Operación exenta de IVA por aplicación del art. 25 de la Ley 37/1992 (inversión del sujeto pasivo).",
  },
];
