import type { ComponentProps } from "react";
import { Popover as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverClose = Primitive.Close;

export function PopoverContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          "z-50 origin-(--radix-popover-content-transform-origin) popover-motion rounded-xl border border-border bg-popover text-popover-foreground shadow-popover outline-none",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
