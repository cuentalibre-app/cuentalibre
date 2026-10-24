import { describe, expect, it } from "vitest";
import { addressKey, canLocate, placeUrl, searchUrls, tilePosition, tilesAround, TILE_SIZE } from "./address-map-model";

const address = {
  address: "Calle Saturnino Montojo 39",
  postalCode: "11100",
  city: "San Fernando",
  province: "Cádiz",
  country: "España",
};
const empty = { address: "", postalCode: "", city: "", province: "", country: "España" };

describe("canLocate", () => {
  it("needs a street, postal code or town; the country alone isn't enough", () => {
    expect(canLocate(address)).toBe(true);
    expect(canLocate(empty)).toBe(false);
    expect(canLocate({ ...empty, postalCode: "28004" })).toBe(true);
  });
});

describe("addressKey", () => {
  it("ignores case and surrounding spaces, and changes with any part", () => {
    expect(addressKey({ ...address, city: " san fernando " })).toBe(addressKey(address));
    expect(addressKey({ ...address, postalCode: "11101" })).not.toBe(addressKey(address));
  });
});

describe("searchUrls", () => {
  it("tries a structured search first, then the address as free text", () => {
    const [structured, text] = searchUrls({ ...address, province: "" }).map((u) => new URL(u));
    expect(structured!.origin).toBe("https://nominatim.openstreetmap.org");
    expect(Object.fromEntries(structured!.searchParams)).toMatchObject({
      street: "Calle Saturnino Montojo 39",
      postalcode: "11100",
      city: "San Fernando",
      country: "España",
      limit: "1",
    });
    expect(structured!.searchParams.has("county")).toBe(false);
    expect(text!.searchParams.get("q")).toBe("Calle Saturnino Montojo 39, 11100, San Fernando, España");
  });
});

describe("tilePosition", () => {
  it("maps the world's corners and center to the edges and middle of the grid", () => {
    expect(tilePosition(0, 0, 1)).toEqual({ x: 1, y: 1 });
    const corner = tilePosition(85.0511287798, -180, 3);
    expect(corner.x).toBe(0);
    expect(corner.y).toBeCloseTo(0, 6);
    expect(tilePosition(0, 90, 2).x).toBe(3);
  });
});

describe("tilesAround", () => {
  it("lays the tiles out so the point is at the center", () => {
    const { x, y } = tilePosition(40.4168, -3.7038, 17);
    const tiles = tilesAround(40.4168, -3.7038, 17, 2, 1);
    expect(tiles).toHaveLength(15);
    const middle = tiles[7]!;
    expect(middle.url).toBe(`https://tile.openstreetmap.org/17/${Math.floor(x)}/${Math.floor(y)}.png`);
    expect(middle.top).toBe(Math.round((Math.floor(y) - y) * TILE_SIZE));
    // The center tile starts up to one tile before the point, which falls inside it
    expect(middle.left).toBeLessThanOrEqual(0);
    expect(middle.left).toBeGreaterThan(-TILE_SIZE);
    expect(tiles[8]!.left - middle.left).toBe(TILE_SIZE);
  });
});

describe("placeUrl", () => {
  it("opens the place on openstreetmap.org with a marker", () => {
    expect(placeUrl({ lat: 36.46, lon: -6.2, label: "" })).toBe(
      "https://www.openstreetmap.org/?mlat=36.46&mlon=-6.2#map=18/36.46/-6.2",
    );
  });
});
