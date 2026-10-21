const env = import.meta.env;
const appUrl = (env.PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

export const appLinks = {
  signIn: `${appUrl}/entrar`,
  signUp: `${appUrl}/registro`,
  demo: `${appUrl}/demo`,
  export: `${appUrl}/exportar`,
  profile: `${appUrl}/configuracion/datos-personales`,
};

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

/** The legal pages, in the order the footers list them. */
export const legalPages = [
  { path: "/aviso-legal", label: "Aviso legal" },
  { path: "/privacidad", label: "Privacidad" },
  { path: "/cookies", label: "Cookies" },
  { path: "/terminos", label: "Términos" },
] as const;

/** Date of the last change to the legal pages. */
export const legalUpdated = "21 de octubre de 2026";
