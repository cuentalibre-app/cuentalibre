import { provinceFromPostalCode } from "@cuentalibre/core";
import type { Place } from "./address-map-model";

/**
 * Street suggestions for Spanish addresses from CartoCiudad, the geocoder of
 * the Instituto Geográfico Nacional: free, no key, and it knows every street
 * and street number with its postal code.
 */

/** What CartoCiudad returns for each candidate (only the fields we read). */
export interface Candidate {
  id: string;
  type: string;
  address: string;
  tip_via: string | null;
  postalCode: string | null;
  poblacion: string | null;
  muni: string | null;
  province: string | null;
  portalNumber: number | null;
  extension?: string | null;
  lat?: number;
  lng?: number;
}

/** A street or street number the user can pick, with what it fills in. */
export interface AddressSuggestion {
  id: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  /** A whole street, without a number yet: picking it leaves the user typing the number. */
  street: boolean;
}

const CANDIDATES = "https://www.cartociudad.es/geocoder/api/geocoder/candidates";
/** Kinds of places that aren't a street, so they're never suggested. */
const NOT_STREETS = "municipio,poblacion,toponimo,expendeduria,ngbe,codpost";
const LIMIT = 6;

/** Below this, a search matches too many streets to help. */
export const MIN_QUERY = 3;

/**
 * The search for what the user typed. A postal code already filled in narrows
 * it to that area, which is what makes "gran via 12" find Madrid's.
 */
export function candidatesUrl(query: string, postalCode = "") {
  const params = new URLSearchParams({ q: searchText(query), limit: String(LIMIT), no_process: NOT_STREETS });
  if (/^\d{5}$/.test(postalCode.trim())) params.set("cod_postal_filter", postalCode.trim());
  return `${CANDIDATES}?${params}`;
}

/** Words written in lower case inside a street name, unless they open it. */
const PARTICLES = new Set(["de", "del", "la", "las", "los", "el", "y", "i", "en", "a", "al"]);
const ROMAN = /^[IVXLCDM]+$/;

/** "CALLE DE LA GRAN VIA" → "Calle de la Gran Via". Roman numerals stay as they are. */
export function titleCase(text: string) {
  return text
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (!word) return word;
      if (ROMAN.test(word.toUpperCase()) && word.length > 1 && i > 0) return word.toUpperCase();
      if (i > 0 && PARTICLES.has(word)) return word;
      // Catalan elisions keep the apostrophe lower case: d'Hortons, l'Hospitalet
      const elided = /^([dl]')(.+)$/.exec(word);
      if (elided) return elided[1] + elided[2]!.charAt(0).toUpperCase() + elided[2]!.slice(1);
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * The street line of a candidate, as people write it: "Calle Saturnino
 * Montojo 39". CartoCiudad appends the town ("…, San Fernando" or "… (Arija)"),
 * repeats the street type when it's also the name ("GRAN VIA GRAN VIA") and
 * moves leading particles to the end ("SANT SADURNI (DE)").
 */
export function streetLine(c: Candidate) {
  let street = c.address.includes(", ")
    ? c.address.slice(0, c.address.lastIndexOf(", "))
    : c.address.replace(/ \([^()]*\)$/, "");
  const number = c.portalNumber != null ? `${c.portalNumber}${c.extension ?? ""}` : "";
  if (number && street.endsWith(` ${number}`)) street = street.slice(0, -number.length - 1);
  else if (c.portalNumber != null && street.endsWith(` ${c.portalNumber}`))
    street = street.slice(0, -String(c.portalNumber).length - 1);
  const type = c.tip_via?.trim() ?? "";
  let name = type && street.startsWith(`${type} `) ? street.slice(type.length + 1) : street;
  const particle = /^(.*) \(([^()]+)\)$/.exec(name);
  if (particle) name = `${particle[2]} ${particle[1]}`;
  const parts = type && name !== type ? [type, name] : [name];
  return [titleCase(parts.join(" ")), number].filter(Boolean).join(" ");
}

/**
 * What the user typed after the street number, such as the floor ("39, 2º B"),
 * which CartoCiudad doesn't know and picking a suggestion shouldn't erase.
 */
export function addressTail(query: string) {
  return /\d+\s*[a-z]?\s*,\s*(\S.*)$/i.exec(query.trim())?.[1] ?? "";
}

/** What to search for: the street and number, without the floor that confuses the geocoder. */
export function searchText(query: string) {
  const tail = addressTail(query);
  const text = query.trim();
  return tail ? text.slice(0, text.length - tail.length).replace(/\s*,\s*$/, "") : text;
}

/** The address a pick leaves in the field: a street number keeps the floor the user typed after it. */
export const pickedAddress = (s: AddressSuggestion, typed: string) => {
  const tail = s.street ? "" : addressTail(typed);
  return tail ? `${s.address}, ${tail}` : s.address;
};

/** The candidates worth suggesting, as what each fills in, without repeats. */
export function toSuggestions(candidates: Candidate[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  for (const c of candidates) {
    if (c.type !== "portal" && c.type !== "callejero") continue;
    // A long street spans several postal codes, listed with spaces; then the user picks the number first
    const postalCode = /^\d{5}$/.test(c.postalCode?.trim() ?? "") ? c.postalCode!.trim() : "";
    const street = streetLine(c);
    const suggestion = {
      id: c.id,
      address: street,
      postalCode,
      city: c.muni?.trim() || c.poblacion?.trim() || "",
      // Our own names, so the province reads the same as the one the postal code fills in
      province: provinceFromPostalCode(postalCode) ?? c.province?.split("/").pop()?.trim() ?? "",
      street: c.portalNumber == null,
    };
    const key = [suggestion.address, suggestion.postalCode, suggestion.city].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
  }
  return suggestions;
}

/**
 * Where the street number of an address is, from CartoCiudad's answer. It
 * knows portals OpenStreetMap often lacks, which only finds the street then.
 * Null without a number, or when the number isn't one of the candidates.
 */
export function portalPlace(candidates: Candidate[], address: string): Place | null {
  const number = /\b(\d+)\s*[a-z]?\s*(?:,|$)/i.exec(searchText(address))?.[1];
  if (!number) return null;
  const c = candidates.find((c) => c.type === "portal" && String(c.portalNumber) === number && c.lat && c.lng);
  if (!c) return null;
  const [s] = toSuggestions([c]);
  const place = [[s?.postalCode, s?.city].filter(Boolean).join(" "), s?.province].filter(Boolean).join(", ");
  return { lat: c.lat!, lon: c.lng!, label: [s?.address, place].filter(Boolean).join(", ") };
}
