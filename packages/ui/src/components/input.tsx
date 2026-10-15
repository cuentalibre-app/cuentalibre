import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground hover:border-muted-strong focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 aria-invalid:border-destructive";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-10", className)} {...props} />;
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
