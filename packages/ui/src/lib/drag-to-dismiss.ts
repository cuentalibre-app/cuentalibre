import { useCallback, useMemo, useRef, type Ref } from "react";

/** Pixels a finger moves before the gesture counts as a drag rather than a tap. */
const SLOP = 6;
/** A flick this fast (px/ms) dismisses however short it was. */
const FLICK = 0.5;
/** Dragged past this share of its height, the panel goes on release. */
const DISTANCE = 0.25;

/**
 * Lets a finger drag a panel down and let go to close it, as a phone's own sheets do. Returns a
 * callback ref for the panel. The drag starts only when what's under the finger isn't scrolled,
 * so a scrolled list scrolls back up first; a short drag springs the panel back.
 *
 * It closes by sending Escape, which every Radix dialog, sheet and menu already listens for, so
 * the panel doesn't need to know who controls it. `when` is read as the drag starts, to limit the
 * gesture to phone layouts (a centered dialog on a tablet doesn't slide).
 */
export function useDragToDismiss<T extends HTMLElement>(when: () => boolean = () => true) {
  const whenRef = useRef(when);
  whenRef.current = when;

  return useCallback((el: T | null) => {
    if (!el) return;
    let state: "idle" | "pending" | "drag" | "scroll" = "idle";
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let speed = 0;
    let offset = 0;

    const scrolled = (target: EventTarget | null) => {
      for (let node = target as HTMLElement | null; node && node !== el.parentElement; node = node.parentElement)
        if (node.scrollTop > 0) return true;
      return false;
    };

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch || !whenRef.current()) {
        state = "idle";
        return;
      }
      startX = touch.clientX;
      startY = lastY = touch.clientY;
      lastT = e.timeStamp;
      speed = offset = 0;
      state = scrolled(e.target) ? "scroll" : "pending";
    };

    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || state === "idle" || state === "scroll") return;
      const dy = touch.clientY - startY;
      if (state === "pending") {
        const dx = touch.clientX - startX;
        if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return;
        // Upwards or sideways is the content's to handle (scroll, a horizontal strip)
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          state = "scroll";
          return;
        }
        state = "drag";
        // The entry animation holds the transform; drop it so the finger can move the panel
        el.style.animation = "none";
        el.style.transition = "none";
      }
      e.preventDefault();
      const dt = e.timeStamp - lastT;
      if (dt > 0) speed = (touch.clientY - lastY) / dt;
      lastY = touch.clientY;
      lastT = e.timeStamp;
      offset = Math.max(0, dy);
      el.style.transform = `translateY(${offset}px)`;
    };

    const onEnd = () => {
      if (state !== "drag") {
        state = "idle";
        return;
      }
      state = "idle";
      // The finger lifts over whatever it dragged across; that isn't a tap on it
      const swallow = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 400);

      if (offset > el.offsetHeight * DISTANCE || speed > FLICK) {
        el.style.transition = "transform 180ms ease-in";
        el.style.transform = `translateY(${el.offsetHeight + 24}px)`;
        el.addEventListener(
          "transitionend",
          () => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
          { once: true },
        );
      } else {
        el.style.transition = "transform 260ms var(--ease-out)";
        el.style.transform = "";
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);
}

/** Joins refs, so a component can keep its own while passing the caller's on. */
export function useMergedRefs<T>(...refs: (Ref<T> | undefined)[]) {
  // The refs themselves are the dependencies: a new callback only when one of them changes
  return useMemo(() => mergeRefs(refs), refs);
}

function mergeRefs<T>(refs: (Ref<T> | undefined)[]) {
  return (node: T | null) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
      return undefined;
    });
    return () =>
      cleanups.forEach((cleanup, i) => {
        const ref = refs[i];
        if (typeof cleanup === "function") cleanup();
        else if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      });
  };
}
