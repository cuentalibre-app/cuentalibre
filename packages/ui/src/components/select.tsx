import type { ComponentProps } from "react";
import { Select as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;

export function SelectTrigger({ className, children, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        "flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 font-semibold text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </Primitive.Trigger>
  );
}

/** Dropdown list; scrolls vertically when it has more options than fit. */
export function SelectContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        position="popper"
        sideOffset={6}
        className={cn(
          "z-50 max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-popover",
          className,
        )}
        {...props}
      >
        <Primitive.Viewport>{children}</Primitive.Viewport>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "flex h-10 cursor-pointer items-center rounded-md px-3 outline-none select-none data-[highlighted]:bg-muted data-[state=checked]:bg-accent data-[state=checked]:font-semibold",
        className,
      )}
      {...props}
    >
      <Primitive.ItemText>{children}</Primitive.ItemText>
    </Primitive.Item>
  );
}
