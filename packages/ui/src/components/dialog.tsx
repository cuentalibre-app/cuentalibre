import type { ComponentProps } from "react";
import { Dialog as Primitive } from "radix-ui";
import { cn } from "../lib/cn";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

/** Centered panel over a dimmed page; on phones it fills the width and scrolls. */
export function DialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/50" />
      <Primitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 animate-fade-in flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-popover outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          aria-label="Cerrar"
          className="absolute top-4 right-4 flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn("m-0 pr-10 text-lg font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className={cn("m-0 text-sm text-muted-foreground", className)} {...props} />;
}

/** Bare pieces for a dialog that places itself, such as a step of a tour pointing at an element. */
export const DialogPortal = Primitive.Portal;
export const DialogPanel = Primitive.Content;
