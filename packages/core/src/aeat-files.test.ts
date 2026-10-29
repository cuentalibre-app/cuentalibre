import { describe, expect, it } from "vitest";
import {
  aeatAmount,
  aeatBytes,
  aeatFileName,
  aeatText,
  declarationType130,
  file130,
  filerTaxId,
  type AeatFiler,
} from "./aeat-files";
import { cents, eurosToCents } from "./money";
import type { Boxes } from "./tax-returns";

const eur = eurosToCents;

const filer: AeatFiler = { taxId: "50123456-q", surnames: "Martín Gómez", name: "Lucía" };

/** A field of the 130's page by its position and length in the record design (1-based). */
const PAGE_START = 329;
const field = (file: string, position: number, length: number) =>
  file.slice(PAGE_START - 1 + position - 1, PAGE_START - 1 + position - 1 + length);

function boxes130(values: Partial<Record<string, number>>): Boxes {
  const all: Boxes = {};
  for (let n = 1; n <= 19; n++) all[String(n).padStart(2, "0")] = 0;
  return { ...all, ...values } as Boxes;
}

describe("aeatText", () => {
  it("upper-cases, drops accents and symbols, keeps Ñ and Ç and pads to the right", () => {
    expect(aeatText("Peña-García, José Mª", 24)).toBe("PEÑA GARCIA JOSE M      ");
    expect(aeatText("Façade l'Hôtel", 14)).toBe("FAÇADE L HOTEL");
  });

  it("cuts what doesn't fit", () => {
    expect(aeatText("Fernández de Córdoba", 9)).toBe("FERNANDEZ");
  });
});

describe("aeatAmount", () => {
  it("writes cents right aligned with zeros", () => {
    expect(aeatAmount(eur(1234.5), 17, false)).toBe("00000000000123450");
    expect(aeatAmount(0, 17, true)).toBe("00000000000000000");
  });

  it("puts an N first on negative amounts of signed fields", () => {
    expect(aeatAmount(eur(-80.25), 17, true)).toBe("N0000000000008025");
  });

  it("rejects negative amounts in unsigned fields and amounts that don't fit", () => {
    expect(() => aeatAmount(-1, 17, false)).toThrow(RangeError);
    expect(() => aeatAmount(1e17, 17, false)).toThrow(RangeError);
    expect(() => aeatAmount(0.5, 17, false)).toThrow(RangeError);
  });
});

describe("filerTaxId", () => {
  it("drops separators and the ES prefix of a VAT number", () => {
    expect(filerTaxId("es 50123456-Q")).toBe("50123456Q");
    expect(filerTaxId("B12345678")).toBe("B12345678");
  });
});

describe("declarationType130", () => {
  it("pays a positive result by deposit", () => {
    expect(declarationType130(cents(100), 2)).toBe("I");
  });

  it("leaves a negative result to deduct until Q3, and files it as negative in Q4", () => {
    expect(declarationType130(cents(-100), 3)).toBe("B");
    expect(declarationType130(cents(-100), 4)).toBe("N");
  });

  it("files a zero result as negative", () => {
    expect(declarationType130(cents(0), 1)).toBe("N");
  });
});

describe("file130", () => {
  const form = {
    year: 2026,
    quarter: 3 as const,
    result: eur(1150),
    boxes: boxes130({
      "01": eur(30000),
      "02": eur(8000.4),
      "03": eur(21999.6),
      "04": eur(4399.92),
      "05": eur(1500),
      "06": eur(1749.92),
      "07": eur(1150),
      "12": eur(1150),
      "14": eur(1150),
      "17": eur(1150),
      "19": eur(1150),
    }),
  };
  const file = file130(form, filer);

  it("wraps one 600-position page in the envelope", () => {
    expect(file).toHaveLength(17 + 311 + 600 + 18);
    expect(file.slice(0, 17)).toBe("<T130020263T0000>");
    expect(file.slice(17, 22)).toBe("<AUX>");
    expect(file.slice(22, 322)).toBe(" ".repeat(300));
    expect(file.slice(322, 328)).toBe("</AUX>");
    expect(file.slice(-18)).toBe("</T130020263T0000>");
  });

  it("lays out the identification as the record design says", () => {
    expect(field(file, 1, 11)).toBe("<T13001000>");
    expect(field(file, 12, 1)).toBe(" ");
    expect(field(file, 13, 1)).toBe("I");
    expect(field(file, 14, 9)).toBe("50123456Q");
    expect(field(file, 23, 60)).toBe("MARTIN GOMEZ".padEnd(60));
    expect(field(file, 83, 20)).toBe("LUCIA".padEnd(20));
    expect(field(file, 103, 4)).toBe("2026");
    expect(field(file, 107, 2)).toBe("3T");
    expect(field(file, 589, 12)).toBe("</T13001000>");
  });

  it("puts every box at its position", () => {
    const positions: Record<string, number> = {
      "01": 109, "02": 126, "03": 143, "04": 160, "05": 177, "06": 194, "07": 211, "08": 228, "09": 245, "10": 262,
      "11": 279, "12": 296, "13": 313, "14": 330, "15": 347, "16": 364, "17": 381, "18": 398, "19": 415,
    }; // prettier-ignore
    expect(field(file, 109, 17)).toBe("00000000003000000");
    expect(field(file, 126, 17)).toBe("00000000000800040");
    for (const [box, position] of Object.entries(positions)) {
      expect(field(file, position, 17), `box ${box}`).toBe(aeatAmount(form.boxes[box]!, 17, true));
    }
  });

  it("leaves the complementary fields, IBAN and reserved space blank", () => {
    expect(field(file, 432, 1 + 13 + 34 + 96 + 13)).toBe(" ".repeat(157));
  });

  it("writes a negative result to deduct with its sign", () => {
    const negative = file130(
      {
        ...form,
        quarter: 2,
        result: eur(-310),
        boxes: boxes130({ "01": eur(5000), "02": eur(2000), "03": eur(3000), "04": eur(600), "06": eur(910), "07": eur(-310), "12": eur(-310), "14": eur(-310), "17": eur(-310), "19": eur(-310) }), // prettier-ignore
      },
      filer,
    );
    expect(field(negative, 13, 1)).toBe("B");
    expect(field(negative, 415, 17)).toBe("N0000000000031000");
    expect(negative.slice(0, 17)).toBe("<T130020262T0000>");
  });

  it("files a return without activity as negative with every box at zero", () => {
    const empty = file130({ year: 2026, quarter: 1, result: cents(0), boxes: boxes130({}) }, filer);
    expect(field(empty, 13, 1)).toBe("N");
    expect(field(empty, 109, 17 * 19)).toBe("0".repeat(17 * 19));
  });

  it("refuses a negative amount in an unsigned box and years without a design", () => {
    expect(() => file130({ ...form, boxes: boxes130({ "06": -1 }) }, filer)).toThrow(RangeError);
    expect(() => file130({ ...form, year: 2018 }, filer)).toThrow(RangeError);
  });
});

describe("aeatFileName", () => {
  it("names the file after the form and period", () => {
    expect(aeatFileName("130", 2026, 3)).toBe("130_2026_3T.txt");
    expect(aeatFileName("390", 2026, null)).toBe("390_2026.txt");
  });
});

describe("aeatBytes", () => {
  it("encodes as ISO-8859-1", () => {
    expect([...aeatBytes("PEÑA")]).toEqual([0x50, 0x45, 0xd1, 0x41]);
    expect(() => aeatBytes("€")).toThrow(RangeError);
  });
});
