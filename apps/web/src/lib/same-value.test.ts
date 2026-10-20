import { describe, expect, it } from "vitest";
import { sameValue } from "./same-value";

describe("sameValue", () => {
  it("ignores the order of keys, as jsonb returns them", () => {
    const draft = { region: "peninsula", activities: [{ id: "a", type: "A05", code: "762" }], fee: 0 };
    const echoed = { fee: 0, region: "peninsula", activities: [{ code: "762", id: "a", type: "A05" }] };
    expect(sameValue(draft, echoed)).toBe(true);
  });

  it("tells apart different values, array order and missing keys", () => {
    expect(sameValue({ fee: 0 }, { fee: 1 })).toBe(false);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(sameValue({ a: null }, { a: 0 })).toBe(false);
    expect(sameValue([], {})).toBe(false);
  });

  it("treats undefined keys as absent, as JSON does", () => {
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
});
