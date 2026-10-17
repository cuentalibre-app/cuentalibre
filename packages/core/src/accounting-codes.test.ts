import { describe, expect, it } from "vitest";
import { accountCodeLength, codeError, ledgerAccountNumber, prefixError } from "./accounting-codes";

describe("ledgerAccountNumber", () => {
  it("pads the code after the prefix to the number of digits", () => {
    expect(ledgerAccountNumber("430", "12", 8)).toBe("43000012");
    expect(ledgerAccountNumber("4300", "1", 10)).toBe("4300000001");
  });

  it("treats an empty or all-zero code as zeros", () => {
    expect(ledgerAccountNumber("572", "", 8)).toBe("57200000");
    expect(ledgerAccountNumber("572", "00000", 8)).toBe("57200000");
  });

  it("drops leading zeros that don't fit", () => {
    expect(ledgerAccountNumber("629", "0099999", 8)).toBe("62999999");
  });

  it("rejects codes that don't fit and non-digits", () => {
    expect(ledgerAccountNumber("430", "123456", 8)).toBeNull();
    expect(ledgerAccountNumber("430", "1a", 8)).toBeNull();
    expect(ledgerAccountNumber("43x", "1", 8)).toBeNull();
  });
});

describe("validation", () => {
  it("checks the prefix", () => {
    expect(prefixError("", 8)).toBeDefined();
    expect(prefixError("12345678", 8)).toBeDefined();
    expect(prefixError("430", 8)).toBeUndefined();
  });

  it("counts the digits left for the code", () => {
    expect(accountCodeLength("430", 8)).toBe(5);
    expect(codeError("430", "99999", 8)).toBeUndefined();
    expect(codeError("430", "100000", 8)).toMatch(/5 dígitos/);
  });
});
