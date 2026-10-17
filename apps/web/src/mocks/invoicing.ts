/** Sample catalog and note templates until there is a backend. Payment methods live in the settings. */

export interface Product {
  id: string;
  name: string;
  /** Unit price before VAT. */
  price: number;
  vatRate: number;
}

export const products: Product[] = [
  { id: "p1", name: "Hora de consultoría", price: 65, vatRate: 0.21 },
  { id: "p2", name: "Diseño y mantenimiento web · cuota mensual", price: 2_400, vatRate: 0.21 },
  { id: "p3", name: "Fotografía de producto (unidad)", price: 45, vatRate: 0.21 },
  { id: "p4", name: "Landing page", price: 1_900, vatRate: 0.21 },
];

export interface NoteTemplate {
  id: string;
  title: string;
  text: string;
}

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
