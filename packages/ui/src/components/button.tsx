import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary font-semibold text-primary-foreground hover:bg-primary-hover",
        secondary: "border border-input bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-accent",
        destructive: "bg-destructive font-semibold text-destructive-foreground hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-base",
        md: "h-10 px-4 text-base",
        lg: "h-11 px-4 text-base", // default desktop size (44px)
        xl: "h-13 rounded-xl px-5 text-md", // primary mobile actions (52px)
        icon: "size-11 rounded-full border border-border",
      },
    },
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
