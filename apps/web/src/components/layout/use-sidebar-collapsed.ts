import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "fiscalia:sidebar-collapsed";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether the desktop sidebar is shrunk to its icon rail, remembered per browser and toggled with ⌘B / Ctrl+B. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the toggle still works
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return [collapsed, toggle] as const;
}
