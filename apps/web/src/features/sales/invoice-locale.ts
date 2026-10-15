import type { Option } from "./sales-model";

/** Languages a document can be printed in. Empty means the client's default. */
export const LANGUAGES: Option[] = [
  { value: "es", label: "Español" },
  { value: "ca", label: "Catalán" },
  { value: "en", label: "Inglés" },
  { value: "gl", label: "Gallego" },
  { value: "de", label: "Alemán" },
  { value: "fr", label: "Francés" },
  { value: "eu", label: "Euskera" },
];

/** Number and date formats (regions) available for each language. */
export const NUMBER_FORMATS: Record<string, Option[]> = {
  es: [
    { value: "ES", label: "España" },
    { value: "MX", label: "México" },
    { value: "GT", label: "Guatemala" },
    { value: "CR", label: "Costa Rica" },
    { value: "PA", label: "Panamá" },
    { value: "DO", label: "República Dominicana" },
    { value: "VE", label: "Venezuela" },
    { value: "CO", label: "Colombia" },
    { value: "PE", label: "Perú" },
    { value: "AR", label: "Argentina" },
    { value: "EC", label: "Ecuador" },
    { value: "CL", label: "Chile" },
    { value: "UY", label: "Uruguay" },
    { value: "PY", label: "Paraguay" },
    { value: "BO", label: "Bolivia" },
    { value: "SV", label: "El Salvador" },
    { value: "HN", label: "Honduras" },
    { value: "NI", label: "Nicaragua" },
    { value: "PR", label: "Puerto Rico" },
    { value: "US", label: "Estados Unidos" },
  ],
  ca: [{ value: "ES", label: "España" }],
  en: [
    { value: "US", label: "Estados Unidos" },
    { value: "GB", label: "Reino Unido" },
    { value: "AU", label: "Australia" },
    { value: "CA", label: "Canadá" },
    { value: "NZ", label: "Nueva Zelanda" },
    { value: "IE", label: "Irlanda" },
    { value: "ZA", label: "Sudáfrica" },
    { value: "JM", label: "Jamaica" },
    { value: "BZ", label: "Belice" },
    { value: "TT", label: "Trinidad y Tobago" },
    { value: "ZW", label: "Zimbabue" },
    { value: "PH", label: "República de Filipinas" },
    { value: "MY", label: "Malasia" },
    { value: "IN", label: "India" },
    { value: "HK", label: "RAE de Hong Kong" },
    { value: "SG", label: "Singapur" },
  ],
  gl: [{ value: "ES", label: "España" }],
  de: [
    { value: "DE", label: "Alemania" },
    { value: "CH", label: "Suiza" },
    { value: "AT", label: "Austria" },
    { value: "LU", label: "Luxemburgo" },
    { value: "LI", label: "Liechtenstein" },
  ],
  fr: [
    { value: "FR", label: "Francia" },
    { value: "BE", label: "Bélgica" },
    { value: "CA", label: "Canadá" },
    { value: "LU", label: "Luxemburgo" },
    { value: "MC", label: "Mónaco" },
    { value: "CH", label: "Suiza" },
  ],
  eu: [{ value: "ES", label: "España" }],
};

/** First format of a language, used when the language changes. */
export const defaultNumberFormat = (language: string) => NUMBER_FORMATS[language]?.[0]?.value ?? "";

export interface FormatSample {
  negative: string;
  positive: string;
  date: string;
}

/** How amounts and dates print with a language and region, e.g. "en-US" → "(€108.52)". */
export function formatSample(language: string, region: string, today: Date): FormatSample | null {
  if (!language || !region) return null;
  const locale = `${language}-${region}`;
  try {
    const money = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", currencySign: "accounting" });
    const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
    return { negative: money.format(-108.52), positive: money.format(10_846.52), date: date.format(today) };
  } catch {
    return null;
  }
}
