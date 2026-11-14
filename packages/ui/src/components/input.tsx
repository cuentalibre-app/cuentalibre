import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { MAX_DATE, MIN_DATE } from "@cuentalibre/core";
import { cn } from "../lib/cn";
import { isTouchScreen } from "../lib/touch-keyboard";

const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground hover:border-muted-strong focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 aria-invalid:border-destructive";

/**
 * `autoFocus` only where a keyboard is already at hand: on a phone it would raise the on-screen
 * keyboard over a page or sheet that has just opened, before the user has even read it.
 */
const autoFocusOnDesktop = (autoFocus: boolean | undefined) => autoFocus && !isTouchScreen();

export function Input({ className, autoFocus, ...props }: ComponentProps<"input">) {
  // Without bounds browsers let the year run to six digits (20269-01-21)
  const bounds = props.type === "date" ? { min: MIN_DATE, max: MAX_DATE } : undefined;
  // Browsers draw a password's dots at text size, too small to count: larger and spaced out
  const dots =
    "[&[type=password]:not(:placeholder-shown)]:text-xl [&[type=password]:not(:placeholder-shown)]:tracking-[0.2em]";
  return (
    <input
      className={cn(fieldClass, "h-10", dots, className)}
      autoFocus={autoFocusOnDesktop(autoFocus)}
      {...bounds}
      {...props}
    />
  );
}

/** A search box: magnifier, then the text. Same height and border as any input. */
export function SearchField({ className, autoFocus, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <label
      className={cn(
        "flex h-10 min-w-0 cursor-text items-center gap-2 rounded-lg border border-input bg-background px-3 text-muted-foreground transition-colors duration-150 focus-within:border-ring focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:border-muted-strong",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        autoFocus={autoFocusOnDesktop(autoFocus)}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </label>
  );
}

interface TextareaProps extends ComponentProps<"textarea"> {
  /** Grows with its text instead of scrolling, from `rows` lines up. */
  autoGrow?: boolean;
}

export function Textarea({ className, rows = 3, autoGrow = false, autoFocus, ref, ...props }: TextareaProps) {
  const own = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = own.current;
    if (!autoGrow || !el) return;
    const fit = () => {
      el.style.height = "auto";
      // scrollHeight leaves out the border, which a border-box height includes
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    // The same text wraps onto more lines when the field narrows (rotating the phone, opening the sidebar)
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoGrow, props.value]);

  return (
    <textarea
      ref={(el) => {
        own.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      rows={rows}
      autoFocus={autoFocusOnDesktop(autoFocus)}
      className={cn(fieldClass, autoGrow ? "resize-none overflow-hidden" : "resize-y", "py-2.5", className)}
      {...props}
    />
  );
}

export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("size-[18px] shrink-0 cursor-pointer rounded-xs accent-primary", className)}
      {...props}
    />
  );
}
