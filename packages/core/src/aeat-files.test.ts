import { describe, expect, it } from "vitest";
import {
  aeatAmount,
  aeatBytes,
  aeatFileName,
  aeatText,
  declarationType130,
  declarationTypeWithholdings,
  file111,
  file115,
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

/** Every box of a form at zero, with the given ones on top. */
function boxesOf(count: number, values: Partial<Record<string, number>>): Boxes {
  const all: Boxes = {};
  for (let n = 1; n <= count; n++) all[String(n).padStart(2, "0")] = 0;
  return { ...all, ...values } as Boxes;
}

const boxes130 = (values: Partial<Record<string, number>>) => boxesOf(19, values);

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

describe("declarationTypeWithholdings", () => {
  it("pays a positive result by deposit and files anything else as negative", () => {
    expect(declarationTypeWithholdings(1)).toBe("I");
    expect(declarationTypeWithholdings(0)).toBe("N");
  });
});

describe("file111", () => {
  const form = {
    year: 2026,
    quarter: 2 as const,
    boxes: boxesOf(30, {
      "01": 1,
      "02": eur(600),
      "03": eur(90),
      "07": 3,
      "08": eur(4250.5),
      "09": eur(637.58),
      "28": eur(727.58),
      "30": eur(727.58),
    }),
  };
  const file = file111(form, filer);

  it("wraps one 1000-position page in the envelope", () => {
    expect(file).toHaveLength(17 + 311 + 1000 + 18);
    expect(file.slice(0, 17)).toBe("<T111020262T0000>");
    expect(file.slice(17, 328)).toBe(`<AUX>${" ".repeat(300)}</AUX>`);
    expect(file.slice(-18)).toBe("</T111020262T0000>");
  });

  it("lays out the identification as the record design says", () => {
    expect(field(file, 1, 11)).toBe("<T11101000>");
    expect(field(file, 12, 1)).toBe(" ");
    expect(field(file, 13, 1)).toBe("I");
    expect(field(file, 14, 9)).toBe("50123456Q");
    expect(field(file, 23, 60)).toBe("MARTIN GOMEZ".padEnd(60));
    expect(field(file, 83, 20)).toBe("LUCIA".padEnd(20));
    expect(field(file, 103, 4)).toBe("2026");
    expect(field(file, 107, 2)).toBe("2T");
    expect(field(file, 989, 12)).toBe("</T11101000>");
  });

  it("puts every box at its position, with perceptor counts in 8 positions", () => {
    expect(field(file, 109, 8)).toBe("00000001");
    expect(field(file, 117, 17)).toBe("00000000000060000");
    expect(field(file, 134, 17)).toBe("00000000000009000");
    expect(field(file, 193, 8)).toBe("00000003");
    expect(field(file, 201, 17)).toBe("00000000000425050");
    expect(field(file, 218, 17)).toBe("00000000000063758");
    for (let group = 0; group < 9; group++) {
      const position = 109 + group * 42;
      const n = 1 + group * 3;
      const key = (k: number) => String(k).padStart(2, "0");
      expect(field(file, position, 8), `box ${key(n)}`).toBe(aeatAmount(form.boxes[key(n)]!, 8, false));
      expect(field(file, position + 8, 17), `box ${key(n + 1)}`).toBe(aeatAmount(form.boxes[key(n + 1)]!, 17, false));
      expect(field(file, position + 25, 17), `box ${key(n + 2)}`).toBe(aeatAmount(form.boxes[key(n + 2)]!, 17, false));
    }
    expect(field(file, 487, 17)).toBe("00000000000072758");
    expect(field(file, 504, 17)).toBe("0".repeat(17));
    expect(field(file, 521, 17)).toBe("00000000000072758");
  });

  it("leaves the complementary fields, IBAN and reserved space blank", () => {
    expect(field(file, 538, 1 + 13 + 1 + 34 + 389 + 13)).toBe(" ".repeat(451));
  });

  it("files a return without withholdings as negative with every box at zero", () => {
    const empty = file111({ year: 2026, quarter: 4, boxes: boxesOf(30, {}) }, filer);
    expect(field(empty, 13, 1)).toBe("N");
    expect(field(empty, 109, 9 * 42 + 3 * 17)).toBe("0".repeat(9 * 42 + 3 * 17));
  });

  it("writes box 29 with its sign and refuses negative amounts elsewhere", () => {
    expect(field(file111({ ...form, boxes: { ...form.boxes, "29": eur(-10) } }, filer), 504, 17)).toBe(
      "N0000000000001000",
    );
    expect(() => file111({ ...form, boxes: { ...form.boxes, "09": -1 } }, filer)).toThrow(RangeError);
    expect(() => file111({ ...form, year: 2018 }, filer)).toThrow(RangeError);
  });
});

describe("file115", () => {
  const form = {
    year: 2026,
    quarter: 1 as const,
    boxes: boxesOf(5, { "01": 1, "02": eur(2400), "03": eur(456), "05": eur(456) }),
  };
  const file = file115(form, filer);

  it("wraps one 500-position page in the envelope", () => {
    expect(file).toHaveLength(17 + 311 + 500 + 18);
    expect(file.slice(0, 17)).toBe("<T115020261T0000>");
    expect(file.slice(17, 328)).toBe(`<AUX>${" ".repeat(300)}</AUX>`);
    expect(file.slice(-18)).toBe("</T115020261T0000>");
  });

  it("lays out the identification as the record design says", () => {
    expect(field(file, 1, 11)).toBe("<T11501000>");
    expect(field(file, 12, 1)).toBe(" ");
    expect(field(file, 13, 1)).toBe("I");
    expect(field(file, 14, 9)).toBe("50123456Q");
    expect(field(file, 23, 60)).toBe("MARTIN GOMEZ".padEnd(60));
    expect(field(file, 83, 20)).toBe("LUCIA".padEnd(20));
    expect(field(file, 103, 4)).toBe("2026");
    expect(field(file, 107, 2)).toBe("1T");
    expect(field(file, 489, 12)).toBe("</T11501000>");
  });

  it("puts every box at its position, with the landlord count in 15 positions", () => {
    expect(field(file, 109, 15)).toBe("000000000000001");
    expect(field(file, 124, 17)).toBe("00000000000240000");
    expect(field(file, 141, 17)).toBe("00000000000045600");
    expect(field(file, 158, 17)).toBe("0".repeat(17));
    expect(field(file, 175, 17)).toBe("00000000000045600");
  });

  it("leaves the complementary fields, IBAN and reserved space blank", () => {
    expect(field(file, 192, 1 + 13 + 34 + 236 + 13)).toBe(" ".repeat(297));
  });

  it("files a return without rentals as negative with every box at zero", () => {
    const empty = file115({ year: 2026, quarter: 3, boxes: boxesOf(5, {}) }, filer);
    expect(field(empty, 13, 1)).toBe("N");
    expect(field(empty, 109, 15 + 4 * 17)).toBe("0".repeat(83));
  });

  it("refuses negative amounts and years without a design", () => {
    expect(() => file115({ ...form, boxes: { ...form.boxes, "03": -1 } }, filer)).toThrow(RangeError);
    expect(() => file115({ ...form, year: 2018 }, filer)).toThrow(RangeError);
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
