import { send } from "./backend";
import type { Entity } from "./commands";
import { createStore } from "./store";

export interface Collection<T extends { id: string }> {
  all: () => T[];
  get: (id: string) => T | undefined;
  /** Subscribes the component to the whole collection. */
  use: () => T[];
  add: (item: T) => Promise<void>;
  update: (id: string, changes: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
}

/**
 * A collection of records kept in memory, written through create, update and
 * delete commands. Changes apply at once; if the backend rejects one, only that
 * record goes back to how it was, so other changes made meanwhile survive.
 */
export function createCollection<T extends { id: string }>(
  entity: Entity,
  initial: T[],
  /** Where new records go: lists that show the newest first keep them at the start. */
  { addAt = "end" }: { addAt?: "start" | "end" } = {},
): Collection<T> {
  const store = createStore(initial);
  const items = store.get;
  const set = store.set;

  return {
    all: items,
    get: (id) => items().find((item) => item.id === id),
    use: store.use,
    subscribe: store.subscribe,

    add(item) {
      set(addAt === "start" ? [item, ...items()] : [...items(), item]);
      return send([{ type: "create", entity, data: item }], () => set(items().filter((other) => other.id !== item.id)));
    },

    update(id, changes) {
      const before = items().find((item) => item.id === id);
      if (!before) return Promise.resolve();
      set(items().map((item) => (item.id === id ? { ...item, ...changes } : item)));
      // Undo only the fields this change touched
      const previous = Object.fromEntries(Object.keys(changes).map((key) => [key, before[key as keyof T]]));
      return send([{ type: "update", entity, id, changes }], () =>
        set(items().map((item) => (item.id === id ? { ...item, ...previous } : item))),
      );
    },

    remove(id) {
      const index = items().findIndex((item) => item.id === id);
      if (index < 0) return Promise.resolve();
      const removed = items()[index]!;
      set(items().filter((item) => item.id !== id));
      return send([{ type: "delete", entity, id }], () => {
        if (items().some((item) => item.id === id)) return;
        const next = [...items()];
        next.splice(Math.min(index, next.length), 0, removed);
        set(next);
      });
    },
  };
}
