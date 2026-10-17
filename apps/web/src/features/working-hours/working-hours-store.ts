import { useSyncExternalStore } from "react";
import type { TimeEntry } from "@fiscalia/core";
import { initialTimeEntries } from "@/mocks/working-hours";

/** Clock-in/clock-out intervals, in memory until reload like the other stores. */
let entries = initialTimeEntries;
const listeners = new Set<() => void>();

function commit(next: TimeEntry[]) {
  entries = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTimeEntries(): TimeEntry[] {
  return useSyncExternalStore(subscribe, () => entries);
}

export const workingHoursStore = {
  get: () => entries,
  add: (entry: Omit<TimeEntry, "id">) => commit([...entries, { ...entry, id: crypto.randomUUID() }]),
  update: (id: string, patch: Partial<Omit<TimeEntry, "id">>) =>
    commit(entries.map((e) => (e.id === id ? { ...e, ...patch } : e))),
  remove: (id: string) => commit(entries.filter((e) => e.id !== id)),
};
