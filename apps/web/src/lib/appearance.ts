import { useSyncExternalStore } from "react";

/*
 * How the app looks on this device: light, dark or following the system. A per-device preference, so it lives in localStorage rather than the account.
 * `public/appearance.js` applies the same stored value before the first paint; keep the key, the
 * shape and the theme colours in step with it.
 */

export type Theme = "light" | "dark" | "system";

export interface Appearance {
  theme: Theme;
}

export const THEMES: readonly Theme[] = ["light", "dark", "system"];

const STORAGE_KEY = "cuentalibre:appearance";
const DEFAULT: Appearance = { theme: "system" };

/** Reads a stored value, falling back to the default for anything missing or unknown. */
export function parseAppearance(raw: string | null): Appearance {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (typeof value !== "object" || value === null) return DEFAULT;
    const { theme } = value as Record<string, unknown>;
    return { theme: THEMES.includes(theme as Theme) ? (theme as Theme) : DEFAULT.theme };
  } catch {
    return DEFAULT;
  }
}

/** Whether the page should be dark for a theme, given what the system prefers. */
export function isDark(theme: Theme, systemDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && systemDark);
}

function readStorage(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT;
  }
}

const darkQuery = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
let current: Appearance = readStorage();
const listeners = new Set<() => void>();

/** The canvas behind the app (--canvas in semantic.css), which the browser chrome takes on. */
const THEME_COLORS = { light: "#f3f3f1", dark: "#0d0e10" };

function apply() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = isDark(current.theme, darkQuery?.matches ?? false);
  root.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[dark ? "dark" : "light"]);
}

// Follow the system when it switches while the app is open
darkQuery?.addEventListener("change", apply);
apply();

export function setAppearance(change: Partial<Appearance>) {
  current = { ...current, ...change };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable (private mode): the choice lasts until reload
  }
  apply();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, () => current);
}
