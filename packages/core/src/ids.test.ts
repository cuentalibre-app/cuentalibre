import { describe, expect, it } from "vitest";
import { createIdGenerator, isUuidV7, newId } from "./ids";

const zeros = (bytes: Uint8Array) => bytes.fill(0);
const ones = (bytes: Uint8Array) => bytes.fill(0xff);

describe("newId", () => {
  it("returns a UUIDv7", () => {
    expect(isUuidV7(newId())).toBe(true);
  });

  it("returns distinct, increasing IDs", () => {
    const ids = Array.from({ length: 10_000 }, () => newId());
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe("createIdGenerator", () => {
  it("encodes the timestamp, version and variant", () => {
    const next = createIdGenerator({ now: () => 0x0190_1234_5678, random: zeros });
    expect(next()).toBe("01901234-5678-7000-8000-000000000000");
  });

  it("keeps the random bits outside the version and variant", () => {
    const next = createIdGenerator({ now: () => 0, random: ones });
    expect(next()).toBe("00000000-0000-7007-bfff-ffffffffffff");
  });

  it("increments the counter within the same millisecond", () => {
    const next = createIdGenerator({ now: () => 1000, random: zeros });
    expect([next(), next(), next()]).toEqual([
      "00000000-03e8-7000-8000-000000000000",
      "00000000-03e8-7001-8000-000000000000",
      "00000000-03e8-7002-8000-000000000000",
    ]);
  });

  it("stays monotonic if the clock goes back", () => {
    let ms = 2000;
    const next = createIdGenerator({ now: () => ms, random: zeros });
    const first = next();
    ms = 1000;
    expect(next() > first).toBe(true);
  });

  it("moves to the next millisecond when the counter overflows", () => {
    const next = createIdGenerator({ now: () => 1000, random: zeros });
    for (let i = 0; i < 0xfff; i++) next();
    expect(next()).toBe("00000000-03e8-7fff-8000-000000000000");
    expect(next()).toBe("00000000-03e9-7000-8000-000000000000");
  });
});

describe("isUuidV7", () => {
  it("rejects other UUID versions and legacy IDs", () => {
    expect(isUuidV7("6ba7b810-9dad-41d1-80b4-00c04fd430c8")).toBe(false);
    expect(isUuidV7("c1")).toBe(false);
  });
});
