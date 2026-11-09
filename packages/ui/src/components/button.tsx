import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * The one clickable control. Pick a variant for its weight and a size for where it sits:
 * - default (40px) next to inputs and selects, in page headers, toolbars and dialog footers;
 * - `sm` (32px) inside a card or a row, such as "Ver todas";
 * - `xl` (52px) for the main action at the foot of a phone screen;
 * - `icon` / `icon-sm` for a button that is only an icon (give it an aria-label).
 * `chip` is a small pill that toggles (aria-pressed) or picks a preset; `link` is inline text.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap no-underline transition-[color,background-color,border-color,opacity,scale] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary font-semibold text-primary-foreground hover:bg-primary-hover",
        secondary: "border border-input bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-accent",
        destructive: "bg-destructive font-semibold text-destructive-foreground hover:opacity-90",
        chip: "border border-input bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary",
        link: "text-primary hover:text-primary-hover hover:underline underline-offset-2 active:scale-100",
      },
      size: {
        sm: "h-8 px-3 text-base",
        lg: "h-10 px-4 text-base", // default (40px), the height of inputs and selects
        xl: "h-13 rounded-xl px-5 text-md", // primary mobile actions (52px)
        icon: "size-10 px-0",
        "icon-sm": "size-8 px-0 pointer-coarse:size-10 text-muted-foreground hover:text-foreground [&_svg]:size-4",
      },
    },
    compoundVariants: [
      // Chips are pills a notch smaller than a button, whatever the size
      { variant: "chip", class: "h-8 rounded-full px-3 text-sm [&_svg]:size-4" },
      // Links flow with the text around them
      { variant: "link", class: "inline h-auto px-0 text-[length:inherit] whitespace-normal" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "lg",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
