import { useLayoutEffect, useRef } from "react";

/*
 * On a phone, focusing a text field raises the keyboard over half the screen. A dialog or sheet
 * that opens with its first field focused shows up already covered, so on touch screens it opens
 * with the panel focused instead and the keyboard waits for a tap on the field.
 * Mouse and keyboard users keep the focus on the first field, ready to type.
 */

const NOT_TYPED = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"]);

const isTouchScreen = () => window.matchMedia("(pointer: coarse)").matches;

function raisesKeyboard(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return !NOT_TYPED.has(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Moves the focus from a field inside the panel to the panel itself, before the keyboard shows. */
function lowerKeyboard(panel: HTMLElement) {
  if (raisesKeyboard(document.activeElement) && panel.contains(document.activeElement)) {
    panel.focus({ preventScroll: true });
  }
}

/**
 * Wraps a panel's `onOpenAutoFocus`: the caller's handler runs first, then on touch screens
 * the panel keeps the focus rather than the first field.
 */
export function withClosedKeyboard(onOpenAutoFocus?: (event: Event) => void) {
  return (event: Event) => {
    onOpenAutoFocus?.(event);
    if (!isTouchScreen()) return;
    const panel = event.currentTarget as HTMLElement;
    if (!event.defaultPrevented) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
    }
    lowerKeyboard(panel);
  };
}

/**
 * A field with `autoFocus` takes the focus as it mounts, before the panel's `onOpenAutoFocus`
 * (which then never fires). Rendered last inside the panel, this undoes it on touch screens.
 */
export function ClosedKeyboardGuard() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current?.parentElement?.closest<HTMLElement>("[role=dialog]");
    if (panel && isTouchScreen()) lowerKeyboard(panel);
  }, []);
  return <span ref={ref} hidden />;
}
