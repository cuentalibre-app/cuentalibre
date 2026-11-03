import { SPAIN, checkTaxId, hasEuVatPrefix, isOtherEuCountry } from "@cuentalibre/core";
import type { Contact, ContactRole } from "@cuentalibre/contracts";

export interface RoleConfig {
  /** "Clientes", for titles and the sidebar. */
  title: string;
  /** "Cliente". */
  singular: string;
  /** Lowercase noun with article, for sentences: "el cliente". */
  noun: string;
  path: string;
  newPath: string;
  /** The other list, for "Copiar como proveedor". */
  opposite: ContactRole;
}

export const ROLES: Record<ContactRole, RoleConfig> = {
  client: {
    title: "Clientes",
    singular: "Cliente",
    noun: "el cliente",
    path: "/contactos/clientes",
    newPath: "/contactos/clientes/nuevo",
    opposite: "supplier",
  },
  supplier: {
    title: "Proveedores",
    singular: "Proveedor",
    noun: "el proveedor",
    path: "/contactos/proveedores",
    newPath: "/contactos/proveedores/nuevo",
    opposite: "client",
  },
};

export const contactPath = (role: ContactRole, id: string) => `${ROLES[role].path}/${id}`;
export const editContactPath = (role: ContactRole, id: string) => `${contactPath(role, id)}/editar`;

/** Countries offered in the address, Spain and the EU first; names match the EU VAT table in core. */
export const COUNTRIES: { label?: string; options: string[] }[] = [
  { options: [SPAIN] },
  {
    label: "Unión Europea",
    options: [
      "Alemania",
      "Austria",
      "Bélgica",
      "Bulgaria",
      "Chipre",
      "Croacia",
      "Dinamarca",
      "Eslovaquia",
      "Eslovenia",
      "Estonia",
      "Finlandia",
      "Francia",
      "Grecia",
      "Hungría",
      "Irlanda",
      "Italia",
      "Letonia",
      "Lituania",
      "Luxemburgo",
      "Malta",
      "Países Bajos",
      "Polonia",
      "Portugal",
      "República Checa",
      "Rumanía",
      "Suecia",
    ],
  },
  {
    label: "Resto del mundo",
    options: [
      "Andorra",
      "Arabia Saudí",
      "Argentina",
      "Australia",
      "Bolivia",
      "Brasil",
      "Canadá",
      "Chile",
      "China",
      "Colombia",
      "Corea del Sur",
      "Costa Rica",
      "Cuba",
      "Ecuador",
      "Egipto",
      "Emiratos Árabes Unidos",
      "Estados Unidos",
      "Filipinas",
      "Gibraltar",
      "Guatemala",
      "Honduras",
      "Hong Kong",
      "India",
      "Indonesia",
      "Islandia",
      "Israel",
      "Japón",
      "Liechtenstein",
      "Marruecos",
      "México",
      "Mónaco",
      "Nicaragua",
      "Noruega",
      "Nueva Zelanda",
      "Panamá",
      "Paraguay",
      "Perú",
      "Puerto Rico",
      "Reino Unido",
      "República Dominicana",
      "San Marino",
      "Singapur",
      "Sudáfrica",
      "Suiza",
      "Tailandia",
      "Túnez",
      "Turquía",
      "Ucrania",
      "Uruguay",
      "Venezuela",
    ],
  },
];

export const countryOf = (contact: Pick<Contact, "country">) => contact.country || SPAIN;

/** Why a tax ID can't be saved, or undefined when it is fine. */
export function taxIdError(taxId: string, country: string): string | undefined {
  const check = checkTaxId(taxId, country);
  if (check.valid) return undefined;
  if (check.reason === "empty") return "Introduce un NIF.";
  if (check.reason === "checksum") return "La letra o el dígito de control no es correcto. Revisa el NIF.";
  return country === SPAIN
    ? "El formato del NIF no es correcto. Formatos válidos: 12345678Z (NIF), X1234567L (NIE) o B12345674 (CIF)."
    : "Solo letras y números, sin espacios.";
}

/** Advice that doesn't block saving: what intra-EU invoices need. */
export function taxIdWarning(taxId: string, country: string): string | undefined {
  if (hasEuVatPrefix(taxId, country) === false)
    return "Para operaciones intracomunitarias, el NIF-IVA empieza por el código del país.";
  return undefined;
}

/** "Calle Colón 8, 46004 Valencia, Valencia, España". */
export function formatAddress(contact: Contact): string {
  const town = [contact.postalCode, contact.city].filter(Boolean).join(" ");
  const province = contact.province !== contact.city ? contact.province : undefined;
  return [contact.address, town, province, countryOf(contact)].filter(Boolean).join(", ");
}

/** Intra-EU when it is in another member state and registered in VIES. */
export const isIntraEu = (contact: Contact) => isOtherEuCountry(countryOf(contact)) && !!contact.vies;

/** vCard 3.0 for the address book, as Contasimple's "Descargar vCard". */
export function toVCard(contact: Contact): string {
  const esc = (value: string) => value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(contact.name)}`,
    `ORG:${esc(contact.name)}`,
    contact.email && `EMAIL;TYPE=WORK:${contact.email}`,
    contact.phone && `TEL;TYPE=WORK,VOICE:${contact.phone}`,
    contact.mobile && `TEL;TYPE=CELL:${contact.mobile}`,
    contact.fax && `TEL;TYPE=FAX:${contact.fax}`,
    contact.website && `URL:${contact.website}`,
    `ADR;TYPE=WORK:;;${[contact.address, contact.city, contact.province, contact.postalCode, countryOf(contact)]
      .map((v) => esc(v ?? ""))
      .join(";")}`,
    `NOTE:${esc([`NIF: ${contact.taxId}`, contact.notes].filter(Boolean).join("\n"))}`,
    "END:VCARD",
  ];
  return `${lines.filter(Boolean).join("\r\n")}\r\n`;
}

export function downloadVCard(contact: Contact) {
  const blob = new Blob([toVCard(contact)], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const name = contact.name
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  Object.assign(document.createElement("a"), { href: url, download: `${name || "contacto"}.vcf` }).click();
  URL.revokeObjectURL(url);
}
