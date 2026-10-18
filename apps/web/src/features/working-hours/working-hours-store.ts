import { newId, type TimeEntry } from "@fiscalia/core";
import { createCollection } from "@/data/collection";
import { initialTimeEntries } from "@/mocks/working-hours";

/** Clock-in/clock-out intervals. Changes apply instantly and are sent to the backend (see `@/data`). */
const entries = createCollection<TimeEntry>("timeEntries", initialTimeEntries);

export function useTimeEntries(): TimeEntry[] {
  return entries.use();
}

export const workingHoursStore = {
  get: entries.all,
  add: (entry: Omit<TimeEntry, "id">) => entries.add({ ...entry, id: newId() }),
  update: (id: string, patch: Partial<Omit<TimeEntry, "id">>) => entries.update(id, patch),
  remove: entries.remove,
};
