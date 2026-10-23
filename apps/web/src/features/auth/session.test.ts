import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "./session";

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
