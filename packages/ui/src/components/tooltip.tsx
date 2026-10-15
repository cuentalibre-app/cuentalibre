import type { ComponentProps } from "react";
import { Tooltip as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

export const TooltipProvider = Primitive.Provider;
export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;

export function TooltipContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          "popover-motion z-50 flex origin-(--radix-tooltip-content-transform-origin) items-center gap-2 rounded-md bg-foreground px-2.5 py-1.5 text-sm font-medium text-background shadow-popover",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
