import { useEffect, useRef, useState } from "react";
import { formatEUR } from "@fiscalia/ui/lib/format";

const DURATION = 500;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Eases from the previous value to `value` whenever it changes. Starts at `value` on mount. */
export function useTweenedNumber(value: number) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value || prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - (1 - t) ** 4; // easeOutQuart
      shownRef.current = from + (value - from) * eased;
      setShown(shownRef.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return shown;
}

/** A euro amount that counts to its new value. Screen readers only get the final value. */
export function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const shown = useTweenedNumber(value);
  return (
    <span className={className}>
      <span aria-hidden="true">{formatEUR(shown)}</span>
      <span className="sr-only">{formatEUR(value)}</span>
    </span>
  );
}
