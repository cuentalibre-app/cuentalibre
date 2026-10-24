import { useEffect, useState } from "react";

const STORAGE_KEY = "cuentalibre:nav-groups-open";

function readStored(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * Whether a sidebar group is expanded, remembered per browser once the user toggles it.
 * Until then it falls back to `defaultOpen`.
 */
export function useNavGroupOpen(key: string, defaultOpen: boolean) {
  const [open, setOpen] = useState(() => readStored()[key] ?? defaultOpen);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), [key]: open }));
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the toggle still works
    }
  }, [key, open, touched]);

  const toggle = () => {
    setTouched(true);
    setOpen((o) => !o);
  };

  return [open, toggle] as const;
}
