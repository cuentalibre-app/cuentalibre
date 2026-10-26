import { afterEach, describe, expect, it, vi } from "vitest";
import { localBackend, onCommandError, setBackend, type Backend } from "./backend";
import { createCollection } from "./collection";
import type { Command } from "./commands";
import { createStore } from "./store";

interface Item {
  id: string;
  name: string;
  count: number;
}

const a: Item = { id: "a", name: "A", count: 1 };
const b: Item = { id: "b", name: "B", count: 2 };

/** A backend that records what it receives and rejects when told to. */
function fakeBackend() {
  const sent: Command[][] = [];
  let failing = false;
  const backend: Backend = {
    send(commands) {
      sent.push(commands);
      return failing ? Promise.reject(new Error("rejected")) : Promise.resolve();
    },
  };
  setBackend(backend);
  return { sent, fail: () => (failing = true) };
}

afterEach(() => setBackend(localBackend));

describe("createCollection", () => {
  it("applies changes at once and sends them as commands", async () => {
    const { sent } = fakeBackend();
    const items = createCollection<Item>("tags", [a]);
    const added = items.add(b);
    expect(items.all()).toEqual([a, b]);
    await added;
    await items.update("a", { count: 5 });
    await items.remove("b");
    expect(items.all()).toEqual([{ ...a, count: 5 }]);
    expect(sent).toEqual([
      [{ type: "create", entity: "tags", data: b }],
      [{ type: "update", entity: "tags", id: "a", changes: { count: 5 } }],
      [{ type: "delete", entity: "tags", id: "b" }],
    ]);
  });

  it("adds at the start when asked", () => {
    const items = createCollection<Item>("tags", [a], { addAt: "start" });
    void items.add(b);
    expect(items.all()).toEqual([b, a]);
  });

  it("undoes a rejected create and tells the error listeners", async () => {
    fakeBackend().fail();
    const listener = vi.fn();
    const stop = onCommandError(listener);
    const items = createCollection<Item>("tags", [a]);
    await items.add(b);
    stop();
    expect(items.all()).toEqual([a]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("undoes only the fields a rejected update changed", async () => {
    const backend = fakeBackend();
    const items = createCollection<Item>("tags", [a]);
    backend.fail();
    const rejected = items.update("a", { count: 9 });
    // A later change to another field, made before the rejection arrives, survives
    setBackend(localBackend);
    void items.update("a", { name: "Renamed" });
    await rejected;
    expect(items.get("a")).toEqual({ ...a, name: "Renamed" });
  });

  it("writes a record with its own commands and restores it when they are rejected", async () => {
    const backend = fakeBackend();
    const items = createCollection<Item>("tags", [a]);
    await items.write({ ...a, count: 3 }, [{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15" }]);
    expect(items.all()).toEqual([{ ...a, count: 3 }]);
    expect(backend.sent).toEqual([[{ type: "closeQuarter", period: "2026-T3", closedOn: "2026-10-15" }]]);

    backend.fail();
    await items.write({ ...a, count: 9 }, [{ type: "reopenQuarter", period: "2026-T3" }]);
    await items.write(b, [{ type: "reopenQuarter", period: "2026-T3" }]);
    expect(items.all()).toEqual([{ ...a, count: 3 }]);
  });

  it("puts a record back where it was when its delete is rejected", async () => {
    fakeBackend().fail();
    const items = createCollection<Item>("tags", [a, b]);
    await items.remove("a");
    expect(items.all()).toEqual([a, b]);
  });
});

describe("createStore", () => {
  it("undoes a rejected write when nothing changed since", async () => {
    fakeBackend().fail();
    const store = createStore({ value: 1 });
    await store.write({ value: 2 }, [{ type: "saveSettings", section: "userTour", data: 2 }]);
    expect(store.get()).toEqual({ value: 1 });
  });

  it("keeps a later write when an earlier one is rejected", async () => {
    const backend = fakeBackend();
    const store = createStore({ value: 1 });
    backend.fail();
    const rejected = store.write({ value: 2 }, [{ type: "saveSettings", section: "userTour", data: 2 }]);
    setBackend(localBackend);
    void store.write({ value: 3 }, [{ type: "saveSettings", section: "userTour", data: 3 }]);
    await rejected;
    expect(store.get()).toEqual({ value: 3 });
  });
});
