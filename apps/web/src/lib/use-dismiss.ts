import { useEffect, useRef, type RefObject } from "react";

/**
 * While `active`, calls `onDismiss` when the pointer goes down outside `ref`'s element or Escape is pressed:
 * how a chart lets go of the month it highlights.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
  // The latest callback, without re-subscribing on every render
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!active) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) dismiss.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss.current();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, active]);
}
