import type { ComponentProps } from "react";
import { MAX_DATE, MIN_DATE } from "@cuentalibre/core";
import { cn } from "../lib/cn";

const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground hover:border-muted-strong focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 aria-invalid:border-destructive";

export function Input({ className, ...props }: ComponentProps<"input">) {
  // Without bounds browsers let the year run to six digits (20269-01-21)
  const bounds = props.type === "date" ? { min: MIN_DATE, max: MAX_DATE } : undefined;
  // Browsers draw a password's dots at text size, too small to count: larger and spaced out
  const dots =
    "[&[type=password]:not(:placeholder-shown)]:text-xl [&[type=password]:not(:placeholder-shown)]:tracking-[0.2em]";
  return <input className={cn(fieldClass, "h-10", dots, className)} {...bounds} {...props} />;
}

/** A search box: magnifier, then the text. Same height and border as any input. */
export function SearchField({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <label
      className={cn(
        "flex h-10 min-w-0 cursor-text items-center gap-2 rounded-lg border border-input bg-background px-3 text-muted-foreground transition-colors duration-150 focus-within:border-ring focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:border-muted-strong",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </label>
  );
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(fieldClass, "resize-y py-2.5", className)} {...props} />;
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
