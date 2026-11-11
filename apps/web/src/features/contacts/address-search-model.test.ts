import { describe, expect, it } from "vitest";
import {
  addressTail,
  pickedAddress,
  searchText,
  candidatesUrl,
  candidatesUrls,
  inArea,
  portalPlace,
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
    const url = new URL(candidatesUrl("gran via 12", { postalCode: "28013", city: "Madrid" }));
    expect(url.searchParams.get("cod_postal_filter")).toBe("28013");
    expect(url.searchParams.has("municipio_filter")).toBe(false);
    expect(new URL(candidatesUrl("gran via 12", { postalCode: "280" })).searchParams.has("cod_postal_filter")).toBe(
      false,
    );
  });

  it("narrows to the town without a postal code", () => {
    const url = new URL(candidatesUrl("gran via 12", { postalCode: "", city: " Madrid " }));
    expect(url.searchParams.get("municipio_filter")).toBe("Madrid");
  });
});

describe("candidatesUrls", () => {
  const filters = (urls: string[]) =>
    urls.map((u) => {
      const p = new URL(u).searchParams;
      return p.get("cod_postal_filter") ?? p.get("municipio_filter") ?? "";
    });

  it("tries the postal code, then the town, then anywhere", () => {
    expect(filters(candidatesUrls("gran via 12", { postalCode: "28013", city: "Madrid" }))).toEqual([
      "28013",
      "Madrid",
      "",
    ]);
  });

  it("skips the searches it has nothing for", () => {
    expect(filters(candidatesUrls("gran via 12", { city: "Madrid" }))).toEqual(["Madrid", ""]);
    expect(filters(candidatesUrls("gran via 12"))).toEqual([""]);
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

describe("pickedAddress", () => {
  const [number] = toSuggestions([candidate({})]);
  it("keeps the floor typed after the number", () => {
    expect(pickedAddress(number!, "saturnino montojo 39, 3B")).toBe("Calle Saturnino Montojo 39, 3B");
    expect(pickedAddress(number!, "saturnino montojo 39")).toBe("Calle Saturnino Montojo 39");
  });
});

describe("toSuggestions", () => {
  it("fills postal code, town and province", () => {
    expect(toSuggestions([candidate({})])).toEqual([
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

  it("suggests the street and number alone, without the floor typed", () => {
    expect(toSuggestions([candidate({})])[0]?.address).toBe("Calle Saturnino Montojo 39");
  });

  it("leaves the postal code empty when a street spans several", () => {
    const [s] = toSuggestions([
      candidate({
        type: "callejero",
        address: "AVENIDA DIAGONAL, Barcelona",
        tip_via: "AVENIDA",
        postalCode: "08005 08006",
        muni: "Barcelona",
        province: "Barcelona",
        portalNumber: null,
      }),
    ]);
    expect(s).toMatchObject({ address: "Avenida Diagonal", postalCode: "", province: "Barcelona", street: true });
  });

  it("uses the Spanish half of a bilingual province without a postal code", () => {
    const [s] = toSuggestions([
      candidate({ type: "callejero", postalCode: null, province: "València/Valencia", portalNumber: null }),
    ]);
    expect(s?.province).toBe("Valencia");
  });

  it("skips repeats and places that aren't streets", () => {
    const list = toSuggestions([
      candidate({ id: "1" }),
      candidate({ id: "2" }),
      candidate({ id: "3", type: "Municipio" }),
    ]);
    expect(list.map((s) => s.id)).toEqual(["1"]);
  });
});

describe("inArea", () => {
  it("matches the postal code, among the several of a long street", () => {
    expect(inArea(candidate({}), { postalCode: "11100", city: "Cádiz" })).toBe(true);
    expect(inArea(candidate({ postalCode: "33010 33199" }), { postalCode: "33199" })).toBe(true);
    expect(inArea(candidate({}), { postalCode: "28013", city: "San Fernando" })).toBe(false);
  });

  it("matches the town without a postal code, ignoring case and accents", () => {
    expect(inArea(candidate({}), { city: "san fernando" })).toBe(true);
    expect(inArea(candidate({ muni: "Cádiz", poblacion: "Cádiz" }), { city: "Cadiz" })).toBe(true);
    expect(inArea(candidate({}), { city: "Zaragoza" })).toBe(false);
  });

  it("trusts nothing without an area", () => {
    expect(inArea(candidate({}), {})).toBe(false);
  });
});

describe("portalPlace", () => {
  const portal = candidate({ lat: 36.465, lng: -6.2 });
  const area = { postalCode: "11100", city: "San Fernando" };

  it("finds the street number typed", () => {
    expect(
      portalPlace([candidate({ portalNumber: 38, lat: 1, lng: 1 }), portal], "Calle Saturnino Montojo 39", area),
    ).toEqual({
      lat: 36.465,
      lon: -6.2,
      label: "Calle Saturnino Montojo 39, 11100 San Fernando, Cádiz",
    });
    expect(portalPlace([portal], "Calle Saturnino Montojo 39, 2º B", area)?.lat).toBe(36.465);
  });

  it("gives up without a number or when it isn't among the candidates", () => {
    expect(portalPlace([portal], "Calle Saturnino Montojo", area)).toBeNull();
    expect(portalPlace([portal], "Calle Saturnino Montojo 41", area)).toBeNull();
  });

  it("ignores the same street number in another town", () => {
    expect(portalPlace([portal], "Calle Saturnino Montojo 39", { city: "Zaragoza" })).toBeNull();
    expect(portalPlace([portal], "Calle Saturnino Montojo 39", {})).toBeNull();
  });
});
