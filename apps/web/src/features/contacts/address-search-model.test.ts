import { describe, expect, it } from "vitest";
import {
  addressTail,
  searchText,
  candidatesUrl,
  streetLine,
  titleCase,
  toSuggestions,
  type Candidate,
} from "./address-search-model";

const candidate = (over: Partial<Candidate>): Candidate => ({
  id: "1",
  type: "portal",
  address: "CALLE SATURNINO MONTOJO 39, San Fernando",
  tip_via: "CALLE",
  postalCode: "11100",
  poblacion: "San Fernando",
  muni: "San Fernando",
  province: "Cádiz",
  portalNumber: 39,
  extension: null,
  ...over,
});

describe("candidatesUrl", () => {
  it("searches streets only", () => {
    const url = new URL(candidatesUrl(" gran via 12 "));
    expect(url.searchParams.get("q")).toBe("gran via 12");
    expect(url.searchParams.get("no_process")).toContain("municipio");
    expect(url.searchParams.has("cod_postal_filter")).toBe(false);
  });

  it("narrows to a postal code already filled in", () => {
    expect(new URL(candidatesUrl("gran via 12", "28013")).searchParams.get("cod_postal_filter")).toBe("28013");
    expect(new URL(candidatesUrl("gran via 12", "280")).searchParams.has("cod_postal_filter")).toBe(false);
  });
});

describe("titleCase", () => {
  it("capitalizes words but not particles or roman numerals", () => {
    expect(titleCase("CALLE DE LA GRAN VIA")).toBe("Calle de la Gran Via");
    expect(titleCase("CALLE ALFONSO XIII")).toBe("Calle Alfonso XIII");
    expect(titleCase("CALLE D'HORTONS")).toBe("Calle d'Hortons");
  });
});

describe("streetLine", () => {
  it("drops the town and keeps the number", () => {
    expect(streetLine(candidate({}))).toBe("Calle Saturnino Montojo 39");
  });

  it("drops a town in brackets", () => {
    expect(streetLine(candidate({ address: "CALLE GRAN VIA 12 (Arija)", portalNumber: 12 }))).toBe("Calle Gran Via 12");
  });

  it("doesn't repeat a street type that is also the name", () => {
    expect(
      streetLine(candidate({ address: "GRAN VIA GRAN VIA 11, Mula", tip_via: "GRAN VIA", portalNumber: 11 })),
    ).toBe("Gran Via 11");
  });

  it("puts a trailing particle back in front", () => {
    expect(
      streetLine(candidate({ address: "CALLE SANT SADURNI (DE), Montornès del Vallès", portalNumber: null })),
    ).toBe("Calle de Sant Sadurni");
  });
});

describe("addressTail", () => {
  it("keeps what follows the street number", () => {
    expect(addressTail("Calle Saturnino Montojo 39, 2º B")).toBe("2º B");
    expect(addressTail("Calle Saturnino Montojo, 39")).toBe("");
    expect(addressTail("Calle Saturnino Montojo")).toBe("");
  });
});

describe("searchText", () => {
  it("leaves the floor out of the search", () => {
    expect(searchText("Calle Saturnino Montojo 39, 2º B")).toBe("Calle Saturnino Montojo 39");
    expect(searchText(" Calle Saturnino Montojo, 39 ")).toBe("Calle Saturnino Montojo, 39");
  });
});

describe("toSuggestions", () => {
  it("fills postal code, town and province", () => {
    expect(toSuggestions([candidate({})], "saturnino montojo 39")).toEqual([
      {
        id: "1",
        address: "Calle Saturnino Montojo 39",
        postalCode: "11100",
        city: "San Fernando",
        province: "Cádiz",
        street: false,
      },
    ]);
  });

  it("keeps the floor the user typed", () => {
    expect(toSuggestions([candidate({})], "saturnino montojo 39, 2º B")[0]?.address).toBe(
      "Calle Saturnino Montojo 39, 2º B",
    );
  });

  it("leaves the postal code empty when a street spans several", () => {
    const [s] = toSuggestions(
      [
        candidate({
          type: "callejero",
          address: "AVENIDA DIAGONAL, Barcelona",
          tip_via: "AVENIDA",
          postalCode: "08005 08006",
          muni: "Barcelona",
          province: "Barcelona",
          portalNumber: null,
        }),
      ],
      "diagonal",
    );
    expect(s).toMatchObject({ address: "Avenida Diagonal", postalCode: "", province: "Barcelona", street: true });
  });

  it("uses the Spanish half of a bilingual province without a postal code", () => {
    const [s] = toSuggestions(
      [candidate({ type: "callejero", postalCode: null, province: "València/Valencia", portalNumber: null })],
      "x",
    );
    expect(s?.province).toBe("Valencia");
  });

  it("skips repeats and places that aren't streets", () => {
    const list = toSuggestions(
      [candidate({ id: "1" }), candidate({ id: "2" }), candidate({ id: "3", type: "Municipio" })],
      "x",
    );
    expect(list.map((s) => s.id)).toEqual(["1"]);
  });
});
