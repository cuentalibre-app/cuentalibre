import { describe, expect, it } from "vitest";
import { splitLinks } from "./links";

describe("splitLinks", () => {
  it("keeps text without addresses whole", () => {
    expect(splitLinks("Ve a Ventas.")).toEqual([{ text: "Ve a Ventas." }]);
  });

  it("leaves the closing punctuation out of the address", () => {
    expect(splitLinks("Lee la guía (https://cuentalibre.es/docs/facturas).")).toEqual([
      { text: "Lee la guía (" },
      { href: "https://cuentalibre.es/docs/facturas" },
      { text: ")." },
    ]);
  });

  it("finds several addresses", () => {
    expect(splitLinks("https://a.es y https://b.es/x?y=1")).toEqual([
      { href: "https://a.es" },
      { text: " y " },
      { href: "https://b.es/x?y=1" },
    ]);
  });
});
