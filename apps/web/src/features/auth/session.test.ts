import { describe, expect, it } from "vitest";
import { resolveApiUrl, returnPath, signInPath, signInQuery } from "./session";

describe("resolveApiUrl", () => {
  it("takes a full URL as it is, without a trailing slash", () => {
    expect(resolveApiUrl("https://api.cuentalibre.es/", "https://app.cuentalibre.es")).toBe(
      "https://api.cuentalibre.es",
    );
  });

  it("puts a path on the app's own origin", () => {
    expect(resolveApiUrl("/", "http://192.168.1.20:3000")).toBe("http://192.168.1.20:3000");
  });

  it("leaves the app on the demo without one", () => {
    expect(resolveApiUrl(undefined, "https://app.cuentalibre.es")).toBeUndefined();
    expect(resolveApiUrl("", "https://app.cuentalibre.es")).toBeUndefined();
  });
});

describe("signing in again", () => {
  it("says the session ended, and comes back to the page", () => {
    const path = signInPath({ back: "/ventas/facturas?periodo=2026-T3", expired: true });
    expect(path).toBe("/entrar?caducada=1&volver=%2Fventas%2Ffacturas%3Fperiodo%3D2026-T3");
    expect(signInQuery(new URL(path, "https://app.cuentalibre.es").searchParams)).toEqual({
      expired: true,
      back: "/ventas/facturas?periodo=2026-T3",
    });
  });

  it("leaves the query out when there is nothing to say", () => {
    expect(signInPath()).toBe("/entrar");
    expect(signInPath({ back: "/" })).toBe("/entrar");
    expect(signInQuery(new URLSearchParams())).toEqual({ expired: false, back: "/" });
  });

  it("only goes back to paths in the app", () => {
    expect(returnPath("/contactos/clientes")).toBe("/contactos/clientes");
    for (const elsewhere of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", null])
      expect(returnPath(elsewhere)).toBe("/");
  });
});
