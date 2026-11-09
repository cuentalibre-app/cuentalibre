import type { ComponentProps } from "react";
import { Select as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;

export function SelectTrigger({ className, children, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        "flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-foreground transition-colors duration-150 outline-none hover:border-muted-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring [&_svg]:shrink-0",
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
          "z-50 max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] origin-(--radix-select-content-transform-origin) popover-motion overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-popover",
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
        "flex h-9 cursor-pointer items-center rounded-md px-3 transition-colors duration-150 outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground data-[highlighted]:bg-muted data-[state=checked]:bg-accent data-[state=checked]:font-semibold",
        className,
      )}
      {...props}
    >
      <Primitive.ItemText>{children}</Primitive.ItemText>
    </Primitive.Item>
  );
}

export const SelectGroup = Primitive.Group;

/** Heading of a group of options; not selectable. */
export function SelectLabel({ className, ...props }: ComponentProps<typeof Primitive.Label>) {
  return (
    <Primitive.Label
      className={cn("px-3 pt-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase", className)}
      {...props}
    />
  );
}

export function SelectSeparator({ className, ...props }: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn("mx-2 my-1.5 h-px bg-divider", className)} {...props} />;
}
