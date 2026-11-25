import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";

/*
 * The app's language. Spanish is the source: every text is written in `locales/es.json` first, and a
 * text another language hasn't translated yet shows in Spanish. A per-device preference, like the
 * theme, so it lives in localStorage rather than the account.
 */

/** The languages people can pick, each named in itself. Add one here and in `locales/<code>.json`. */
export const LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

export const SOURCE_LANGUAGE: Language = "es";
const STORAGE_KEY = "cuentalibre:language";

/** Only Spanish ships in the main bundle; the others load when picked. */
const translations = import.meta.glob<{ default: Record<string, unknown> }>(["./locales/*.json", "!./locales/es.json"]);

/** Reads a stored value, taking Spanish for anything missing or unknown. */
export function parseLanguage(raw: string | null): Language {
  return LANGUAGES.find(({ code }) => code === raw)?.code ?? SOURCE_LANGUAGE;
}

function readStorage(): Language {
  try {
    return parseLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return SOURCE_LANGUAGE;
  }
}

async function load(language: Language) {
  if (i18n.hasResourceBundle(language, "translation")) return;
  const module = await translations[`./locales/${language}.json`]?.();
  if (module) i18n.addResourceBundle(language, "translation", module.default);
}

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

/** Starts translation in the stored language; the app renders once it's ready. */
export async function startI18n() {
  const language = readStorage();
  await i18n.use(initReactI18next).init({
    lng: SOURCE_LANGUAGE,
    fallbackLng: SOURCE_LANGUAGE,
    resources: { es: { translation: es } },
    partialBundledLanguages: true,
    // React already escapes what it renders
    interpolation: { escapeValue: false },
  });
  if (language !== SOURCE_LANGUAGE) await setLanguage(language);
}

export async function setLanguage(language: Language) {
  await load(language);
  await i18n.changeLanguage(language);
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage unavailable (private mode): the choice lasts until reload
  }
}
