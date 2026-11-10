import { describe, expect, it } from "vitest";
import { isDark, parseAppearance } from "./appearance";

describe("parseAppearance", () => {
  it("defaults to the system theme and the aurora backdrop", () => {
    expect(parseAppearance(null)).toEqual({ theme: "system", backdrop: "aurora" });
    expect(parseAppearance("{not json")).toEqual({ theme: "system", backdrop: "aurora" });
  });

  it("keeps known values and replaces unknown ones", () => {
    expect(parseAppearance('{"theme":"dark","backdrop":"forest"}')).toEqual({ theme: "dark", backdrop: "forest" });
    expect(parseAppearance('{"theme":"sepia","backdrop":"plain"}')).toEqual({ theme: "system", backdrop: "plain" });
  });
});

describe("isDark", () => {
  it("follows the system only on the system theme", () => {
    expect(isDark("system", true)).toBe(true);
    expect(isDark("system", false)).toBe(false);
    expect(isDark("light", true)).toBe(false);
    expect(isDark("dark", false)).toBe(true);
  });
});
