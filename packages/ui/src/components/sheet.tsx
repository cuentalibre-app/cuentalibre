import type { ComponentProps } from "react";
import { Dialog as Primitive } from "radix-ui";
import { cn } from "../lib/cn";
import { useDragToDismiss, useMergedRefs } from "../lib/drag-to-dismiss";
import { ModalCloseButton, ModalHandle, modalOverlayClass, modalPanelClass, modalTitleClass } from "./dialog";

export const Sheet = Primitive.Root;
export const SheetTrigger = Primitive.Trigger;
export const SheetClose = Primitive.Close;

/**
 * Panel that slides up from the bottom of a phone screen, with the same look as a dialog:
 * grab handle, title and round close button. Scrolls on its own when its content is taller than the screen,
 * and a finger dragging it down closes it.
 */
export function SheetContent({
  title,
  className,
  children,
  ref,
  ...props
}: ComponentProps<typeof Primitive.Content> & { title: string }) {
  const panelRef = useMergedRefs(ref, useDragToDismiss<HTMLDivElement>());
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={modalOverlayClass} />
      <Primitive.Content
        ref={panelRef}
        aria-describedby={undefined}
        className={cn(
          modalPanelClass,
          "fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] max-h-[85dvh] data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in",
          className,
        )}
        {...props}
      >
        <ModalHandle className="mt-2.5" />
        <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-3.5 pb-2">
          <Primitive.Title className={modalTitleClass}>{title}</Primitive.Title>
          <ModalCloseButton />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">{children}</div>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
