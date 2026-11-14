import { describe, expect, it } from "vitest";
import { isDark, parseAppearance } from "./appearance";

describe("parseAppearance", () => {
  it("defaults to the system theme", () => {
    expect(parseAppearance(null)).toEqual({ theme: "system" });
    expect(parseAppearance("{not json")).toEqual({ theme: "system" });
  });

  it("keeps known values and replaces unknown ones", () => {
    expect(parseAppearance('{"theme":"dark"}')).toEqual({ theme: "dark" });
    expect(parseAppearance('{"theme":"sepia"}')).toEqual({ theme: "system" });
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
