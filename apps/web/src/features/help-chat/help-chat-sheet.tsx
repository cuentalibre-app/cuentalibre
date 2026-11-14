import { Sheet, SheetContent } from "@cuentalibre/ui/components/sheet";
import { HelpChat } from "./help-chat";

/** The help chat on phones: a tall sheet over the page, opened from "Más". */
export function HelpChatSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The chat scrolls on its own and keeps its composer at the bottom, so the sheet's body only frames it */}
      <SheetContent title="Ayuda" className="h-[85dvh]" bodyClassName="flex flex-col overflow-hidden px-2 pb-0">
        <HelpChat />
      </SheetContent>
    </Sheet>
  );
}
