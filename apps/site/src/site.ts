const env = import.meta.env;
const appUrl = (env.PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

export const appLinks = {
  signIn: `${appUrl}/entrar`,
  signUp: `${appUrl}/registro`,
  demo: `${appUrl}/demo`,
  export: `${appUrl}/exportar`,
  profile: `${appUrl}/configuracion/datos-personales`,
};

/** The demo opens in its own tab, so leaving it brings people back to the page they were reading. */
export const demoLinkAttrs = { target: "_blank", rel: "noopener" } as const;

export const sourceUrl = "https://github.com/jesuspb2/cuentalibre";

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

/** Price of the Cloud plan, VAT included. */
export const cloudPrice = "4,99 €";

/** Price of the Cloud plan paid yearly. */
export const cloudYearlyPrice = "34,99 €";

/** The legal pages, in the order the footers list them. */
export const legalPages = [
  { path: "/aviso-legal", label: "Aviso legal" },
  { path: "/privacidad", label: "Privacidad" },
  { path: "/cookies", label: "Cookies" },
  { path: "/terminos", label: "Términos" },
] as const;

/** Date of the last change to the legal pages. */
export const legalUpdated = "21 de octubre de 2026";

/** The groups of the documentation's index, in the order it shows them. */
export const docSections = [
  { id: "start", label: "Empezar" },
  { id: "integrations", label: "Integraciones" },
  { id: "api", label: "Referencia de la API" },
] as const;

export type DocSectionId = (typeof docSections)[number]["id"];
export const docSectionIds = docSections.map((section) => section.id) as [DocSectionId, ...DocSectionId[]];
