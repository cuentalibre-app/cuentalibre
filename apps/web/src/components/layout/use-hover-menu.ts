import { useEffect, useRef, useState, type PointerEvent } from "react";

const OPEN_DELAY = 150;
const CLOSE_DELAY = 200;

/**
 * Controlled state for a dropdown that also opens after the mouse rests on its trigger.
 * A hover-opened menu closes when the mouse leaves trigger and menu; clicking pins it open,
 * and a menu opened by click or keyboard behaves as usual.
 */
export function useHoverMenu() {
  const [open, setOpen] = useState(false);
  const openedByHover = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function schedule(next: boolean, delay: number) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      // Left set while closing, so the close doesn't move focus back to the trigger
      if (next) openedByHover.current = true;
      setOpen(next);
    }, delay);
  }

  // Touch and pen keep the regular tap-to-open behaviour
  const hoverProps = {
    onPointerEnter(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      if (open) window.clearTimeout(timer.current);
      else schedule(true, OPEN_DELAY);
    },
    onPointerLeave(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      if (open && openedByHover.current) schedule(false, CLOSE_DELAY);
      else window.clearTimeout(timer.current);
    },
  };

  return {
    open,
    onOpenChange(next: boolean) {
      window.clearTimeout(timer.current);
      openedByHover.current = false;
      setOpen(next);
    },
    triggerProps: {
      ...hoverProps,
      ref: triggerRef,
      onPointerDown(e: PointerEvent) {
        if (!open || !openedByHover.current) return;
        // Clicking a menu the hover already opened pins it instead of toggling it shut
        e.preventDefault();
        openedByHover.current = false;
      },
    },
    contentProps: {
      ...hoverProps,
      // The trigger handles its own presses; don't treat them as a click outside the menu
      onPointerDownOutside(e: Event) {
        if (e.target instanceof Node && triggerRef.current?.contains(e.target)) e.preventDefault();
      },
      // Don't pull focus into a menu that only opened because the mouse passed by
      onOpenAutoFocus: (e: Event) => openedByHover.current && e.preventDefault(),
      onCloseAutoFocus: (e: Event) => openedByHover.current && e.preventDefault(),
    },
  };
}
