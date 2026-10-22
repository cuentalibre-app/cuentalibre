import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

/** Loads the module afresh, as a reload would. */
async function load() {
  vi.resetModules();
  return import("./list-preferences");
}

describe("list preferences", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the saved preferences after a reload", async () => {
    const first = await load();
    const chosen = {
      quote: { status: "open", date: "month" },
      deliveryNote: { status: "all", date: "month" },
    } as const;
    first.listPreferencesStore.update(chosen);

    const reloaded = await load();
    expect(reloaded.listPreferencesStore.get()).toEqual(chosen);
  });

  it("falls back to the defaults for missing or unexpected values", async () => {
    vi.stubGlobal(
      "localStorage",
      fakeStorage({ "cuentalibre:list-preferences": JSON.stringify({ quote: { status: "open", date: "year" } }) }),
    );
    const { listPreferencesStore } = await load();
    expect(listPreferencesStore.get()).toEqual({
      quote: { status: "open", date: "all" },
      deliveryNote: { status: "all", date: "all" },
    });
  });

  it("uses the defaults when storage is unreadable", async () => {
    vi.stubGlobal("localStorage", fakeStorage({ "cuentalibre:list-preferences": "{not json" }));
    const { listPreferencesStore, DEFAULT_LIST_PREFERENCES } = await load();
    expect(listPreferencesStore.get()).toEqual(DEFAULT_LIST_PREFERENCES);
  });
});
