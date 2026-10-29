import { describe, expect, it } from "vitest";
import {
  aeatAmount,
  aeatBytes,
  aeatFileName,
  aeatText,
  declarationType130,
  declarationType303,
  declarationTypeWithholdings,
  file111,
  file115,
  file130,
  file303,
  file349,
  FIRST_YEAR_303,
  filerTaxId,
  period349,
  type AeatFiler,
  type Return303,
  type Return349,
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

describe("declarationType303", () => {
  it("pays a positive result by deposit and files a zero result as such", () => {
    expect(declarationType303(cents(100), 1, false)).toBe("I");
    expect(declarationType303(cents(0), 4, true)).toBe("N");
  });

  it("carries a negative result forward, or asks for a refund in Q4", () => {
    expect(declarationType303(cents(-100), 3, true)).toBe("C");
    expect(declarationType303(cents(-100), 4, false)).toBe("C");
    expect(declarationType303(cents(-100), 4, true)).toBe("D");
  });
});

describe("file303", () => {
  /** Rates the 303 prints on its rows, as model303 fills them. */
  const RATES = { "151": 0, "02": 4, "05": 10, "08": 21, "157": 1.75, "169": 0.5, "20": 1.4, "23": 5.2, "65": 100 };
  const form: Return303 = {
    year: 2026,
    quarter: 3,
    result: eur(1_670),
    hasActivity: true,
    refund: false,
    cashBasis: false,
    annual: null,
    boxes: {
      ...RATES,
      "07": eur(10_000),
      "09": eur(2_100),
      "14": eur(-200),
      "15": eur(-42),
      "27": eur(2_058),
      "28": eur(1_000),
      "29": eur(210),
      "45": eur(210),
      "46": eur(1_848),
      "59": eur(3_000),
      "64": eur(1_848),
      "66": eur(1_848),
      "110": eur(500),
      "78": eur(178),
      "87": eur(322),
      "69": eur(1_670),
      "71": eur(1_670),
    },
  };
  const file = file303(form, filer);

  /** Pages in the file: page 1 (1581), page 3 (1017), optionally page 4 (998), and the bank page (823). */
  const PAGE_3 = PAGE_START + 1581;
  const at = (start: number) => (text: string, position: number, length: number) =>
    text.slice(start - 1 + position - 1, start - 1 + position - 1 + length);
  const page1 = at(PAGE_START);
  const page3 = at(PAGE_3);

  it("wraps pages 1 and 3 and the bank page in the envelope", () => {
    expect(file).toHaveLength(17 + 311 + 1581 + 1017 + 823 + 18);
    expect(file.slice(0, 17)).toBe("<T303020263T0000>");
    expect(file.slice(17, 328)).toBe(`<AUX>${" ".repeat(300)}</AUX>`);
    expect(page1(file, 1, 11)).toBe("<T30301000>");
    expect(page1(file, 1570, 12)).toBe("</T30301000>");
    expect(page3(file, 1, 11)).toBe("<T30303000>");
    expect(page3(file, 1006, 12)).toBe("</T30303000>");
    expect(file.slice(-18 - 823, -18)).toBe(`<T303DID00>${" ".repeat(182)}0${" ".repeat(617)}</T303DID00>`);
    expect(file.slice(-18)).toBe("</T303020263T0000>");
  });

  it("lays out the identification as the record design says", () => {
    expect(page1(file, 12, 1)).toBe(" ");
    expect(page1(file, 13, 1)).toBe("I");
    expect(page1(file, 14, 9)).toBe("50123456Q");
    expect(page1(file, 23, 80)).toBe("MARTIN GOMEZ LUCIA".padEnd(80));
    expect(page1(file, 103, 4)).toBe("2026");
    expect(page1(file, 107, 2)).toBe("3T");
    // Common territory, no REDEME, only the general regime, no joint return, no cash basis…
    expect(page1(file, 109, 6)).toBe("223222");
    // …no special proration, no insolvency, no SII, and the Q4 and fuel flags at zero
    expect(page1(file, 115, 16)).toBe("222" + " ".repeat(9) + "2000");
  });

  it("puts the general regime boxes at their 2026 positions", () => {
    expect(page1(file, 131, 17)).toBe("0".repeat(17)); // [150]
    expect(page1(file, 148, 5)).toBe("00000"); // [151]
    expect(page1(file, 170, 17 + 5 + 17)).toBe("0".repeat(39)); // [165] [166] [167]
    expect(page1(file, 226, 5)).toBe("00400"); // [02]
    expect(page1(file, 265, 5)).toBe("00000"); // [154]
    expect(page1(file, 304, 5)).toBe("01000"); // [05]
    expect(page1(file, 326, 17)).toBe("00000000001000000"); // [07]
    expect(page1(file, 343, 5)).toBe("02100"); // [08]
    expect(page1(file, 348, 17)).toBe("00000000000210000"); // [09]
    expect(page1(file, 433, 17)).toBe("N0000000000020000"); // [14]
    expect(page1(file, 450, 17)).toBe("N0000000000004200"); // [15]
    expect(page1(file, 484, 5)).toBe("00175"); // [157]
    expect(page1(file, 523, 5)).toBe("00050"); // [169]
    expect(page1(file, 562, 5)).toBe("00000"); // [17]
    expect(page1(file, 601, 5)).toBe("00140"); // [20]
    expect(page1(file, 640, 5)).toBe("00520"); // [23]
    expect(page1(file, 696, 17)).toBe("00000000000205800"); // [27]
    expect(page1(file, 713, 17)).toBe("00000000000100000"); // [28]
    expect(page1(file, 730, 17)).toBe("00000000000021000"); // [29]
    expect(page1(file, 1002, 17)).toBe("00000000000021000"); // [45]
    expect(page1(file, 1019, 17)).toBe("00000000000184800"); // [46]
    expect(page1(file, 1036, 521 + 13)).toBe(" ".repeat(534));
  });

  it("puts the additional information and the result on page 3", () => {
    expect(page3(file, 12, 17)).toBe("00000000000300000"); // [59]
    expect(page3(file, 199, 17)).toBe("00000000000184800"); // [64]
    expect(page3(file, 216, 5)).toBe("10000"); // [65]
    expect(page3(file, 221, 17)).toBe("00000000000184800"); // [66]
    expect(page3(file, 255, 17)).toBe("00000000000050000"); // [110]
    expect(page3(file, 272, 17)).toBe("00000000000017800"); // [78]
    expect(page3(file, 289, 17)).toBe("00000000000032200"); // [87]
    expect(page3(file, 340, 17)).toBe("00000000000167000"); // [69]
    expect(page3(file, 408, 17)).toBe("00000000000167000"); // [71]
    expect(page3(file, 425, 1)).toBe(" ");
    expect(page3(file, 426, 1 + 13 + 1)).toBe(" ".repeat(15));
    expect(page3(file, 441, 17)).toBe("0".repeat(17)); // [111]
    expect(page3(file, 458, 2 + 546)).toBe(" ".repeat(548));
  });

  it("files a negative result to carry forward with its sign", () => {
    const negative = file303(
      { ...form, quarter: 1, result: eur(-120), boxes: { ...RATES, "29": eur(120), "45": eur(120), "46": eur(-120), "64": eur(-120), "66": eur(-120), "69": eur(-120), "71": eur(-120) } }, // prettier-ignore
      filer,
    );
    expect(page1(negative, 13, 1)).toBe("C");
    expect(page1(negative, 1019, 17)).toBe("N0000000000012000");
    expect(page3(negative, 408, 17)).toBe("N0000000000012000");
    expect(negative.slice(0, 17)).toBe("<T303020261T0000>");
  });

  it("asks for a refund in Q4 when told to", () => {
    const q4 = { ...form, quarter: 4 as const, result: eur(-120), boxes: { ...RATES, "71": eur(-120) } };
    expect(page1(file303({ ...q4, refund: true }, filer), 13, 1)).toBe("D");
    expect(page1(file303(q4, filer), 13, 1)).toBe("C");
    // The proration flags are answered with a no, and the filer files form 390
    expect(page1(file303(q4, filer), 115, 15)).toBe("22" + "2" + " ".repeat(9) + "220");
  });

  it("marks a return without activity and leaves the mark off when there is something to carry", () => {
    const empty = file303({ ...form, quarter: 2, result: cents(0), hasActivity: false, boxes: { ...RATES } }, filer);
    expect(page1(empty, 13, 1)).toBe("N");
    expect(page3(empty, 425, 1)).toBe("X");
    const carrying = file303({ ...form, result: cents(0), hasActivity: false, boxes: { ...RATES, "110": eur(50), "87": eur(50) } }, filer); // prettier-ignore
    expect(page1(carrying, 13, 1)).toBe("N");
    expect(page3(carrying, 425, 1)).toBe(" ");
  });

  it("flags the cash accounting regime", () => {
    expect(page1(file303({ ...form, cashBasis: true }, filer), 113, 1)).toBe("1");
  });

  it("adds page 4 in Q4 for filers exempt from form 390", () => {
    const exempt = file303(
      {
        ...form,
        quarter: 4,
        annual: {
          activities: [
            { type: "A05", code: "751" },
            { type: "A03", code: "843.9" },
          ],
          thirdParties: true,
          boxes: { "80": eur(40_000), "93": eur(3_000), "88": eur(43_000), "107": 100 },
        },
      },
      filer,
    );
    expect(exempt).toHaveLength(17 + 311 + 1581 + 1017 + 998 + 823 + 18);
    expect(page1(exempt, 128, 2)).toBe("11");
    const page4 = at(PAGE_3 + 1017);
    expect(page4(exempt, 1, 12)).toBe("<T30304000> ");
    expect(page4(exempt, 13, 42)).toBe("A05751 A038439" + " ".repeat(28));
    expect(page4(exempt, 55, 1)).toBe("X");
    expect(page4(exempt, 56, 25)).toBe("00000000000000000000" + "10000");
    expect(page4(exempt, 81, 17)).toBe("00000000004000000"); // [80]
    expect(page4(exempt, 115, 17)).toBe("00000000000300000"); // [93]
    expect(page4(exempt, 370, 17)).toBe("00000000004300000"); // [88]
    expect(page4(exempt, 387, 600)).toBe(" ".repeat(600));
    expect(page4(exempt, 987, 12)).toBe("</T30304000>");
  });

  it("flags a filer exempt from form 390 without operations", () => {
    const idle = file303({ ...form, quarter: 4, annual: { activities: [], thirdParties: false, boxes: {} } }, filer);
    expect(page1(idle, 128, 2)).toBe("12");
  });

  it("follows the 2025 design for 2025 returns", () => {
    const old = file303({ ...form, year: 2025 }, filer);
    expect(old).toHaveLength(17 + 311 + 1581 + 1017 + 823 + 18);
    expect(old.slice(0, 17)).toBe("<T303020253T0000>");
    expect(page1(old, 128, 3)).toBe("000"); // no fuel flag: box 150 starts at 130
    expect(page1(old, 186, 5)).toBe("00400"); // [02]
    expect(page1(old, 286, 17)).toBe("00000000001000000"); // [07]
    expect(page1(old, 303, 5)).toBe("02100"); // [08]
    expect(page1(old, 393, 17)).toBe("N0000000000020000"); // [14]
    expect(page1(old, 940, 17)).toBe("00000000000184800"); // [46]
    expect(page1(old, 957, 17 + 5 + 17)).toBe("0".repeat(39)); // [165] [166] [167]
    expect(page1(old, 1013, 5)).toBe("00050"); // [169]
    expect(page1(old, 1035, 522 + 13)).toBe(" ".repeat(535));
    expect(page3(old, 323, 17)).toBe("00000000000167000"); // [69]
    expect(page3(old, 374, 17)).toBe("00000000000167000"); // [71]
    expect(page3(old, 391, 1)).toBe(" ");
    expect(page3(old, 407, 17)).toBe("0".repeat(17)); // [108]
    expect(page3(old, 424, 17 + 120 + 2 + 443)).toBe(" ".repeat(582));
  });

  it("refuses a negative amount in an unsigned box and years without a design", () => {
    expect(() => file303({ ...form, boxes: { ...form.boxes, "29": -1 } }, filer)).toThrow(RangeError);
    expect(() => file303({ ...form, year: FIRST_YEAR_303 - 1 }, filer)).toThrow(RangeError);
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

describe("period349", () => {
  it("codes quarters, months and the first two months of a quarter", () => {
    expect(period349([3, 4, 5])).toEqual({ period: "2T", bimonthly: false });
    expect(period349([10])).toEqual({ period: "11", bimonthly: false });
    expect(period349([6, 7])).toEqual({ period: "08", bimonthly: true });
  });

  it("has no code for the year or loose months", () => {
    expect(period349(Array.from({ length: 12 }, (_, m) => m))).toBeNull();
    expect(period349([1, 2])).toBeNull();
    expect(period349([])).toBeNull();
  });
});

describe("file349", () => {
  const form: Return349 = {
    year: 2026,
    period: "3T",
    bimonthly: false,
    operations: [
      { code: "DE", number: "123456789", name: "Müller Maschinen GmbH", key: "E", base: eur(12500.4) },
      { code: "FR", number: "12345678901", name: "Société Générale d'Études", key: "S", base: eur(3000) },
      { code: "DE", number: "123456789", name: "Müller Maschinen GmbH", key: "I", base: eur(250) },
    ],
    rectifications: [
      {
        code: "IE",
        number: "6364992H",
        name: "Cloud Hosting Ltd",
        key: "I",
        base: eur(80),
        year: 2026,
        period: "1T",
        declared: eur(120.5),
      },
    ],
  };
  const records = (file: string) => file.split("\r\n").slice(0, -1);
  /** A field of a record by its position and length in the record design (1-based). */
  const at = (record: string, position: number, length: number) => record.slice(position - 1, position - 1 + length);

  it("writes 500-position records, one per line", () => {
    const file = file349(form, { ...filer, phone: "+34 600 12 34 56" });
    expect(file.endsWith("\r\n")).toBe(true);
    const lines = records(file);
    expect(lines).toHaveLength(5);
    for (const line of lines) expect(line).toHaveLength(500);
  });

  it("opens with the declarant and the totals", () => {
    const [declarant] = records(file349(form, { ...filer, phone: "+34 600 12 34 56" }));
    expect(at(declarant!, 1, 17)).toBe("1349202650123456Q");
    expect(at(declarant!, 18, 40)).toBe("MARTIN GOMEZ LUCIA".padEnd(40));
    expect(at(declarant!, 58, 1)).toBe(" ");
    expect(at(declarant!, 59, 9)).toBe("600123456");
    expect(at(declarant!, 68, 40)).toBe("MARTIN GOMEZ LUCIA".padEnd(40));
    expect(at(declarant!, 108, 13)).toBe("3490000000000");
    expect(at(declarant!, 121, 2)).toBe("  ");
    expect(at(declarant!, 123, 13)).toBe("0".repeat(13));
    expect(at(declarant!, 136, 2)).toBe("3T");
    expect(at(declarant!, 138, 9)).toBe("000000003");
    expect(at(declarant!, 147, 15)).toBe("000000001575040");
    expect(at(declarant!, 162, 9)).toBe("000000001");
    expect(at(declarant!, 171, 15)).toBe("000000000008000");
    expect(at(declarant!, 186, 315)).toBe(" ".repeat(315));
  });

  it("writes one record per operator and key", () => {
    const [, first, second] = records(file349(form, filer));
    expect(at(first!, 1, 17)).toBe("2349202650123456Q");
    expect(at(first!, 18, 58)).toBe(" ".repeat(58));
    expect(at(first!, 76, 17)).toBe("DE123456789      ");
    expect(at(first!, 93, 40)).toBe("MULLER MASCHINEN GMBH".padEnd(40));
    expect(at(first!, 133, 1)).toBe("E");
    expect(at(first!, 134, 13)).toBe("0000001250040");
    expect(at(first!, 147, 354)).toBe(" ".repeat(354));
    expect(at(second!, 76, 17)).toBe("FR12345678901    ");
    expect(at(second!, 93, 40)).toBe("SOCIETE GENERALE D ETUDES".padEnd(40));
    expect(at(second!, 133, 14)).toBe("S0000000300000");
  });

  it("follows with the rectifications of earlier periods", () => {
    const rectification = records(file349(form, filer))[4]!;
    expect(at(rectification, 1, 17)).toBe("2349202650123456Q");
    expect(at(rectification, 76, 17)).toBe("IE6364992H       ");
    expect(at(rectification, 133, 1)).toBe("I");
    expect(at(rectification, 134, 13)).toBe(" ".repeat(13));
    expect(at(rectification, 147, 6)).toBe("20261T");
    expect(at(rectification, 153, 13)).toBe("0000000008000");
    expect(at(rectification, 166, 13)).toBe("0000000012050");
    expect(at(rectification, 179, 322)).toBe(" ".repeat(322));
  });

  it("marks a return of the first two months of a quarter and fills in a missing phone with zeros", () => {
    const [declarant] = records(file349({ ...form, period: "05", bimonthly: true }, filer));
    expect(at(declarant!, 59, 9)).toBe("000000000");
    expect(at(declarant!, 136, 2)).toBe("05");
    expect(at(declarant!, 186, 1)).toBe("X");
  });

  it("files a period without operations as the declarant record alone", () => {
    const lines = records(file349({ ...form, operations: [], rectifications: [] }, filer));
    expect(lines).toHaveLength(1);
    expect(at(lines[0]!, 138, 48)).toBe("0".repeat(48));
  });

  it("matches a file the sede imports, record for record", () => {
    // A 4T return as another program exports it, with the declarant changed and our receipt number
    const file = file349(
      {
        year: 2026,
        period: "4T",
        bimonthly: false,
        operations: [
          { code: "CY", number: "10313492Q", name: "Nicosia Testing Ltd", key: "S", base: eur(4750) },
          { code: "IE", number: "4143435AH", name: "Dublin Cloud Limited", key: "I", base: eur(19.01) },
          { code: "IE", number: "4276970QH", name: "Cork Models, Limited", key: "I", base: eur(18) },
        ],
        rectifications: [],
      },
      { ...filer, phone: "600123456" },
    );
    const name = "MARTIN GOMEZ LUCIA".padEnd(40);
    const head = "2349202650123456Q" + " ".repeat(58);
    expect(records(file)).toEqual([
      (
        "1349202650123456Q" +
        name +
        " 600123456" +
        name +
        "3490000000000  " +
        "0".repeat(13) +
        "4T000000003000000000478701000000000000000000000000"
      ).padEnd(500),
      (head + "CY10313492Q      " + "NICOSIA TESTING LTD".padEnd(40) + "S0000000475000").padEnd(500),
      (head + "IE4143435AH      " + "DUBLIN CLOUD LIMITED".padEnd(40) + "I0000000001901").padEnd(500),
      (head + "IE4276970QH      " + "CORK MODELS LIMITED".padEnd(40) + "I0000000001800").padEnd(500),
    ]);
  });

  it("rejects negative bases and years before the design", () => {
    const negative = { ...form.operations[0]!, base: eur(-10) };
    expect(() => file349({ ...form, operations: [negative] }, filer)).toThrow(RangeError);
    expect(() => file349({ ...form, year: 2020 }, filer)).toThrow(RangeError);
  });
});
