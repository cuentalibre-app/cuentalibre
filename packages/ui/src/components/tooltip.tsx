import { createContext, use, useCallback, useRef, useState, type ComponentProps } from "react";
import { Tooltip as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

export const TooltipProvider = Primitive.Provider;

/* Radix tooltips only open on hover and focus, so a tap on a phone does nothing. These wrappers
   keep that behaviour for the mouse and make a touch or pen tap toggle the tooltip instead. */

const OpenContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

export function Tooltip({ open: openProp, defaultOpen = false, onOpenChange, ...props }: ComponentProps<typeof Primitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  return (
    <OpenContext value={{ open, setOpen }}>
      <Primitive.Root open={open} onOpenChange={setOpen} {...props} />
    </OpenContext>
  );
}

export function TooltipTrigger({ onPointerDown, onPointerLeave, onClick, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  const context = use(OpenContext);
  /** Whether the press in progress is a tap, and whether the tooltip was open when it began. */
  const tap = useRef<{ wasOpen: boolean } | null>(null);
  return (
    <Primitive.Trigger
      {...props}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.pointerType === "mouse") {
          tap.current = null;
          return;
        }
        tap.current = { wasOpen: context?.open ?? false };
        // Skips Radix's handler, which closes the tooltip on any press
        event.preventDefault();
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        // A finger "leaves" the trigger when lifted: that mustn't close what the tap opened
        if (event.pointerType !== "mouse") event.preventDefault();
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!tap.current || !context) return;
        // Skips Radix's handler, which closes the tooltip on click
        event.preventDefault();
        context.setOpen(!tap.current.wasOpen);
        tap.current = null;
      }}
    />
  );
}

export function TooltipContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          "popover-motion z-50 flex origin-(--radix-tooltip-content-transform-origin) items-center gap-2 rounded-md bg-foreground px-2.5 py-1.5 text-sm font-medium text-background shadow-popover",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
