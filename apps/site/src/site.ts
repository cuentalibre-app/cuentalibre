const env = import.meta.env;
const appUrl = (env.PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

export const appLinks = {
  signIn: `${appUrl}/entrar`,
  signUp: `${appUrl}/registro`,
  demo: `${appUrl}/demo`,
  export: `${appUrl}/exportar`,
  profile: `${appUrl}/configuracion/datos-personales`,
};

/**
 * The demo opens in the same tab: Chrome on iPhone lays a tab opened with target="_blank" out under its
 * top toolbar, hiding the demo banner. Leaving the demo brings people back to the page they came from.
 * The layout's script adds the theme the visitor picked here to these links, so the demo opens in it.
 */
export const demoLinkAttrs = { "data-demo-link": "" } as const;

/** Links that leave the site open in a new tab, so the page stays where it was. */
export const externalLinkAttrs = { target: "_blank", rel: "noopener noreferrer" } as const;

export const sourceUrl = "https://github.com/cuentalibre-app/cuentalibre";

/**
 * Who runs this instance: the details the LSSI and the GDPR require the legal
 * pages to publish. They come from the build environment so they stay out of
 * the repository and every instance shows its own.
 */
export const owner = {
  name: env.PUBLIC_OWNER_NAME || "[Nombre del titular]",
  taxId: env.PUBLIC_OWNER_TAX_ID || "[NIF]",
  address: env.PUBLIC_OWNER_ADDRESS || "[Domicilio]",
  email: env.PUBLIC_OWNER_EMAIL || "[Correo de contacto]",
};

/** Monthly price of the Cloud plan, VAT not included. */
export const cloudPrice = "4,99 €";

/**
 * How the Cloud plan can be paid, VAT not included. The landing leads with what
 * each period comes to per month, in euros, and puts the amount actually charged below it.
 */
export const cloudBilling = [
  { id: "monthly", label: "Mensual", perMonth: "4,99", charged: "4,99 € al mes", saving: "" },
  { id: "quarterly", label: "Trimestral", perMonth: "4,49", charged: "13,47 € cada trimestre", saving: "10 %" },
  { id: "yearly", label: "Anual", perMonth: "3,99", charged: "47,88 € al año", saving: "20 %" },
] as const;

/** The legal pages, in the order the footers list them. */
export const legalPages = [
  { path: "/aviso-legal", label: "Aviso legal" },
  { path: "/privacidad", label: "Privacidad" },
  { path: "/cookies", label: "Cookies" },
  { path: "/terminos", label: "Términos" },
] as const;

/** Date of the last change to the legal pages. */
export const legalUpdated = "11 de noviembre de 2026";

/** The groups of the documentation's index, in the order it shows them. */
export const docSections = [
  { id: "start", label: "Empezar" },
  { id: "integrations", label: "Integraciones" },
  { id: "api", label: "Referencia de la API" },
] as const;

export type DocSectionId = (typeof docSections)[number]["id"];
export const docSectionIds = docSections.map((section) => section.id) as [DocSectionId, ...DocSectionId[]];
