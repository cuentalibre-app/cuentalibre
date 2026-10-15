import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("m-0 text-lg font-semibold", className)} {...props} />;
}
