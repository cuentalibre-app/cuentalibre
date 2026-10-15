import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A small group of mutually exclusive toggle buttons (e.g. chart views). */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  // The thumb slides under the selected option; measure it after layout and on resize
  useLayoutEffect(() => {
    const measure = () => {
      const el = buttons.current.get(value);
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    buttons.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [value]);

  return (
    <div role="group" aria-label={label} className={cn("relative flex gap-0.5 rounded-lg bg-muted p-[3px]", className)}>
      {thumb && (
        <span
          aria-hidden="true"
          className="absolute top-[3px] bottom-[3px] left-0 rounded-sm border border-border bg-background transition-[translate,width] duration-300 ease-out"
          style={{ width: thumb.width, translate: `${thumb.left}px 0` }}
        />
      )}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) buttons.current.set(option.value, el);
              else buttons.current.delete(option.value);
            }}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-8 cursor-pointer rounded-sm px-3 text-sm transition-colors duration-200",
              selected ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
              // Until the thumb is measured, the selected option paints its own background
              selected && !thumb && "border border-border bg-background",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
