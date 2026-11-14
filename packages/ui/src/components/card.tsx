import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("flex flex-col gap-3 surface p-4 text-card-foreground", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("m-0 text-lg font-semibold tracking-tight lg:text-md", className)} {...props} />;
}
