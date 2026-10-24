/** The parts of an address the map looks up. */
export interface MapAddress {
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
}

/** A place found on the map. */
export interface Place {
  lat: number;
  lon: number;
  /** How OpenStreetMap names it, for the user to check it's theirs. */
  label: string;
}

export const TILE_SIZE = 256;
/** Close enough to tell the street, far enough to see the neighbourhood. */
export const MAP_ZOOM = 17;

/** Whether there's enough to look up: a street, or a postal code or town. */
export const canLocate = (a: MapAddress) => [a.address, a.postalCode, a.city].some((s) => s.trim());

/** Identifies an address: the map shown belongs to this key until the address changes. */
export const addressKey = (a: MapAddress) =>
  [a.address, a.postalCode, a.city, a.province, a.country].map((s) => s.trim().toLowerCase()).join("|");

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/**
 * The searches on Nominatim (OpenStreetMap's geocoder) to try in order: a
 * structured one, which matches better, then the whole address as free text,
 * which forgives a misspelt street or a number OpenStreetMap doesn't know.
 */
export function searchUrls(a: MapAddress): string[] {
  const base = { format: "jsonv2", limit: "1", "accept-language": "es" };
  const fields: [string, string][] = [
    ["street", a.address],
    ["postalcode", a.postalCode],
    ["city", a.city],
    ["county", a.province],
    ["country", a.country],
  ];
  const structured = new URLSearchParams(base);
  for (const [key, value] of fields) if (value.trim()) structured.set(key, value.trim());
  const text = fields
    .map(([, value]) => value.trim())
    .filter(Boolean)
    .join(", ");
  return [`${NOMINATIM}?${structured}`, `${NOMINATIM}?${new URLSearchParams({ ...base, q: text })}`];
}

/** Where a point falls in the tile grid of a zoom level, in tiles (Web Mercator). */
export function tilePosition(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/**
 * The tiles around a point, and where each goes in pixels from the map's
 * center, so the point sits right in the middle.
 */
export function tilesAround(lat: number, lon: number, zoom: number, across: number, down: number) {
  const { x, y } = tilePosition(lat, lon, zoom);
  const tiles: { url: string; left: number; top: number }[] = [];
  for (let dy = -down; dy <= down; dy++) {
    for (let dx = -across; dx <= across; dx++) {
      const tx = Math.floor(x) + dx;
      const ty = Math.floor(y) + dy;
      tiles.push({
        url: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
        left: Math.round((tx - x) * TILE_SIZE),
        top: Math.round((ty - y) * TILE_SIZE),
      });
    }
  }
  return tiles;
}

/** The place on openstreetmap.org, with a marker. */
export const placeUrl = ({ lat, lon }: Place) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
