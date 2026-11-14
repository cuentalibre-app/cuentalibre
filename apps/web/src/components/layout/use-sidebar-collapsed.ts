import { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

const STORAGE_KEY = "cuentalibre:sidebar-collapsed";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Whether the desktop sidebar is shrunk to its icon rail, remembered per browser and toggled with ⌘B / Ctrl+B.
 * Below the xl breakpoint the rail is forced so the content keeps its wide layout; `canExpand` is then false.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readStored);
  const canExpand = useMediaQuery("(min-width: 80rem)");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the toggle still works
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  useEffect(() => {
    if (!canExpand) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, canExpand]);

  return { collapsed: collapsed || !canExpand, canExpand, toggle };
}
