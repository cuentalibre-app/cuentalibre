import { useSyncExternalStore } from "react";
import type { SalesDocument } from "@fiscalia/contracts";

/** Filters the quote and delivery note lists open with; the user can still clear them. */
export interface ListFilterDefaults {
  /** "open" hides the documents already invoiced or rejected. */
  status: "all" | "open";
  /** "month" shows only the documents issued this month. */
  date: "all" | "month";
}

export type FilteredKind = "quote" | "deliveryNote";

export type ListPreferences = Record<FilteredKind, ListFilterDefaults>;

export const DEFAULT_LIST_PREFERENCES: ListPreferences = {
  quote: { status: "all", date: "all" },
  deliveryNote: { status: "all", date: "all" },
};

/** Statuses a quote or delivery note is still pending in. */
export const OPEN_STATUSES: SalesDocument["status"][] = ["created", "sent", "accepted"];

/** In memory until reload, like the other settings. */
let preferences = DEFAULT_LIST_PREFERENCES;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useListPreferences(): ListPreferences {
  return useSyncExternalStore(subscribe, () => preferences);
}

export const listPreferencesStore = {
  get: () => preferences,
  update(next: ListPreferences) {
    preferences = next;
    listeners.forEach((listener) => listener());
  },
};
