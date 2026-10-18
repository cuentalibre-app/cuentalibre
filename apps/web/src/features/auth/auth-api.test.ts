import { describe, expect, it } from "vitest";
import { AuthError, authErrorMessage, slugFor } from "./auth-api";

describe("slugFor", () => {
  it("makes a URL-safe slug with a unique suffix", () => {
    expect(slugFor("Estudio Peña & Asociados, S.L.")).toMatch(/^estudio-pena-asociados-s-l-[0-9a-f]{8}$/);
    expect(slugFor("¡¡¡")).toMatch(/^empresa-[0-9a-f]{8}$/);
    expect(slugFor("Ana")).not.toBe(slugFor("Ana"));
  });
});

describe("authErrorMessage", () => {
  it("explains known errors in Spanish", () => {
    expect(authErrorMessage(new AuthError("INVALID_EMAIL_OR_PASSWORD"))).toBe(
      "El email o la contraseña no son correctos.",
    );
    expect(authErrorMessage(new AuthError("SOMETHING_ELSE"))).toBe("Algo ha ido mal. Inténtalo de nuevo.");
    expect(authErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "No se puede conectar con el servidor. Inténtalo de nuevo.",
    );
  });
});
