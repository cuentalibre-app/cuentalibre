import type { ComponentProps } from "react";
import { Dialog as Primitive } from "radix-ui";
import { cn } from "../lib/cn";
import { useDragToDismiss, useMergedRefs } from "../lib/drag-to-dismiss";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

/*
 * Dialogs and bottom sheets share one look: a frosted panel over a dimmed, blurred page,
 * the same corner radius, title and round close button. On phones both rise from the bottom.
 */

export const modalOverlayClass =
  "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in";

export const modalPanelClass =
  "z-50 flex flex-col rounded-3xl border border-glass-edge bg-modal text-popover-foreground shadow-floating backdrop-blur-2xl backdrop-saturate-150 outline-none";

export const modalTitleClass = "m-0 text-title font-semibold tracking-tight";

/** Grab handle at the top of a panel that rises from the bottom of a phone screen. */
export function ModalHandle({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("mx-auto h-1 w-9 shrink-0 rounded-full bg-muted-strong", className)} />;
}

/** The round close button in the corner of every dialog and sheet. */
export function ModalCloseButton({ className }: { className?: string }) {
  return (
    <Primitive.Close
      aria-label="Cerrar"
      className={cn(
        "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-foreground/8 text-foreground transition-[background-color,scale] duration-150 hover:bg-foreground/12 active:scale-90",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    </Primitive.Close>
  );
}

/** Below `sm` a dialog is a sheet from the bottom, and slides away like one; above, it stays centered. */
const isSheetLayout = () => window.matchMedia("(width < 40rem)").matches;

/**
 * Centered panel on larger screens; on phones it rises from the bottom like a sheet, scrolls,
 * and a finger dragging it down closes it.
 */
export function DialogContent({ className, children, ref, ...props }: ComponentProps<typeof Primitive.Content>) {
  const panelRef = useMergedRefs(ref, useDragToDismiss<HTMLDivElement>(isSheetLayout));
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={modalOverlayClass} />
      <Primitive.Content
        ref={panelRef}
        className={cn(
          modalPanelClass,
          "fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] mx-auto max-h-[85dvh] max-w-xl gap-4 overflow-y-auto overscroll-contain px-6 pt-8 pb-6 data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-2rem)] sm:m-0 sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:pt-6 sm:data-[state=closed]:animate-fade-out sm:data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      >
        <ModalHandle className="absolute top-2.5 left-1/2 -translate-x-1/2 sm:hidden" />
        {children}
        <ModalCloseButton className="absolute top-8 right-5 sm:top-6" />
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn(modalTitleClass, "min-h-10 content-center pr-12", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className={cn("m-0 -mt-2 text-sm text-muted-foreground", className)} {...props} />;
}

/** The dialog's actions: right-aligned, the main one last; full width and stacked on phones. */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2.5 pt-1 *:w-full sm:flex-row sm:flex-wrap sm:justify-end sm:*:w-auto",
        className,
      )}
      {...props}
    />
  );
}

/** Bare pieces for a dialog that places itself, such as a step of a tour pointing at an element. */
export const DialogPortal = Primitive.Portal;
export const DialogPanel = Primitive.Content;
