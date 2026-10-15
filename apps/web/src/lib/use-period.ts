import { useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router";
import { defaultPeriod, parsePeriod, periodKey, type Period } from "@fiscalia/core";

const PARAM = "periodo";
const STORAGE_KEY = "fiscalia:period";

/*
 * The selected period is shared by every page, so picking 2026 on the home page carries over to
 * the invoice lists and back. It lives in a module store (mirrored to sessionStorage so it survives
 * reloads in the tab) and in the URL (?periodo=2026-T3) so a link opens on the same period.
 */
let stored: string | null = readStorage();
const listeners = new Set<() => void>();

function readStorage(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(key: string) {
  if (key === stored) return;
  stored = key;
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Storage unavailable (private mode): the in-memory value still carries across pages
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePeriod(today: Date): [Period, (period: Period) => void] {
  const [params, setParams] = useSearchParams();
  const shared = useSyncExternalStore(subscribe, () => stored);
  const fromUrl = parsePeriod(params.get(PARAM) ?? "");
  const period = fromUrl ?? parsePeriod(shared ?? "") ?? defaultPeriod(today);

  // A link or back/forward navigation with ?periodo wins and becomes the shared period
  const urlKey = fromUrl ? periodKey(fromUrl) : null;
  useEffect(() => {
    if (urlKey) store(urlKey);
  }, [urlKey]);

  const setPeriod = (next: Period) => {
    const key = periodKey(next);
    store(key);
    setParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.set(PARAM, key);
        return updated;
      },
      { replace: true },
    );
  };

  return [period, setPeriod];
}
