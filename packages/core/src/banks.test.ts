import { describe, expect, it } from "vitest";
import { bankFromIban } from "./banks";

describe("bankFromIban", () => {
  it("reads the entity code of a Spanish IBAN", () => {
    expect(bankFromIban("ES02 0182 5640 9202 0196 7369")).toBe("bbva");
    expect(bankFromIban("ES7415830001159063663081")).toBe("revolut");
    expect(bankFromIban("ES9121000418450200051332")).toBe("caixabank");
  });

  it("recognises common foreign banks", () => {
    expect(bankFromIban("LT63 3250 0012 3456 7890")).toBe("revolut");
    expect(bankFromIban("DE02 1001 1001 2345 6789 01")).toBe("n26");
    expect(bankFromIban("BE11 9670 1234 5678")).toBe("wise");
  });

  it("returns null for unknown banks, partial numbers and invalid IBANs", () => {
    expect(bankFromIban("ES7620770024003102575766")).toBeNull();
    expect(bankFromIban("7369")).toBeNull();
    expect(bankFromIban("ES03 0182 5640 9202 0196 7369")).toBeNull();
  });
});
