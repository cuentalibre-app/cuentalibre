import { useSyncExternalStore } from "react";
import type { SalesDocument } from "@cuentalibre/contracts";

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

const STORAGE_KEY = "cuentalibre:list-preferences";

/** Keeps each known value saved, and the default for anything missing or unexpected. */
function readStored(): ListPreferences {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const stored = (parsed && typeof parsed === "object" ? parsed : {}) as Partial<Record<FilteredKind, unknown>>;
    const read = (kind: FilteredKind): ListFilterDefaults => {
      const value = (stored[kind] ?? {}) as Partial<Record<keyof ListFilterDefaults, unknown>>;
      return {
        status: value.status === "open" ? "open" : "all",
        date: value.date === "month" ? "month" : "all",
      };
    };
    return { quote: read("quote"), deliveryNote: read("deliveryNote") };
  } catch {
    return DEFAULT_LIST_PREFERENCES;
  }
}

/**
 * A view preference remembered per browser. The user's own settings aren't stored on
 * the server yet; when they are, this belongs with them so it follows the user.
 */
let preferences = readStored();
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the choice then lasts until reload
    }
    listeners.forEach((listener) => listener());
  },
};
