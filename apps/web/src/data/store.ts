import { useSyncExternalStore } from "react";
import { send } from "./backend";
import type { Command } from "./commands";

export interface Store<S> {
  get: () => S;
  /** Replaces the state without telling the backend: for state only the client keeps, and for undoing. */
  set: (next: S) => void;
  /** Subscribes the component to the whole state. */
  use: () => S;
  /** Replaces the state and sends the commands that describe the change. */
  write: (next: S, commands: Command[]) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Holds one piece of state in memory and lets React components subscribe to it.
 * Writes apply at once (optimistic) and are sent to the backend; a rejected
 * write is undone only if nothing changed the state in the meantime, since
 * undoing it then would also throw away the later change.
 */
export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<() => void>();

  const set = (next: S) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const get = () => state;

  return {
    get,
    set,
    use: () => useSyncExternalStore(subscribe, get),
    write(next, commands) {
      const before = state;
      set(next);
      return send(commands, () => {
        if (state === next) set(before);
      });
    },
    subscribe,
  };
}
